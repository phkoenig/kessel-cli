import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import chalk from "chalk"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Pfad zur kessel-boilerplate .env Datei (absoluter Pfad)
export const BOILERPLATE_ENV_PATH = "B:/Nextcloud/CODE/proj/kessel-boilerplate/.env"

// Default-Werte
export const DEFAULTS = {
  infraDb: {
    name: "Kessel",
    url: "https://ufqlocxqizmiaozkashi.supabase.co",
    projectRef: "ufqlocxqizmiaozkashi",
    description: "INFRA-DB: User, Auth, Vault, Multi-Tenant Schemas",
  },
  devDb: {
    name: "MEGABRAIN",
    url: "https://jpmhwyjiuodsvjowddsm.supabase.co",
    projectRef: "jpmhwyjiuodsvjowddsm",
    description: "DEV-DB: App-Daten, Entwicklung",
  },
  defaultTemplateRepo: "phkoenig/kessel-boilerplate",
}

/** Presets fuer Template-Stacks (Phase 7: Clerk + SpacetimeDB) */
export const PRESETS = {
  "clerk-spacetimedb-ui": {
    id: "clerk-spacetimedb-ui",
    name: "Clerk + SpacetimeDB UI (Default)",
    templateRepo: "phkoenig/kessel-boilerplate",
    requiredEnv: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
    ],
    optionalEnv: [
      "CLERK_WEBHOOK_SIGNING_SECRET",
      "NEXT_PUBLIC_SPACETIMEDB_ENABLED",
      "NEXT_PUBLIC_SPACETIMEDB_URI",
      "NEXT_PUBLIC_SPACETIMEDB_DATABASE",
    ],
    postSetupHooks: ["pnpm pull-env", "pnpm install"],
  },
  legacy: {
    id: "legacy",
    name: "Legacy (Supabase Auth)",
    templateRepo: "phkoenig/kessel-boilerplate",
    requiredEnv: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
    optionalEnv: [],
    postSetupHooks: ["pnpm pull-env", "pnpm install"],
  },
}

export const DEFAULT_PRESET_ID = "clerk-spacetimedb-ui"

/**
 * Lade Config-Datei (falls vorhanden)
 * @returns {Object} Config-Objekt mit infraDb, devDb, etc.
 */
export function loadConfig() {
  const configPath = path.join(__dirname, "..", "config.json")
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
      // Füge Kompatibilitäts-Properties hinzu
      return {
        ...config,
        // Legacy-Kompatibilität: defaultSupabaseUrl zeigt auf INFRA-DB (Vault)
        defaultSupabaseUrl: config.infraDb?.url || DEFAULTS.infraDb.url,
        // Legacy-Kompatibilität: sharedSupabaseProject = INFRA-DB
        sharedSupabaseProject: {
          url: config.infraDb?.url || DEFAULTS.infraDb.url,
          projectRef: config.infraDb?.projectRef || DEFAULTS.infraDb.projectRef,
        },
      }
    } catch (error) {
      console.warn(chalk.yellow("⚠️  Konfigurationsdatei konnte nicht geladen werden, verwende Standardwerte"))
    }
  }
  // Defaults: INFRA-DB = Kessel, DEV-DB = MEGABRAIN
  return {
    ...DEFAULTS,
    // Legacy-Kompatibilität
    defaultSupabaseUrl: DEFAULTS.infraDb.url,
    sharedSupabaseProject: {
      url: DEFAULTS.infraDb.url,
      projectRef: DEFAULTS.infraDb.projectRef,
    },
  }
}

/**
 * Lade SERVICE_ROLE_KEY aus boilerplate .env
 * @returns {string|null} Service Role Key oder null
 */
export function loadServiceRoleKey() {
  if (fs.existsSync(BOILERPLATE_ENV_PATH)) {
    try {
      const envContent = fs.readFileSync(BOILERPLATE_ENV_PATH, "utf-8")
      const match = envContent.match(/SERVICE_ROLE_KEY=(.+)/)
      if (match && match[1]) {
        return match[1].trim()
      }
    } catch (error) {
      console.error(chalk.red(`❌ Fehler beim Lesen der .env Datei: ${error.message}`))
      return null
    }
  } else {
    console.error(chalk.red(`❌ .env Datei nicht gefunden: ${BOILERPLATE_ENV_PATH}`))
    return null
  }
  return null
}

