#!/usr/bin/env node
// Test für automatischen Anon Key Abruf

import { execSync } from "child_process"

// Test-Projekt-Ref
const projectRef = "jpmhwyjiuodsvjowddsm"

// Kopiere die Funktion aus index.js
async function fetchAnonKeyFromSupabase(projectRef, debugFn) {
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
    
    if (debugFn) {
      debugFn(`API-Keys Output (${output.length} chars): ${output.substring(0, 300)}`)
    }
    
    const trimmedOutput = output.trim()
    if (!trimmedOutput || trimmedOutput.length === 0) {
      if (debugFn) {
        debugFn(`⚠️  CLI gibt keine Keys zurück (leere Ausgabe)`)
      }
      return null
    }
    
    let keys
    try {
      keys = JSON.parse(trimmedOutput)
    } catch (parseError) {
      if (debugFn) {
        debugFn(`⚠️  Ausgabe ist kein JSON: ${parseError.message}`)
      }
      return null
    }
    
    // Suche nach dem "anon" oder "publishable" Key im JSON
    if (Array.isArray(keys)) {
      // Bevorzuge "anon" Key (legacy), sonst "publishable" Key
      let anonKey = keys.find((k) => {
        const name = (k.name || "").toLowerCase()
        const id = (k.id || "").toLowerCase()
        return name === "anon" || id === "anon"
      })
      
      // Falls kein "anon" Key, nimm "publishable" Key
      if (!anonKey) {
        anonKey = keys.find((k) => {
          const type = (k.type || "").toLowerCase()
          return type === "publishable"
        })
      }
      
      if (anonKey && anonKey.api_key) {
        const keyValue = anonKey.api_key
        if (debugFn) {
          debugFn(`✓ Anon Key automatisch abgerufen (${anonKey.name || anonKey.type}): ${keyValue.substring(0, 20)}...`)
        }
        return keyValue
      }
    } else if (keys.anon_key || keys.anon || keys.public || keys.api_key) {
      const key = keys.anon_key || keys.anon || keys.public || keys.api_key
      if (debugFn) {
        debugFn(`✓ Anon Key automatisch abgerufen: ${key.substring(0, 20)}...`)
      }
      return key
    }
    
    if (debugFn) {
      debugFn(`⚠️  Kein Anon Key im JSON gefunden`)
    }
    return null
  } catch (error) {
    if (debugFn) {
      debugFn(`⚠️  Fehler beim Abrufen des Anon Keys: ${error.message}`)
    }
    return null
  }
}

// Test ausführen
console.log("🧪 Teste automatischen Anon Key Abruf...\n")
console.log(`Projekt-Ref: ${projectRef}\n`)

const debugLog = []
const anonKey = await fetchAnonKeyFromSupabase(projectRef, (msg) => debugLog.push(msg))

console.log("📋 Debug-Ausgaben:")
debugLog.forEach(msg => console.log(`  ${msg}`))

console.log("\n📊 Ergebnis:")
if (anonKey) {
  console.log(`✅ Anon Key erfolgreich abgerufen:`)
  console.log(`   ${anonKey.substring(0, 50)}...`)
  console.log(`   Länge: ${anonKey.length} Zeichen`)
  process.exit(0)
} else {
  console.log(`❌ Kein Anon Key gefunden`)
  process.exit(1)
}

