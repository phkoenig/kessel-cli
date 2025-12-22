import enquirer from "enquirer"
import { loadProfile, normalizeUsername, getProfileDir } from "../../lib/profile.js"
import { DEFAULTS } from "../config.js"
import { fetchServiceRoleKeyFromSupabase, fetchServiceRoleKeyFromVault } from "../utils/supabase.js"
import fs from "fs"
import path from "path"
import chalk from "chalk"

/**
 * Lädt existierendes Profil (lokal oder systemweit)
 * @param {string} projectRoot - Projekt-Root-Verzeichnis
 * @returns {Promise<Object|null>} Profil oder null
 */
export async function loadExistingProfile(projectRoot) {
  // 1. Suche lokales Profil
  if (projectRoot) {
    try {
      const localProfileFiles = fs.readdirSync(projectRoot)
        .filter(f => f.endsWith('.kesselprofile'))
      
      if (localProfileFiles.length > 0) {
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
          localProfilesWithStats.sort((a, b) => b.mtime - a.mtime)
          const newest = localProfilesWithStats[0]
          const usernameFromFile = newest.file.replace('.kesselprofile', '')
          
          try {
            const content = fs.readFileSync(newest.path, "utf-8")
            const profile = {}
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
            
            const profileUsername = profile.USERNAME || usernameFromFile
            const hasInfraUrl = profile.SUPABASE_INFRA_URL || profile.SUPABASE_BACKEND_URL
            if (profileUsername && hasInfraUrl) {
              profile.USERNAME = profileUsername
              return { profile, source: "local", username: profileUsername }
            }
          } catch (error) {
            // Ignorieren
          }
        }
      }
    } catch (error) {
      // Ignorieren
    }
  }
  
  // 2. Suche systemweites Profil
  try {
    const profileDir = getProfileDir()
    if (fs.existsSync(profileDir)) {
      const files = fs.readdirSync(profileDir)
      const profileFiles = files.filter(f => f.endsWith('.kesselprofile'))
      
      if (profileFiles.length > 0) {
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
          profilesWithStats.sort((a, b) => b.mtime - a.mtime)
          const newest = profilesWithStats[0]
          const usernameFromFile = newest.file.replace('.kesselprofile', '')
          const profile = loadProfile(usernameFromFile)
          
          if (profile && profile.USERNAME) {
            return { profile, source: "system", username: usernameFromFile }
          }
        }
      }
    }
  } catch (error) {
    // Ignorieren
  }
  
  return null
}

/**
 * Migriert alte Profil-Variablen zu neuen
 * @param {Object} profile - Profil-Objekt
 * @returns {Object} Migriertes Profil
 */
function migrateProfile(profile) {
  const migrated = { ...profile }
  
  // Migriere SUPABASE_BACKEND_URL nur wenn es die INFRA-DB (Kessel) ist
  if (profile.SUPABASE_BACKEND_URL && !profile.SUPABASE_INFRA_URL) {
    const backendUrl = profile.SUPABASE_BACKEND_URL
    // Prüfe ob es die Kessel-DB ist (endet mit ...kashi)
    if (backendUrl.includes('ufqlocxqizmiaozkashi')) {
      migrated.SUPABASE_INFRA_URL = backendUrl
    }
    // Wenn es die DEV-DB ist, ignorieren wir es (verwenden Default)
  }
  
  if (profile.SUPABASE_VAULT_SERVICE_ROLE_KEY && !profile.SUPABASE_SERVICE_ROLE_KEY) {
    migrated.SUPABASE_SERVICE_ROLE_KEY = profile.SUPABASE_VAULT_SERVICE_ROLE_KEY
  }
  
  return migrated
}

/**
 * Wizard für Projekt-Initialisierung
 * Sammelt alle benötigten Informationen via Prompts
 * @param {string} projectNameArg - Projektname als Argument (optional)
 * @param {string} projectRoot - Projekt-Root-Verzeichnis (optional)
 * @returns {Promise<Object>} KesselConfig-Objekt
 */
export async function runInitWizard(projectNameArg = null, projectRoot = null) {
  // Lade existierendes Profil
  const existing = await loadExistingProfile(projectRoot)
  let profile = existing?.profile || null
  
  if (profile) {
    profile = migrateProfile(profile)
    // Keine Debug-Ausgabe hier - wird später im Wizard angezeigt
  }
  
  // 1. Username
  const { username } = await enquirer.prompt({
    type: 'input',
    name: 'username',
    message: 'Dein Username:',
    initial: profile?.USERNAME || existing?.username || '',
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Username ist erforderlich'
      }
      return true
    },
  })
  
  const normalizedUsername = normalizeUsername(username)
  
  // Lade Profil falls noch nicht geladen
  if (!profile) {
    profile = loadProfile(normalizedUsername)
    if (profile) {
      profile = migrateProfile(profile)
    }
  }
  
  // 2. INFRA-DB URL
  // Prüfe ob SUPABASE_BACKEND_URL die INFRA-DB ist (nur wenn es Kessel ist)
  const backendUrlFromProfile = profile?.SUPABASE_BACKEND_URL
  const isValidInfraDb = backendUrlFromProfile?.includes('ufqlocxqizmiaozkashi')
  const infraUrlDefault = profile?.SUPABASE_INFRA_URL || (isValidInfraDb ? backendUrlFromProfile : null) || DEFAULTS.infraDb.url
  
  const { infraUrl } = await enquirer.prompt({
    type: 'input',
    name: 'infraUrl',
    message: 'INFRA-DB URL (Kessel - Auth, Vault, Multi-Tenant):',
    initial: infraUrlDefault,
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return 'INFRA-DB URL ist erforderlich'
      }
      try {
        new URL(value)
        return true
      } catch {
        return 'Bitte eine gültige URL eingeben'
      }
    },
  })
  
  // 3. DEV-DB URL
  const { devUrl } = await enquirer.prompt({
    type: 'input',
    name: 'devUrl',
    message: 'DEV-DB URL (App-Daten, Entwicklung):',
    initial: profile?.SUPABASE_DEV_URL || DEFAULTS.devDb.url,
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return 'DEV-DB URL ist erforderlich'
      }
      try {
        new URL(value)
        return true
      } catch {
        return 'Bitte eine gültige URL eingeben'
      }
    },
  })
  
  // 4. SERVICE_ROLE_KEY - Versuche automatisch zu holen
  const infraProjectRef = infraUrl ? new URL(infraUrl).hostname.split(".")[0] : null
  
  // Versuche 1: Aus Vault holen (wenn temporärer Key vorhanden)
  let serviceRoleKey = null
  const tempServiceRoleKey = profile?.SUPABASE_SERVICE_ROLE_KEY || profile?.SUPABASE_VAULT_SERVICE_ROLE_KEY
  
  if (tempServiceRoleKey && infraUrl) {
    console.log(chalk.blue("🔍 Versuche SERVICE_ROLE_KEY aus Vault zu holen..."))
    serviceRoleKey = await fetchServiceRoleKeyFromVault(infraUrl, tempServiceRoleKey, (msg) => {
      // Silent - keine Debug-Ausgaben im Wizard
    })
    
    if (serviceRoleKey) {
      console.log(chalk.green("✓ SERVICE_ROLE_KEY aus Vault geholt"))
    } else {
      console.log(chalk.yellow("⚠️  Vault-Zugriff fehlgeschlagen, versuche Management API..."))
    }
  }
  
  // Versuche 2: Über Management API (Supabase CLI)
  if (!serviceRoleKey && infraProjectRef) {
    serviceRoleKey = await fetchServiceRoleKeyFromSupabase(infraProjectRef, (msg) => {
      // Silent - keine Debug-Ausgaben im Wizard
    })
    
    if (serviceRoleKey) {
      console.log(chalk.green("✓ SERVICE_ROLE_KEY über Management API geholt"))
    }
  }
  
  // Versuche 3: Aus Profil
  if (!serviceRoleKey) {
    serviceRoleKey = tempServiceRoleKey
    if (serviceRoleKey) {
      console.log(chalk.dim("ℹ️  Verwende SERVICE_ROLE_KEY aus Profil"))
    }
  }
  
  // Falls immer noch kein Key: Frage nach manueller Eingabe
  if (!serviceRoleKey) {
    const prompt = await enquirer.prompt({
      type: 'password',
      name: 'serviceRoleKey',
      message: 'SERVICE_ROLE_KEY (für INFRA-DB/Vault-Zugriff):',
      initial: '',
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Service Role Key ist erforderlich'
        }
        return true
      },
    })
    serviceRoleKey = prompt.serviceRoleKey
  }
  
  // 5. Projektname
  const currentDirName = projectRoot ? path.basename(projectRoot) : 'mein-projekt'
  const normalizedDirName = currentDirName.replace(/_/g, "-").toLowerCase()
  const defaultProjectName = projectNameArg || normalizedDirName
  
  const { projectName } = await enquirer.prompt({
    type: 'input',
    name: 'projectName',
    message: 'Projektname:',
    initial: defaultProjectName,
    validate: (value) => {
      if (!/^[a-z0-9-]+$/.test(value)) {
        return 'Projektname darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten'
      }
      return true
    },
  })
  
  // 6. GitHub Repo Option
  const { createGithub } = await enquirer.prompt({
    type: 'select',
    name: 'createGithub',
    message: 'GitHub Repository erstellen?',
    choices: [
      { name: 'private', message: 'Ja, privat' },
      { name: 'public', message: 'Ja, öffentlich' },
      { name: 'none', message: 'Nein, nur lokal' },
    ],
    initial: 0,
  })
  
  // 7. Dependencies installieren
  const { autoInstallDeps } = await enquirer.prompt({
    type: 'confirm',
    name: 'autoInstallDeps',
    message: 'Dependencies automatisch installieren?',
    initial: true,
  })
  
  // 8. Vercel Link
  const { linkVercel } = await enquirer.prompt({
    type: 'confirm',
    name: 'linkVercel',
    message: 'Mit Vercel verknüpfen?',
    initial: false,
  })
  
  // 9. Initial Commit
  const { doInitialCommit } = await enquirer.prompt({
    type: 'confirm',
    name: 'doInitialCommit',
    message: 'Initial Commit erstellen?',
    initial: true,
  })
  
  // 10. Push zu GitHub
  const { doPush } = await enquirer.prompt({
    type: 'confirm',
    name: 'doPush',
    message: 'Änderungen zu GitHub pushen?',
    initial: createGithub !== 'none' && doInitialCommit,
  })
  
  // Extrahiere Project Refs aus URLs (infraProjectRef wurde bereits oben extrahiert)
  const devProjectRef = devUrl ? new URL(devUrl).hostname.split(".")[0] : null
  
  // Generiere Schema-Name
  const schemaName = projectName.replace(/-/g, "_").toLowerCase()
  
  // Baue Config-Objekt
  return {
    username: normalizedUsername,
    projectName,
    schemaName,
    infraDb: {
      url: infraUrl.trim(),
      projectRef: infraProjectRef,
    },
    devDb: {
      url: devUrl.trim(),
      projectRef: devProjectRef,
    },
    serviceRoleKey: serviceRoleKey.trim(),
    createGithub,
    autoInstallDeps,
    linkVercel,
    doInitialCommit,
    doPush,
    profile, // Gespeichertes Profil für später
  }
}

