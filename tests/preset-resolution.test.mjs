/**
 * Unit-Tests für Preset-Resolution und Env-Rendering
 * Phase 7: Clerk + SpacetimeDB Template-System
 */

import { strict as assert } from "node:assert"
import { PRESETS, DEFAULT_PRESET_ID, loadServiceRoleKey } from "../src/config.js"

const tests = []

function test(name, fn) {
  tests.push({ name, fn })
}

test("DEFAULT_PRESET_ID ist clerk-spacetimedb-ui", () => {
  assert.strictEqual(DEFAULT_PRESET_ID, "clerk-spacetimedb-ui")
})

test("PRESETS enthaelt clerk-spacetimedb-ui", () => {
  assert.ok(PRESETS["clerk-spacetimedb-ui"])
  assert.strictEqual(PRESETS["clerk-spacetimedb-ui"].id, "clerk-spacetimedb-ui")
  assert.ok(Array.isArray(PRESETS["clerk-spacetimedb-ui"].requiredEnv))
  assert.ok(PRESETS["clerk-spacetimedb-ui"].requiredEnv.includes("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"))
  assert.ok(PRESETS["clerk-spacetimedb-ui"].requiredEnv.includes("CLERK_SECRET_KEY"))
})

test("PRESETS enthaelt legacy-Preset", () => {
  assert.ok(PRESETS.legacy)
  assert.strictEqual(PRESETS.legacy.id, "legacy")
  assert.ok(PRESETS.legacy.requiredEnv.includes("SUPABASE_SERVICE_ROLE_KEY"))
})

test("clerk-spacetimedb-ui requiredEnv enthaelt Clerk und Supabase", () => {
  const preset = PRESETS["clerk-spacetimedb-ui"]
  assert.ok(preset.requiredEnv.includes("NEXT_PUBLIC_SUPABASE_URL"))
  assert.ok(preset.requiredEnv.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
  assert.ok(preset.requiredEnv.includes("SUPABASE_SERVICE_ROLE_KEY"))
  assert.ok(preset.requiredEnv.includes("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"))
  assert.ok(preset.requiredEnv.includes("CLERK_SECRET_KEY"))
})

test("clerk-spacetimedb-ui optionalEnv enthaelt SpacetimeDB", () => {
  const preset = PRESETS["clerk-spacetimedb-ui"]
  assert.ok(preset.optionalEnv.includes("NEXT_PUBLIC_SPACETIMEDB_ENABLED"))
  assert.ok(preset.optionalEnv.includes("CLERK_WEBHOOK_SIGNING_SECRET"))
})

test("Preset-Resolution: Ungueltiges Preset wirft nicht", () => {
  assert.strictEqual(PRESETS["invalid-preset"], undefined)
})

test("loadServiceRoleKey nutzt SERVICE_ROLE_KEY aus Environment", () => {
  const prevServiceRoleKey = process.env.SERVICE_ROLE_KEY
  const prevSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.SERVICE_ROLE_KEY = " test-key-from-service-role "
  delete process.env.SUPABASE_SERVICE_ROLE_KEY

  const result = loadServiceRoleKey()
  assert.strictEqual(result, "test-key-from-service-role")

  if (prevServiceRoleKey === undefined) {
    delete process.env.SERVICE_ROLE_KEY
  } else {
    process.env.SERVICE_ROLE_KEY = prevServiceRoleKey
  }
  if (prevSupabaseServiceRoleKey === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = prevSupabaseServiceRoleKey
  }
})

async function run() {
  let passed = 0
  let failed = 0
  for (const { name, fn } of tests) {
    try {
      fn()
      passed++
      console.log(`  ✓ ${name}`)
    } catch (err) {
      failed++
      console.error(`  ✗ ${name}`)
      console.error(`    ${err.message}`)
    }
  }
  console.log(`\nPreset-Resolution: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

run()
