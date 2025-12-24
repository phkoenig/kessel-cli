import { execSync } from "child_process"
import { debugLog, debugError, maskSecret } from "./debug.js"
import pg from "pg"
const { Client } = pg

/**
 * Direkter SQL-Fallback für Secrets (umgeht PostgREST Schema-Cache)
 * @param {string} supabaseUrl - Supabase URL
 * @param {string} serviceRoleKey - Service Role Key
 * @param {string|null} secretName - Name des Secrets (optional)
 * @param {boolean} verbose - Verbose-Modus
 * @returns {Promise<{data: any, error: null}|{data: null, error: Error}>}
 */
export async function getSecretsViaDirectSql(supabaseUrl, serviceRoleKey, secretName = null, verbose = false) {
  debugLog("Direkter SQL-Fallback: Rufe Vault-Funktion direkt über SQL auf", { secretName }, verbose)
  
  try {
    if (secretName) {
      // Einzelnes Secret
      const url = `${supabaseUrl}/rest/v1/rpc/read_secret`
      debugLog(`HTTP Request URL: ${url}`, null, verbose)
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ secret_name: secretName })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        debugLog(`HTTP Response Error: ${response.status} - ${errorText}`, null, verbose)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
      
      const data = await response.text()
      debugLog(`HTTP Response Data: ${data.substring(0, 100)}`, null, verbose)
      return { data: data, error: null }
    } else {
      // Alle Secrets
      const url = `${supabaseUrl}/rest/v1/rpc/get_all_secrets_for_env`
      debugLog(`HTTP Request URL: ${url}`, null, verbose)
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({})
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        debugLog(`HTTP Response Error: ${response.status} - ${errorText}`, null, verbose)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
      
      const data = await response.json()
      debugLog(`HTTP Response Data`, typeof data === 'object' ? Object.keys(data) : data, verbose)
      return { data: data, error: null }
    }
  } catch (error) {
    debugError(error, verbose)
    throw error
  }
}

/**
 * HTTP-Fallback für RPC-Calls (wenn Schema-Cache Problem)
 * @param {string} supabaseUrl - Supabase URL
 * @param {string} serviceRoleKey - Service Role Key
 * @param {string} functionName - RPC-Funktionsname
 * @param {Object} params - Parameter-Objekt
 * @param {boolean} verbose - Verbose-Modus
 * @returns {Promise<{data: any, error: null}|{data: null, error: Error}>}
 */
export async function callRpcViaHttp(supabaseUrl, serviceRoleKey, functionName, params = {}, verbose = false, schema = null) {
  debugLog(`HTTP-Fallback: Rufe ${functionName} über PostgREST auf`, { url: supabaseUrl, function: functionName, schema }, verbose)
  
  try {
    const url = `${supabaseUrl}/rest/v1/rpc/${functionName}`
    debugLog(`HTTP Request URL: ${url}`, null, verbose)
    
    const headers = {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Prefer': 'return=representation'
    }
    
    // Schema-Prefix für Funktionen in anderen Schemas (z.B. infra)
    if (schema) {
      headers['Content-Profile'] = schema
    }
    
    debugLog(`HTTP Request Headers`, { 
      'Content-Type': headers['Content-Type'],
      'apikey': maskSecret(serviceRoleKey),
      'Authorization': `Bearer ${maskSecret(serviceRoleKey)}`,
      'Prefer': headers['Prefer']
    }, verbose)
    
    debugLog(`HTTP Request Body`, params, verbose)
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(params)
    })
    
    debugLog(`HTTP Response Status: ${response.status} ${response.statusText}`, null, verbose)
    
    if (!response.ok) {
      const errorText = await response.text()
      debugLog(`HTTP Response Error Body`, errorText, verbose)
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
    
    const data = await response.json()
    debugLog(`HTTP Response Data`, typeof data === 'object' ? Object.keys(data) : data, verbose)
    
    return { data, error: null }
  } catch (error) {
    debugError(error, verbose)
    throw error
  }
}

/**
 * Liste Supabase-Projekte auf (via CLI)
 * @param {Function} debugFn - Debug-Funktion
 * @returns {Promise<Array>} Array von Projekt-Objekten
 */
export async function listSupabaseProjects(debugFn) {
  try {
    let output
    try {
      output = execSync("supabase projects list", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env,
        shell: true,
      })
    } catch (execError) {
      if (execError.stdout) {
        output = execError.stdout.toString("utf-8")
      } else if (execError.stderr) {
        output = execError.stderr.toString("utf-8")
      } else {
        if (debugFn) {
          debugFn(`execSync Error: ${execError.message}`)
        }
        throw execError
      }
    }
    
    const normalizedOutput = output.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const lines = normalizedOutput.split("\n")
    const projects = []
    let headerFound = false
    let inTable = false

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (trimmed.includes("LINKED") && trimmed.includes("ORG ID")) {
        headerFound = true
        continue
      }

      if (headerFound && (trimmed.includes("─") || trimmed.includes("┼")) && trimmed.length > 50) {
        inTable = true
        continue
      }

      // Unterstütze beide Pipe-Varianten: │ (Box-Drawing) und | (ASCII)
      if ((inTable || headerFound) && (trimmed.includes("│") || trimmed.includes("|")) && !trimmed.includes("LINKED")) {
        const parts = trimmed.split(/[│|]/).map((p) => p.trim())
        if (parts.length >= 4) {
          const referenceId = parts[2] || ""
          const name = parts[3] || ""
          if (referenceId && referenceId.length > 0 && !referenceId.includes("zedhieyjlfhygsfxzbze")) {
            projects.push({
              id: referenceId,
              project_ref: referenceId,
              name: name,
              org_id: parts[1] || "",
              region: parts[4] || "",
            })
          }
        }
      }
    }

    return projects
  } catch (error) {
    if (debugFn) {
      debugFn(`Fehler beim Abrufen der Projekte: ${error.message}`)
    }
    return []
  }
}

/**
 * Versuche Anon Key automatisch abzurufen (via Supabase CLI)
 * @param {string} projectRef - Project Reference ID
 * @param {Function} debugFn - Debug-Funktion
 * @returns {Promise<string|null>} Anon Key oder null
 */
export async function fetchAnonKeyFromSupabase(projectRef, debugFn) {
  try {
    let output
    try {
      output = execSync(
        `supabase projects api-keys --project-ref ${projectRef} --output json`,
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          shell: true,
        }
      )
    } catch (execError) {
      if (execError.stdout) {
        output = execError.stdout.toString("utf-8")
      } else if (execError.stderr) {
        output = execError.stderr.toString("utf-8")
      } else {
        if (debugFn) {
          debugFn(`⚠️  CLI-Fehler: ${execError.message}`)
        }
        return null
      }
    }
    
    const trimmedOutput = output.trim()
    if (!trimmedOutput || trimmedOutput.length === 0) {
      return null
    }
    
    let keys
    try {
      keys = JSON.parse(trimmedOutput)
    } catch (parseError) {
      // Fallback: Tabellen-Format parsen
      const lines = trimmedOutput.split("\n")
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.includes("anon") || trimmed.includes("public")) {
          // Unterstütze beide Pipe-Varianten: │ (Box-Drawing) und | (ASCII)
          const parts = trimmed.split(/[│|]/).map((p) => p.trim())
          if (parts.length >= 2) {
            const keyName = parts[0].toLowerCase()
            const keyValue = parts[1]
            if ((keyName.includes("anon") || keyName.includes("public")) && keyValue && keyValue.length > 20) {
              return keyValue
            }
          }
        }
      }
      return null
    }
    
    if (Array.isArray(keys)) {
      let anonKey = keys.find((k) => {
        const name = (k.name || "").toLowerCase()
        const id = (k.id || "").toLowerCase()
        return name === "anon" || id === "anon"
      })
      
      if (!anonKey) {
        anonKey = keys.find((k) => {
          const type = (k.type || "").toLowerCase()
          return type === "publishable"
        })
      }
      
      if (anonKey && anonKey.api_key) {
        return anonKey.api_key
      }
    } else if (keys.anon_key || keys.anon || keys.public || keys.api_key) {
      return keys.anon_key || keys.anon || keys.public || keys.api_key
    }
    
    return null
  } catch (error) {
    if (debugFn) {
      debugFn(`⚠️  Fehler beim Abrufen des Anon Keys: ${error.message}`)
    }
    return null
  }
}

/**
 * Versuche Service Role Key automatisch abzurufen (via Supabase CLI Management API)
 * @param {string} projectRef - Project Reference ID
 * @param {Function} debugFn - Debug-Funktion
 * @returns {Promise<string|null>} Service Role Key oder null
 */
export async function fetchServiceRoleKeyFromSupabase(projectRef, debugFn) {
  try {
    let output
    try {
      output = execSync(
        `supabase projects api-keys --project-ref ${projectRef}`,
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          shell: true,
        }
      )
    } catch (execError) {
      if (execError.stdout) {
        output = execError.stdout.toString("utf-8")
      } else if (execError.stderr) {
        output = execError.stderr.toString("utf-8")
      } else {
        return null
      }
    }
    
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '').replace(/\u001b\[\d+m/g, '')
    const lines = cleanOutput.split("\n")
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.includes("service_role")) {
        // Unterstütze beide Pipe-Varianten: │ (Box-Drawing) und | (ASCII)
        const parts = trimmed.split(/[│|]/).map((p) => p.trim())
        if (parts.length >= 2) {
          const keyName = parts[0].toLowerCase()
          const keyValue = parts[1].replace(/\x1b\[[0-9;]*m/g, '').trim()
          if (keyName.includes("service_role") && keyValue && keyValue.length > 20) {
            return keyValue
          }
        }
      }
    }
    
    return null
  } catch (error) {
    if (debugFn) {
      debugFn(`❌ Fehler beim Abrufen von Service Role Key: ${error.message}`)
    }
    return null
  }
}

/**
 * Versuche Service Role Key aus dem Vault der INFRA-DB zu holen
 * @param {string} infraDbUrl - INFRA-DB URL
 * @param {string} tempServiceRoleKey - Temporärer Service Role Key (z.B. aus Profil) für Vault-Zugriff
 * @param {Function} debugFn - Debug-Funktion
 * @returns {Promise<string|null>} Service Role Key oder null
 */
export async function fetchServiceRoleKeyFromVault(infraDbUrl, tempServiceRoleKey, debugFn) {
  if (!tempServiceRoleKey) {
    if (debugFn) {
      debugFn("⚠️  Kein temporärer Service Role Key für Vault-Zugriff vorhanden")
    }
    return null
  }

  try {
    if (debugFn) {
      debugFn(`🔍 Versuche SERVICE_ROLE_KEY aus Vault zu holen...`)
    }

    // Versuche über RPC-Funktion
    const { callRpcViaHttp } = await import("./supabase.js")
    const result = await callRpcViaHttp(
      infraDbUrl,
      tempServiceRoleKey,
      "read_secret",
      { secret_name: "SERVICE_ROLE_KEY" },
      false // verbose
    )

    if (result.error) {
      if (debugFn) {
        debugFn(`⚠️  Vault-Zugriff fehlgeschlagen: ${result.error.message}`)
      }
      return null
    }

    if (result.data && typeof result.data === 'string' && result.data.length > 20) {
      if (debugFn) {
        debugFn(`✅ SERVICE_ROLE_KEY aus Vault geholt`)
      }
      return result.data
    }

    return null
  } catch (error) {
    if (debugFn) {
      debugFn(`⚠️  Fehler beim Abrufen aus Vault: ${error.message}`)
    }
    return null
  }
}

/**
 * Versuche DB-Passwort aus dem Vault der INFRA-DB zu holen
 * @param {string} infraDbUrl - INFRA-DB URL
 * @param {string} tempServiceRoleKey - Temporärer Service Role Key (z.B. aus Profil) für Vault-Zugriff
 * @param {Function} debugFn - Debug-Funktion
 * @returns {Promise<string|null>} DB-Passwort oder null
 */
export async function fetchDbPasswordFromVault(infraDbUrl, tempServiceRoleKey, debugFn) {
  if (!tempServiceRoleKey) {
    if (debugFn) {
      debugFn("⚠️  Kein temporärer Service Role Key für Vault-Zugriff vorhanden")
    }
    return null
  }

  try {
    if (debugFn) {
      debugFn(`🔍 Versuche SUPABASE_DB_PASSWORD aus Vault zu holen...`)
    }

    // Versuche über RPC-Funktion
    const { callRpcViaHttp } = await import("./supabase.js")
    const result = await callRpcViaHttp(
      infraDbUrl,
      tempServiceRoleKey,
      "read_secret",
      { secret_name: "SUPABASE_DB_PASSWORD" },
      false // verbose
    )

    if (result.error) {
      if (debugFn) {
        debugFn(`⚠️  Vault-Zugriff fehlgeschlagen: ${result.error.message}`)
      }
      return null
    }

    if (result.data && typeof result.data === 'string' && result.data.length > 0) {
      if (debugFn) {
        debugFn(`✅ SUPABASE_DB_PASSWORD aus Vault geholt`)
      }
      return result.data
    }

    return null
  } catch (error) {
    if (debugFn) {
      debugFn(`⚠️  Fehler beim Abrufen aus Vault: ${error.message}`)
    }
    return null
  }
}

/**
 * Wende Schema-Setup direkt über PostgreSQL-Verbindung an
 * Erstellt Schema, Grants und konfiguriert PostgREST (pgrst.db_schemas)
 * @param {string} projectRef - Supabase Project Reference ID
 * @param {string} schemaName - Name des Schemas
 * @param {string} dbPassword - Datenbank-Passwort
 * @param {boolean} verbose - Verbose-Modus
 * @returns {Promise<void>}
 */
export async function applySchemaViaPg(projectRef, schemaName, dbPassword, verbose = false) {
  // Versuche zuerst Session Pooler (IPv4-kompatibel), dann direkten Zugang
  const endpoints = [
    // Session Pooler - funktioniert besser auf Windows (IPv4)
    `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
    // Direkter Zugang (IPv6 auf manchen Systemen)
    `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`
  ]
  
  let lastError = null
  
  for (const connectionString of endpoints) {
    const host = connectionString.includes('pooler') ? 'Pooler' : 'Direct'
    debugLog(`Versuche PostgreSQL-Verbindung via ${host}...`, null, verbose)
    
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false }
    })
    
    try {
      await client.connect()
      debugLog(`PostgreSQL-Verbindung erfolgreich (${host})`, null, verbose)
      
      // Schema + Grants + PostgREST Konfiguration
      await applySchemaSetup(client, schemaName, verbose)
      
      await client.end()
      return // Erfolg!
    } catch (error) {
      lastError = error
      debugLog(`${host}-Verbindung fehlgeschlagen: ${error.message}`, null, verbose)
      try { await client.end() } catch (e) { /* ignore */ }
    }
  }
  
  // Alle Versuche fehlgeschlagen
  throw lastError || new Error('Alle PostgreSQL-Verbindungsversuche fehlgeschlagen')
}

/**
 * Führt das Schema-Setup auf einer bestehenden PG-Verbindung aus
 */
async function applySchemaSetup(client, schemaName, verbose = false) {
  // 1. Schema erstellen
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)
  debugLog(`Schema "${schemaName}" erstellt`, null, verbose)
  
  // 2. Grants für authenticated und anon
  await client.query(`GRANT USAGE ON SCHEMA "${schemaName}" TO authenticated, anon`)
  await client.query(`GRANT ALL ON ALL TABLES IN SCHEMA "${schemaName}" TO authenticated`)
  await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA "${schemaName}" TO anon`)
  debugLog(`Grants für Schema "${schemaName}" gesetzt`, null, verbose)
  
  // 3. Default privileges für zukünftige Tabellen
  await client.query(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" 
      GRANT ALL ON TABLES TO authenticated
  `)
  await client.query(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" 
      GRANT SELECT ON TABLES TO anon
  `)
  debugLog(`Default privileges für Schema "${schemaName}" gesetzt`, null, verbose)
  
  // 4. KRITISCH: PostgREST Schema-Konfiguration
  // Hole aktuelle Konfiguration und füge neues Schema hinzu
  const currentConfig = await client.query(`
    SELECT setting FROM pg_settings WHERE name = 'pgrst.db_schemas'
  `)
  
  let currentSchemas = 'public, infra, storage, graphql_public, realtime'
  if (currentConfig.rows.length > 0 && currentConfig.rows[0].setting) {
    currentSchemas = currentConfig.rows[0].setting
  }
  
  // Füge Schema hinzu wenn nicht vorhanden
  if (!currentSchemas.includes(schemaName)) {
    const newSchemas = currentSchemas + ', ' + schemaName
    await client.query(`
      ALTER ROLE authenticator 
        SET pgrst.db_schemas = '${newSchemas}'
    `)
    debugLog(`PostgREST konfiguriert: pgrst.db_schemas = '${newSchemas}'`, null, verbose)
  } else {
    debugLog(`Schema "${schemaName}" bereits in PostgREST konfiguriert`, null, verbose)
  }
  
  // 5. PostgREST Reload
  try {
    await client.query(`NOTIFY pgrst, 'reload config'`)
    debugLog(`PostgREST Reload-Benachrichtigung gesendet`, null, verbose)
  } catch (notifyError) {
    debugLog(`PostgREST Reload nicht möglich (ignoriert)`, null, verbose)
  }
}

/**
 * Erstelle neues Supabase-Projekt
 * @param {string} projectName - Projektname
 * @param {string} organizationId - Organization ID
 * @param {string} dbPassword - Datenbank-Passwort
 * @param {string} region - Region (default: eu-central-1)
 * @returns {Promise<Object>} Projekt-Objekt
 */
export async function createSupabaseProject(projectName, organizationId, dbPassword, region = "eu-central-1") {
  try {
    const output = execSync(
      `supabase projects create "${projectName}" --org-id ${organizationId} --db-password "${dbPassword}" --region ${region} --output json`,
      {
        encoding: "utf-8",
        stdio: "pipe",
      }
    )
    return JSON.parse(output)
  } catch (error) {
    throw new Error(`Fehler beim Erstellen des Supabase-Projekts: ${error.message}`)
  }
}

/**
 * Richtet ein Tenant-Schema über RPC-Funktion ein (umgeht IPv6/DNS-Probleme)
 * Ruft infra.ensure_tenant_schema() auf der INFRA-DB auf
 * @param {string} supabaseUrl - Supabase URL der INFRA-DB
 * @param {string} serviceRoleKey - Service Role Key
 * @param {string} schemaName - Name des zu erstellenden Schemas
 * @param {boolean} verbose - Verbose-Modus
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function ensureTenantSchemaViaRpc(supabaseUrl, serviceRoleKey, schemaName, verbose = false) {
  debugLog(`Richte Schema "${schemaName}" via RPC ein...`, { url: supabaseUrl }, verbose)
  
  try {
    const url = `${supabaseUrl}/rest/v1/rpc/ensure_tenant_schema`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer': 'return=representation',
        'Content-Profile': 'infra'  // Funktion liegt im infra-Schema
      },
      body: JSON.stringify({ p_schema_name: schemaName })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      debugLog(`RPC Fehler: ${response.status}`, errorText, verbose)
      
      // Prüfe ob Funktion nicht existiert (404 oder spezifischer Fehler)
      if (response.status === 404 || errorText.includes('function') || errorText.includes('does not exist')) {
        return {
          success: false,
          error: 'RPC-Funktion nicht gefunden. Bitte erst infra.ensure_tenant_schema() in der INFRA-DB installieren.',
          needsSetup: true
        }
      }
      
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      }
    }
    
    const result = await response.json()
    debugLog(`RPC Ergebnis:`, result, verbose)
    
    if (result.success) {
      return {
        success: true,
        message: result.message,
        schemasExposed: result.schemas_exposed
      }
    } else {
      return {
        success: false,
        error: result.error || 'Unbekannter Fehler'
      }
    }
  } catch (error) {
    debugError(error, verbose)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Prüft ob die infra.ensure_tenant_schema() Funktion verfügbar ist
 * @param {string} supabaseUrl - Supabase URL
 * @param {string} serviceRoleKey - Service Role Key
 * @returns {Promise<boolean>}
 */
export async function isSchemaManagementAvailable(supabaseUrl, serviceRoleKey) {
  try {
    // Versuche die Funktion mit ungültigem Namen aufzurufen - sollte Validation-Error zurückgeben
    const url = `${supabaseUrl}/rest/v1/rpc/ensure_tenant_schema`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Profile': 'infra'  // Funktion liegt im infra-Schema
      },
      body: JSON.stringify({ p_schema_name: '123invalid' })
    })
    
    // Wenn 200 mit Error-JSON oder 400 mit spezifischem Fehler = Funktion existiert
    if (response.ok) {
      const result = await response.json()
      // Funktion existiert und hat Validierung ausgeführt
      return true
    }
    
    // 404 = Funktion existiert nicht
    if (response.status === 404) {
      return false
    }
    
    // Andere Fehler = Funktion könnte existieren
    const errorText = await response.text()
    if (errorText.includes('does not exist') || errorText.includes('function')) {
      return false
    }
    
    return true // Annahme: Funktion existiert
  } catch (error) {
    return false
  }
}

// ============================================================
// Supabase Management API (für PostgREST Config)
// ============================================================

/**
 * Holt die aktuelle PostgREST-Konfiguration via Management API
 * @param {string} projectRef - Project Reference (z.B. "ufqlocxqizmiaozkashi")
 * @param {string} pat - Personal Access Token
 * @param {boolean} verbose - Verbose-Modus
 * @returns {Promise<{db_schema: string, error: string|null}>}
 */
export async function getPostgrestConfig(projectRef, pat, verbose = false) {
  debugLog(`Management API: Hole PostgREST-Config für ${projectRef}`, null, verbose)
  
  try {
    // Korrekter Endpoint: /v1/projects/{ref}/postgrest (ohne /config)
    const url = `https://api.supabase.com/v1/projects/${projectRef}/postgrest`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      debugLog(`Management API Error: ${response.status} - ${errorText}`, null, verbose)
      return { db_schema: '', error: `HTTP ${response.status}: ${errorText}` }
    }
    
    const config = await response.json()
    // API gibt db_schema als kommaseparierter String zurück
    debugLog(`Aktuelle db_schema: ${config.db_schema}`, null, verbose)
    
    return { 
      db_schema: config.db_schema || 'public', 
      error: null 
    }
  } catch (error) {
    debugLog(`Management API Exception: ${error.message}`, null, verbose)
    return { db_schema: '', error: error.message }
  }
}

/**
 * Aktualisiert die PostgREST-Konfiguration via Management API
 * @param {string} projectRef - Project Reference
 * @param {string} pat - Personal Access Token
 * @param {string} dbSchema - Kommaseparierte Liste der Schema-Namen
 * @param {boolean} verbose - Verbose-Modus
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function updatePostgrestConfig(projectRef, pat, dbSchema, verbose = false) {
  debugLog(`Management API: Update db_schema auf "${dbSchema}"`, null, verbose)
  
  try {
    // Korrekter Endpoint: /v1/projects/{ref}/postgrest
    const url = `https://api.supabase.com/v1/projects/${projectRef}/postgrest`
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json'
      },
      // API erwartet db_schema als String, nicht Array
      body: JSON.stringify({ db_schema: dbSchema })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      debugLog(`Management API PATCH Error: ${response.status} - ${errorText}`, null, verbose)
      return { success: false, error: `HTTP ${response.status}: ${errorText}` }
    }
    
    debugLog(`PostgREST-Config erfolgreich aktualisiert`, null, verbose)
    return { success: true, error: null }
  } catch (error) {
    debugLog(`Management API Exception: ${error.message}`, null, verbose)
    return { success: false, error: error.message }
  }
}

/**
 * Fügt ein Schema zur PostgREST-Konfiguration hinzu (via Management API)
 * @param {string} projectRef - Project Reference
 * @param {string} pat - Personal Access Token
 * @param {string} schemaName - Name des hinzuzufügenden Schemas
 * @param {boolean} verbose - Verbose-Modus
 * @returns {Promise<{success: boolean, schemas: string[], error: string|null}>}
 */
export async function addSchemaToPostgrestConfig(projectRef, pat, schemaName, verbose = false) {
  debugLog(`Management API: Füge Schema "${schemaName}" hinzu`, null, verbose)
  
  // 1. Hole aktuelle Config
  const { db_schema, error: getError } = await getPostgrestConfig(projectRef, pat, verbose)
  
  if (getError) {
    return { success: false, schemas: [], error: getError }
  }
  
  // 2. Parse aktuelle Schemas (kommasepariert)
  const currentSchemas = db_schema.split(',').map(s => s.trim()).filter(Boolean)
  
  // 3. Prüfe ob Schema bereits vorhanden
  if (currentSchemas.includes(schemaName)) {
    debugLog(`Schema "${schemaName}" bereits in db_schema`, null, verbose)
    return { success: true, schemas: currentSchemas, error: null }
  }
  
  // 4. Füge neues Schema hinzu
  const newSchemas = [...currentSchemas, schemaName]
  const newDbSchema = newSchemas.join(',')
  
  // 5. Update Config
  const { success, error: updateError } = await updatePostgrestConfig(projectRef, pat, newDbSchema, verbose)
  
  if (!success) {
    return { success: false, schemas: currentSchemas, error: updateError }
  }
  
  return { success: true, schemas: newSchemas, error: null }
}

// ============================================================
// RLS Multi-Tenant: Tenant-Erstellung
// ============================================================

/**
 * Erstellt einen neuen Tenant über infra.create_tenant RPC
 * @param {string} supabaseUrl - Supabase URL der INFRA-DB
 * @param {string} serviceRoleKey - Service Role Key
 * @param {string} slug - Tenant-Slug (z.B. "galaxy", "nova")
 * @param {string} name - Tenant-Name (Anzeigename)
 * @param {boolean} verbose - Verbose-Modus
 * @returns {Promise<{success: boolean, tenantId?: string, error?: string}>}
 */
export async function createTenant(supabaseUrl, serviceRoleKey, slug, name, verbose = false) {
  debugLog(`Erstelle Tenant: ${slug} (${name})`, null, verbose)
  
  try {
    // Prüfe zuerst ob Tenant bereits existiert
    const checkUrl = `${supabaseUrl}/rest/v1/rpc/get_tenant_by_slug`
    const checkResponse = await fetch(checkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Profile': 'infra'
      },
      body: JSON.stringify({ p_slug: slug })
    })
    
    if (checkResponse.ok) {
      const existing = await checkResponse.json()
      if (existing && existing.length > 0) {
        debugLog(`Tenant "${slug}" existiert bereits: ${existing[0].id}`, null, verbose)
        return {
          success: true,
          tenantId: existing[0].id,
          error: null
        }
      }
    }
    
    // Erstelle Tenant über RPC
    const url = `${supabaseUrl}/rest/v1/rpc/create_tenant`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Profile': 'infra'
      },
      body: JSON.stringify({
        p_slug: slug,
        p_name: name
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      debugLog(`Tenant-Erstellung fehlgeschlagen: ${response.status}`, errorText, verbose)
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      }
    }
    
    const tenantId = await response.json()
    debugLog(`Tenant erstellt: ${tenantId}`, null, verbose)
    
    return {
      success: true,
      tenantId: tenantId,
      error: null
    }
  } catch (error) {
    debugError(error, verbose)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Ordnet einen User einem Tenant zu über infra.assign_user_to_tenant RPC
 * @param {string} supabaseUrl - Supabase URL der INFRA-DB
 * @param {string} serviceRoleKey - Service Role Key
 * @param {string} userId - User UUID
 * @param {string} tenantId - Tenant UUID
 * @param {string} role - Rolle im Tenant ('owner', 'admin', 'member')
 * @param {boolean} verbose - Verbose-Modus
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function assignUserToTenant(supabaseUrl, serviceRoleKey, userId, tenantId, role = 'owner', verbose = false) {
  debugLog(`Ordne User ${userId} Tenant ${tenantId} zu (Rolle: ${role})`, null, verbose)
  
  try {
    const url = `${supabaseUrl}/rest/v1/rpc/assign_user_to_tenant`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Profile': 'infra'
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_tenant_id: tenantId,
        p_role: role
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      debugLog(`User-Tenant-Zuordnung fehlgeschlagen: ${response.status}`, errorText, verbose)
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      }
    }
    
    debugLog(`User-Tenant-Zuordnung erfolgreich`, null, verbose)
    return { success: true, error: null }
  } catch (error) {
    debugError(error, verbose)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Kopiert alle Themes aus dem Root in den tenant-spezifischen Storage-Ordner
 * @param {string} supabaseUrl - Supabase URL
 * @param {string} serviceRoleKey - Service Role Key  
 * @param {string} tenantSlug - Tenant-Slug
 * @param {boolean} verbose - Verbose-Modus
 * @returns {Promise<{success: boolean, copied: string[], skipped: string[], error?: string}>}
 */
export async function copyDefaultTheme(supabaseUrl, serviceRoleKey, tenantSlug, verbose = false) {
  debugLog(`Kopiere Themes für Tenant: ${tenantSlug}`, null, verbose)
  
  const copied = []
  const skipped = []
  
  try {
    // 1. Liste alle Themes im Root-Verzeichnis
    const listUrl = `${supabaseUrl}/storage/v1/object/list/themes`
    const rootResponse = await fetch(listUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ prefix: '', limit: 100 })
    })
    
    if (!rootResponse.ok) {
      return { success: false, copied: [], skipped: [], error: 'Kann Theme-Liste nicht laden' }
    }
    
    const rootFiles = await rootResponse.json()
    const rootThemes = rootFiles.filter(f => f.name.endsWith('.css'))
    
    if (rootThemes.length === 0) {
      debugLog(`Keine Themes im Root gefunden`, null, verbose)
      return { success: false, copied: [], skipped: [], error: 'Keine Themes im Root vorhanden' }
    }
    
    debugLog(`${rootThemes.length} Themes im Root gefunden`, rootThemes.map(t => t.name), verbose)
    
    // 2. Liste existierende Themes im Tenant-Ordner
    const tenantResponse = await fetch(listUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ prefix: tenantSlug + '/', limit: 100 })
    })
    
    const existingThemes = tenantResponse.ok 
      ? (await tenantResponse.json()).map(f => f.name) 
      : []
    
    // 3. Kopiere jedes Theme
    for (const theme of rootThemes) {
      const themeName = theme.name
      
      // Skip wenn bereits vorhanden
      if (existingThemes.includes(themeName)) {
        debugLog(`Theme existiert bereits: ${tenantSlug}/${themeName}`, null, verbose)
        skipped.push(themeName)
        continue
      }
      
      // Download aus Root
      const downloadUrl = `${supabaseUrl}/storage/v1/object/public/themes/${themeName}`
      const downloadResponse = await fetch(downloadUrl)
      
      if (!downloadResponse.ok) {
        debugLog(`Theme nicht ladbar: ${themeName}`, null, verbose)
        skipped.push(themeName)
        continue
      }
      
      const themeContent = await downloadResponse.text()
      
      // Upload in Tenant-Ordner
      const uploadUrl = `${supabaseUrl}/storage/v1/object/themes/${tenantSlug}/${themeName}`
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/css',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'x-upsert': 'true'
        },
        body: themeContent
      })
      
      if (uploadResponse.ok) {
        debugLog(`Theme kopiert: ${tenantSlug}/${themeName}`, null, verbose)
        copied.push(themeName)
      } else {
        debugLog(`Theme-Upload fehlgeschlagen: ${themeName}`, null, verbose)
        skipped.push(themeName)
      }
    }
    
    // 4. Stelle sicher, dass default.css existiert (als Alias für perpetuity oder erstes Theme)
    if (!existingThemes.includes('default.css') && !copied.includes('default.css')) {
      const fallbackTheme = copied[0] || rootThemes[0]?.name
      if (fallbackTheme && fallbackTheme !== 'default.css') {
        // Kopiere erstes Theme auch als default.css
        const downloadUrl = `${supabaseUrl}/storage/v1/object/public/themes/${tenantSlug}/${fallbackTheme}`
        const downloadResponse = await fetch(downloadUrl)
        
        if (downloadResponse.ok) {
          const themeContent = await downloadResponse.text()
          const uploadUrl = `${supabaseUrl}/storage/v1/object/themes/${tenantSlug}/default.css`
          await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/css',
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`,
              'x-upsert': 'true'
            },
            body: themeContent
          })
          debugLog(`Default-Theme erstellt aus: ${fallbackTheme}`, null, verbose)
          copied.push('default.css')
        }
      }
    }
    
    debugLog(`Themes kopiert: ${copied.length}, übersprungen: ${skipped.length}`, null, verbose)
    return { success: true, copied, skipped }
    
  } catch (error) {
    debugError(error, verbose)
    return { success: false, copied, skipped, error: error.message }
  }
}

