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

Secrets werden in der **INFRA-DB (Kessel Vault)** verwaltet:

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

## Supabase-Architektur (INFRA-DB + DEV-DB)

Die CLI unterstützt eine **Zwei-Datenbank-Architektur**:

### INFRA-DB (Kessel)
- **URL:** `https://ufqlocxqizmiaozkashi.supabase.co`
- **Zweck:** User, Auth, Vault (Secrets), Multi-Tenant Schemas
- **Enthält:** Shared Auth, Supabase Vault, User-Profile

### DEV-DB (MEGABRAIN)
- **URL:** `https://jpmhwyjiuodsvjowddsm.supabase.co`
- **Zweck:** App-Daten, fachliche Entwicklung
- **Enthält:** Projekt-spezifische Daten, Features

### Warum zwei Datenbanken?

| INFRA-DB (Kessel) | DEV-DB |
|-------------------|--------|
| User & Auth | App-Daten |
| Secrets (Vault) | Fachliche Tabellen |
| Multi-Tenant Schemas | Feature-Entwicklung |
| Stabil & shared | Zum Austoben |

**Cursor MCP zeigt immer auf DEV-DB** - INFRA-DB wird über interne APIs angesprochen.

## Was das Tool macht (13 Schritte)

1. **GitHub Repository** - Erstellen (public/private) oder überspringen
2. **Template klonen** - von `phkoenig/kessel-boilerplate`
3. **Bootstrap-Credentials (.env)** - INFRA-DB URL + Service Role Key
4. **Public-Credentials (.env.local)** - Anon Key, Tenant-Slug, App-Name
5. **Git initialisieren** - Repository erstellen und verknüpfen
6. **Dependencies installieren** - mit pnpm
7. **🆕 Secrets aus Vault laden** - `pnpm pull-env` für API-Keys (OPENROUTER, FAL, etc.)
8. **Supabase Link** - Projekt mit INFRA-DB verknüpfen
9. **Tenant erstellen** - RLS-basierte Multi-Tenant-Isolation
10. **Datenbank-Migrationen** - Alle Tabellen im Schema erstellen
11. **Standard-User prüfen** - Shared Auth User zu Tenant zuordnen
12. **Vercel Link** - Optional Vercel-Projekt verknüpfen
13. **MCP-Konfiguration** - Cursor MCP für DEV-DB einrichten

### Multi-Tenant Architektur

Die INFRA-DB verwendet eine **Multi-Tenant-Architektur**:
- Jedes Projekt erhält ein **eigenes Schema** für Daten-Isolation
- Auth ist **shared** - Standard-User existieren für alle Projekte
- Vault enthält zentrale Secrets

### Standard-User (Shared Auth)

| E-Mail | Passwort | Rolle |
|--------|----------|-------|
| `admin@local` | `admin123` | Admin |
| `user@local` | `user123` | User |

**⚠️ SICHERHEITSHINWEIS:** Diese Credentials sind nur für die Entwicklung gedacht!  
In Production müssen diese User gelöscht oder die Passwörter geändert werden.

## Konfiguration

### config.json

Die CLI verwendet `config.json` für Standard-Werte:

```json
{
  "infraDb": {
    "name": "Kessel",
    "url": "https://ufqlocxqizmiaozkashi.supabase.co",
    "projectRef": "ufqlocxqizmiaozkashi",
    "description": "INFRA-DB: User, Auth, Vault, Multi-Tenant Schemas"
  },
  "devDb": {
    "name": "MEGABRAIN",
    "url": "https://jpmhwyjiuodsvjowddsm.supabase.co",
    "projectRef": "jpmhwyjiuodsvjowddsm",
    "description": "DEV-DB: App-Daten, Entwicklung"
  },
  "defaultTemplateRepo": "phkoenig/kessel-boilerplate"
}
```

### Profil-System

Das Tool speichert Konfigurationen in `~/.kessel/{username}.kesselprofile`:

| Variable | Beschreibung |
|----------|--------------|
| `USERNAME` | Dein Username |
| `SUPABASE_INFRA_URL` | INFRA-DB URL (Kessel) |
| `SUPABASE_DEV_URL` | DEV-DB URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key für Vault |

**Legacy-Variablen** (für Abwärtskompatibilität):
- `SUPABASE_BACKEND_URL` → wird zu `SUPABASE_INFRA_URL` migriert
- `SUPABASE_VAULT_URL` → nicht mehr benötigt (Vault ist in INFRA-DB)

## Cursor MCP Integration

**Wichtig:** In Cursor sollte nur **ein** Supabase-MCP pro Workspace aktiv sein!

### Automatische MCP-Konfiguration

Die CLI aktualisiert automatisch die `.cursor/mcp.json` Datei am Ende des Projekterstellungsprozesses:

1. **Entfernt** alle existierenden Supabase-MCP Server
2. **Erstellt** einen neuen MCP Server für die DEV-DB
3. **Benennt** ihn nach dem Projekt: `supabase_DEV_{schema_name}`

```json
{
  "mcpServers": {
    "supabase_DEV_mein_projekt": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=jpmhwyjiuodsvjowddsm"
    }
  }
}
```

### Warum nur DEV-DB?

| Datenbank | MCP-Zugriff | Grund |
|-----------|-------------|-------|
| **DEV-DB** | ✅ Ja (MCP) | Cursor-gesteuerte Entwicklung |
| **INFRA-DB** | ❌ Nein | Zugriff über Backend-API/SDK |

Die INFRA-DB (Kessel) enthält sensible Daten (User, Auth, Vault) und sollte nicht direkt über MCP angesprochen werden.

Siehe auch: `docs/04_knowledge/mcp-setup.md` im Boilerplate

## Links

- **Template:** [kessel-boilerplate](https://github.com/phkoenig/kessel-boilerplate)
- **Dokumentation:** Siehe `docs/04_knowledge/cli-*.md` im Template

---

**🚀 Powered by Philip König, Berlin**
