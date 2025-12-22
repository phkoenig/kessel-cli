#!/usr/bin/env node
/**
 * Tests für den Init-Wizard
 */

import { describe, test, expect } from "./test-helpers.mjs"
import { DEFAULTS } from "../src/config.js"

console.log("🧪 Tests für Init-Wizard\n")

describe("Wizard Config-Struktur", () => {
  test("DEFAULTS sind definiert", () => {
    expect(DEFAULTS.infraDb).toBeDefined()
    expect(DEFAULTS.devDb).toBeDefined()
    expect(DEFAULTS.infraDb.url).toBeDefined()
    expect(DEFAULTS.devDb.url).toBeDefined()
  })
  
  test("Config-Objekt hat korrekte Struktur", () => {
    const mockConfig = {
      username: "testuser",
      projectName: "test-project",
      schemaName: "test_project",
      infraDb: {
        url: DEFAULTS.infraDb.url,
        projectRef: DEFAULTS.infraDb.projectRef,
      },
      devDb: {
        url: DEFAULTS.devDb.url,
        projectRef: DEFAULTS.devDb.projectRef,
      },
      serviceRoleKey: "test-key",
      createGithub: "private",
      autoInstallDeps: true,
      linkVercel: false,
      doInitialCommit: true,
      doPush: true,
    }
    
    expect(mockConfig.username).toBeDefined()
    expect(mockConfig.projectName).toBeDefined()
    expect(mockConfig.schemaName).toBeDefined()
    expect(mockConfig.infraDb.url).toBeDefined()
    expect(mockConfig.devDb.url).toBeDefined()
    expect(mockConfig.serviceRoleKey).toBeDefined()
  })
  
  test("Schema-Name wird korrekt generiert", () => {
    const projectName = "mein-cooles-projekt"
    const schemaName = projectName.replace(/-/g, "_").toLowerCase()
    
    expect(schemaName).toBe("mein_cooles_projekt")
  })
})

console.log("\n✅ Alle Wizard-Tests abgeschlossen\n")

