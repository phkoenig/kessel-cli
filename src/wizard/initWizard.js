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
          } catch { return null }
        }).filter(Boolean)
        
        if (localProfilesWithStats.length > 0) {
          localProfilesWithStats.sort((a, b) => b.mtime - a.mtime)
          const newest = localProfilesWithStats[0]
          const usernameFromFile = newest.file.replace('.kesselprofile', '')
          
          try {
            const content = fs.readFileSync(newest.path, "utf-8")
            const profile = {}
            for (const line of content.split("\n")) {
              const trimmed = line.trim()
              if (!trimmed || trimmed.startsWith("#")) continue
              const match = trimmed.match(/^([^=]+)=(.*)$/)
              if (match) profile[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "")
            }
            profile.USERNAME = profile.USERNAME || usernameFromFile
            if (profile.USERNAME) return { profile, source: "local", username: profile.USERNAME }
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }
  
  try {
    const profileDir = getProfileDir()
    if (fs.existsSync(profileDir)) {
      const profileFiles = fs.readdirSync(profileDir).filter(f => f.endsWith('.kesselprofile'))
      if (profileFiles.length > 0) {
        const profilesWithStats = profileFiles.map(file => {
          const filePath = path.join(profileDir, file)
          try { return { file, path: filePath, mtime: fs.statSync(filePath).mtime } } catch { return null }
        }).filter(Boolean)
        
        if (profilesWithStats.length > 0) {
          profilesWithStats.sort((a, b) => b.mtime - a.mtime)
          const usernameFromFile = profilesWithStats[0].file.replace('.kesselprofile', '')
          const profile = loadProfile(usernameFromFile)
          if (profile?.USERNAME) return { profile, source: "system", username: usernameFromFile }
        }
      }
    }
  } catch { /* ignore */ }
  
  return null
}

/**
 * Wizard fuer Projekt-Initialisierung (Boilerplate 3.0 Architektur)
 * 
 * Neues Schema: Supabase (App-Daten) + Clerk (Auth) + SpacetimeDB (UX-Core)
 * Alle drei Services sind optional -- man kann sie spaeter verbinden.
 */
export async function runInitWizard(projectNameArg = null, projectRoot = null) {
  const existing = await loadExistingProfile(projectRoot)
  const profile = existing?.profile || null

  // ── 1. Username ──
  const { username } = await enquirer.prompt({
    type: 'input',
    name: 'username',
    message: 'Dein Username:',
    initial: profile?.USERNAME || existing?.username || '',
    validate: (v) => v?.trim().length > 0 ? true : 'Username ist erforderlich',
  })
  const normalizedUsername = normalizeUsername(username)

  // ── 2. Projektname ──
  const currentDirName = projectRoot ? path.basename(projectRoot) : 'mein-projekt'
  const defaultProjectName = projectNameArg || currentDirName.replace(/_/g, "-").toLowerCase()

  const { projectName } = await enquirer.prompt({
    type: 'input',
    name: 'projectName',
    message: 'Projektname:',
    initial: defaultProjectName,
    validate: (v) => /^[a-z0-9-]+$/.test(v) ? true : 'Nur Kleinbuchstaben, Zahlen und Bindestriche',
  })

  const schemaName = projectName.replace(/-/g, "_").toLowerCase()

  // ── 3. Supabase (App-Datenbank) ──
  console.log(chalk.blue("\n── Supabase (App-Datenbank) ──────────────────────"))

  const { supabaseSetup } = await enquirer.prompt({
    type: 'select',
    name: 'supabaseSetup',
    message: 'Supabase-Projekt:',
    choices: [
      { name: 'now', message: 'Jetzt verbinden (URL + Keys eingeben)' },
      { name: 'later', message: 'Spaeter einrichten (Projekt wird ohne Supabase erstellt)' },
    ],
    initial: 0,
  })

  let supabase = null
  let serviceRoleKey = null

  if (supabaseSetup === 'now') {
    const { supabaseUrl } = await enquirer.prompt({
      type: 'input',
      name: 'supabaseUrl',
      message: 'Supabase-Projekt URL (z.B. https://xyz.supabase.co):',
      initial: profile?.SUPABASE_URL || '',
      validate: (v) => {
        if (!v?.trim()) return 'URL ist erforderlich'
        try { new URL(v); return true } catch { return 'Bitte eine gueltige URL eingeben' }
      },
    })

    supabase = {
      url: supabaseUrl.trim(),
      projectRef: new URL(supabaseUrl.trim()).hostname.split(".")[0],
    }

    // Service Role Key automatisch oder manuell
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
        validate: (v) => v?.trim().length > 0 ? true : 'Key ist erforderlich',
      })
      serviceRoleKey = prompt.serviceRoleKey
    }
  } else {
    console.log(chalk.dim("  → Du kannst Supabase spaeter in .env.local konfigurieren"))
  }

  // ── 4. Clerk (Authentication) ──
  console.log(chalk.blue("\n── Clerk (Authentication) ────────────────────────"))

  const { clerkSetup } = await enquirer.prompt({
    type: 'select',
    name: 'clerkSetup',
    message: 'Clerk Application:',
    choices: [
      { name: 'dedicated', message: 'Eigene Application (Keys jetzt eingeben)' },
      { name: 'later', message: 'Spaeter einrichten (Keys kommen via pull-env oder manuell)' },
    ],
    initial: 0,
  })

  let clerkKeys = null
  if (clerkSetup === 'dedicated') {
    console.log(chalk.dim("  Erstelle eine neue Application im Clerk Dashboard:"))
    console.log(chalk.dim("  https://dashboard.clerk.com → Create Application\n"))

    clerkKeys = await enquirer.prompt([
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
  } else {
    console.log(chalk.dim("  → Keys werden spaeter via pnpm pull-env oder manuell eingetragen"))
  }

  // ── 5. SpacetimeDB (UX-Core) ──
  console.log(chalk.blue("\n── SpacetimeDB (UX-Core) ─────────────────────────"))

  const { spacetimeMode } = await enquirer.prompt({
    type: 'select',
    name: 'spacetimeMode',
    message: 'SpacetimeDB Modul:',
    choices: [
      { name: 'publish', message: `Neues Modul publizieren: ${projectName}-core` },
      { name: 'existing', message: 'Bestehendes Modul verwenden' },
      { name: 'later', message: 'Spaeter einrichten' },
    ],
    initial: 0,
  })

  let spacetimeDatabase = null
  if (spacetimeMode === 'existing') {
    const { stdbName } = await enquirer.prompt({
      type: 'input',
      name: 'stdbName',
      message: 'SpacetimeDB Datenbankname:',
      validate: (v) => v?.trim().length > 0 ? true : 'Name ist erforderlich',
    })
    spacetimeDatabase = stdbName.trim()
  } else if (spacetimeMode === 'publish') {
    spacetimeDatabase = `${projectName}-core`
  }

  // ── 6. Projekt-Optionen ──
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

  const { autoInstallDeps } = await enquirer.prompt({
    type: 'confirm',
    name: 'autoInstallDeps',
    message: 'Dependencies automatisch installieren?',
    initial: true,
  })

  const { linkVercel } = await enquirer.prompt({
    type: 'confirm',
    name: 'linkVercel',
    message: 'Mit Vercel verknuepfen?',
    initial: false,
  })

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

  // ── Zusammenfassung ──
  console.log(chalk.blue("\n── Zusammenfassung ───────────────────────────────"))
  console.log(chalk.white(`  Projekt:     ${projectName}`))
  console.log(chalk.white(`  Supabase:    ${supabase ? supabase.projectRef : chalk.yellow('spaeter')}`))
  console.log(chalk.white(`  Clerk:       ${clerkKeys ? 'Eigene Application' : chalk.yellow('spaeter')}`))
  console.log(chalk.white(`  SpacetimeDB: ${spacetimeDatabase || chalk.yellow('spaeter')}`))
  console.log(chalk.white(`  GitHub:      ${createGithub === 'none' ? 'nur lokal' : createGithub}`))
  console.log(chalk.white(`  Vercel:      ${linkVercel ? 'ja' : 'nein'}`))
  console.log()

  return {
    username: normalizedUsername,
    projectName,
    schemaName,
    supabase,
    serviceRoleKey: serviceRoleKey?.trim() || null,
    clerkSetup,
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
