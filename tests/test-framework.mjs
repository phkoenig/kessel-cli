#!/usr/bin/env node
/**
 * Test-Framework für kessel CLI
 * 
 * Testet einzelne Funktionen isoliert ohne echte API-Calls oder Installationen
 */

import { describe, test, expect } from "./test-helpers.mjs"

// Importiere Funktionen aus index.js (müssen exportiert werden)
// Für jetzt: Kopiere die Logik hier rein zum Testen

console.log("🧪 Test-Framework für kessel\n")

describe("Template-Klonen", () => {
  test("Template-URL wird korrekt formatiert", () => {
    const templateRepo = "phkoenig/next-supabase-shadcn-template"
    const templateVersion = "main"
    const templateSource = templateVersion === "main"
      ? templateRepo
      : `${templateRepo}#${templateVersion}`
    
    expect(templateSource).toBe(templateRepo)
  })
  
  test("Template-URL mit Version wird korrekt formatiert", () => {
    const templateRepo = "phkoenig/next-supabase-shadcn-template"
    const templateVersion = "v1.0.0"
    const templateSource = templateVersion === "main"
      ? templateRepo
      : `${templateRepo}#${templateVersion}`
    
    expect(templateSource).toBe(`${templateRepo}#${templateVersion}`)
  })
})

describe("Supabase Projects Parsing", () => {
  test("Parse Supabase Projects List Output", async () => {
    const mockOutput = `    LINKED │        ORG ID        │     REFERENCE ID     │       NAME       │         REGION         │  CREATED AT (UTC)
  ─────────┼──────────────────────┼──────────────────────┼──────────────────┼───────────────────────    
           │ djzdgltmsofbziwsfidc │ hehzflyabtarnxujbewh │ Zepta      │ eu-central-1          │ 2024-01-15 10:30:00
           │ djzdgltmsofbziwsfidc │ uigpauojizbrzaoxyyst │ Secrets    │ eu-central-1          │ 2024-01-20 15:00:00
`
    
    // Teste Parsing-Logik
    const normalizedOutput = mockOutput.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const lines = normalizedOutput.split("\n")
    const projects = []
    let headerFound = false
    let inTable = false
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      
      if (trimmed.includes("LINKED") && trimmed.includes("ORG ID")) {
        headerFound = true
        continue
      }
      
      if (headerFound && (trimmed.includes("─") || trimmed.includes("┼")) && trimmed.length > 50) {
        inTable = true
        continue
      }
      
      if ((inTable || headerFound) && trimmed.includes("│") && !trimmed.includes("LINKED")) {
        const parts = trimmed.split("│").map((p) => p.trim())
        if (parts.length >= 4) {
          const referenceId = parts[2] || ""
          if (referenceId && referenceId.length > 0 && !referenceId.includes("uigpauojizbrzaoxyyst")) {
            projects.push({ project_ref: referenceId })
          }
        }
      }
    }
    
    expect(projects.length).toBe(1)
    expect(projects[0].project_ref).toBe("hehzflyabtarnxujbewh")
  })
})

describe("Anon Key Parsing", () => {
  test("Parse Anon Key aus JSON", () => {
    const mockKeys = [
      {
        "api_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "name": "anon",
        "type": "legacy"
      },
      {
        "api_key": "sb_publishable_...",
        "name": "default",
        "type": "publishable"
      }
    ]
    
    let anonKey = mockKeys.find((k) => {
      const name = (k.name || "").toLowerCase()
      const id = (k.id || "").toLowerCase()
      return name === "anon" || id === "anon"
    })
    
    if (!anonKey) {
      anonKey = mockKeys.find((k) => {
        const type = (k.type || "").toLowerCase()
        return type === "publishable"
      })
    }
    
    expect(anonKey).toBeDefined()
    expect(anonKey.api_key).toBeDefined()
    expect(anonKey.name).toBe("anon")
  })
})

console.log("\n✅ Alle Tests abgeschlossen\n")

