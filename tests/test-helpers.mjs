/**
 * Einfache Test-Helper-Funktionen
 */

export function describe(name, fn) {
  console.log(`\n📦 ${name}`)
  fn()
}

export function test(name, fn) {
  try {
    fn()
    console.log(`  ✅ ${name}`)
  } catch (error) {
    console.error(`  ❌ ${name}`)
    console.error(`     ${error.message}`)
    throw error
  }
}

export function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, but got ${actual}`)
      }
    },
    toBeDefined() {
      if (actual === undefined || actual === null) {
        throw new Error(`Expected value to be defined, but got ${actual}`)
      }
    },
    toBeUndefined() {
      if (actual !== undefined) {
        throw new Error(`Expected value to be undefined, but got ${actual}`)
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected value to be null, but got ${actual}`)
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected value to be truthy, but got ${actual}`)
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected value to be falsy, but got ${actual}`)
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`)
      }
    },
    toContain(item) {
      if (Array.isArray(actual)) {
        if (!actual.includes(item)) {
          throw new Error(`Expected array to contain "${item}"`)
        }
      } else if (typeof actual === 'string') {
        if (!actual.includes(item)) {
          throw new Error(`Expected "${actual}" to contain "${item}"`)
        }
      } else {
        throw new Error(`toContain() expects string or array, got ${typeof actual}`)
      }
    },
    toMatch(regex) {
      if (!regex.test(actual)) {
        throw new Error(`Expected "${actual}" to match ${regex}`)
      }
    },
    toThrow() {
      if (typeof actual !== 'function') {
        throw new Error(`Expected a function, but got ${typeof actual}`)
      }
      let threw = false
      try {
        actual()
      } catch {
        threw = true
      }
      if (!threw) {
        throw new Error(`Expected function to throw, but it didn't`)
      }
    },
    toHaveLength(expected) {
      if (actual.length !== expected) {
        throw new Error(`Expected length ${expected}, but got ${actual.length}`)
      }
    },
    toHaveProperty(prop) {
      if (!(prop in actual)) {
        throw new Error(`Expected object to have property "${prop}"`)
      }
    }
  }
}

// Async test support
export async function testAsync(name, fn) {
  try {
    await fn()
    console.log(`  ✅ ${name}`)
  } catch (error) {
    console.error(`  ❌ ${name}`)
    console.error(`     ${error.message}`)
    throw error
  }
}

