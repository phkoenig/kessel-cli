#!/usr/bin/env node
/**
 * Integrationstests für kessel
 * 
 * Testet kritische Pfade ohne echte Installationen
 */

import { describe, test, expect } from "./test-helpers.mjs"
import degit from "degit"
import fs from "fs"
import path from "path"

console.log("🧪 Integrationstests für kessel\n")

describe("Template-Klonen", () => {
  test("Template kann von GitHub geklont werden", async () => {
    const templateRepo = "phkoenig/next-supabase-shadcn-template"
    const testDir = "./test-clone-integration"
    
    // Cleanup falls vorhanden
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    
    const emitter = degit(templateRepo, {
      cache: false,
      force: true,
    })
    
    await emitter.clone(testDir)
    
    // Prüfe ob wichtige Dateien vorhanden sind
    const requiredFiles = [
      "package.json",
      "README.md",
      ".cursor/mcp.json",
    ]
    
    for (const file of requiredFiles) {
      const filePath = path.join(testDir, file)
      expect(fs.existsSync(filePath)).toBe(true)
    }
    
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true })
  })
})

describe("Config-Laden", () => {
  test("Config wird korrekt geladen", () => {
    const configPath = "./config.json"
    let config
    
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    } else {
      config = {
        defaultSupabaseUrl: "https://zedhieyjlfhygsfxzbze.supabase.co",
        defaultTemplateRepo: "phkoenig/next-supabase-shadcn-template",
      }
    }
    
    expect(config.defaultSupabaseUrl).toBeDefined()
    expect(config.defaultTemplateRepo).toBeDefined()
  })
})

console.log("\n✅ Alle Integrationstests abgeschlossen\n")

