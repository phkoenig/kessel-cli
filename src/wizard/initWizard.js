import enquirer from "enquirer"
import { loadProfile, normalizeUsername, getProfileDir } from "../../lib/profile.js"
import { DEFAULTS } from "../config.js"
import { fetchServiceRoleKeyFromOnePassword } from "../utils/onepassword.js"
import fs from "fs"
import path from "path"
import chalk from "chalk"

/**
 * Laedt existierendes Profil (lokal oder systemweit)
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
            if (profileUsername) {
              profile.USERNAME = profileUsername
              return { profile, source: "local", username: profileUsername }
            }
          } catch {
            // Ignorieren
          }
        }
      }
    } catch {
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
  } catch {
    // Ignorieren
  }
  
  return null
}

/**
 * Wizard fuer Projekt-Initialisierung (Boilerplate 3.0 Architektur)
 * 
 * Neues Schema: Supabase (App-Daten) + Clerk (Auth) + SpacetimeDB (UX-Core)
 * Die alte INFRA-DB / DEV-DB Trennung entfaellt.
 */
export async function runInitWizard(projectNameArg = null, projectRoot = null) {
  const existing = await loadExistingProfile(projectRoot)
  const profile = existing?.profile || null

  // 1. Username
  const { username } = await enquirer.prompt({
    type: 'input',
    name: 'username',
    message: 'Dein Username:',
    initial: profile?.USERNAME || existing?.username || '',
    validate: (value) => {
      if (!value || value.trim().length === 0) return 'Username ist erforderlich'
      return true
    },
  })
  
  const normalizedUsername = normalizeUsername(username)

  // 2. Projektname
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
        return 'Nur Kleinbuchstaben, Zahlen und Bindestriche'
      }
      return true
    },
  })

  const projectPrefix = projectName.toUpperCase()
  const schemaName = projectName.replace(/-/g, "_").toLowerCase()

  // 3. Supabase-Projekt (fuer App-Daten)
  console.log(chalk.blue("\n── Supabase (App-Datenbank) ──────────────────────"))
  
  const { supabaseUrl } = await enquirer.prompt({
    type: 'input',
    name: 'supabaseUrl',
    message: 'Supabase-Projekt URL:',
    initial: profile?.SUPABASE_URL || '',
    validate: (value) => {
      if (!value || value.trim().length === 0) return 'URL ist erforderlich'
      try { new URL(value); return true } catch { return 'Bitte eine gueltige URL eingeben' }
    },
  })

  const supabaseProjectRef = new URL(supabaseUrl.trim()).hostname.split(".")[0]

  // Service Role Key
  let serviceRoleKey = null
  console.log(chalk.blue("🔍 Versuche SERVICE_ROLE_KEY aus 1Password zu holen..."))
  serviceRoleKey = await fetchServiceRoleKeyFromOnePassword(() => {})
  
  if (serviceRoleKey) {
    console.log(chalk.green("✓ SERVICE_ROLE_KEY aus 1Password geholt"))
  } else {
    console.log(chalk.yellow("⚠️  Nicht automatisch gefunden"))
    const prompt = await enquirer.prompt({
      type: 'password',
      name: 'serviceRoleKey',
      message: 'SUPABASE_SERVICE_ROLE_KEY:',
      validate: (v) => v.trim().length > 0 ? true : 'Key ist erforderlich',
    })
    serviceRoleKey = prompt.serviceRoleKey
  }

  // 4. Clerk Authentication
  console.log(chalk.blue("\n── Clerk (Authentication) ────────────────────────"))
  
  const { clerkMode } = await enquirer.prompt({
    type: 'select',
    name: 'clerkMode',
    message: 'Clerk Application:',
    choices: [
      { name: 'dedicated', message: 'Eigene Application (eigener User Pool, empfohlen)' },
      { name: 'shared', message: 'Shared (Keys kommen spaeter via pull-env)' },
    ],
    initial: 0,
  })

  let clerkKeys = null
  if (clerkMode === 'dedicated') {
    console.log(chalk.dim("  Erstelle eine neue Application im Clerk Dashboard:"))
    console.log(chalk.dim("  https://dashboard.clerk.com → Create Application\n"))

    const clerkPrompts = await enquirer.prompt([
      {
        type: 'input',
        name: 'publishableKey',
        message: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (pk_test_...):',
        validate: (v) => v.startsWith('pk_') ? true : 'Muss mit pk_ beginnen',
      },
      {
        type: 'password',
        name: 'secretKey',
        message: 'CLERK_SECRET_KEY (sk_test_...):',
        validate: (v) => v.startsWith('sk_') ? true : 'Muss mit sk_ beginnen',
      },
    ])
    clerkKeys = clerkPrompts
  }

  // 5. SpacetimeDB (UX-Core)
  console.log(chalk.blue("\n── SpacetimeDB (UX-Core) ─────────────────────────"))
  
  const { spacetimeMode } = await enquirer.prompt({
    type: 'select',
    name: 'spacetimeMode',
    message: 'SpacetimeDB Modul:',
    choices: [
      { name: 'publish', message: `Neues Modul publizieren: ${projectName}-core` },
      { name: 'existing', message: 'Bestehendes Modul verwenden' },
      { name: 'skip', message: 'SpacetimeDB ueberspringen' },
    ],
    initial: 0,
  })

  let spacetimeDatabase = null
  if (spacetimeMode === 'existing') {
    const { stdbName } = await enquirer.prompt({
      type: 'input',
      name: 'stdbName',
      message: 'SpacetimeDB Datenbankname:',
      validate: (v) => v.trim().length > 0 ? true : 'Name ist erforderlich',
    })
    spacetimeDatabase = stdbName.trim()
  } else if (spacetimeMode === 'publish') {
    spacetimeDatabase = `${projectName}-core`
  }

  // 6. GitHub Repo
  console.log(chalk.blue("\n── Projekt-Optionen ──────────────────────────────"))
  
  const { createGithub } = await enquirer.prompt({
    type: 'select',
    name: 'createGithub',
    message: 'GitHub Repository erstellen?',
    choices: [
      { name: 'private', message: 'Ja, privat' },
      { name: 'public', message: 'Ja, oeffentlich' },
      { name: 'none', message: 'Nein, nur lokal' },
    ],
    initial: 0,
  })

  // 7. Dependencies
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
    message: 'Mit Vercel verknuepfen?',
    initial: false,
  })

  // 9. Initial Commit + Push
  const { doInitialCommit } = await enquirer.prompt({
    type: 'confirm',
    name: 'doInitialCommit',
    message: 'Initial Commit erstellen?',
    initial: true,
  })

  const { doPush } = await enquirer.prompt({
    type: 'confirm',
    name: 'doPush',
    message: 'Aenderungen zu GitHub pushen?',
    initial: createGithub !== 'none' && doInitialCommit,
  })

  // Config-Objekt (neues Boilerplate 3.0 Schema)
  return {
    username: normalizedUsername,
    projectName,
    schemaName,
    supabase: {
      url: supabaseUrl.trim(),
      projectRef: supabaseProjectRef,
    },
    serviceRoleKey: serviceRoleKey.trim(),
    clerkMode,
    clerkKeys,
    spacetimeMode,
    spacetimeDatabase,
    createGithub,
    autoInstallDeps,
    linkVercel,
    doInitialCommit,
    doPush,
    profile,
  }
}
