import { execSync } from "child_process"
import inquirer from "inquirer"
import chalk from "chalk"
import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"
import {
  loadProfile,
  saveProfile,
  normalizeUsername,
  profileExists,
  getProfileDir,
} from "./profile.js"
import { updateProgress } from "./progress.js"

// Default-Werte für INFRA-DB und DEV-DB
const DEFAULTS = {
  infraDb: {
    name: "Kessel",
    url: "https://ufqlocxqizmiaozkashi.supabase.co",
    projectRef: "ufqlocxqizmiaozkashi",
  },
  devDb: {
    name: "MEGABRAIN",
    url: "https://jpmhwyjiuodsvjowddsm.supabase.co",
    projectRef: "jpmhwyjiuodsvjowddsm",
  },
}

/**
 * Prüft ob GitHub CLI installiert ist
 * @returns {boolean} - true wenn installiert
 */
export function isGitHubCLIInstalled() {
  try {
    execSync("gh --version", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

/**
 * Prüft ob GitHub CLI authentifiziert ist
 * @returns {boolean} - true wenn authentifiziert
 */
export function isGitHubCLIAuthenticated() {
  try {
    const token = execSync("gh auth token", {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim()
    return token && token.length > 0
  } catch {
    return false
  }
}

/**
 * Prüft und installiert GitHub CLI, authentifiziert falls nötig
 * @param {Object} progressBar - Progress Bar Objekt (optional)
 * @returns {Promise<string>} - GitHub Token
 */
export async function checkGitHubCLI(progressBar = null, silent = false) {
  if (!silent) {
    updateProgress(progressBar, null, "Prüfe GitHub CLI...")
  }

  // Prüfe Installation
  if (!isGitHubCLIInstalled()) {
    if (!silent) {
      console.log(chalk.yellow("\n⚠️  GitHub CLI nicht gefunden"))
      const { install } = await inquirer.prompt([
        {
          type: "confirm",
          name: "install",
          message: "Möchtest du GitHub CLI jetzt installieren? (Siehe: https://cli.github.com/)",
          default: false,
        },
      ])

      if (!install) {
        throw new Error("GitHub CLI ist erforderlich. Bitte installiere es manuell.")
      }
    }

    throw new Error(
      "GitHub CLI ist nicht installiert.\n" +
      "Siehe: https://cli.github.com/manual/installation"
    )
  }

  if (!silent) {
    updateProgress(progressBar, null, "Prüfe GitHub Authentifizierung...")
  }

  // Prüfe Authentifizierung
  if (!isGitHubCLIAuthenticated()) {
    if (!silent) {
      console.log(chalk.yellow("\n⚠️  GitHub CLI nicht authentifiziert"))
      const { login } = await inquirer.prompt([
        {
          type: "confirm",
          name: "login",
          message: "Möchtest du dich jetzt bei GitHub anmelden?",
          default: true,
        },
      ])

      if (login) {
        console.log(chalk.blue("Öffne GitHub Login..."))
        try {
          execSync("gh auth login", { stdio: "inherit" })
        } catch (error) {
          throw new Error(`GitHub Login fehlgeschlagen: ${error.message}`)
        }
      } else {
        throw new Error("GitHub Authentifizierung ist erforderlich.")
      }
    } else {
      throw new Error("GitHub CLI ist nicht authentifiziert. Bitte führe 'gh auth login' aus.")
    }
  }

  // Hole Token
  if (!silent) {
    updateProgress(progressBar, null, "GitHub Token abrufen...")
  }
  try {
    const token = execSync("gh auth token", {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim()

    if (!token || token.length === 0) {
      throw new Error("GitHub Token konnte nicht abgerufen werden")
    }

    return token
  } catch (error) {
    throw new Error(`Fehler beim Abrufen des GitHub Tokens: ${error.message}`)
  }
}

/**
 * Prüft ob Vercel CLI installiert ist
 * @returns {boolean} - true wenn installiert
 */
export function isVercelCLIInstalled() {
  try {
    execSync("vercel --version", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

/**
 * Prüft ob Vercel CLI authentifiziert ist
 * @returns {boolean} - true wenn authentifiziert
 */
export function isVercelCLIAuthenticated() {
  try {
    execSync("vercel whoami", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

/**
 * Prüft und installiert Vercel CLI, authentifiziert falls nötig
 * @param {Object} progressBar - Progress Bar Objekt (optional)
 * @returns {Promise<void>}
 */
export async function checkVercelCLI(progressBar = null) {
  updateProgress(progressBar, null, "Prüfe Vercel CLI...")

  // Prüfe Installation
  if (!isVercelCLIInstalled()) {
    console.log(chalk.yellow("\n⚠️  Vercel CLI nicht gefunden"))
    const { install } = await inquirer.prompt([
      {
        type: "confirm",
        name: "install",
        message: "Möchtest du Vercel CLI jetzt installieren? (npm install -g vercel)",
        default: false,
      },
    ])

    if (install) {
      console.log(chalk.blue("Installiere Vercel CLI..."))
      try {
        execSync("npm install -g vercel", { stdio: "inherit" })
      } catch (error) {
        throw new Error(`Vercel CLI Installation fehlgeschlagen: ${error.message}`)
      }
    } else {
      console.log(chalk.dim("Vercel CLI wird übersprungen (optional)"))
      return
    }
  }

  updateProgress(progressBar, null, "Prüfe Vercel Authentifizierung...")

  // Prüfe Authentifizierung
  if (!isVercelCLIAuthenticated()) {
    console.log(chalk.yellow("\n⚠️  Vercel CLI nicht authentifiziert"))
    const { login } = await inquirer.prompt([
      {
        type: "confirm",
        name: "login",
        message: "Möchtest du dich jetzt bei Vercel anmelden?",
        default: false,
      },
    ])

    if (login) {
      console.log(chalk.blue("Öffne Vercel Login..."))
      try {
        execSync("vercel login", { stdio: "inherit" })
      } catch (error) {
        console.log(chalk.yellow("⚠️  Vercel Login fehlgeschlagen (optional)"))
      }
    }
  }

  updateProgress(progressBar, null, "Vercel CLI bereit")
}

/**
 * Prüft ob pnpm installiert ist
 * @returns {boolean} - true wenn installiert
 */
export function isPnpmInstalled() {
  try {
    execSync("pnpm --version", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

/**
 * Prüft ob npm installiert ist
 * @returns {boolean} - true wenn installiert
 */
export function isNpmInstalled() {
  try {
    execSync("npm --version", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

/**
 * Prüft Package Manager: Bevorzugt pnpm, Fallback zu npm
 * @param {Object} progressBar - Progress Bar Objekt (optional)
 * @returns {Promise<{name: string, command: string}>} - Package Manager Info
 */
export async function checkPackageManager(progressBar = null, silent = false) {
  if (!silent) {
    updateProgress(progressBar, null, "Prüfe Package Manager...")
  }

  // Prüfe zuerst pnpm
  if (isPnpmInstalled()) {
    const version = execSync("pnpm --version", { encoding: "utf-8", stdio: "pipe" }).trim()
    if (!silent) {
      console.log(chalk.green(`✓ pnpm gefunden (Version ${version})`))
      updateProgress(progressBar, null, "pnpm bereit")
    }
    return {
      name: "pnpm",
      command: "pnpm",
      installCommand: "pnpm install",
      devCommand: "pnpm dev",
    }
  }

  // Fallback zu npm
  if (isNpmInstalled()) {
    const version = execSync("npm --version", { encoding: "utf-8", stdio: "pipe" }).trim()
    if (!silent) {
      console.log(chalk.yellow(`⚠️  pnpm nicht gefunden, verwende npm (Version ${version})`))
      console.log(chalk.dim("   Tipp: pnpm wird empfohlen. Installiere mit: npm install -g pnpm"))
      updateProgress(progressBar, null, "npm bereit")
    }
    return {
      name: "npm",
      command: "npm",
      installCommand: "npm install",
      devCommand: "npm run dev",
    }
  }

  // Kein Package Manager gefunden
  throw new Error(
    "Weder pnpm noch npm gefunden. Bitte installiere einen Package Manager:\n" +
    "  - pnpm: npm install -g pnpm (empfohlen)\n" +
    "  - npm: sollte mit Node.js installiert sein"
  )
}

/**
 * Prüft ob Supabase CLI installiert ist
 * @returns {boolean} - true wenn installiert
 */
export function isSupabaseCLIInstalled() {
  try {
    execSync("supabase --version", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

/**
 * Prüft und installiert Supabase CLI
 * @param {Object} progressBar - Progress Bar Objekt (optional)
 * @returns {Promise<void>}
 */
export async function checkSupabaseCLI(progressBar = null, silent = false) {
  if (!silent) {
    updateProgress(progressBar, null, "Prüfe Supabase CLI...")
  }

  if (!isSupabaseCLIInstalled()) {
    if (!silent) {
      console.log(chalk.yellow("\n⚠️  Supabase CLI nicht gefunden"))
      const { install } = await inquirer.prompt([
        {
          type: "confirm",
          name: "install",
          message: "Möchtest du Supabase CLI jetzt installieren? (Siehe: https://supabase.com/docs/guides/cli)",
          default: false,
        },
      ])

      if (!install) {
        throw new Error("Supabase CLI ist erforderlich. Bitte installiere es manuell.")
      }
    }

    throw new Error(
      "Supabase CLI ist nicht installiert.\n" +
      "Siehe: https://supabase.com/docs/guides/cli/getting-started"
    )
  }

  if (!silent) {
    updateProgress(progressBar, null, "Supabase CLI bereit")
  }
}

/**
 * Setup Supabase: Lädt/erstellt Profil und fragt INFRA-DB und DEV-DB URLs ab
 * 
 * Architektur:
 * - INFRA-DB (Kessel): User, Auth, Vault, Multi-Tenant Schemas
 * - DEV-DB (MEGABRAIN): App-Daten, fachliche Entwicklung
 * 
 * @param {Object} progressBar - Progress Bar Objekt (optional)
 * @param {string} projectRoot - Root-Verzeichnis des Projekts (optional)
 * @returns {Promise<Object>} - { username, infraDbUrl, devDbUrl, profile }
 */
export async function setupSupabase(progressBar = null, projectRoot = null) {
  updateProgress(progressBar, null, "Supabase Setup...")

  // Prüfe zuerst, ob bereits ein Profil existiert
  let existingProfile = null
  let existingUsername = null
  let profileSource = null // "local" oder "system"
  
  // 1. SCHRITT: Suche zuerst im Projekt-Root-Verzeichnis nach lokalem Profil
  if (projectRoot) {
    try {
      const localProfileFiles = fs.readdirSync(projectRoot)
        .filter(f => f.endsWith('.kesselprofile'))
      
      if (localProfileFiles.length > 0) {
        // Sortiere nach Änderungsdatum (neuestes zuerst) - wie bei systemweit
        const localProfilesWithStats = localProfileFiles.map(file => {
          const filePath = path.join(projectRoot, file)
          try {
            const stats = fs.statSync(filePath)
            return { file, path: filePath, mtime: stats.mtime }
          } catch {
            return null
          }
        }).filter(Boolean)
        
        if (localProfilesWithStats.length > 0) {
          localProfilesWithStats.sort((a, b) => b.mtime - a.mtime) // Neuestes zuerst
          
          // Lade das neueste lokale Profil
          const newestLocalProfile = localProfilesWithStats[0]
          const profilePath = newestLocalProfile.path
          const usernameFromFile = newestLocalProfile.file.replace('.kesselprofile', '')
          
          // Lade Profil direkt aus Datei
          try {
            const content = fs.readFileSync(profilePath, "utf-8")
            const profile = {}
            
            // Parse .env-Format
            const lines = content.split("\n")
            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || trimmed.startsWith("#")) continue
              const match = trimmed.match(/^([^=]+)=(.*)$/)
              if (match) {
                const key = match[1].trim()
                const value = match[2].trim().replace(/^["']|["']$/g, "")
                profile[key] = value
              }
            }
            
            // Verwende USERNAME aus Profil oder Dateinamen
            const profileUsername = profile.USERNAME || usernameFromFile
            // Akzeptiere Profil wenn entweder neue oder alte Variablen vorhanden sind
            const hasInfraUrl = profile.SUPABASE_INFRA_URL || profile.SUPABASE_BACKEND_URL
            if (profileUsername && hasInfraUrl) {
              existingProfile = profile
              existingProfile.USERNAME = profileUsername
              existingUsername = profileUsername
              profileSource = "local"
              console.log(chalk.cyan(`📋 Lokales Profil gefunden: ${newestLocalProfile.file}`))
              console.log(chalk.dim(`   Pfad: ${profilePath}`))
              if (localProfilesWithStats.length > 1) {
                console.log(chalk.dim(`   (${localProfilesWithStats.length} Profile gefunden, neuestes verwendet)`))
              }
              console.log(chalk.dim(`   Username: ${profileUsername}`))
              if (profile.SUPABASE_INFRA_URL) {
                console.log(chalk.dim(`   INFRA-DB: ${profile.SUPABASE_INFRA_URL}`))
              } else if (profile.SUPABASE_BACKEND_URL) {
                console.log(chalk.dim(`   INFRA-DB (legacy): ${profile.SUPABASE_BACKEND_URL}`))
              }
              if (profile.SUPABASE_DEV_URL) {
                console.log(chalk.dim(`   DEV-DB: ${profile.SUPABASE_DEV_URL}`))
              }
            }
          } catch (error) {
            // Fehler beim Laden des lokalen Profils - ignorieren
          }
        }
      }
    } catch (error) {
      // Fehler beim Lesen des Projekt-Verzeichnisses - ignorieren
    }
  }
  
  // 2. SCHRITT: Falls kein lokales Profil gefunden, frag ob systemweit gesucht werden soll
  if (!existingProfile) {
    const { searchSystemwide } = await inquirer.prompt([
      {
        type: "confirm",
        name: "searchSystemwide",
        message: "Kein lokales Profil gefunden. Systemweit nach Profil suchen?",
        default: true,
      },
    ])
    
    if (searchSystemwide) {
      // Suche nach allen Profilen im systemweiten .kessel Verzeichnis
      try {
        const profileDir = getProfileDir()
        if (fs.existsSync(profileDir)) {
          const files = fs.readdirSync(profileDir)
          const profileFiles = files.filter(f => f.endsWith('.kesselprofile'))
          
          if (profileFiles.length > 0) {
            // Sortiere nach Änderungsdatum (neuestes zuerst)
            const profilesWithStats = profileFiles.map(file => {
              const filePath = path.join(profileDir, file)
              try {
                const stats = fs.statSync(filePath)
                return { file, path: filePath, mtime: stats.mtime }
              } catch {
                return null
              }
            }).filter(Boolean)
            
            if (profilesWithStats.length > 0) {
              profilesWithStats.sort((a, b) => b.mtime - a.mtime) // Neuestes zuerst
              
              // Lade das neueste Profil
              const newestProfile = profilesWithStats[0]
              const usernameFromFile = newestProfile.file.replace('.kesselprofile', '')
              const profile = loadProfile(usernameFromFile)
              
              if (profile && profile.USERNAME) {
                existingProfile = profile
                existingUsername = usernameFromFile
                profileSource = "system"
                console.log(chalk.cyan(`📋 Systemweites Profil gefunden: ${usernameFromFile}.kesselprofile`))
                console.log(chalk.dim(`   Pfad: ${newestProfile.path}`))
                console.log(chalk.dim(`   Geändert: ${newestProfile.mtime.toLocaleString()}`))
                if (profile.SUPABASE_INFRA_URL) {
                  console.log(chalk.dim(`   INFRA-DB: ${profile.SUPABASE_INFRA_URL}`))
                } else if (profile.SUPABASE_BACKEND_URL) {
                  console.log(chalk.dim(`   INFRA-DB (legacy): ${profile.SUPABASE_BACKEND_URL}`))
                }
                if (profile.SUPABASE_DEV_URL) {
                  console.log(chalk.dim(`   DEV-DB: ${profile.SUPABASE_DEV_URL}`))
                }
              }
            }
          } else {
            console.log(chalk.yellow("⚠️  Kein systemweites Profil gefunden"))
          }
        }
      } catch (error) {
        // Fehler beim Lesen des Profil-Verzeichnisses - ignorieren
      }
    } else {
      console.log(chalk.dim("Systemweite Suche übersprungen"))
    }
  }

  // Wenn ein vollständiges Profil gefunden wurde, verwende es direkt
  let normalizedUsername = null
  let profile = null
  let infraDbUrl = null
  let devDbUrl = null
  
  // Migriere alte Variablen zu neuen
  const migrateProfile = (p) => {
    // Migriere SUPABASE_BACKEND_URL nur wenn es die INFRA-DB (Kessel) ist
    if (p.SUPABASE_BACKEND_URL && !p.SUPABASE_INFRA_URL) {
      const backendUrl = p.SUPABASE_BACKEND_URL
      // Prüfe ob es die Kessel-DB ist (endet mit ...kashi)
      if (backendUrl.includes('ufqlocxqizmiaozkashi')) {
        p.SUPABASE_INFRA_URL = backendUrl
      }
      // Wenn es die DEV-DB ist, ignorieren wir es (verwenden Default)
    }
    if (p.SUPABASE_VAULT_URL && !p.SUPABASE_DEV_URL) {
      // Falls Vault URL gesetzt war, könnte das die alte separate Vault sein
      // In der neuen Architektur ist Vault Teil der INFRA-DB
    }
    return p
  }
  
  // Prüfe ob Profil vollständig ist (INFRA-DB reicht, DEV-DB hat Default)
  // Prüfe ob SUPABASE_BACKEND_URL die INFRA-DB ist (nur wenn es Kessel ist)
  const backendUrl = existingProfile?.SUPABASE_BACKEND_URL
  const isValidInfraDb = backendUrl?.includes('ufqlocxqizmiaozkashi')
  const hasInfraUrl = existingProfile?.SUPABASE_INFRA_URL || (isValidInfraDb ? backendUrl : null)
  
  if (existingProfile && existingProfile.USERNAME && hasInfraUrl) {
    // Vollständiges Profil gefunden - verwende es direkt
    existingProfile = migrateProfile(existingProfile)
    normalizedUsername = normalizeUsername(existingProfile.USERNAME || existingUsername)
    profile = existingProfile
    // Verwende SUPABASE_BACKEND_URL nur wenn es die INFRA-DB (Kessel) ist
    const backendUrl = existingProfile.SUPABASE_BACKEND_URL
    const isValidInfraDb = backendUrl?.includes('ufqlocxqizmiaozkashi')
    infraDbUrl = existingProfile.SUPABASE_INFRA_URL || (isValidInfraDb ? backendUrl : null) || DEFAULTS.infraDb.url
    devDbUrl = existingProfile.SUPABASE_DEV_URL || DEFAULTS.devDb.url
    
    console.log(chalk.green(`✓ Profil verwendet: ${normalizedUsername}`))
    console.log(chalk.dim(`   INFRA-DB (Kessel): ${infraDbUrl}`))
    console.log(chalk.dim(`   DEV-DB: ${devDbUrl}`))
  } else {
    if (existingProfile) {
      console.log(chalk.yellow(`⚠️  Profil gefunden, aber unvollständig`))
    }
    // Kein vollständiges Profil gefunden - frage nach Username
    const { username } = await inquirer.prompt([
      {
        type: "input",
        name: "username",
        message: "Dein Username:",
        default: existingUsername || "",
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return "Username ist erforderlich"
          }
          return true
        },
      },
    ])

    normalizedUsername = normalizeUsername(username)
    updateProgress(progressBar, null, "Lade Profil...")

    // Versuche Profil zu laden
    profile = loadProfile(normalizedUsername)
    
    // Falls kein Profil gefunden, aber ein anderes Profil existiert, verwende das als Fallback
    if (!profile && existingProfile && normalizedUsername === existingUsername) {
      profile = existingProfile
    }
    
    if (profile) {
      profile = migrateProfile(profile)
    }
    
    // Prüfe ob INFRA-DB URL im Profil vorhanden
    if (profile && (profile.SUPABASE_INFRA_URL || profile.SUPABASE_BACKEND_URL)) {
      infraDbUrl = profile.SUPABASE_INFRA_URL || profile.SUPABASE_BACKEND_URL
      devDbUrl = profile.SUPABASE_DEV_URL || DEFAULTS.devDb.url
      console.log(chalk.green(`✓ Profil geladen: ${normalizedUsername}.kesselprofile`))
      console.log(chalk.dim(`   Verwende URLs aus Profil`))
    } else {
      // Frage nach INFRA-DB URL
      console.log(chalk.blue("\n📊 Supabase DB-Architektur:"))
      console.log(chalk.dim("   INFRA-DB (Kessel): User, Auth, Vault, Multi-Tenant Schemas"))
      console.log(chalk.dim("   DEV-DB: App-Daten, fachliche Entwicklung\n"))
      
      updateProgress(progressBar, null, "INFRA-DB URL abfragen...")
      const { infraUrl } = await inquirer.prompt([
        {
          type: "input",
          name: "infraUrl",
          message: "INFRA-DB URL (Kessel - Auth, Vault, Multi-Tenant):",
          default: (() => {
            const backendUrl = profile?.SUPABASE_BACKEND_URL
            const isValidInfraDb = backendUrl?.includes('ufqlocxqizmiaozkashi')
            return profile?.SUPABASE_INFRA_URL || (isValidInfraDb ? backendUrl : null) || DEFAULTS.infraDb.url
          })(),
          validate: (input) => {
            if (!input || input.trim().length === 0) {
              return "INFRA-DB URL ist erforderlich"
            }
            try {
              new URL(input)
              return true
            } catch {
              return "Bitte eine gültige URL eingeben"
            }
          },
        },
      ])

      infraDbUrl = infraUrl.trim()

      // Teste INFRA-DB URL
      updateProgress(progressBar, null, "Teste INFRA-DB URL...")
      try {
        const testUrl = new URL(infraDbUrl)
        const response = await fetch(`${testUrl.origin}/rest/v1/`, {
          method: "GET",
          headers: { apikey: "test" },
        })
        if (response.status !== 401 && response.status !== 200) {
          console.log(chalk.yellow(`⚠️  INFRA-DB URL antwortet mit Status ${response.status}`))
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️  INFRA-DB URL konnte nicht getestet werden: ${error.message}`))
      }

      // Frage nach DEV-DB URL
      updateProgress(progressBar, null, "DEV-DB URL abfragen...")
      const { devUrl } = await inquirer.prompt([
        {
          type: "input",
          name: "devUrl",
          message: "DEV-DB URL (App-Daten, Entwicklung):",
          default: profile?.SUPABASE_DEV_URL || DEFAULTS.devDb.url,
          validate: (input) => {
            if (!input || input.trim().length === 0) {
              return "DEV-DB URL ist erforderlich"
            }
            try {
              new URL(input)
              return true
            } catch {
              return "Bitte eine gültige URL eingeben"
            }
          },
        },
      ])

      devDbUrl = devUrl.trim()

      // Teste DEV-DB URL
      updateProgress(progressBar, null, "Teste DEV-DB URL...")
      try {
        const testUrl = new URL(devDbUrl)
        const response = await fetch(`${testUrl.origin}/rest/v1/`, {
          method: "GET",
          headers: { apikey: "test" },
        })
        if (response.status !== 401 && response.status !== 200) {
          console.log(chalk.yellow(`⚠️  DEV-DB URL antwortet mit Status ${response.status}`))
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️  DEV-DB URL konnte nicht getestet werden: ${error.message}`))
      }

      // Speichere im Profil
      updateProgress(progressBar, null, "Speichere Profil...")
      if (!profile) {
        profile = {}
      }
      profile.USERNAME = normalizedUsername
      profile.SUPABASE_INFRA_URL = infraDbUrl
      profile.SUPABASE_DEV_URL = devDbUrl
      // Legacy-Kompatibilität
      profile.SUPABASE_BACKEND_URL = infraDbUrl
      saveProfile(normalizedUsername, profile)
      console.log(chalk.green(`✓ Profil gespeichert: ${normalizedUsername}.kesselprofile`))
    }
  }

  updateProgress(progressBar, null, "Supabase Setup abgeschlossen")

  return {
    username: normalizedUsername,
    infraDbUrl,
    devDbUrl,
    // Legacy-Kompatibilität
    backendUrl: infraDbUrl,
    profile,
  }
}

/**
 * Setup Secrets: Fragt nach Service Role Key für INFRA-DB (Vault ist integriert)
 * 
 * In der neuen Architektur ist der Vault Teil der INFRA-DB (Kessel).
 * Es gibt keine separate Vault-URL mehr.
 * 
 * @param {Object} progressBar - Progress Bar Objekt (optional)
 * @param {Object} supabaseSetup - Ergebnis von setupSupabase()
 * @returns {Promise<Object>} - { vaultUrl, serviceRoleKey } oder null
 */
export async function setupSecrets(progressBar = null, supabaseSetup = null) {
  updateProgress(progressBar, null, "Secrets Management Setup...")

  // Prüfe ob Profil bereits Secrets-Konfiguration hat
  const profile = supabaseSetup?.profile || {}
  const hasSecretsConfig = profile.SUPABASE_SERVICE_ROLE_KEY || profile.SUPABASE_VAULT_SERVICE_ROLE_KEY
  
  if (hasSecretsConfig) {
    const serviceRoleKey = profile.SUPABASE_SERVICE_ROLE_KEY || profile.SUPABASE_VAULT_SERVICE_ROLE_KEY
    console.log(chalk.cyan(`📋 Secrets-Konfiguration im Profil gefunden`))
    console.log(chalk.dim(`   INFRA-DB (Vault): ${supabaseSetup?.infraDbUrl || profile.SUPABASE_INFRA_URL}`))
    console.log(chalk.dim(`   Service Role Key: ${serviceRoleKey.substring(0, 20)}...`))
    
    // Frage ob vorhandene Konfiguration verwendet werden soll
    const { useExisting } = await inquirer.prompt([
      {
        type: "confirm",
        name: "useExisting",
        message: "Vorhandene Secrets-Konfiguration aus Profil verwenden?",
        default: true,
      },
    ])
    
    if (useExisting) {
      updateProgress(progressBar, null, "Verwende Secrets-Konfiguration aus Profil...")
      return {
        vaultUrl: supabaseSetup?.infraDbUrl || profile.SUPABASE_INFRA_URL,
        serviceRoleKey,
      }
    }
  }

  // In der neuen Architektur ist der Vault immer Teil der INFRA-DB
  console.log(chalk.blue("\n🔐 Secrets werden in der INFRA-DB (Kessel Vault) verwaltet"))
  console.log(chalk.dim(`   URL: ${supabaseSetup?.infraDbUrl || DEFAULTS.infraDb.url}\n`))

  const { setupSecrets } = await inquirer.prompt([
    {
      type: "confirm",
      name: "setupSecrets",
      message: "Möchtest du den SERVICE_ROLE_KEY für Vault-Zugriff einrichten?",
      default: true,
    },
  ])

  if (!setupSecrets) {
    updateProgress(progressBar, null, "Secrets Management übersprungen")
    return null
  }

  // Vault URL ist immer die INFRA-DB URL
  const vaultUrl = supabaseSetup?.infraDbUrl || DEFAULTS.infraDb.url

  // Frage nach SERVICE_ROLE_KEY
  updateProgress(progressBar, null, "Service Role Key abfragen...")
  const { key } = await inquirer.prompt([
    {
      type: "password",
      name: "key",
      message: "SERVICE_ROLE_KEY (für INFRA-DB/Vault-Zugriff):",
      default: profile.SUPABASE_SERVICE_ROLE_KEY || profile.SUPABASE_VAULT_SERVICE_ROLE_KEY || "",
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return "Service Role Key ist erforderlich"
        }
        return true
      },
    },
  ])

  const serviceRoleKey = key.trim()

  // Teste Vault-Verbindung
  updateProgress(progressBar, null, "Teste Vault-Verbindung...")
  try {
    const supabase = createClient(vaultUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Versuche Secrets abzurufen
    try {
      await supabase.rpc("get_all_secrets_for_env", {})
      console.log(chalk.green("✓ Vault-Verbindung erfolgreich"))
    } catch (rpcError) {
      // Falls RPC nicht verfügbar, teste wenigstens die Verbindung
      const testResponse = await fetch(`${vaultUrl}/rest/v1/`, {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      })
      if (testResponse.status === 200 || testResponse.status === 401) {
        console.log(chalk.green("✓ INFRA-DB Verbindung erfolgreich"))
        console.log(chalk.yellow("⚠️  Vault-Funktionen nicht gefunden. Führe Migration 001_vault_setup.sql aus."))
      } else {
        console.log(chalk.yellow(`⚠️  INFRA-DB antwortet mit Status ${testResponse.status}`))
      }
    }
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Vault-Test fehlgeschlagen: ${error.message}`))
  }

  // Speichere im Profil
  updateProgress(progressBar, null, "Speichere Secrets-Konfiguration...")
  const normalizedUsername = supabaseSetup?.username || normalizeUsername("default")
  if (!profile.USERNAME) {
    profile.USERNAME = normalizedUsername
  }
  profile.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey
  // Legacy-Kompatibilität
  profile.SUPABASE_VAULT_SERVICE_ROLE_KEY = serviceRoleKey
  profile.SUPABASE_VAULT_URL = vaultUrl
  saveProfile(normalizedUsername, profile)

  updateProgress(progressBar, null, "Secrets Setup abgeschlossen")

  return {
    vaultUrl,
    serviceRoleKey,
  }
}
