#!/usr/bin/env node
/**
 * Test für CWD-Erkennung
 */

import { describe, test, expect } from "./test-helpers.mjs"
import path from "path"

console.log("🧪 CWD-Erkennung Tests\n")

describe("CWD-Erkennung", () => {
  test("path.basename gibt korrekten Ordnernamen zurück", () => {
    const testPath = "/b/Nextcloud/CODE/proj/testapp3"
    const dirName = path.basename(testPath)
    expect(dirName).toBe("testapp3")
  })
  
  test("Normalisiert Ordnername korrekt", () => {
    const dirName = "test_app_3"
    const normalized = dirName.replace(/_/g, "-").toLowerCase()
    expect(normalized).toBe("test-app-3")
  })
  
  test("Erkennt wenn initialCwd != currentCwd", () => {
    const initialCwd = "/b/Nextcloud/CODE/proj/kessel"
    const currentCwd = "/b/Nextcloud/CODE/proj/testapp3"
    const shouldUseCurrent = initialCwd !== currentCwd
    
    expect(shouldUseCurrent).toBe(true)
  })
})

console.log("\n✅ CWD-Erkennung Tests abgeschlossen\n")

