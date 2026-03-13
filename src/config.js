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
  appDb: {
    name: "App Supabase",
    url: "https://ufqlocxqizmiaozkashi.supabase.co",
    projectRef: "ufqlocxqizmiaozkashi",
    description: "App-DB + Storage der aktuellen Ableitung",
  },
  defaultTemplateRepo: "phkoenig/kessel-boilerplate",
  secretsProvider: {
    type: "1password",
    manifestPath: "scripts/pull-env.manifest.json",
  },
}

/** Presets fuer Template-Stacks (Phase 7: Clerk + SpacetimeDB) */
export const PRESETS = {
  "boilerplate-3-0": {
    id: "boilerplate-3-0",
    name: "Boilerplate 3.0 (Clerk + Spacetime + App Supabase)",
    templateRepo: "phkoenig/kessel-boilerplate",
    requiredEnv: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
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
      "NEXT_PUBLIC_SPACETIMEDB_ENABLED",
    ],
    postSetupHooks: ["pnpm pull-env", "pnpm install"],
  },
  "clerk-spacetimedb-ui": {
    id: "clerk-spacetimedb-ui",
    name: "Clerk + SpacetimeDB UI (Alias auf Boilerplate 3.0)",
    templateRepo: "phkoenig/kessel-boilerplate",
    requiredEnv: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
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
      "NEXT_PUBLIC_SPACETIMEDB_ENABLED",
    ],
    postSetupHooks: ["pnpm pull-env", "pnpm install"],
  },
}

export const DEFAULT_PRESET_ID = "boilerplate-3-0"

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
        appDb: config.appDb || config.devDb || DEFAULTS.appDb,
        infraDb: config.infraDb || config.appDb || config.devDb || DEFAULTS.appDb,
        devDb: config.devDb || config.appDb || DEFAULTS.appDb,
        defaultSupabaseUrl:
          config.appDb?.url || config.devDb?.url || config.infraDb?.url || DEFAULTS.appDb.url,
        sharedSupabaseProject: {
          url:
            config.appDb?.url || config.devDb?.url || config.infraDb?.url || DEFAULTS.appDb.url,
          projectRef:
            config.appDb?.projectRef ||
            config.devDb?.projectRef ||
            config.infraDb?.projectRef ||
            DEFAULTS.appDb.projectRef,
        },
      }
    } catch (error) {
      console.warn(chalk.yellow("⚠️  Konfigurationsdatei konnte nicht geladen werden, verwende Standardwerte"))
    }
  }
  // Defaults: INFRA-DB = Kessel, DEV-DB = MEGABRAIN
  return {
    ...DEFAULTS,
    infraDb: DEFAULTS.appDb,
    devDb: DEFAULTS.appDb,
    defaultSupabaseUrl: DEFAULTS.appDb.url,
    sharedSupabaseProject: {
      url: DEFAULTS.appDb.url,
      projectRef: DEFAULTS.appDb.projectRef,
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

