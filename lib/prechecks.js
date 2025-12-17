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
export async function checkGitHubCLI(progressBar = null) {
  updateProgress(progressBar, null, "Prüfe GitHub CLI...")

  // Prüfe Installation
  if (!isGitHubCLIInstalled()) {
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

    throw new Error(
      "GitHub CLI Installation muss manuell durchgeführt werden.\n" +
      "Siehe: https://cli.github.com/manual/installation"
    )
  }

  updateProgress(progressBar, null, "Prüfe GitHub Authentifizierung...")

  // Prüfe Authentifizierung
  if (!isGitHubCLIAuthenticated()) {
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
  }

  // Hole Token
  updateProgress(progressBar, null, "GitHub Token abrufen...")
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
export async function checkPackageManager(progressBar = null) {
  updateProgress(progressBar, null, "Prüfe Package Manager...")

  // Prüfe zuerst pnpm
  if (isPnpmInstalled()) {
    const version = execSync("pnpm --version", { encoding: "utf-8", stdio: "pipe" }).trim()
    console.log(chalk.green(`✓ pnpm gefunden (Version ${version})`))
    updateProgress(progressBar, null, "pnpm bereit")
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
    console.log(chalk.yellow(`⚠️  pnpm nicht gefunden, verwende npm (Version ${version})`))
    console.log(chalk.dim("   Tipp: pnpm wird empfohlen. Installiere mit: npm install -g pnpm"))
    updateProgress(progressBar, null, "npm bereit")
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
export async function checkSupabaseCLI(progressBar = null) {
  updateProgress(progressBar, null, "Prüfe Supabase CLI...")

  if (!isSupabaseCLIInstalled()) {
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

    throw new Error(
      "Supabase CLI Installation muss manuell durchgeführt werden.\n" +
      "Siehe: https://supabase.com/docs/guides/cli/getting-started"
    )
  }

  updateProgress(progressBar, null, "Supabase CLI bereit")
}

/**
 * Setup Supabase: Lädt/erstellt Profil und fragt Backend URL ab
 * @param {Object} progressBar - Progress Bar Objekt (optional)
 * @param {string} projectRoot - Root-Verzeichnis des Projekts (optional)
 * @returns {Promise<Object>} - { username, backendUrl }
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
            if (profileUsername && profile.SUPABASE_BACKEND_URL) {
              existingProfile = profile
              existingProfile.USERNAME = profileUsername // Stelle sicher, dass USERNAME gesetzt ist
              existingUsername = profileUsername
              profileSource = "local"
              console.log(chalk.cyan(`📋 Lokales Profil gefunden: ${newestLocalProfile.file}`))
              console.log(chalk.dim(`   Pfad: ${profilePath}`))
              if (localProfilesWithStats.length > 1) {
                console.log(chalk.dim(`   (${localProfilesWithStats.length} Profile gefunden, neuestes verwendet)`))
              }
              console.log(chalk.dim(`   Username: ${profileUsername}`))
              if (profile.SUPABASE_BACKEND_URL) {
                console.log(chalk.dim(`   Backend URL: ${profile.SUPABASE_BACKEND_URL}`))
              }
              if (profile.SUPABASE_VAULT_URL) {
                console.log(chalk.dim(`   Vault URL: ${profile.SUPABASE_VAULT_URL}`))
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
                if (profile.SUPABASE_BACKEND_URL) {
                  console.log(chalk.dim(`   Backend URL: ${profile.SUPABASE_BACKEND_URL}`))
                }
                if (profile.SUPABASE_VAULT_URL) {
                  console.log(chalk.dim(`   Vault URL: ${profile.SUPABASE_VAULT_URL}`))
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
  let backendUrl = null
  
  // Debug: Zeige was gefunden wurde
  if (existingProfile) {
    console.log(chalk.dim(`   [DEBUG] existingProfile gefunden:`))
    console.log(chalk.dim(`   [DEBUG]   USERNAME: ${existingProfile.USERNAME || 'FEHLT'}`))
    console.log(chalk.dim(`   [DEBUG]   SUPABASE_BACKEND_URL: ${existingProfile.SUPABASE_BACKEND_URL || 'FEHLT'}`))
  }
  
  if (existingProfile && existingProfile.USERNAME && existingProfile.SUPABASE_BACKEND_URL) {
    // Vollständiges Profil gefunden - verwende es direkt
    normalizedUsername = normalizeUsername(existingProfile.USERNAME || existingUsername)
    profile = existingProfile
    backendUrl = existingProfile.SUPABASE_BACKEND_URL
    
    console.log(chalk.green(`✓ Profil verwendet: ${normalizedUsername}`))
    console.log(chalk.dim(`   Backend URL: ${backendUrl}`))
    if (profile.SUPABASE_VAULT_URL) {
      console.log(chalk.dim(`   Vault URL: ${profile.SUPABASE_VAULT_URL}`))
    }
  } else {
    if (existingProfile) {
      console.log(chalk.yellow(`⚠️  Profil gefunden, aber unvollständig (fehlt: ${!existingProfile.USERNAME ? 'USERNAME ' : ''}${!existingProfile.SUPABASE_BACKEND_URL ? 'SUPABASE_BACKEND_URL' : ''})`))
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
    
      if (profile && profile.SUPABASE_BACKEND_URL) {
        backendUrl = profile.SUPABASE_BACKEND_URL
        console.log(chalk.green(`✓ Profil geladen: ${normalizedUsername}.kesselprofile`))
        console.log(chalk.dim(`   Verwende Backend URL aus Profil`))
      } else {
        // Frage nach Backend URL
        updateProgress(progressBar, null, "Backend URL abfragen...")
        const { url } = await inquirer.prompt([
          {
            type: "input",
            name: "url",
            message: "Supabase Backend URL (für die App):",
            default: profile?.SUPABASE_BACKEND_URL || "",
            validate: (input) => {
              if (!input || input.trim().length === 0) {
                return "Backend URL ist erforderlich"
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

        backendUrl = url.trim()

        // Teste URL
        updateProgress(progressBar, null, "Teste Backend URL...")
        try {
          const testUrl = new URL(backendUrl)
          // Einfacher Test: Prüfe ob URL erreichbar ist
          const response = await fetch(`${testUrl.origin}/rest/v1/`, {
            method: "GET",
            headers: { apikey: "test" },
          })
          // Status 401 ist OK (bedeutet dass Server erreichbar ist)
          if (response.status !== 401 && response.status !== 200) {
            console.log(chalk.yellow(`⚠️  Backend URL antwortet mit Status ${response.status}`))
          }
        } catch (error) {
          console.log(chalk.yellow(`⚠️  Backend URL konnte nicht getestet werden: ${error.message}`))
        }

        // Speichere im Profil
        updateProgress(progressBar, null, "Speichere Profil...")
        if (!profile) {
          profile = {}
        }
        profile.USERNAME = normalizedUsername
        profile.SUPABASE_BACKEND_URL = backendUrl
        saveProfile(normalizedUsername, profile)
        console.log(chalk.green(`✓ Profil gespeichert: ${normalizedUsername}.kesselprofile`))
      }
    }

  updateProgress(progressBar, null, "Supabase Setup abgeschlossen")

  return {
    username: normalizedUsername,
    backendUrl,
    profile,
  }
}

/**
 * Setup Secrets: Fragt nach Secrets-Option und Vault-Konfiguration
 * @param {Object} progressBar - Progress Bar Objekt (optional)
 * @param {Object} supabaseSetup - Ergebnis von setupSupabase()
 * @returns {Promise<Object>} - { vaultUrl, serviceRoleKey } oder null
 */
export async function setupSecrets(progressBar = null, supabaseSetup = null) {
  updateProgress(progressBar, null, "Secrets Management Setup...")

  // Prüfe ob Profil bereits Secrets-Konfiguration hat
  const profile = supabaseSetup?.profile || {}
  const hasVaultConfig = profile.SUPABASE_VAULT_URL && profile.SUPABASE_VAULT_SERVICE_ROLE_KEY
  
  if (hasVaultConfig) {
    console.log(chalk.cyan(`📋 Secrets-Konfiguration im Profil gefunden`))
    console.log(chalk.dim(`   Vault URL: ${profile.SUPABASE_VAULT_URL}`))
    console.log(chalk.dim(`   Service Role Key: ${profile.SUPABASE_VAULT_SERVICE_ROLE_KEY.substring(0, 20)}...`))
    
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
        vaultUrl: profile.SUPABASE_VAULT_URL,
        serviceRoleKey: profile.SUPABASE_VAULT_SERVICE_ROLE_KEY,
        option: profile.SUPABASE_VAULT_URL ? "vault" : "backend",
      }
    }
  }

  const { option } = await inquirer.prompt([
    {
      type: "list",
      name: "option",
      message: "Wie möchtest du Secrets verwalten?",
      choices: [
        { name: "Supabase Vault verwenden", value: "vault" },
        { name: "Backend Secrets verwenden", value: "backend" },
        { name: "Keine Secrets (überspringen)", value: "none" },
      ],
    },
  ])

  if (option === "none") {
    updateProgress(progressBar, null, "Secrets Management übersprungen")
    return null
  }

  let vaultUrl = null
  let serviceRoleKey = null

  // Frage nach Vault URL
  if (option === "vault") {
    updateProgress(progressBar, null, "Vault URL abfragen...")
    const { url } = await inquirer.prompt([
      {
        type: "input",
        name: "url",
        message: "Supabase Vault URL (zentrales Projekt für Secrets):",
        default: profile.SUPABASE_VAULT_URL || "",
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return "Vault URL ist erforderlich"
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

    vaultUrl = url.trim()
  } else {
    // Backend = verwende Backend URL
    vaultUrl = supabaseSetup?.backendUrl || null
  }

  // Frage nach SERVICE_ROLE_KEY
  updateProgress(progressBar, null, "Service Role Key abfragen...")
  const { key } = await inquirer.prompt([
    {
      type: "password",
      name: "key",
      message: "SERVICE_ROLE_KEY (für Vault-Zugriff):",
      default: profile.SUPABASE_VAULT_SERVICE_ROLE_KEY || "",
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return "Service Role Key ist erforderlich"
        }
        return true
      },
    },
  ])

  serviceRoleKey = key.trim()

  // Teste Vault
  updateProgress(progressBar, null, "Teste Vault...")
  try {
    const supabase = createClient(vaultUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Versuche Secrets abzurufen (oder zumindest eine Verbindung zu testen)
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
        console.log(chalk.green("✓ Vault-Verbindung erfolgreich"))
      } else {
        console.log(chalk.yellow(`⚠️  Vault antwortet mit Status ${testResponse.status}`))
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
  if (option === "vault") {
    profile.SUPABASE_VAULT_URL = vaultUrl
  }
  profile.SUPABASE_VAULT_SERVICE_ROLE_KEY = serviceRoleKey
  saveProfile(normalizedUsername, profile)

  updateProgress(progressBar, null, "Secrets Setup abgeschlossen")

  return {
    vaultUrl,
    serviceRoleKey,
    option,
  }
}
