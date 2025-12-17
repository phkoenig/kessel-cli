-- Supabase Vault Functions für Secrets Management
-- Diese Funktionen wrappen die native vault.create_secret() Funktion
-- für einfachere Verwendung über RPC

-- Prüfe ob Vault Extension installiert ist
CREATE EXTENSION IF NOT EXISTS vault;

-- Funktion: insert_secret (erstellt oder aktualisiert ein Secret)
CREATE OR REPLACE FUNCTION insert_secret(name TEXT, secret TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_id UUID;
  existing_secret_id UUID;
BEGIN
  -- Prüfe ob Secret bereits existiert
  SELECT id INTO existing_secret_id
  FROM vault.decrypted_secrets
  WHERE decrypted_secrets.name = insert_secret.name
  LIMIT 1;
  
  IF existing_secret_id IS NOT NULL THEN
    -- Aktualisiere existierendes Secret
    PERFORM vault.update_secret(
      existing_secret_id,
      secret,
      name,
      'Updated via insert_secret function'
    );
    RETURN existing_secret_id;
  ELSE
    -- Erstelle neues Secret
    SELECT vault.create_secret(secret, name, 'Created via insert_secret function') INTO secret_id;
    RETURN secret_id;
  END IF;
END;
$$;

-- Funktion: read_secret (liest ein Secret nach Name)
CREATE OR REPLACE FUNCTION read_secret(secret_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_value TEXT;
BEGIN
  SELECT decrypted_secrets.decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE decrypted_secrets.name = read_secret.secret_name
  LIMIT 1;
  
  IF secret_value IS NULL THEN
    RAISE EXCEPTION 'Secret not found: %', secret_name;
  END IF;
  
  RETURN secret_value;
END;
$$;

-- Funktion: delete_secret (löscht ein Secret nach Name)
CREATE OR REPLACE FUNCTION delete_secret(secret_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_id UUID;
BEGIN
  -- Finde Secret ID
  SELECT id INTO secret_id
  FROM vault.decrypted_secrets
  WHERE decrypted_secrets.name = delete_secret.secret_name
  LIMIT 1;
  
  IF secret_id IS NULL THEN
    RAISE EXCEPTION 'Secret not found: %', secret_name;
  END IF;
  
  -- Lösche Secret
  PERFORM vault.delete_secret(secret_id);
  
  RETURN TRUE;
END;
$$;

-- Funktion: get_all_secrets_for_env (gibt alle Secrets als JSONB zurück)
CREATE OR REPLACE FUNCTION get_all_secrets_for_env()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secrets_json JSONB;
BEGIN
  -- Erstelle JSONB-Objekt mit allen Secrets
  SELECT jsonb_object_agg(name, decrypted_secret)
  INTO secrets_json
  FROM vault.decrypted_secrets;
  
  RETURN COALESCE(secrets_json, '{}'::JSONB);
END;
$$;

-- Gewähre Execute-Rechte für authenticated und anon roles
GRANT EXECUTE ON FUNCTION insert_secret(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION read_secret(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION delete_secret(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_all_secrets_for_env() TO authenticated, anon;

-- Kommentare für Dokumentation
COMMENT ON FUNCTION insert_secret IS 'Erstellt oder aktualisiert ein Secret im Vault';
COMMENT ON FUNCTION read_secret IS 'Liest ein Secret aus dem Vault nach Name';
COMMENT ON FUNCTION delete_secret IS 'Löscht ein Secret aus dem Vault nach Name';
COMMENT ON FUNCTION get_all_secrets_for_env IS 'Gibt alle Secrets als JSONB-Objekt zurück';

