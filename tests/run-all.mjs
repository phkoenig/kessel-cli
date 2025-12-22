#!/usr/bin/env node
/**
 * Test-Runner für alle kessel-cli Tests
 * 
 * Führt alle Test-Dateien nacheinander aus und gibt eine Zusammenfassung.
 */

import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log("╔═══════════════════════════════════════════════════╗")
console.log("║        🧪 KESSEL CLI TEST SUITE                   ║")
console.log("╚═══════════════════════════════════════════════════╝\n")

// Test-Dateien in der Reihenfolge, in der sie ausgeführt werden sollen
const testFiles = [
  "test-framework.mjs",        // Basis-Tests
  "profile.test.mjs",          // Profil-System
  "infra-dev-db.test.mjs",     // INFRA-DB + DEV-DB Architektur
]

let passed = 0
let failed = 0
const results = []

for (const testFile of testFiles) {
  const testPath = path.join(__dirname, testFile)
  
  if (!fs.existsSync(testPath)) {
    console.log(`⚠️  Test-Datei nicht gefunden: ${testFile}`)
    continue
  }
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`📄 ${testFile}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  
  try {
    execSync(`node "${testPath}"`, {
      cwd: __dirname,
      stdio: "inherit",
    })
    passed++
    results.push({ file: testFile, status: "✅ PASSED" })
  } catch (error) {
    failed++
    results.push({ file: testFile, status: "❌ FAILED" })
  }
}

// Zusammenfassung
console.log("\n╔═══════════════════════════════════════════════════╗")
console.log("║                 ZUSAMMENFASSUNG                    ║")
console.log("╚═══════════════════════════════════════════════════╝\n")

for (const result of results) {
  console.log(`  ${result.status}  ${result.file}`)
}

console.log(`\n  ────────────────────────────────────────────────`)
console.log(`  Gesamt: ${passed + failed} | Bestanden: ${passed} | Fehlgeschlagen: ${failed}`)
console.log(`  ────────────────────────────────────────────────\n`)

if (failed > 0) {
  console.log("❌ Einige Tests sind fehlgeschlagen!\n")
  process.exit(1)
} else {
  console.log("✅ Alle Tests bestanden!\n")
  process.exit(0)
}

