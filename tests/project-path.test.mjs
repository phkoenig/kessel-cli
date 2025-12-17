#!/usr/bin/env node
/**
 * Test für Project Path Berechnung
 */

import { describe, test, expect } from "./test-helpers.mjs"
import path from "path"

console.log("🧪 Project Path Validierung Tests\n")

describe("Project Path Berechnung", () => {
  test("Projektname = Ordnername → verwendet aktuelles Verzeichnis", () => {
    const currentDir = "/b/Nextcloud/CODE/proj/testapp3"
    const currentDirBasename = path.basename(currentDir)
    const normalizedCurrentDirBasename = currentDirBasename.replace(/_/g, "-").toLowerCase()
    
    const projectName = "testapp3"
    const normalizedProjectName = projectName.replace(/_/g, "-").toLowerCase()
    
    const isCurrentDir = normalizedProjectName === normalizedCurrentDirBasename
    const projectPath = isCurrentDir ? currentDir : path.resolve(currentDir, projectName)
    
    expect(isCurrentDir).toBe(true)
    expect(projectPath).toBe(currentDir)
  })
  
  test("Projektname != Ordnername → erstellt neuen Ordner", () => {
    const currentDir = "/b/Nextcloud/CODE/proj/testapp3"
    const currentDirBasename = path.basename(currentDir)
    const normalizedCurrentDirBasename = currentDirBasename.replace(/_/g, "-").toLowerCase()
    
    const projectName = "other-project"
    const normalizedProjectName = projectName.replace(/_/g, "-").toLowerCase()
    
    const isCurrentDir = normalizedProjectName === normalizedCurrentDirBasename
    const projectPath = isCurrentDir ? currentDir : path.resolve(currentDir, projectName)
    
    expect(isCurrentDir).toBe(false)
    // Normalisiere Pfad für plattform-agnostischen Vergleich
    const normalizedPath = projectPath.replace(/\\/g, "/").toLowerCase()
    expect(normalizedPath).toContain("testapp3/other-project")
  })
  
  test("Normalisierung: test_app_3 = test-app-3", () => {
    const currentDir = "/b/Nextcloud/CODE/proj/test_app_3"
    const currentDirBasename = path.basename(currentDir)
    const normalizedCurrentDirBasename = currentDirBasename.replace(/_/g, "-").toLowerCase()
    
    const projectName = "test-app-3"
    const normalizedProjectName = projectName.replace(/_/g, "-").toLowerCase()
    
    const isCurrentDir = normalizedProjectName === normalizedCurrentDirBasename
    const projectPath = isCurrentDir ? currentDir : path.resolve(currentDir, projectName)
    
    expect(normalizedCurrentDirBasename).toBe("test-app-3")
    expect(normalizedProjectName).toBe("test-app-3")
    expect(isCurrentDir).toBe(true)
    expect(projectPath).toBe(currentDir)
  })
  
  test("Projektname mit Unterstrich wird normalisiert", () => {
    const currentDir = "/b/Nextcloud/CODE/proj/testapp3"
    const currentDirBasename = path.basename(currentDir)
    const normalizedCurrentDirBasename = currentDirBasename.replace(/_/g, "-").toLowerCase()
    
    const projectName = "test_app_3"
    const normalizedProjectName = projectName.replace(/_/g, "-").toLowerCase()
    
    const isCurrentDir = normalizedProjectName === normalizedCurrentDirBasename
    const projectPath = isCurrentDir ? currentDir : path.resolve(currentDir, projectName)
    
    expect(normalizedProjectName).toBe("test-app-3")
    expect(isCurrentDir).toBe(false) // test-app-3 != testapp3
    // Normalisiere Pfad für plattform-agnostischen Vergleich
    const normalizedPath = projectPath.replace(/\\/g, "/").toLowerCase()
    expect(normalizedPath).toContain("testapp3/test_app_3")
  })
  
  test("Verschiedene Kombinationen werden korrekt erkannt", () => {
    const testCases = [
      {
        currentDir: "/b/Nextcloud/CODE/proj/testapp3",
        projectName: "testapp3",
        expectedIsCurrentDir: true,
        expectedPathContains: "testapp3"
      },
      {
        currentDir: "/b/Nextcloud/CODE/proj/testapp3",
        projectName: "test-app-3",
        expectedIsCurrentDir: false, // test-app-3 != testapp3
        expectedPathContains: "testapp3/test-app-3"
      },
      {
        currentDir: "/b/Nextcloud/CODE/proj/test-app-3",
        projectName: "test-app-3",
        expectedIsCurrentDir: true,
        expectedPathContains: "test-app-3"
      },
      {
        currentDir: "/b/Nextcloud/CODE/proj/test_app_3",
        projectName: "test-app-3",
        expectedIsCurrentDir: true, // test-app-3 == test-app-3 (normalisiert)
        expectedPathContains: "test_app_3"
      }
    ]
    
    testCases.forEach((testCase, index) => {
      const currentDirBasename = path.basename(testCase.currentDir)
      const normalizedCurrentDirBasename = currentDirBasename.replace(/_/g, "-").toLowerCase()
      
      const normalizedProjectName = testCase.projectName.replace(/_/g, "-").toLowerCase()
      
      const isCurrentDir = (
        normalizedProjectName === normalizedCurrentDirBasename ||
        testCase.projectName === currentDirBasename
      )
      
      const projectPath = isCurrentDir 
        ? testCase.currentDir 
        : path.resolve(testCase.currentDir, testCase.projectName)
      
      expect(isCurrentDir).toBe(testCase.expectedIsCurrentDir)
      // Normalisiere Pfad für plattform-agnostischen Vergleich
      const normalizedPath = projectPath.replace(/\\/g, "/").toLowerCase()
      const expectedPath = testCase.expectedPath || testCase.expectedPathContains
      if (testCase.expectedPathContains) {
        expect(normalizedPath).toContain(testCase.expectedPathContains.toLowerCase())
      } else {
        expect(normalizedPath).toBe(expectedPath.replace(/\\/g, "/").toLowerCase())
      }
    })
  })
  
  test("Project Path wird nicht in kessel erstellt", () => {
    const currentDir = "/b/Nextcloud/CODE/proj/testapp3"
    const projectName = "testapp3"
    
    const currentDirBasename = path.basename(currentDir)
    const normalizedCurrentDirBasename = currentDirBasename.replace(/_/g, "-").toLowerCase()
    const normalizedProjectName = projectName.replace(/_/g, "-").toLowerCase()
    
    const isCurrentDir = normalizedProjectName === normalizedCurrentDirBasename
    const projectPath = isCurrentDir ? currentDir : path.resolve(currentDir, projectName)
    
    // Prüfe dass projectPath NICHT in kessel liegt
    const isInCreateMyApp = projectPath.includes("kessel")
    expect(isInCreateMyApp).toBe(false)
    expect(projectPath).toBe(currentDir)
  })
})

console.log("\n✅ Project Path Validierung Tests abgeschlossen\n")

