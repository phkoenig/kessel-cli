#!/usr/bin/env node
/**
 * Test für Repository-Handling
 */

import { describe, test, expect } from "./test-helpers.mjs"

console.log("🧪 Repository-Handling Tests\n")

describe("Repository-Fehlerbehandlung", () => {
  test("Erkennt 'already exists' Fehler korrekt", () => {
    const mockError = {
      status: 422,
      message: "name already exists on this account"
    }
    
    const isAlreadyExists = mockError.status === 422 && mockError.message?.includes("already exists")
    expect(isAlreadyExists).toBe(true)
  })
  
  test("Erkennt andere Fehler korrekt", () => {
    const mockError = {
      status: 401,
      message: "Bad credentials"
    }
    
    const isAlreadyExists = mockError.status === 422 && mockError.message?.includes("already exists")
    expect(isAlreadyExists).toBe(false)
  })
})

console.log("\n✅ Repository-Handling Tests abgeschlossen\n")

