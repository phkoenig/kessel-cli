#!/usr/bin/env node
/**
 * Test für Template-Klonen
 */

import { describe, test, expect } from "./test-helpers.mjs"

console.log("🧪 Template-Klonen Tests\n")

describe("Template-URL-Formatierung", () => {
  test("Git URL wird korrekt formatiert", () => {
    const templateRepo = "phkoenig/next-supabase-shadcn-template"
    const githubToken = "ghp_test123"
    const gitUrl = `https://${githubToken}@github.com/${templateRepo}.git`
    
    expect(gitUrl).toBe("https://ghp_test123@github.com/phkoenig/next-supabase-shadcn-template.git")
  })
  
  test("Branch wird korrekt gesetzt", () => {
    const templateVersion = "main"
    const branch = templateVersion === "main" ? "main" : templateVersion
    
    expect(branch).toBe("main")
  })
  
  test("Custom Branch wird korrekt gesetzt", () => {
    const templateVersion = "v1.0.0"
    const branch = templateVersion === "main" ? "main" : templateVersion
    
    expect(branch).toBe("v1.0.0")
  })
})

console.log("\n✅ Template-Klonen Tests abgeschlossen\n")

