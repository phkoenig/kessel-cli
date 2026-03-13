import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import chalk from "chalk"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Default-Werte fuer Boilerplate 3.0 Architektur
// Supabase = App-Daten | Clerk = Auth | SpacetimeDB = UX-Core
export const DEFAULTS = {
  templateRepo: "phkoenig/kessel-boilerplate",
  spacetimeUri: "wss://maincloud.spacetimedb.com",
  spacetimeCoreDriver: "spacetime",
  secretsProvider: {
    type: "1password",
    manifestPath: "scripts/pull-env.manifest.json",
  },
}

/** Preset fuer Boilerplate 3.0 Stack */
export const PRESETS = {
  "boilerplate-3-0": {
    id: "boilerplate-3-0",
    name: "Boilerplate 3.0 (Clerk + SpacetimeDB + Supabase)",
    templateRepo: "phkoenig/kessel-boilerplate",
    requiredEnv: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
      "NEXT_PUBLIC_SPACETIMEDB_URI",
      "NEXT_PUBLIC_SPACETIMEDB_DATABASE",
      "NEXT_PUBLIC_BOILERPLATE_CORE_DRIVER",
      "NEXT_PUBLIC_TENANT_SLUG",
    ],
    optionalEnv: [
      "CLERK_WEBHOOK_SIGNING_SECRET",
    ],
    postSetupHooks: ["pnpm pull-env", "pnpm install"],
  },
}

export const DEFAULT_PRESET_ID = "boilerplate-3-0"

/**
 * Lade Config-Datei (falls vorhanden)
 * @returns {Object} Config-Objekt
 */
export function loadConfig() {
  const configPath = path.join(__dirname, "..", "config.json")
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"))
    } catch (error) {
      console.warn(chalk.yellow("⚠️  Konfigurationsdatei konnte nicht geladen werden"))
    }
  }
  return {}
}
