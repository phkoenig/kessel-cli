# CLI-Benutzerführung Optimierung - Plan

**Datum:** 2025-01-13  
**Status:** 🟡 In Planung  
**Priorität:** Hoch (Verbessert User Experience erheblich)

## 🎯 Zielsetzung

Die CLI-Benutzerführung soll so einfach und intuitiv wie möglich sein:
- **Minimale Prompts:** Nur das Nötigste abfragen
- **Intelligente Defaults:** Automatische Erkennung wo möglich
- **Hilfe-Links:** Direkte Links zu Login-Seiten, Token-Erstellung etc.
- **Klarere Beschreibungen:** User weiß immer, was er tun muss

## 📊 Aktuelle Situation

### Aktuelle Prompts (in Reihenfolge):

1. **Projektname** ✅ Gut (mit Default)
2. **GitHub Token** ⚠️ Könnte automatisch geladen werden
3. **Zentrale Supabase URL** ✅ Gut (mit Default)
4. **SERVICE_ROLE_KEY** ✅ Gut (automatisch geladen)
5. **Supabase-Projekt-Auswahl** ✅ Gut (Liste mit 3 Optionen)
6. **Weitere Prompts** (abhängig von Auswahl):
   - Bestehendes Projekt: Projekt aus Liste + Anon Key (automatisch oder manuell)
   - Neues Projekt: Projektname + Organization ID (optional) + Anon Key (automatisch oder manuell)
   - Manuell: URL + Anon Key
7. **Dependencies installieren?** ✅ Gut (Ja/Nein)

### Probleme & Verbesserungspotenziale:

#### 1. GitHub Token
- **Problem:** Muss jedes Mal manuell eingegeben werden
- **Lösung:** 
  - Aus Umgebungsvariable laden (`GITHUB_TOKEN`)
  - Oder aus Git Config (`git config --global github.token`)
  - Oder aus `~/.github/token` Datei
  - Mit Hilfe-Link: "Token erstellen: https://github.com/settings/tokens"

#### 2. Supabase CLI Checks
- **Problem:** Fehlende CLI wird erst spät erkannt
- **Lösung:** 
  - Am Anfang prüfen: Supabase CLI installiert? → Link zur Installation
  - Authentifiziert? → Link zu `supabase login`
  - Klare Anweisungen mit direkten Links

#### 3. Vercel Integration
- **Problem:** Wird am Ende gefragt, könnte früher geprüft werden
- **Lösung:**
  - Am Anfang prüfen: Vercel CLI installiert? → Link zur Installation
  - Authentifiziert? → Link zu `vercel login`
  - Automatisch verlinken wenn möglich

#### 4. Anon Key Abruf
- **Problem:** Funktioniert nicht immer automatisch
- **Lösung:**
  - Bessere Fehlerbehandlung
  - Klarerer Hinweis: "Anon Key nicht automatisch abrufbar, bitte manuell eingeben"
  - Direkter Link zum Supabase Dashboard: "Key finden: https://supabase.com/dashboard/project/[project_ref]/settings/api"

#### 5. Hilfe-Links fehlen
- **Problem:** User muss selbst suchen, wo er Token/Keys findet
- **Lösung:**
  - Direkte Links in Prompts anzeigen
  - Beispiel: "GitHub Token (erstellen: https://github.com/settings/tokens):"
  - Beispiel: "Supabase Anon Key (finden: https://supabase.com/dashboard/...)"

#### 6. Klarere Beschreibungen
- **Problem:** Manche Prompts sind technisch/unklar
- **Lösung:**
  - Einfachere Sprache
  - Kontext geben: "Für was wird das benötigt?"
  - Beispiele zeigen

## 🚀 Verbesserungsplan

### Phase 1: Automatisches Laden von Credentials

1. **GitHub Token automatisch laden:**
   - `process.env.GITHUB_TOKEN`
   - `git config --global github.token`
   - `~/.github/token` Datei
   - Falls nicht gefunden: Prompt mit Hilfe-Link

2. **Supabase Anon Key automatisch abrufen:**
   - Verbesserte `fetchAnonKeyFromSupabase` Funktion
   - Bessere Fehlerbehandlung
   - Fallback zu manueller Eingabe mit Hilfe-Link

### Phase 2: Frühe Checks & Hilfe-Links

1. **Am Anfang prüfen:**
   - Supabase CLI installiert? → Link zur Installation
   - Supabase CLI authentifiziert? → Link zu `supabase login`
   - Vercel CLI installiert? → Link zur Installation
   - Vercel CLI authentifiziert? → Link zu `vercel login`

2. **Hilfe-Links in Prompts:**
   - GitHub Token: "GitHub Token (erstellen: https://github.com/settings/tokens):"
   - Supabase Anon Key: "Anon Key (finden: https://supabase.com/dashboard/...):"
   - Supabase Login: "Bitte zuerst einloggen: https://supabase.com/dashboard"

### Phase 3: Klarere Beschreibungen

1. **Einfachere Sprache:**
   - "Wie lautet der Name deines Projekts?" → "Wie soll dein Projekt heißen?"
   - "Zentrale Supabase URL (für Secrets-Vault):" → "Supabase URL für Secrets (Standard: ...):"

2. **Kontext geben:**
   - "Dies wird benötigt für..." in Prompts
   - Beispiele zeigen: "z.B. mein-neues-projekt"

3. **Bessere Fehlermeldungen:**
   - Nicht nur "Fehler", sondern "Was ist passiert?" + "Wie beheben?"

### Phase 4: Optimierte Reihenfolge

1. **Am Anfang:**
   - Projektname (mit Default)
   - Checks: Supabase CLI, Vercel CLI
   - Automatisches Laden: GitHub Token, SERVICE_ROLE_KEY

2. **Dann:**
   - Supabase-Projekt-Auswahl
   - Automatischer Anon Key Abruf (mit Fallback)

3. **Am Ende:**
   - Vercel Integration (optional)
   - Dependencies installieren?

## 📝 Konkrete Umsetzung

### 1. GitHub Token automatisch laden

```javascript
import os from 'os'

function loadGitHubToken() {
  // 1. Aus Umgebungsvariable
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN
  }
  
  // 2. Aus Git Config
  try {
    const token = execSync('git config --global github.token', { encoding: 'utf-8' }).trim()
    if (token) return token
  } catch {}
  
  // 3. Aus Datei ~/.github/token
  const tokenFile = path.join(os.homedir(), '.github', 'token')
  if (fs.existsSync(tokenFile)) {
    return fs.readFileSync(tokenFile, 'utf-8').trim()
  }
  
  return null
}
```

### 2. Hilfe-Links in Prompts

```javascript
{
  type: "password",
  name: "githubToken",
  message: "GitHub Token (erstellen: https://github.com/settings/tokens):",
  validate: (input) => input.length > 0 || "Token ist erforderlich.",
}
```

### 3. Frühe Checks

```javascript
// Am Anfang des Programms
async function checkPrerequisites() {
  console.log(chalk.blue("\n🔍 Prüfe Voraussetzungen...\n"))
  
  // Supabase CLI
  try {
    execSync('supabase --version', { stdio: 'ignore' })
    console.log(chalk.green("✓ Supabase CLI installiert"))
    
    try {
      execSync('supabase projects list', { stdio: 'ignore' })
      console.log(chalk.green("✓ Supabase CLI authentifiziert"))
    } catch {
      console.log(chalk.yellow("⚠️  Supabase CLI nicht authentifiziert"))
      console.log(chalk.dim("   Bitte einloggen: supabase login"))
      console.log(chalk.dim("   Oder: https://supabase.com/dashboard"))
    }
  } catch {
    console.log(chalk.yellow("⚠️  Supabase CLI nicht installiert"))
    console.log(chalk.dim("   Installation: npm install -g supabase"))
    console.log(chalk.dim("   Oder: https://supabase.com/docs/guides/cli"))
  }
  
  // Vercel CLI
  try {
    execSync('vercel --version', { stdio: 'ignore' })
    console.log(chalk.green("✓ Vercel CLI installiert"))
    
    try {
      execSync('vercel whoami', { stdio: 'ignore' })
      console.log(chalk.green("✓ Vercel CLI authentifiziert"))
    } catch {
      console.log(chalk.yellow("⚠️  Vercel CLI nicht authentifiziert"))
      console.log(chalk.dim("   Bitte einloggen: vercel login"))
      console.log(chalk.dim("   Oder: https://vercel.com/login"))
    }
  } catch {
    console.log(chalk.yellow("⚠️  Vercel CLI nicht installiert"))
    console.log(chalk.dim("   Installation: npm install -g vercel"))
    console.log(chalk.dim("   Oder: https://vercel.com/docs/cli"))
  }
  
  console.log() // Leerzeile
}
```

## ✅ Erfolgskriterien

- **Weniger Prompts:** Maximal 3-4 Prompts für Standard-Workflow
- **Automatisches Laden:** GitHub Token, SERVICE_ROLE_KEY automatisch geladen
- **Hilfe-Links:** Alle Prompts haben direkte Links zu benötigten Seiten
- **Klarere Beschreibungen:** User weiß immer, was er tun muss
- **Frühe Checks:** Probleme werden sofort erkannt, nicht erst später

## 🔄 Nächste Schritte

1. ✅ Analyse abgeschlossen
2. ⏳ Implementierung starten
3. ⏳ Testen mit verschiedenen Szenarien
4. ⏳ Dokumentation aktualisieren

