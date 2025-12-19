#!/usr/bin/env node

/**
 * Test: Projekt-Erstellung End-to-End
 * ====================================
 * 
 * Testet die vollständige Projekt-Erstellung mit der CLI:
 * - Schema-Erstellung
 * - Migrationen
 * - User-Erstellung
 * - Environment-Variablen
 */

import { execSync } from "child_process"
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { fileURLToPath } from "url"
import { dirname } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TEST_PROJECT_NAME = `test-${Date.now().toString().slice(-6)}`
const TEST_PROJECT_PATH = join(__dirname, "..", "..", TEST_PROJECT_NAME)

console.log("🧪 Test: Projekt-Erstellung End-to-End\n")
console.log("=" .repeat(60))
console.log(`Test-Projekt: ${TEST_PROJECT_NAME}`)
console.log(`Pfad: ${TEST_PROJECT_PATH}\n`)

const tests = []
let passed = 0
let failed = 0

function test(name, fn) {
  tests.push({ name, fn })
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed")
  }
}

// Test 1: Projekt-Erstellung
test("Projekt wird erstellt", async () => {
  console.log("📦 Test 1: Erstelle Projekt...")
  
  // Führe CLI aus (non-interactive mit --yes flags)
  // TODO: CLI muss non-interactive Mode unterstützen
  // Für jetzt: Prüfe ob Projekt-Verzeichnis existiert nach CLI-Ausführung
  
  if (existsSync(TEST_PROJECT_PATH)) {
    console.log("   ✓ Projekt-Verzeichnis existiert\n")
    return true
  } else {
    throw new Error("Projekt-Verzeichnis wurde nicht erstellt")
  }
})

// Test 2: .env.local existiert und enthält korrekte Variablen
test(".env.local enthält korrekte Variablen", () => {
  console.log("📋 Test 2: Prüfe .env.local...")
  
  const envLocalPath = join(TEST_PROJECT_PATH, ".env.local")
  assert(existsSync(envLocalPath), ".env.local existiert nicht")
  
  const envContent = readFileSync(envLocalPath, "utf-8")
  
  // Prüfe auf erforderliche Variablen
  assert(envContent.includes("NEXT_PUBLIC_SUPABASE_URL"), "NEXT_PUBLIC_SUPABASE_URL fehlt")
  assert(envContent.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fehlt")
  assert(envContent.includes("NEXT_PUBLIC_PROJECT_SCHEMA"), "NEXT_PUBLIC_PROJECT_SCHEMA fehlt")
  assert(envContent.includes("SUPABASE_SERVICE_ROLE_KEY"), "SUPABASE_SERVICE_ROLE_KEY fehlt")
  
  // Prüfe dass keine ANSI Escape Codes vorhanden sind
  assert(!envContent.includes("\x1b["), "ANSI Escape Codes gefunden in .env.local")
  
  // Prüfe dass SERVICE_ROLE_KEY NICHT vorhanden ist (nur SUPABASE_SERVICE_ROLE_KEY)
  assert(!envContent.match(/^SERVICE_ROLE_KEY=/m), "SERVICE_ROLE_KEY sollte nicht in .env.local sein")
  
  console.log("   ✓ Alle erforderlichen Variablen vorhanden")
  console.log("   ✓ Keine ANSI Escape Codes")
  console.log("   ✓ Keine SERVICE_ROLE_KEY (nur SUPABASE_SERVICE_ROLE_KEY)\n")
  
  return true
})

// Test 3: Migration-Script existiert und ist aktuell
test("Migration-Script ist aktuell", () => {
  console.log("📝 Test 3: Prüfe Migration-Script...")
  
  const migrationScriptPath = join(TEST_PROJECT_PATH, "scripts", "apply-migrations-to-schema.mjs")
  assert(existsSync(migrationScriptPath), "Migration-Script existiert nicht")
  
  const scriptContent = readFileSync(migrationScriptPath, "utf-8")
  
  // Prüfe dass Script NICHT supabase db execute verwendet
  assert(!scriptContent.includes("supabase db execute --file"), "Migration-Script verwendet noch 'supabase db execute'")
  
  // Prüfe dass Script supabase db push verwendet
  assert(scriptContent.includes("supabase db push"), "Migration-Script verwendet nicht 'supabase db push'")
  
  console.log("   ✓ Migration-Script verwendet 'supabase db push'")
  console.log("   ✓ Keine veralteten 'supabase db execute' Befehle\n")
  
  return true
})

// Test 4: User-Script existiert und hat korrekte Passwörter
test("User-Script hat korrekte Passwörter", () => {
  console.log("👤 Test 4: Prüfe User-Script...")
  
  const userScriptPath = join(TEST_PROJECT_PATH, "scripts", "create-test-users.mjs")
  assert(existsSync(userScriptPath), "User-Script existiert nicht")
  
  const scriptContent = readFileSync(userScriptPath, "utf-8")
  
  // Prüfe dass Passwörter mindestens 6 Zeichen haben
  assert(!scriptContent.includes('password: "admin"'), "Admin-Passwort ist zu kurz (sollte 'admin123' sein)")
  assert(!scriptContent.includes('password: "user"'), "User-Passwort ist zu kurz (sollte 'user123' sein)")
  
  assert(scriptContent.includes('password: "admin123"'), "Admin-Passwort sollte 'admin123' sein")
  assert(scriptContent.includes('password: "user123"'), "User-Passwort sollte 'user123' sein")
  
  console.log("   ✓ Passwörter haben mindestens 6 Zeichen")
  console.log("   ✓ Admin: admin123, User: user123\n")
  
  return true
})

// Test 5: Schema-Name ist korrekt normalisiert
test("Schema-Name ist korrekt normalisiert", () => {
  console.log("📊 Test 5: Prüfe Schema-Name...")
  
  const envLocalPath = join(TEST_PROJECT_PATH, ".env.local")
  const envContent = readFileSync(envLocalPath, "utf-8")
  
  const schemaMatch = envContent.match(/NEXT_PUBLIC_PROJECT_SCHEMA=(.+)/)
  assert(schemaMatch, "NEXT_PUBLIC_PROJECT_SCHEMA nicht gefunden")
  
  const schemaName = schemaMatch[1].trim()
  
  // Schema-Name sollte keine Bindestriche enthalten (werden zu Unterstrichen)
  assert(!schemaName.includes("-"), "Schema-Name enthält Bindestriche (sollte Unterstriche verwenden)")
  
  console.log(`   ✓ Schema-Name: ${schemaName}`)
  console.log("   ✓ Keine Bindestriche im Schema-Namen\n")
  
  return true
})

// Führe alle Tests aus
async function runTests() {
  console.log("🚀 Starte Tests...\n")
  
  for (const { name, fn } of tests) {
    try {
      await fn()
      passed++
      console.log(`✅ ${name}`)
    } catch (error) {
      failed++
      console.log(`❌ ${name}: ${error.message}`)
    }
  }
  
  console.log("\n" + "=" .repeat(60))
  console.log(`📊 Test-Zusammenfassung:`)
  console.log(`   ✅ Bestanden: ${passed}`)
  console.log(`   ❌ Fehlgeschlagen: ${failed}`)
  console.log(`   📊 Gesamt: ${tests.length}`)
  console.log("=" .repeat(60) + "\n")
  
  if (failed > 0) {
    console.log("⚠️  Einige Tests sind fehlgeschlagen!")
    process.exit(1)
  } else {
    console.log("✅ Alle Tests bestanden!")
  }
}

// Cleanup
process.on("exit", () => {
  // Lösche Test-Projekt (optional)
  // if (existsSync(TEST_PROJECT_PATH)) {
  //   execSync(`rm -rf "${TEST_PROJECT_PATH}"`, { stdio: "ignore" })
  // }
})

runTests().catch((error) => {
  console.error("Fataler Fehler:", error)
  process.exit(1)
})

