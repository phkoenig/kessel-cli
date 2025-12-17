#!/usr/bin/env node
// Test mit echter Supabase-Ausgabe

import fs from "fs"

// Lade echte Ausgabe (falls vorhanden)
// Hinweis: Diese Datei muss manuell erstellt werden, wenn der Test verwendet werden soll
const testOutputPath = "test-real-output.txt"
if (!fs.existsSync(testOutputPath)) {
  console.error(`❌ Testdatei "${testOutputPath}" nicht gefunden.`)
  console.error("   Erstelle die Datei mit echter Supabase-Ausgabe oder verwende test-parsing.mjs stattdessen.")
  process.exit(1)
}
const realOutput = fs.readFileSync(testOutputPath, "utf-8")

// Kopiere die Parsing-Logik aus index.js
function parseSupabaseProjects(output, debugFn) {
  // Normalisiere Zeilenenden (Windows: \r\n, Unix: \n)
  const normalizedOutput = output.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const lines = normalizedOutput.split("\n")
  const projects = []
  let headerFound = false
  let inTable = false

  if (debugFn) {
    debugFn(`Raw output lines: ${lines.length}`)
    debugFn(`All lines with content:`)
    lines.forEach((line, i) => {
      const trimmed = line.trim()
      if (trimmed && trimmed.length > 0) {
        debugFn(`  Line ${i}: "${trimmed.substring(0, 100)}"`)
      }
    })
  }

  for (const line of lines) {
    const trimmed = line.trim()
    
    // Überspringe leere Zeilen
    if (!trimmed) {
      continue
    }

    // Überspringe Warnungen und andere Meldungen
    if (trimmed.includes("Cannot find") || trimmed.includes("version") || trimmed.includes("recommend") || trimmed.includes("updating")) {
      continue
    }

    // Erkenne Header-Zeile (kann mit Leerzeichen beginnen)
    if (trimmed.includes("LINKED") && trimmed.includes("ORG ID")) {
      headerFound = true
      if (debugFn) debugFn(`✓ Header gefunden in Zeile: "${trimmed.substring(0, 60)}"`)
      continue
    }

    // Erkenne Trennlinie nach Header (enthält ─ oder ┼)
    if (headerFound && (trimmed.includes("─") || trimmed.includes("┼")) && trimmed.length > 50) {
      inTable = true
      if (debugFn) debugFn(`✓ Trennlinie gefunden, inTable = true. Zeile: "${trimmed.substring(0, 60)}"`)
      continue
    }

    // Parse Tabellenzeilen (getrennt durch │)
    // WICHTIG: Prüfe auch ob headerFound gesetzt ist, falls inTable noch nicht gesetzt wurde
    if ((inTable || headerFound) && trimmed.includes("│") && !trimmed.includes("LINKED")) {
      if (debugFn) {
        debugFn(`[inTable=${inTable}, headerFound=${headerFound}] Parsing Zeile: "${trimmed.substring(0, 80)}"`)
      }
      const parts = trimmed.split("│").map((p) => p.trim())
      
      if (debugFn) {
        debugFn(`  → parts.length: ${parts.length}, parts: [${parts.slice(0, 5).map(p => `"${p.substring(0, 20)}"`).join(", ")}]`)
      }
      
      if (parts.length >= 4) {
        // Index 0: LINKED (kann leer sein)
        // Index 1: ORG ID
        // Index 2: REFERENCE ID (project_ref)
        // Index 3: NAME
        // Index 4: REGION
        const orgId = parts[1] || ""
        const referenceId = parts[2] || ""
        const name = parts[3] || ""
        const region = parts[4] || ""

        if (debugFn) {
          debugFn(`  → referenceId: "${referenceId}", name: "${name}", length: ${referenceId.length}`)
        }

        // Filtere das Secret-Projekt raus (uigpauojizbrzaoxyyst)
        if (referenceId && referenceId.length > 0 && !referenceId.includes("uigpauojizbrzaoxyyst")) {
          projects.push({
            id: referenceId,
            project_ref: referenceId,
            name: name,
            org_id: orgId,
            region: region,
          })
          if (debugFn) {
            debugFn(`  ✓ Projekt hinzugefügt: ${name} (${referenceId})`)
          }
        } else if (debugFn) {
          if (!referenceId || referenceId.length === 0) {
            debugFn(`  ✗ Übersprungen: referenceId ist leer`)
          } else if (referenceId.includes("uigpauojizbrzaoxyyst")) {
            debugFn(`  ✗ Übersprungen: Secret-Projekt gefiltert`)
          }
        }
      } else if (debugFn) {
        debugFn(`  ✗ Übersprungen: parts.length (${parts.length}) < 4`)
      }
    }
  }

  if (debugFn) {
    debugFn(`\nParsing abgeschlossen. Gefundene Projekte: ${projects.length}`)
  }

  return projects
}

// Test ausführen
console.log("🧪 Teste mit echter Supabase-Ausgabe...\n")
const debugLog = []
const projects = parseSupabaseProjects(realOutput, (msg) => debugLog.push(msg))

console.log("📋 Debug-Ausgaben:")
debugLog.forEach(msg => console.log(msg))

console.log("\n📊 Ergebnis:")
console.log(`Gefundene Projekte: ${projects.length}`)
projects.forEach((p, i) => {
  console.log(`  ${i + 1}. ${p.name} (${p.project_ref})`)
})

if (projects.length > 0) {
  console.log(`\n✅ Test ERFOLGREICH: ${projects.length} Projekte gefunden`)
  process.exit(0)
} else {
  console.log(`\n❌ Test FEHLGESCHLAGEN: Keine Projekte gefunden`)
  process.exit(1)
}

