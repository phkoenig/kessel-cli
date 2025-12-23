#!/usr/bin/env node
/**
 * Tests für URL-Bereinigung und JWT-Validierung
 * 
 * Testet die Funktionen:
 * - cleanUrl() - Bereinigt URLs von ungültigen Zeichen
 * - extractProjectRefFromJwt() - Extrahiert Project-Ref aus JWT
 * - isKeyForProject() - Prüft ob ein Key zum Projekt passt
 */

import { describe, test, expect } from "./test-helpers.mjs"

console.log("🧪 URL & JWT Validation Tests\n")

// ============================================================================
// Hilfsfunktionen (kopiert aus Wizard.jsx für isolierte Tests)
// ============================================================================

/**
 * Bereinigt eine URL von Carriage-Return und anderen ungültigen Zeichen
 */
function cleanUrl(url) {
  if (!url) return ''
  return url.replace(/[\r\n#]+/g, '').trim()
}

/**
 * Extrahiert die Project-Ref aus einem Supabase JWT
 */
function extractProjectRefFromJwt(jwt) {
  if (!jwt || typeof jwt !== 'string') return null
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'))
    return payload.ref || null
  } catch {
    return null
  }
}

/**
 * Prüft, ob ein SERVICE_ROLE_KEY zum Projekt passt
 */
function isKeyForProject(serviceRoleKey, expectedProjectRef) {
  if (!serviceRoleKey || !expectedProjectRef) return false
  const keyProjectRef = extractProjectRefFromJwt(serviceRoleKey)
  return keyProjectRef === expectedProjectRef
}

// ============================================================================
// Tests
// ============================================================================

describe("cleanUrl() - URL-Bereinigung", () => {
  test("Entfernt \\r (Carriage Return) aus URL", () => {
    const dirty = '\r#\rhttps://example.supabase.co'
    const clean = cleanUrl(dirty)
    expect(clean).toBe('https://example.supabase.co')
  })

  test("Entfernt \\n (Newline) aus URL", () => {
    const dirty = 'https://example.supabase.co\n'
    const clean = cleanUrl(dirty)
    expect(clean).toBe('https://example.supabase.co')
  })

  test("Entfernt # aus URL", () => {
    const dirty = '###https://example.supabase.co###'
    const clean = cleanUrl(dirty)
    expect(clean).toBe('https://example.supabase.co')
  })

  test("Entfernt gemischte ungültige Zeichen", () => {
    const dirty = '\r\n#https://example.supabase.co\r\n#'
    const clean = cleanUrl(dirty)
    expect(clean).toBe('https://example.supabase.co')
  })

  test("Trimmt Whitespace", () => {
    const dirty = '   https://example.supabase.co   '
    const clean = cleanUrl(dirty)
    expect(clean).toBe('https://example.supabase.co')
  })

  test("Gibt leeren String für null zurück", () => {
    expect(cleanUrl(null)).toBe('')
  })

  test("Gibt leeren String für undefined zurück", () => {
    expect(cleanUrl(undefined)).toBe('')
  })

  test("Lässt valide URL unverändert", () => {
    const valid = 'https://ufqlocxqizmiaozkashi.supabase.co'
    expect(cleanUrl(valid)).toBe(valid)
  })
})

describe("extractProjectRefFromJwt() - JWT-Parsing", () => {
  // Echte Supabase JWT-Struktur (nur Base64-encoded, nicht signiert)
  const infraJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmcWxvY3hxaXptaWFvemthc2hpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTIzMTExMSwiZXhwIjoyMDgwODA3MTExfQ.ntLVeJZZIwVvjOnAkY9DnTuq7WeqkcsMxCZVpkPcktE'
  const devJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwbWh3eWppdW9kc3Zqb3dkZHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODYyNjQ0NCwiZXhwIjoyMDY0MjAyNDQ0fQ.U2nrk0Ih7xnPQJ-wtMLS3Tgr0WTNI77LeOFkzhkWwXc'

  test("Extrahiert INFRA-DB project_ref korrekt", () => {
    const ref = extractProjectRefFromJwt(infraJwt)
    expect(ref).toBe('ufqlocxqizmiaozkashi')
  })

  test("Extrahiert DEV-DB project_ref korrekt", () => {
    const ref = extractProjectRefFromJwt(devJwt)
    expect(ref).toBe('jpmhwyjiuodsvjowddsm')
  })

  test("Gibt null für ungültigen JWT zurück", () => {
    expect(extractProjectRefFromJwt('not-a-jwt')).toBeNull()
  })

  test("Gibt null für JWT mit nur 2 Teilen zurück", () => {
    expect(extractProjectRefFromJwt('part1.part2')).toBeNull()
  })

  test("Gibt null für leeren String zurück", () => {
    expect(extractProjectRefFromJwt('')).toBeNull()
  })

  test("Gibt null für null zurück", () => {
    expect(extractProjectRefFromJwt(null)).toBeNull()
  })

  test("Gibt null für undefined zurück", () => {
    expect(extractProjectRefFromJwt(undefined)).toBeNull()
  })

  test("Gibt null für Zahl zurück", () => {
    expect(extractProjectRefFromJwt(12345)).toBeNull()
  })

  test("Gibt null für ungültige Base64 zurück", () => {
    expect(extractProjectRefFromJwt('xxx.!!!invalid-base64!!!.yyy')).toBeNull()
  })
})

describe("isKeyForProject() - Key-Validierung", () => {
  const infraJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmcWxvY3hxaXptaWFvemthc2hpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTIzMTExMSwiZXhwIjoyMDgwODA3MTExfQ.ntLVeJZZIwVvjOnAkY9DnTuq7WeqkcsMxCZVpkPcktE'
  const devJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwbWh3eWppdW9kc3Zqb3dkZHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODYyNjQ0NCwiZXhwIjoyMDY0MjAyNDQ0fQ.U2nrk0Ih7xnPQJ-wtMLS3Tgr0WTNI77LeOFkzhkWwXc'

  test("INFRA-Key passt zur INFRA-DB", () => {
    expect(isKeyForProject(infraJwt, 'ufqlocxqizmiaozkashi')).toBeTruthy()
  })

  test("DEV-Key passt zur DEV-DB", () => {
    expect(isKeyForProject(devJwt, 'jpmhwyjiuodsvjowddsm')).toBeTruthy()
  })

  test("INFRA-Key passt NICHT zur DEV-DB", () => {
    expect(isKeyForProject(infraJwt, 'jpmhwyjiuodsvjowddsm')).toBeFalsy()
  })

  test("DEV-Key passt NICHT zur INFRA-DB", () => {
    expect(isKeyForProject(devJwt, 'ufqlocxqizmiaozkashi')).toBeFalsy()
  })

  test("Gibt false für null Key zurück", () => {
    expect(isKeyForProject(null, 'ufqlocxqizmiaozkashi')).toBeFalsy()
  })

  test("Gibt false für null projectRef zurück", () => {
    expect(isKeyForProject(infraJwt, null)).toBeFalsy()
  })

  test("Gibt false für ungültigen Key zurück", () => {
    expect(isKeyForProject('invalid-key', 'ufqlocxqizmiaozkashi')).toBeFalsy()
  })
})

describe("URL + JWT Integration", () => {
  test("Vollständiger Flow: URL bereinigen, Ref extrahieren, Key validieren", () => {
    // Simuliere den echten Fehlerfall
    const dirtyUrl = '\r#\rhttps://ufqlocxqizmiaozkashi.supabase.co'
    const wrongKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwbWh3eWppdW9kc3Zqb3dkZHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODYyNjQ0NCwiZXhwIjoyMDY0MjAyNDQ0fQ.U2nrk0Ih7xnPQJ-wtMLS3Tgr0WTNI77LeOFkzhkWwXc'
    const correctKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmcWxvY3hxaXptaWFvemthc2hpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTIzMTExMSwiZXhwIjoyMDgwODA3MTExfQ.ntLVeJZZIwVvjOnAkY9DnTuq7WeqkcsMxCZVpkPcktE'

    // 1. URL bereinigen
    const cleanedUrl = cleanUrl(dirtyUrl)
    expect(cleanedUrl).toBe('https://ufqlocxqizmiaozkashi.supabase.co')

    // 2. Project-Ref aus URL extrahieren
    const projectRef = new URL(cleanedUrl).hostname.split('.')[0]
    expect(projectRef).toBe('ufqlocxqizmiaozkashi')

    // 3. Falscher Key wird erkannt
    expect(isKeyForProject(wrongKey, projectRef)).toBeFalsy()
    
    // 4. Richtiger Key wird akzeptiert
    expect(isKeyForProject(correctKey, projectRef)).toBeTruthy()

    // 5. Ref aus falschem Key extrahieren für Fehlermeldung
    const wrongKeyRef = extractProjectRefFromJwt(wrongKey)
    expect(wrongKeyRef).toBe('jpmhwyjiuodsvjowddsm')
  })
})

console.log("\n✅ URL & JWT Validation Tests abgeschlossen\n")

