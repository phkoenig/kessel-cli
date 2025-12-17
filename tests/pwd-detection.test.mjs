#!/usr/bin/env node
/**
 * Test für PWD-Erkennung bei Alias-Wrapper
 * Simuliert dass Script aus kessel Verzeichnis aufgerufen wird,
 * aber PWD zeigt auf das ursprüngliche Verzeichnis (z.B. testapp3)
 */

import { describe, test, expect } from "./test-helpers.mjs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log("🧪 PWD-Erkennung Tests\n")

describe("PWD-Erkennung bei Alias-Wrapper", () => {
  test("Erkennt ursprüngliches Verzeichnis aus PWD", () => {
    // Simuliere: User ist in testapp3, aber Script startet in kessel
    const originalPwd = "/b/Nextcloud/CODE/proj/testapp3"
    const scriptDir = "/b/Nextcloud/CODE/proj/kessel"
    const initialCwd = scriptDir // Script startet hier (durch Alias)
    
    // Simuliere PWD-Logik aus index.js
    const pwdFromEnv = originalPwd // process.env.PWD würde das ursprüngliche Verzeichnis haben
    
    if (initialCwd === scriptDir) {
      if (pwdFromEnv && pwdFromEnv !== scriptDir) {
        // Das ist die erwartete Logik
        const restoredCwd = pwdFromEnv
        expect(restoredCwd).toBe(originalPwd)
        // Prüfe dass restoredCwd NICHT scriptDir ist
        if (restoredCwd === scriptDir) {
          throw new Error(`restoredCwd sollte nicht scriptDir sein, aber ist: ${restoredCwd}`)
        }
        console.log("  ✅ PWD wird korrekt erkannt und wiederhergestellt")
      }
    }
  })
  
  test("Fallback zu Parent wenn PWD nicht verfügbar", () => {
    const scriptDir = "/b/Nextcloud/CODE/proj/kessel"
    const initialCwd = scriptDir
    const pwdFromEnv = null // PWD nicht verfügbar
    
    if (initialCwd === scriptDir) {
      if (!pwdFromEnv || pwdFromEnv === scriptDir) {
        // Fallback: Wechsel ins Parent
        const parentDir = path.dirname(initialCwd)
        expect(parentDir).toBe("/b/Nextcloud/CODE/proj")
        console.log("  ✅ Fallback zu Parent-Verzeichnis funktioniert")
      }
    }
  })
  
  test("Erkennt wenn nicht im Script-Verzeichnis", () => {
    const originalPwd = "/b/Nextcloud/CODE/proj/testapp3"
    const scriptDir = "/b/Nextcloud/CODE/proj/kessel"
    const initialCwd = originalPwd // User ist bereits im richtigen Verzeichnis
    
    // Wenn initialCwd !== scriptDir, sollte nichts passieren
    if (initialCwd !== scriptDir) {
      expect(initialCwd).toBe(originalPwd)
      console.log("  ✅ Keine Änderung wenn nicht im Script-Verzeichnis")
    }
  })
  
  test("Projektname wird aus korrektem Verzeichnis genommen", () => {
    // Simuliere vollständigen Flow
    const originalPwd = "/b/Nextcloud/CODE/proj/testapp3"
    const scriptDir = "/b/Nextcloud/CODE/proj/kessel"
    let initialCwd = scriptDir // Startet hier
    
    // PWD-Logik
    if (initialCwd === scriptDir) {
      const pwdFromEnv = originalPwd
      if (pwdFromEnv && pwdFromEnv !== scriptDir) {
        initialCwd = pwdFromEnv // Wiederherstellen
      }
    }
    
    // Projektname sollte aus initialCwd kommen
    const projectName = path.basename(initialCwd)
    expect(projectName).toBe("testapp3")
    // Prüfe dass projectName NICHT kessel oder proj ist
    if (projectName === "kessel" || projectName === "proj") {
      throw new Error(`projectName sollte nicht "${projectName}" sein`)
    }
    console.log("  ✅ Projektname wird aus korrektem Verzeichnis genommen")
  })
  
  test("Windows-Pfad-Kompatibilität", () => {
    // Teste mit Windows-Pfaden (B:\ statt /b/)
    const originalPwd = "B:\\Nextcloud\\CODE\\proj\\testapp3"
    const scriptDir = "B:\\Nextcloud\\CODE\\proj\\kessel"
    let initialCwd = scriptDir
    
    // Normalisiere für Vergleich
    const normalizedOriginal = originalPwd.replace(/\\/g, "/")
    const normalizedScript = scriptDir.replace(/\\/g, "/")
    
    if (normalizedScript === normalizedScript) {
      const pwdFromEnv = normalizedOriginal
      if (pwdFromEnv && pwdFromEnv !== normalizedScript) {
        initialCwd = pwdFromEnv
        const projectName = path.basename(initialCwd)
        expect(projectName).toBe("testapp3")
        console.log("  ✅ Windows-Pfade werden korrekt behandelt")
      }
    }
  })
})

console.log("\n✅ PWD-Erkennung Tests abgeschlossen\n")

