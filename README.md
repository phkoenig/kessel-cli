# Kessel CLI

> CLI für die Kessel Boilerplate - Erstellt neue Next.js-Projekte mit Supabase & ShadCN UI

**Tech Stack des Templates:** Next.js 16, React 19, Supabase, ShadCN UI, TypeScript, Tailwind CSS v4

## Installation

### Voraussetzungen

- Node.js 18+
- Git
- pnpm (empfohlen) oder npm
- GitHub CLI (`gh`) - für Repository-Erstellung
- Supabase CLI - für Projekt-Linking

### Schritte

1. **Repository klonen:**
```bash
git clone https://github.com/phkoenig/kessel-cli.git
cd kessel-cli
```

2. **Dependencies installieren:**
```bash
pnpm install
```

3. **Global verlinken:**
```bash
pnpm link --global
```

4. **Testen:**
```bash
kessel --version
```

### Alternative: Alias verwenden

Falls `pnpm link --global` nicht funktioniert:

```bash
# Bash/Zsh (.bashrc/.zshrc)
alias kessel="node /pfad/zum/kessel-cli/index.js"
```

## Verwendung

### Projekt erstellen

```bash
# Mit Projektname
kessel mein-projekt

# Im aktuellen Verzeichnis (verwendet Ordnernamen)
kessel

# Mit Template-Version
kessel mein-projekt --template-version v1.2.0

# Mit Debug-Ausgaben
kessel mein-projekt --verbose
```

### Secrets Management

```bash
# Alle Secrets anzeigen
kessel secrets get

# Einzelnes Secret abrufen
kessel secrets get APP_URL

# Secret hinzufügen
kessel secrets add SECRET_NAME "secret_value"

# Secret aktualisieren
kessel secrets update SECRET_NAME "new_value"

# Secret löschen
kessel secrets delete SECRET_NAME

# JSON-Format
kessel secrets get --json

# .env-Format (für Export)
kessel secrets get --env > secrets-backup.env
```

## Was das Tool macht

1. **Pre-Checks** - GitHub CLI, Vercel CLI, Supabase CLI prüfen
2. **Projekt-Setup** - Name, Supabase-Projekt auswählen/erstellen
3. **Template klonen** - von `phkoenig/kessel-boilerplate`
4. **Credentials konfigurieren** - `.env` und `.env.local`
5. **Git initialisieren** - Repository erstellen und verknüpfen
6. **Dependencies installieren** - mit pnpm
7. **Validierung** - Automatische Prüfung der Konfiguration

## Konfiguration

Erstelle `config.json` im CLI-Verzeichnis (optional):

```json
{
  "defaultSupabaseUrl": "https://zedhieyjlfhygsfxzbze.supabase.co",
  "defaultTemplateRepo": "phkoenig/kessel-boilerplate"
}
```

## Profil-System

Das Tool speichert Konfigurationen in `~/.kessel/{username}.kesselprofile`:

- `USERNAME` - Dein Username
- `SUPABASE_BACKEND_URL` - Backend URL für die App
- `SUPABASE_VAULT_URL` - Zentrale Vault URL
- `SUPABASE_VAULT_SERVICE_ROLE_KEY` - Service Role Key

## Links

- **Template:** [kessel-boilerplate](https://github.com/phkoenig/kessel-boilerplate)
- **Dokumentation:** Siehe `docs/04_knowledge/cli-*.md` im Template

---

**🚀 Powered by Philip König, Berlin**
