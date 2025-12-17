#!/usr/bin/env node
/**
 * Test für Logik: Aktuelles Verzeichnis erkennen
 */

import { describe, test, expect } from "./test-helpers.mjs"

console.log("🧪 Aktuelles Verzeichnis Logik Tests\n")

describe("Ordnername Normalisierung", () => {
  test("Normalisiert Unterstriche zu Bindestrichen", () => {
    const dirName = "test_boiler"
    const normalized = dirName.replace(/_/g, "-").toLowerCase()
    expect(normalized).toBe("test-boiler")
  })
  
  test("Erkennt wenn Projektname = Ordnername (normalisiert)", () => {
    const currentDirName = "test_boiler"
    const normalizedCurrentDirName = currentDirName.replace(/_/g, "-").toLowerCase()
    const projectName = "test-boiler"
    const normalizedProjectName = projectName.replace(/_/g, "-").toLowerCase()
    
    const isCurrentDir = normalizedProjectName === normalizedCurrentDirName
    expect(isCurrentDir).toBe(true)
  })
  
  test("Erkennt wenn Projektname != Ordnername", () => {
    const currentDirName = "test_boiler"
    const normalizedCurrentDirName = currentDirName.replace(/_/g, "-").toLowerCase()
    const projectName = "other-project"
    const normalizedProjectName = projectName.replace(/_/g, "-").toLowerCase()
    
    const isCurrentDir = normalizedProjectName === normalizedCurrentDirName
    expect(isCurrentDir).toBe(false)
  })
})

console.log("\n✅ Aktuelles Verzeichnis Logik Tests abgeschlossen\n")

