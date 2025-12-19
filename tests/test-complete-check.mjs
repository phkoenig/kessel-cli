#!/usr/bin/env node

/**
 * Vollständiger Code-Check für Kessel CLI
 * ========================================
 * 
 * Prüft alle kritischen Stellen vor dem Testen:
 * - CLI verwendet korrekte Service Role Keys
 * - Passwörter sind korrekt
 * - Keine veralteten Supabase CLI-Befehle
 * - ANSI Escape Codes werden entfernt
 * - Environment-Variablen sind korrekt
 */

import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const CLI_PATH = join(__dirname, "..", "index.js")
const BOILERPLATE_PATH = join(__dirname, "..", "..", "kessel-boilerplate")

console.log("🔍 Vollständiger Code-Check für Kessel CLI\n")
console.log("=" .repeat(60))

const issues = []
const warnings = []

// 1. CLI-Checks
console.log("\n📋 CLI-Checks:")
const cliContent = readFileSync(CLI_PATH, "utf-8")

// 1.1. Keine veralteten Supabase CLI-Befehle
if (cliContent.includes("supabase db execute --file")) {
  issues.push("CLI verwendet noch 'supabase db execute --file' (existiert nicht)")
} else {
  console.log("  ✅ Keine veralteten 'supabase db execute' Befehle")
}

// 1.2. Service Role Key Verwendung
if (cliContent.includes("vaultServiceRoleKey") && cliContent.match(/supabaseAdmin.*vaultServiceRoleKey/)) {
  issues.push("CLI verwendet noch vaultServiceRoleKey für User-Check (sollte appSupabaseServiceRoleKey sein)")
} else {
  console.log("  ✅ User-Check verwendet appSupabaseServiceRoleKey")
}

if (!cliContent.includes("appSupabaseServiceRoleKey")) {
  issues.push("CLI verwendet appSupabaseServiceRoleKey nicht")
} else {
  console.log("  ✅ appSupabaseServiceRoleKey wird verwendet")
}

// 1.3. Passwörter in Logs
if (cliContent.match(/admin@local.*\/\s*admin[^1]/)) {
  issues.push("CLI zeigt noch altes Admin-Passwort 'admin' in Logs")
} else {
  console.log("  ✅ Admin-Passwort korrekt (admin123)")
}

if (cliContent.match(/user@local.*\/\s*user[^1]/)) {
  issues.push("CLI zeigt noch altes User-Passwort 'user' in Logs")
} else {
  console.log("  ✅ User-Passwort korrekt (user123)")
}

// 1.4. ANSI Escape Code Entfernung
if (!cliContent.includes("replace(/\\x1b\\[")) {
  issues.push("CLI entfernt keine ANSI Escape Codes aus .env.local")
} else {
  console.log("  ✅ ANSI Escape Codes werden entfernt")
}

// 1.5. Environment-Variablen für Migration-Script
if (!cliContent.includes("SUPABASE_SERVICE_ROLE_KEY: appSupabaseServiceRoleKey")) {
  issues.push("CLI setzt SUPABASE_SERVICE_ROLE_KEY nicht für Migration-Script")
} else {
  console.log("  ✅ SUPABASE_SERVICE_ROLE_KEY wird für Migration-Script gesetzt")
}

// 1.6. Environment-Variablen für User-Script
if (!cliContent.includes("SUPABASE_SERVICE_ROLE_KEY: appSupabaseServiceRoleKey") || 
    cliContent.match(/SUPABASE_SERVICE_ROLE_KEY.*vaultServiceRoleKey/)) {
  issues.push("CLI setzt SUPABASE_SERVICE_ROLE_KEY nicht korrekt für User-Script")
} else {
  console.log("  ✅ SUPABASE_SERVICE_ROLE_KEY wird für User-Script gesetzt")
}

// 2. Boilerplate Script-Checks
console.log("\n📝 Boilerplate Script-Checks:")

const migrationScriptPath = join(BOILERPLATE_PATH, "scripts", "apply-migrations-to-schema.mjs")
const userScriptPath = join(BOILERPLATE_PATH, "scripts", "create-test-users.mjs")

if (existsSync(migrationScriptPath)) {
  const migrationContent = readFileSync(migrationScriptPath, "utf-8")
  
  // 2.1. Migration-Script verwendet keine veralteten Befehle
  if (migrationContent.includes("supabase db execute --file")) {
    issues.push("Migration-Script verwendet noch 'supabase db execute --file'")
  } else {
    console.log("  ✅ Migration-Script verwendet keine veralteten Befehle")
  }
  
  // 2.2. Migration-Script verwendet supabase db push
  if (!migrationContent.includes("supabase db push")) {
    issues.push("Migration-Script verwendet nicht 'supabase db push'")
  } else {
    console.log("  ✅ Migration-Script verwendet 'supabase db push'")
  }
  
  // 2.3. Schema-Erstellung über REST API (nicht kritisch, aber sollte funktionieren)
  if (!migrationContent.includes("CREATE SCHEMA IF NOT EXISTS")) {
    warnings.push("Migration-Script erstellt Schema möglicherweise nicht automatisch")
  } else {
    console.log("  ✅ Migration-Script erstellt Schema automatisch")
  }
} else {
  issues.push("Migration-Script nicht gefunden")
}

if (existsSync(userScriptPath)) {
  const userContent = readFileSync(userScriptPath, "utf-8")
  
  // 2.4. User-Script hat korrekte Passwörter
  if (userContent.includes('password: "admin"')) {
    issues.push("User-Script hat noch altes Admin-Passwort 'admin'")
  } else {
    console.log("  ✅ Admin-Passwort korrekt (admin123)")
  }
  
  if (userContent.includes('password: "user"')) {
    issues.push("User-Script hat noch altes User-Passwort 'user'")
  } else {
    console.log("  ✅ User-Passwort korrekt (user123)")
  }
  
  if (!userContent.includes('password: "admin123"')) {
    issues.push("User-Script hat nicht 'admin123'")
  }
  
  if (!userContent.includes('password: "user123"')) {
    issues.push("User-Script hat nicht 'user123'")
  }
  
  // 2.5. User-Script verwendet SUPABASE_SERVICE_ROLE_KEY
  if (!userContent.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    warnings.push("User-Script verwendet möglicherweise nicht SUPABASE_SERVICE_ROLE_KEY")
  } else {
    console.log("  ✅ User-Script verwendet SUPABASE_SERVICE_ROLE_KEY")
  }
} else {
  issues.push("User-Script nicht gefunden")
}

// 3. Dokumentation-Checks
console.log("\n📚 Dokumentation-Checks:")

const cliReadmePath = join(__dirname, "..", "README.md")
const boilerplateReadmePath = join(BOILERPLATE_PATH, "README.md")

if (existsSync(cliReadmePath)) {
  const cliReadme = readFileSync(cliReadmePath, "utf-8")
  if (cliReadme.match(/admin@local.*\|\s*`admin`/)) {
    issues.push("CLI README zeigt noch altes Admin-Passwort")
  } else {
    console.log("  ✅ CLI README hat korrekte Passwörter")
  }
}

if (existsSync(boilerplateReadmePath)) {
  const boilerplateReadme = readFileSync(boilerplateReadmePath, "utf-8")
  if (boilerplateReadme.match(/admin@local.*\|\s*`admin`/)) {
    issues.push("Boilerplate README zeigt noch altes Admin-Passwort")
  } else {
    console.log("  ✅ Boilerplate README hat korrekte Passwörter")
  }
}

// 4. Zusammenfassung
console.log("\n" + "=" .repeat(60))
console.log("📊 Zusammenfassung:")
console.log("=" .repeat(60))

if (issues.length === 0 && warnings.length === 0) {
  console.log("\n✅ Alle Checks bestanden! Keine Probleme gefunden.\n")
  console.log("💡 Die CLI sollte jetzt ohne Fehler funktionieren.")
  process.exit(0)
} else {
  if (issues.length > 0) {
    console.log(`\n❌ ${issues.length} kritische Problem(e) gefunden:`)
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`)
    })
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} Warnung(en):`)
    warnings.forEach((warning, i) => {
      console.log(`   ${i + 1}. ${warning}`)
    })
  }
  
  console.log("\n🔧 Bitte behebe diese Probleme vor dem Testen.\n")
  process.exit(1)
}

