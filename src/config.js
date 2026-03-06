import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import chalk from "chalk"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Kandidatenpfade fuer die Boilerplate-.env.
 * Reihenfolge: explizit konfiguriert -> aktuelles Projekt -> typische Nachbarpfade.
 */
function getBoilerplateEnvPathCandidates() {
  const candidates = [
    process.env.KESSEL_BOILERPLATE_ENV_PATH,
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "kessel-boilerplate", ".env"),
    path.resolve(process.cwd(), "..", "kessel-boilerplate", ".env"),
    path.resolve(__dirname, "..", ".env"),
    path.resolve(__dirname, "..", "..", "kessel-boilerplate", ".env"),
  ].filter(Boolean)

  return [...new Set(candidates)]
}

/**
 * Ermittelt den ersten vorhandenen Boilerplate-.env-Pfad.
 * @returns {string|null}
 */
export function resolveBoilerplateEnvPath() {
  for (const candidate of getBoilerplateEnvPathCandidates()) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

// Legacy-Export fuer bestehende Importe
export const BOILERPLATE_ENV_PATH = resolveBoilerplateEnvPath()

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
  // 1) Hoechste Prioritaet: direkt aus Env (CI/Server/anderer Rechner)
  const directEnvKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY
  if (directEnvKey && directEnvKey.trim().length > 0) {
    return directEnvKey.trim()
  }

  // 2) Fallback: aus lokaler Boilerplate-.env lesen
  const envPath = resolveBoilerplateEnvPath()
  if (envPath && fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, "utf-8")
      const match = envContent.match(/(?:^|\n)(?:SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY)=(.+)/)
      if (match && match[1]) {
        return match[1].trim()
      }
    } catch (error) {
      console.error(chalk.red(`❌ Fehler beim Lesen der .env Datei: ${error.message}`))
      return null
    }
  } else {
    const candidates = getBoilerplateEnvPathCandidates()
    console.error(chalk.red("❌ Keine passende .env fuer SERVICE_ROLE_KEY gefunden."))
    console.error(chalk.yellow("   Setze SERVICE_ROLE_KEY direkt als Environment-Variable"))
    console.error(chalk.dim(`   Gepruefte Pfade: ${candidates.join(", ")}`))
    return null
  }
  return null
}

