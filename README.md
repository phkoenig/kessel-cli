# Kessel CLI

> CLI fuer die Kessel Boilerplate 3.0 - Erstellt neue Next.js-Projekte mit Clerk, SpacetimeDB und Supabase

**Tech Stack des Templates:** Next.js 16, React 19, Clerk Auth, SpacetimeDB, Supabase, ShadCN UI, TypeScript, Tailwind CSS v4

## Architektur (Boilerplate 3.0)

| Dienst | Rolle | Beschreibung |
|--------|-------|--------------|
| **Clerk** | Authentication | User-Lifecycle, Organisations, SSO |
| **SpacetimeDB** | UX-Core | Rollen, Navigation, Wiki, Theme, Chat |
| **Supabase** | App-Datenbank | Fachliche Daten, Storage, Echtzeit |

Jedes abgeleitete Projekt bekommt:
- Ein eigenes **Supabase-Projekt** (dediziert)
- Eine eigene **Clerk Application** (eigener User Pool)
- Ein eigenes **SpacetimeDB Modul** (auf Maincloud)

## Installation

### Voraussetzungen

- Node.js 18+
- pnpm
- GitHub CLI (`gh`)
- Supabase CLI (`supabase`)
- 1Password CLI (`op`)
- SpacetimeDB CLI (`spacetime`) - optional, fuer Modul-Publish

### Schritte

```bash
git clone https://github.com/phkoenig/kessel-cli.git
cd kessel-cli
pnpm install
pnpm link --global
kessel version
```

## Verwendung

### Projekt erstellen

```bash
kessel mein-projekt        # Mit Projektname
kessel                     # Im aktuellen Verzeichnis
kessel mein-projekt -v     # Mit Debug-Ausgaben
```

### Wizard-Ablauf

Der Wizard fragt folgende Informationen ab:

1. **Username** - Dein Entwickler-Name
2. **Projektname** - Lowercase mit Bindestrichen
3. **Supabase-Projekt URL** - URL des dedizierten Supabase-Projekts
4. **Service Role Key** - Wird automatisch aus 1Password geholt
5. **Clerk Application** - Eigene oder Shared
6. **SpacetimeDB Modul** - Neues publizieren, bestehendes verwenden, oder ueberspringen
7. **GitHub Repository** - Privat, oeffentlich, oder nur lokal
8. **Dependencies installieren** - pnpm install
9. **Vercel Link** - Optional
10. **Initial Commit + Push** - Git-Initialisierung

### Was das Tool macht (14 Schritte)

1. **GitHub Repository** - Erstellen (public/private) oder ueberspringen
2. **Template klonen** - von `phkoenig/kessel-boilerplate`
3. **Environment-Variablen (.env.local)** - Supabase, Clerk, SpacetimeDB
4. **.env.example aktualisieren** - Projektspezifische Platzhalter
5. **Git initialisieren** - Repository und Remote
6. **Dependencies installieren** - pnpm install
7. **Secrets aus 1Password** - pnpm pull-env
8. **Supabase Link** - Projekt verknuepfen
9. **SpacetimeDB Modul** - Publizieren (optional)
10. **MCP-Konfiguration** - Cursor MCP fuer Supabase
11. **secrets.mdc** - 1Password-Referenzen anpassen
12. **Vercel Link** - Optional
13. **Initial Commit + Push** - Git
14. **Log** - Erstellungsprotokoll

### Secrets Management

```bash
kessel secrets get                   # Alle Secrets anzeigen
kessel secrets get APP_URL           # Einzelnes Secret
kessel secrets add SECRET_NAME "v"   # Secret hinzufuegen
kessel secrets update SECRET_NAME "v" # Secret aktualisieren
kessel secrets delete SECRET_NAME    # Secret loeschen
```

### Status pruefen

```bash
kessel status
```

Zeigt den Status aller Tools (GitHub, Supabase, pnpm, SpacetimeDB, Vercel), Services (Supabase, Clerk, SpacetimeDB) und MCP-Konfiguration.

## 1Password Integration

Secrets werden ueber 1Password verwaltet. Die CLI passt automatisch den 1Password-Prefix in `pull-env.manifest.json` an:

- Template: `KB - App Runtime`, `KB - Auth Runtime`, etc.
- Nach Ableitung: `<PROJEKT> - App Runtime`, `<PROJEKT> - Auth Runtime`, etc.

## Links

- **Template:** [kessel-boilerplate](https://github.com/phkoenig/kessel-boilerplate)
- **Clerk:** [clerk.com](https://clerk.com)
- **SpacetimeDB:** [spacetimedb.com](https://spacetimedb.com)
- **Supabase:** [supabase.com](https://supabase.com)

---

**Powered by Philip Koenig, Berlin**
