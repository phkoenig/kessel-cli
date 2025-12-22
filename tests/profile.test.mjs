#!/usr/bin/env node
/**
 * Tests für das Profil-System (lib/profile.js)
 * 
 * Testet:
 * - normalizeUsername()
 * - loadProfile() / saveProfile()
 * - Profil-Pfade
 */

import { describe, test, expect } from "./test-helpers.mjs"
import fs from "fs"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Importiere Funktionen aus profile.js
import {
  normalizeUsername,
  getProfileDir,
  getProfilePath,
  loadProfile,
  saveProfile,
  profileExists,
} from "../lib/profile.js"

console.log("🧪 Tests für das Profil-System\n")

// ============================================================================
// NORMALIZE USERNAME TESTS
// ============================================================================

describe("normalizeUsername()", () => {
  test("Wandelt Umlaute um", () => {
    expect(normalizeUsername("müller")).toBe("mueller")
    expect(normalizeUsername("böhm")).toBe("boehm")
    expect(normalizeUsername("löwe")).toBe("loewe")
    expect(normalizeUsername("größe")).toBe("groesse")
  })
  
  test("Wandelt zu Kleinbuchstaben um", () => {
    expect(normalizeUsername("JohnDoe")).toBe("johndoe")
    expect(normalizeUsername("ADMIN")).toBe("admin")
  })
  
  test("Entfernt nicht-alphanumerische Zeichen", () => {
    expect(normalizeUsername("john.doe")).toBe("johndoe")
    expect(normalizeUsername("john-doe")).toBe("johndoe")
    expect(normalizeUsername("john_doe")).toBe("johndoe")
    expect(normalizeUsername("john@example.com")).toBe("johnexamplecom")
  })
  
  test("Kombinierte Transformationen", () => {
    expect(normalizeUsername("Müller-König")).toBe("muellerkoenig")
    expect(normalizeUsername("Größenwahn123")).toBe("groessenwahn123")
  })
  
  test("Wirft Fehler bei leerem Input", () => {
    expect(() => normalizeUsername("")).toThrow()
    expect(() => normalizeUsername(null)).toThrow()
    expect(() => normalizeUsername(undefined)).toThrow()
  })
})

// ============================================================================
// PROFILE DIR TESTS
// ============================================================================

describe("getProfileDir()", () => {
  test("Gibt Pfad im Home-Verzeichnis zurück", () => {
    const profileDir = getProfileDir()
    const homeDir = os.homedir()
    
    expect(profileDir).toContain(homeDir)
    expect(profileDir).toContain(".kessel")
  })
})

// ============================================================================
// PROFILE PATH TESTS
// ============================================================================

describe("getProfilePath()", () => {
  test("Generiert korrekten Pfad", () => {
    const profilePath = getProfilePath("testuser")
    
    expect(profilePath).toContain(".kessel")
    expect(profilePath).toContain("testuser.kesselprofile")
  })
  
  test("Normalisiert Username im Pfad", () => {
    const profilePath = getProfilePath("TestUser")
    
    expect(profilePath).toContain("testuser.kesselprofile")
  })
})

// ============================================================================
// SAVE AND LOAD PROFILE TESTS
// ============================================================================

describe("saveProfile() und loadProfile()", () => {
  const testUsername = "testuser_" + Date.now()
  
  test("Speichert Profil erfolgreich", () => {
    const profile = {
      USERNAME: testUsername,
      SUPABASE_INFRA_URL: "https://test.supabase.co",
      SUPABASE_DEV_URL: "https://dev.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-key-123",
    }
    
    const savedPath = saveProfile(testUsername, profile)
    
    expect(fs.existsSync(savedPath)).toBe(true)
  })
  
  test("Lädt Profil erfolgreich", () => {
    const loaded = loadProfile(testUsername)
    
    expect(loaded).toBeDefined()
    expect(loaded.USERNAME).toBe(testUsername)
    expect(loaded.SUPABASE_INFRA_URL).toBe("https://test.supabase.co")
    expect(loaded.SUPABASE_DEV_URL).toBe("https://dev.supabase.co")
  })
  
  test("profileExists() funktioniert", () => {
    expect(profileExists(testUsername)).toBe(true)
    expect(profileExists("nonexistent_user_12345")).toBe(false)
  })
  
  // Cleanup
  test("Cleanup: Lösche Test-Profil", () => {
    const profilePath = getProfilePath(testUsername)
    if (fs.existsSync(profilePath)) {
      fs.unlinkSync(profilePath)
    }
    expect(fs.existsSync(profilePath)).toBe(false)
  })
})

// ============================================================================
// PROFILE FORMAT TESTS
// ============================================================================

describe("Profil-Format (.env-Style)", () => {
  test("Profil wird im .env-Format gespeichert", () => {
    const testUsername = "formattest_" + Date.now()
    const profile = {
      KEY1: "value1",
      KEY2: "value2 with spaces",
    }
    
    const savedPath = saveProfile(testUsername, profile)
    const content = fs.readFileSync(savedPath, "utf-8")
    
    expect(content).toContain("KEY1=value1")
    expect(content).toContain("KEY2=value2 with spaces")
    expect(content).toContain("# Kessel-Profil")
    
    // Cleanup
    fs.unlinkSync(savedPath)
  })
})

// ============================================================================
// EDGE CASES
// ============================================================================

describe("Edge Cases", () => {
  test("loadProfile() mit nicht existierendem User gibt null zurück", () => {
    const loaded = loadProfile("completely_nonexistent_user_xyz")
    expect(loaded).toBeNull()
  })
  
  test("loadProfile() mit leerem String gibt null zurück", () => {
    const loaded = loadProfile("")
    expect(loaded).toBeNull()
  })
  
  test("loadProfile() mit null gibt null zurück", () => {
    const loaded = loadProfile(null)
    expect(loaded).toBeNull()
  })
})

console.log("\n✅ Alle Profil-Tests abgeschlossen\n")

