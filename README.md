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
2. **Projekt-Setup** - Name abfragen
3. **Template klonen** - von `phkoenig/kessel-boilerplate`
4. **Credentials konfigurieren** - `.env` (Vault) und `.env.local` (Shared-Projekt + Schema)
5. **Git initialisieren** - Repository erstellen und verknüpfen
6. **Dependencies installieren** - mit pnpm
7. **Supabase Link** - Shared-Projekt verknüpfen
8. **Schema erstellen** - Neues Schema im Shared-Projekt (z.B. "galaxy")
9. **Datenbank-Migrationen** - Alle Tabellen im Schema erstellen
10. **Standard-User prüfen** - Shared Auth - User existieren für ALLE Projekte
11. **Vercel Link** - Optional Vercel-Projekt verknüpfen
12. **Validierung** - Automatische Prüfung der Konfiguration

### Multi-Tenant Architektur

**WICHTIG:** Die CLI verwendet eine **Multi-Tenant-Architektur**:
- Alle Projekte teilen sich **ein** Supabase-Projekt (Shared)
- Jedes Projekt erhält ein **eigenes Schema** für Daten-Isolation
- Auth ist **shared** - Standard-User existieren für alle Projekte

**Vorteile:**
- ✅ Nur **ein** kostenloses Supabase-Projekt nötig
- ✅ Vollständige Daten-Isolation zwischen Projekten
- ✅ Beliebige Anzahl Projekte möglich

### Standard-User (Shared Auth)

| E-Mail | Passwort | Rolle |
|--------|----------|-------|
| `admin@local` | `admin` | Admin |
| `user@local` | `user` | User |

**⚠️ SICHERHEITSHINWEIS:** Diese Credentials sind nur für die Entwicklung gedacht!  
In Production müssen diese User gelöscht oder die Passwörter geändert werden.

**Hinweis:** Diese User existieren **einmal** für alle Projekte (Shared Auth). Beim ersten Projekt werden sie erstellt, bei weiteren Projekten werden sie wiederverwendet.

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
