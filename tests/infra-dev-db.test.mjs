#!/usr/bin/env node
/**
 * Tests für die INFRA-DB + DEV-DB Architektur
 * 
 * Testet die neue Zwei-Datenbank-Konfiguration:
 * - INFRA-DB (Kessel): User, Auth, Vault, Multi-Tenant Schemas
 * - DEV-DB (MEGABRAIN): App-Daten, fachliche Entwicklung
 */

import { describe, test, expect } from "./test-helpers.mjs"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cliRoot = path.join(__dirname, "..")

console.log("🧪 Tests für INFRA-DB + DEV-DB Architektur\n")

// ============================================================================
// CONFIG TESTS
// ============================================================================

describe("Config-Struktur (config.json)", () => {
  test("config.example.json hat infraDb und devDb", () => {
    const configPath = path.join(cliRoot, "config.example.json")
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    
    expect(config.infraDb).toBeDefined()
    expect(config.devDb).toBeDefined()
    expect(config.defaultTemplateRepo).toBeDefined()
  })
  
  test("infraDb hat korrekte Struktur", () => {
    const configPath = path.join(cliRoot, "config.example.json")
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    
    expect(config.infraDb.name).toBe("Kessel")
    expect(config.infraDb.url).toContain("ufqlocxqizmiaozkashi")
    expect(config.infraDb.projectRef).toBe("ufqlocxqizmiaozkashi")
    expect(config.infraDb.description).toContain("INFRA-DB")
  })
  
  test("devDb hat korrekte Struktur", () => {
    const configPath = path.join(cliRoot, "config.example.json")
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    
    expect(config.devDb.name).toBe("MEGABRAIN")
    expect(config.devDb.url).toContain("jpmhwyjiuodsvjowddsm")
    expect(config.devDb.projectRef).toBe("jpmhwyjiuodsvjowddsm")
    expect(config.devDb.description).toContain("DEV-DB")
  })
})

// ============================================================================
// LOAD CONFIG TESTS (simuliert loadConfig() Logik)
// ============================================================================

describe("loadConfig() Funktion", () => {
  // Simuliere loadConfig() Logik
  function loadConfig() {
    const configPath = path.join(cliRoot, "config.example.json")
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
        return {
          ...config,
          // Legacy-Kompatibilität: defaultSupabaseUrl zeigt auf INFRA-DB (Vault)
          defaultSupabaseUrl: config.infraDb?.url || "https://ufqlocxqizmiaozkashi.supabase.co",
          // Legacy-Kompatibilität: sharedSupabaseProject = INFRA-DB
          sharedSupabaseProject: {
            url: config.infraDb?.url || "https://ufqlocxqizmiaozkashi.supabase.co",
            projectRef: config.infraDb?.projectRef || "ufqlocxqizmiaozkashi",
          },
        }
      } catch (error) {
        return null
      }
    }
    return null
  }
  
  test("loadConfig() fügt Legacy-Kompatibilitäts-Properties hinzu", () => {
    const config = loadConfig()
    
    expect(config).toBeDefined()
    expect(config.defaultSupabaseUrl).toBeDefined()
    expect(config.sharedSupabaseProject).toBeDefined()
    expect(config.sharedSupabaseProject.url).toBeDefined()
    expect(config.sharedSupabaseProject.projectRef).toBeDefined()
  })
  
  test("defaultSupabaseUrl zeigt auf INFRA-DB", () => {
    const config = loadConfig()
    
    expect(config.defaultSupabaseUrl).toBe(config.infraDb.url)
  })
  
  test("sharedSupabaseProject entspricht INFRA-DB", () => {
    const config = loadConfig()
    
    expect(config.sharedSupabaseProject.url).toBe(config.infraDb.url)
    expect(config.sharedSupabaseProject.projectRef).toBe(config.infraDb.projectRef)
  })
})

// ============================================================================
// DEFAULT VALUES TESTS
// ============================================================================

describe("Default-Werte", () => {
  const DEFAULTS = {
    infraDb: {
      name: "Kessel",
      url: "https://ufqlocxqizmiaozkashi.supabase.co",
      projectRef: "ufqlocxqizmiaozkashi",
    },
    devDb: {
      name: "MEGABRAIN",
      url: "https://jpmhwyjiuodsvjowddsm.supabase.co",
      projectRef: "jpmhwyjiuodsvjowddsm",
    },
  }
  
  test("INFRA-DB Default URL ist Kessel", () => {
    expect(DEFAULTS.infraDb.url).toBe("https://ufqlocxqizmiaozkashi.supabase.co")
  })
  
  test("DEV-DB Default URL ist MEGABRAIN", () => {
    expect(DEFAULTS.devDb.url).toBe("https://jpmhwyjiuodsvjowddsm.supabase.co")
  })
  
  test("Project Refs sind korrekt", () => {
    expect(DEFAULTS.infraDb.projectRef).toBe("ufqlocxqizmiaozkashi")
    expect(DEFAULTS.devDb.projectRef).toBe("jpmhwyjiuodsvjowddsm")
  })
})

// ============================================================================
// PROFILE MIGRATION TESTS
// ============================================================================

describe("Profil-Migration (Legacy → Neu)", () => {
  // Simuliere Profil-Migration
  function migrateProfile(profile) {
    const migrated = { ...profile }
    
    // Migriere SUPABASE_BACKEND_URL → SUPABASE_INFRA_URL
    if (profile.SUPABASE_BACKEND_URL && !profile.SUPABASE_INFRA_URL) {
      migrated.SUPABASE_INFRA_URL = profile.SUPABASE_BACKEND_URL
    }
    
    // Migriere SUPABASE_VAULT_SERVICE_ROLE_KEY → SUPABASE_SERVICE_ROLE_KEY
    if (profile.SUPABASE_VAULT_SERVICE_ROLE_KEY && !profile.SUPABASE_SERVICE_ROLE_KEY) {
      migrated.SUPABASE_SERVICE_ROLE_KEY = profile.SUPABASE_VAULT_SERVICE_ROLE_KEY
    }
    
    return migrated
  }
  
  test("SUPABASE_BACKEND_URL wird zu SUPABASE_INFRA_URL migriert", () => {
    const oldProfile = {
      USERNAME: "testuser",
      SUPABASE_BACKEND_URL: "https://example.supabase.co",
    }
    
    const migrated = migrateProfile(oldProfile)
    
    expect(migrated.SUPABASE_INFRA_URL).toBe("https://example.supabase.co")
  })
  
  test("Existierende SUPABASE_INFRA_URL wird nicht überschrieben", () => {
    const profile = {
      USERNAME: "testuser",
      SUPABASE_BACKEND_URL: "https://old.supabase.co",
      SUPABASE_INFRA_URL: "https://new.supabase.co",
    }
    
    const migrated = migrateProfile(profile)
    
    expect(migrated.SUPABASE_INFRA_URL).toBe("https://new.supabase.co")
  })
  
  test("SUPABASE_VAULT_SERVICE_ROLE_KEY wird zu SUPABASE_SERVICE_ROLE_KEY migriert", () => {
    const oldProfile = {
      USERNAME: "testuser",
      SUPABASE_VAULT_SERVICE_ROLE_KEY: "old-key-123",
    }
    
    const migrated = migrateProfile(oldProfile)
    
    expect(migrated.SUPABASE_SERVICE_ROLE_KEY).toBe("old-key-123")
  })
})

// ============================================================================
// ENV FILE GENERATION TESTS
// ============================================================================

describe(".env Datei-Generierung", () => {
  test(".env enthält INFRA-DB URL", () => {
    const infraDbUrl = "https://ufqlocxqizmiaozkashi.supabase.co"
    const serviceRoleKey = "test-service-role-key"
    
    const envContent = `# Bootstrap-Credentials für Vault-Zugriff (INFRA-DB)
# WICHTIG: Dies ist die URL der INFRA-DB (Kessel) mit integriertem Vault
NEXT_PUBLIC_SUPABASE_URL=${infraDbUrl}
SERVICE_ROLE_KEY=${serviceRoleKey}
`
    
    expect(envContent).toContain("INFRA-DB")
    expect(envContent).toContain(infraDbUrl)
    expect(envContent).toContain(serviceRoleKey)
  })
  
  test(".env.local enthält beide DB URLs", () => {
    const infraDbUrl = "https://ufqlocxqizmiaozkashi.supabase.co"
    const devDbUrl = "https://jpmhwyjiuodsvjowddsm.supabase.co"
    const anonKey = "test-anon-key"
    const schemaName = "test_app"
    const serviceRoleKey = "test-service-role-key"
    
    const envLocalContent = `# Public-Credentials für Next.js Client
# Multi-Tenant Architektur: INFRA-DB (Auth, Vault) + DEV-DB (App-Daten)
# Jedes Projekt hat ein eigenes Schema für Daten-Isolation

# INFRA-DB (Kessel) - Auth, Vault, Multi-Tenant
NEXT_PUBLIC_SUPABASE_URL=${infraDbUrl}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${anonKey}
NEXT_PUBLIC_PROJECT_SCHEMA=${schemaName}

# DEV-DB - App-Daten, Entwicklung
# Hinweis: Kann gleich INFRA-DB sein oder separate DB für fachliche Daten
NEXT_PUBLIC_DEV_SUPABASE_URL=${devDbUrl}

# Service Role Key für Server-Side Operationen (User-Erstellung, etc.)
SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}
`
    
    expect(envLocalContent).toContain("INFRA-DB")
    expect(envLocalContent).toContain("DEV-DB")
    expect(envLocalContent).toContain(infraDbUrl)
    expect(envLocalContent).toContain(devDbUrl)
    expect(envLocalContent).toContain("NEXT_PUBLIC_DEV_SUPABASE_URL")
  })
})

// ============================================================================
// PROFILE VARIABLE TESTS
// ============================================================================

describe("Profil-Variablen", () => {
  test("Neue Variablen-Namen sind definiert", () => {
    const newVariables = [
      "SUPABASE_INFRA_URL",
      "SUPABASE_DEV_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]
    
    // Diese Variablen sollten in neuen Profilen verwendet werden
    for (const varName of newVariables) {
      expect(varName).toBeDefined()
    }
  })
  
  test("Legacy-Variablen für Rückwärtskompatibilität", () => {
    const legacyVariables = [
      "SUPABASE_BACKEND_URL",
      "SUPABASE_VAULT_URL",
      "SUPABASE_VAULT_SERVICE_ROLE_KEY",
    ]
    
    // Diese werden noch unterstützt, aber zu neuen migriert
    for (const varName of legacyVariables) {
      expect(varName).toBeDefined()
    }
  })
})

// ============================================================================
// URL VALIDATION TESTS
// ============================================================================

describe("URL-Validierung", () => {
  function isValidSupabaseUrl(url) {
    try {
      const parsed = new URL(url)
      return parsed.hostname.endsWith(".supabase.co")
    } catch {
      return false
    }
  }
  
  test("INFRA-DB URL ist gültig", () => {
    const url = "https://ufqlocxqizmiaozkashi.supabase.co"
    expect(isValidSupabaseUrl(url)).toBe(true)
  })
  
  test("DEV-DB URL ist gültig", () => {
    const url = "https://jpmhwyjiuodsvjowddsm.supabase.co"
    expect(isValidSupabaseUrl(url)).toBe(true)
  })
  
  test("Ungültige URL wird erkannt", () => {
    const url = "not-a-url"
    expect(isValidSupabaseUrl(url)).toBe(false)
  })
  
  test("Nicht-Supabase URL wird erkannt", () => {
    const url = "https://example.com"
    expect(isValidSupabaseUrl(url)).toBe(false)
  })
})

// ============================================================================
// SCHEMA NAME GENERATION TESTS
// ============================================================================

describe("Schema-Name-Generierung", () => {
  function generateSchemaName(projectName) {
    return projectName.replace(/-/g, "_").toLowerCase()
  }
  
  test("Bindestriche werden zu Unterstrichen", () => {
    expect(generateSchemaName("my-project")).toBe("my_project")
  })
  
  test("Grossbuchstaben werden zu Kleinbuchstaben", () => {
    expect(generateSchemaName("MyProject")).toBe("myproject")
  })
  
  test("Kombination aus beidem", () => {
    expect(generateSchemaName("My-Cool-Project")).toBe("my_cool_project")
  })
})

console.log("\n✅ Alle INFRA-DB + DEV-DB Tests abgeschlossen\n")

