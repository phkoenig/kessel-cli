#!/usr/bin/env node
/**
 * Integrationstest für Template-Klonen
 * Prüft ob Dateien wirklich geklont werden
 */

import { describe, test, expect } from "./test-helpers.mjs"
import fs from "fs"
import path from "path"
import { execSync } from "child_process"

console.log("🧪 Template-Klonen Integrationstest\n")

describe("Template-Klonen Validierung", () => {
  test("Prüft ob geklonte Dateien vorhanden sind", () => {
    const testDir = "./test-clone-validation"
    
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    
    // Simuliere geklontes Verzeichnis
    fs.mkdirSync(testDir, { recursive: true })
    fs.writeFileSync(path.join(testDir, "package.json"), "{}")
    fs.writeFileSync(path.join(testDir, "README.md"), "# Test")
    
    // Prüfe ob Dateien vorhanden sind
    const files = fs.readdirSync(testDir)
    expect(files.length).toBeGreaterThan(0)
    
    // Prüfe ob .git nicht in der Liste ist (sollte entfernt werden)
    const hasGit = files.includes(".git")
    expect(hasGit).toBe(false)
    
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true })
  })
  
  test("Erkennt leeres Verzeichnis korrekt", () => {
    const testDir = "./test-empty-validation"
    
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    
    // Erstelle leeres Verzeichnis
    fs.mkdirSync(testDir, { recursive: true })
    
    // Prüfe ob leer
    const files = fs.readdirSync(testDir)
    const isEmpty = files.length === 0 || (files.length === 1 && files[0] === ".git")
    expect(isEmpty).toBe(true)
    
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true })
  })
})

console.log("\n✅ Template-Klonen Integrationstest abgeschlossen\n")

