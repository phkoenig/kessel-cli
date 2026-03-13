import { Listr } from "listr2"
import { Octokit } from "octokit"
import degit from "degit"
import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import chalk from "chalk"
import { DEFAULTS } from "../config.js"

// ── Helpers ──────────────────────────────────────────────────────────

let logFile = null
let logPath = null
let logClosed = false

function initLog(projectPath, projectName) {
  const logsDir = path.join(projectPath, '.kessel')
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  logPath = path.join(logsDir, `creation-${timestamp}.log`)
  logFile = fs.createWriteStream(logPath, { flags: 'a' })
  logFile.write(`# Kessel CLI - Projekt-Erstellung Log\n`)
  logFile.write(`# Projekt: ${projectName}\n`)
  logFile.write(`# Erstellt: ${new Date().toISOString()}\n`)
  logFile.write(`# Architektur: Boilerplate 3.0 (Clerk + SpacetimeDB + Supabase)\n`)
  logFile.write(`# ================================================\n\n`)
}

function writeLog(message, level = 'INFO') {
  if (logFile && !logClosed && logFile.writable) {
    try { logFile.write(`[${new Date().toISOString()}] [${level}] ${message}\n`) } catch {}
  }
}

function closeLog() {
  if (logFile && !logClosed) {
    try { logFile.write(`[${new Date().toISOString()}] [INFO] Log abgeschlossen\n`); logFile.end() } catch {}
    logClosed = true
  }
  return logPath
}

function withTimeout(promise, ms, operation) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout nach ${ms}ms bei: ${operation}`)), ms))
  ])
}

/**
 * Aktualisiert boilerplate.json mit projektspezifischen Metadaten.
 */
function updateBoilerplateJson(projectPath, config, debug, taskCtx) {
  const bpPath = path.join(projectPath, 'boilerplate.json')
  if (!fs.existsSync(bpPath)) return
  try {
    const bp = JSON.parse(fs.readFileSync(bpPath, 'utf8'))
    bp.name = config.projectName
    bp.version = '0.1.0'
    bp.description = `${config.projectName} – App basierend auf Kessel Boilerplate 3.0`
    bp.basedOn = DEFAULTS.templateRepo
    if (config.supabase?.projectRef) {
      bp.supabase = bp.supabase || {}
      bp.supabase.project = config.supabase.projectRef
    }
    fs.writeFileSync(bpPath, JSON.stringify(bp, null, 2))
    debug(taskCtx, `boilerplate.json aktualisiert`)
  } catch (e) {
    debug(taskCtx, `boilerplate.json Update fehlgeschlagen: ${e.message}`)
  }
}

/**
 * Passt 1Password-Referenzen in pull-env.manifest.json an.
 */
function updatePullEnvManifest(projectPath, config, debug, taskCtx) {
  const manifestPath = path.join(projectPath, 'scripts', 'pull-env.manifest.json')
  if (!fs.existsSync(manifestPath)) return
  try {
    let content = fs.readFileSync(manifestPath, 'utf8')
    const projectPrefix = config.projectName.toUpperCase()
    content = content.replace(/KB - /g, `${projectPrefix} - `)
    fs.writeFileSync(manifestPath, content)
    debug(taskCtx, `pull-env.manifest.json: Prefix auf "${projectPrefix} - " geaendert`)
  } catch (e) {
    debug(taskCtx, `pull-env.manifest.json Update fehlgeschlagen: ${e.message}`)
  }
}

// ── Main ─────────────────────────────────────────────────────────────

/**
 * Erstellt listr2 Tasks fuer Phase 3: Projekt-Erstellung (14 Schritte)
 * Boilerplate 3.0 Architektur: Supabase + Clerk + SpacetimeDB
 */
export function createProjectTasks(config, ctx, projectPath, options = {}) {
  const { verbose, dryRun } = options
  
  const finalProjectPath = projectPath || config?.projectPath
  if (!finalProjectPath) {
    throw new Error('projectPath ist nicht gesetzt!')
  }
  
  let logInitialized = false
  
  const debug = (taskCtx, msg) => {
    if (logInitialized) writeLog(msg, 'DEBUG')
    if (verbose) {
      if (taskCtx && taskCtx.debug) taskCtx.debug(msg)
      else console.log(`[${new Date().toISOString().split('T')[1].split('.')[0]}] ${msg}`)
    }
  }
  
  const initializeLog = () => {
    try {
      initLog(finalProjectPath, config.projectName)
      writeLog(`Starte Projekt-Erstellung: ${config.projectName}`)
      writeLog(`Pfad: ${finalProjectPath}`)
      writeLog(`Supabase: ${config.supabase?.url}`)
      writeLog(`Clerk: ${config.clerkMode}`)
      writeLog(`SpacetimeDB: ${config.spacetimeDatabase || 'skip'}`)
      logInitialized = true
    } catch (e) {
      if (verbose) console.log(`[WARN] Log konnte nicht initialisiert werden: ${e.message}`)
    }
  }

  const taskDefinitions = [
    // ── 1/14: GitHub ──
    {
      title: "1/14: GitHub Repository erstellen",
      task: async (taskCtx, task) => {
        if (dryRun) { task.title = "1/14: GitHub Repository (DRY-RUN) ✓"; return }
        writeLog(`Task 1/14: GitHub Repository`, 'TASK')
        
        if (config.createGithub === 'none') { task.skip("Uebersprungen"); return }
        if (!ctx.githubToken) { task.title = "1/14: GitHub Repository ⚠ (Token fehlt)"; return }
        
        try {
          const octokit = new Octokit({ auth: ctx.githubToken, request: { timeout: 30000 } })
          const { data: userData } = await withTimeout(octokit.rest.users.getAuthenticated(), 30000, 'GitHub Auth')
          debug(taskCtx, `GitHub User: ${userData.login}`)
          
          try {
            const { data: existingRepo } = await withTimeout(
              octokit.rest.repos.get({ owner: userData.login, repo: config.projectName }), 15000, 'Repo-Check'
            )
            ctx.repoUrl = existingRepo.html_url
            task.title = `1/14: GitHub Repository existiert bereits ✓`
            return
          } catch (e) {
            if (e.status !== 404 && !e.message?.includes('Timeout')) throw e
          }
          
          const { data: repo } = await withTimeout(
            octokit.rest.repos.createForAuthenticatedUser({
              name: config.projectName, private: config.createGithub === 'private', auto_init: false,
            }), 30000, 'Repo-Erstellung'
          )
          ctx.repoUrl = repo.html_url
          writeLog(`Repo erstellt: ${repo.html_url}`, 'OK')
          task.title = `1/14: GitHub Repository erstellt ✓`
        } catch (error) {
          writeLog(`GitHub Fehler: ${error.message}`, 'ERROR')
          if (error.message?.includes('Timeout')) { task.title = "1/14: GitHub ⚠ (Timeout)"; return }
          if (error.message?.includes('already exists') || error.status === 422) { task.title = "1/14: GitHub existiert bereits ⚠"; return }
          throw error
        }
      },
    },

    // ── 2/14: Template ──
    {
      title: "2/14: Template klonen",
      task: async (taskCtx, task) => {
        if (dryRun) { task.title = "2/14: Template klonen (DRY-RUN) ✓"; return }
        
        if (fs.existsSync(finalProjectPath) && fs.existsSync(path.join(finalProjectPath, 'package.json'))) {
          task.title = "2/14: Bestehendes Projekt verwendet ✓"
          initializeLog()
          return
        }
        
        const templateRepo = DEFAULTS.templateRepo
        try {
          const gitUrl = `https://${ctx.githubToken}@github.com/${templateRepo}.git`
          execSync(`git clone --depth 1 --branch main ${gitUrl} ${finalProjectPath}`, {
            stdio: "pipe", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
          })
          fs.rmSync(path.join(finalProjectPath, ".git"), { recursive: true, force: true })
        } catch {
          const emitter = degit(`${templateRepo}#main`, { cache: false, force: true })
          await emitter.clone(finalProjectPath)
        }
        
        // package.json aktualisieren
        const pkgPath = path.join(finalProjectPath, 'package.json')
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
          pkg.name = config.projectName
          pkg.version = '0.1.0'
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
        }
        
        updateBoilerplateJson(finalProjectPath, config, debug, taskCtx)
        updatePullEnvManifest(finalProjectPath, config, debug, taskCtx)
        
        task.title = "2/14: Template geklont ✓"
        initializeLog()
      },
    },

    // ── 3/14: .env.local ──
    {
      title: "3/14: Environment-Variablen (.env.local)",
      task: async (taskCtx, task) => {
        if (dryRun) { task.title = "3/14: .env.local (DRY-RUN) ✓"; return }
        
        const appName = config.projectName.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        
        let content = `# ${appName} - Environment Variables
# Boilerplate 3.0: Clerk + SpacetimeDB + Supabase

# App Config
NEXT_PUBLIC_APP_NAME=${appName}
NEXT_PUBLIC_TENANT_SLUG=${config.schemaName}

# Supabase (App-Datenbank)
NEXT_PUBLIC_SUPABASE_URL=${config.supabase.url}
SUPABASE_SERVICE_ROLE_KEY=${config.serviceRoleKey}
`
        // Clerk Keys
        if (config.clerkKeys) {
          content += `
# Clerk Authentication (eigene Application)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${config.clerkKeys.publishableKey}
CLERK_SECRET_KEY=${config.clerkKeys.secretKey}
`
        }

        // SpacetimeDB
        if (config.spacetimeDatabase) {
          content += `
# SpacetimeDB (UX-Core)
NEXT_PUBLIC_SPACETIMEDB_URI=${DEFAULTS.spacetimeUri}
NEXT_PUBLIC_SPACETIMEDB_DATABASE=${config.spacetimeDatabase}
NEXT_PUBLIC_BOILERPLATE_CORE_DRIVER=${DEFAULTS.spacetimeCoreDriver}
`
        }

        fs.writeFileSync(path.join(finalProjectPath, ".env.local"), content)
        task.title = "3/14: .env.local erstellt ✓"
      },
    },

    // ── 4/14: .env.example ──
    {
      title: "4/14: .env.example aktualisieren",
      task: async (taskCtx, task) => {
        if (dryRun) { task.title = "4/14: .env.example (DRY-RUN) ✓"; return }
        
        const appName = config.projectName.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        const projectPrefix = config.projectName.toUpperCase()
        
        let content = `# Bootstrap Environment Variables for ${appName}
# Copy this to .env.local and fill in your values

# Clerk Authentication (${projectPrefix})
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# App Config
NEXT_PUBLIC_TENANT_SLUG=${config.schemaName}
NEXT_PUBLIC_APP_NAME=${appName}

# Supabase (App-Datenbank)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
`
        if (config.spacetimeDatabase) {
          content += `
# SpacetimeDB (UX-Core)
NEXT_PUBLIC_SPACETIMEDB_URI=${DEFAULTS.spacetimeUri}
NEXT_PUBLIC_SPACETIMEDB_DATABASE=${config.spacetimeDatabase}
NEXT_PUBLIC_BOILERPLATE_CORE_DRIVER=${DEFAULTS.spacetimeCoreDriver}
`
        }
        
        fs.writeFileSync(path.join(finalProjectPath, ".env.example"), content)
        task.title = "4/14: .env.example aktualisiert ✓"
      },
    },

    // ── 5/14: Git ──
    {
      title: "5/14: Git initialisieren",
      task: async (taskCtx, task) => {
        if (dryRun) { task.title = "5/14: Git (DRY-RUN) ✓"; return }
        if (!fs.existsSync(path.join(finalProjectPath, ".git"))) {
          execSync("git init -b main", { cwd: finalProjectPath, stdio: "ignore" })
        }
        if (ctx.repoUrl) {
          try { execSync("git remote remove origin", { cwd: finalProjectPath, stdio: "ignore" }) } catch {}
          execSync(`git remote add origin ${ctx.repoUrl}`, { cwd: finalProjectPath, stdio: "ignore" })
        }
        task.title = "5/14: Git initialisiert ✓"
      },
    },

    // ── 6/14: Dependencies ──
    {
      title: "6/14: Dependencies installieren",
      task: async (taskCtx, task) => {
        if (!config.autoInstallDeps) { task.skip("Uebersprungen"); return }
        if (dryRun) { task.title = "6/14: Dependencies (DRY-RUN) ✓"; return }
        
        const installCmd = ctx.packageManager?.installCommand || "pnpm install"
        execSync(installCmd, { cwd: finalProjectPath, stdio: "inherit" })
        try { execSync("pnpm version:write", { cwd: finalProjectPath, stdio: "ignore" }) } catch {}
        task.title = "6/14: Dependencies installiert ✓"
      },
      skip: () => !config.autoInstallDeps,
    },

    // ── 7/14: Secrets aus 1Password ──
    {
      title: "7/14: Secrets aus 1Password laden (pnpm pull-env)",
      task: async (taskCtx, task) => {
        if (!config.autoInstallDeps) { task.skip("Uebersprungen"); return }
        if (dryRun) { task.title = "7/14: Secrets (DRY-RUN) ✓"; return }
        
        try {
          execSync("pnpm pull-env", { cwd: finalProjectPath, stdio: "pipe" })
          writeLog(`Secrets aus 1Password geladen`, 'OK')
          task.title = "7/14: Secrets aus 1Password geladen ✓"
        } catch {
          task.title = "7/14: Secrets ⚠ (manuell: pnpm pull-env)"
        }
      },
      skip: () => !config.autoInstallDeps,
    },

    // ── 8/14: Supabase Link ──
    {
      title: "8/14: Supabase Link",
      task: async (taskCtx, task) => {
        if (dryRun) { task.title = "8/14: Supabase Link (DRY-RUN) ✓"; return }
        try {
          execSync(`supabase link --project-ref ${config.supabase.projectRef}`, {
            cwd: finalProjectPath, stdio: "pipe",
          })
          task.title = `8/14: Supabase verlinkt (${config.supabase.projectRef}) ✓`
        } catch {
          task.title = "8/14: Supabase Link ⚠ (nicht kritisch)"
        }
      },
    },

    // ── 9/14: SpacetimeDB Modul ──
    {
      title: "9/14: SpacetimeDB Modul publizieren",
      task: async (taskCtx, task) => {
        if (config.spacetimeMode === 'skip') { task.skip("Uebersprungen"); return }
        if (config.spacetimeMode === 'existing') {
          task.title = `9/14: SpacetimeDB "${config.spacetimeDatabase}" (bestehend) ✓`
          return
        }
        if (dryRun) { task.title = "9/14: SpacetimeDB (DRY-RUN) ✓"; return }
        
        const modulePath = path.join(finalProjectPath, "spacetime-module")
        if (!fs.existsSync(modulePath)) {
          task.title = "9/14: SpacetimeDB ⚠ (kein spacetime-module/)"
          return
        }
        
        try {
          execSync(`spacetime publish ${config.spacetimeDatabase} --project-path ${modulePath}`, {
            cwd: finalProjectPath, stdio: "pipe",
          })
          writeLog(`SpacetimeDB publiziert: ${config.spacetimeDatabase}`, 'OK')
          task.title = `9/14: SpacetimeDB "${config.spacetimeDatabase}" publiziert ✓`
        } catch (error) {
          writeLog(`SpacetimeDB publish fehlgeschlagen: ${error.message}`, 'WARN')
          task.title = `9/14: SpacetimeDB ⚠ (manuell: spacetime publish ${config.spacetimeDatabase})`
        }
      },
      skip: () => config.spacetimeMode === 'skip',
    },

    // ── 10/14: MCP-Konfiguration ──
    {
      title: "10/14: MCP-Konfiguration aktualisieren",
      task: async (taskCtx, task) => {
        if (dryRun) { task.title = "10/14: MCP (DRY-RUN) ✓"; return }
        
        const mcpConfigPath = path.join(finalProjectPath, ".cursor", "mcp.json")
        const cursorDir = path.join(finalProjectPath, ".cursor")
        if (!fs.existsSync(cursorDir)) fs.mkdirSync(cursorDir, { recursive: true })
        
        let mcpConfig = { mcpServers: {} }
        if (fs.existsSync(mcpConfigPath)) {
          mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"))
        }
        
        // Entferne alte Supabase MCPs
        for (const key of Object.keys(mcpConfig.mcpServers || {}).filter(k => k.toLowerCase().includes("supabase"))) {
          delete mcpConfig.mcpServers[key]
        }
        
        mcpConfig.mcpServers[`supabase_${config.schemaName}`] = {
          type: "http",
          url: `https://mcp.supabase.com/mcp?project_ref=${config.supabase.projectRef}`
        }
        
        fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2))
        task.title = "10/14: MCP-Konfiguration aktualisiert ✓"
      },
    },

    // ── 11/14: secrets.mdc ──
    {
      title: "11/14: secrets.mdc aktualisieren",
      task: async (taskCtx, task) => {
        if (dryRun) { task.title = "11/14: secrets.mdc (DRY-RUN) ✓"; return }
        
        const secretsMdcPath = path.join(finalProjectPath, ".cursor", "rules", "secrets.mdc")
        if (!fs.existsSync(secretsMdcPath)) { task.skip("Nicht vorhanden"); return }
        
        try {
          let content = fs.readFileSync(secretsMdcPath, 'utf8')
          const projectPrefix = config.projectName.toUpperCase()
          content = content.replace(/KB - /g, `${projectPrefix} - `)
          content = content.replace(/Kessel Boilerplate Items \(Prefix: KB - \)/g,
            `${projectPrefix} Items (Prefix: ${projectPrefix} - )`)
          fs.writeFileSync(secretsMdcPath, content)
          task.title = "11/14: secrets.mdc aktualisiert ✓"
        } catch {
          task.title = "11/14: secrets.mdc ⚠"
        }
      },
    },

    // ── 12/14: Vercel ──
    {
      title: "12/14: Vercel Link",
      task: async (taskCtx, task) => {
        if (!config.linkVercel) { task.skip("Uebersprungen"); return }
        if (dryRun) { task.title = "12/14: Vercel (DRY-RUN) ✓"; return }
        try {
          execSync("vercel link --yes", { cwd: finalProjectPath, stdio: "pipe" })
          task.title = "12/14: Vercel verlinkt ✓"
        } catch {
          task.title = "12/14: Vercel Link ⚠ (nicht kritisch)"
        }
      },
      skip: () => !config.linkVercel,
    },

    // ── 13/14: Initial Commit ──
    {
      title: "13/14: Initial Commit",
      task: async (taskCtx, task) => {
        if (!config.doInitialCommit) { task.skip("Uebersprungen"); return }
        if (dryRun) { task.title = "13/14: Commit (DRY-RUN) ✓"; return }
        
        try {
          execSync("git add -A", { cwd: finalProjectPath, stdio: "ignore" })
          execSync(`git commit -m "init: ${config.projectName} (Kessel Boilerplate 3.0)"`, {
            cwd: finalProjectPath, stdio: "ignore",
          })
          writeLog("Initial Commit erstellt", 'OK')
          task.title = "13/14: Initial Commit erstellt ✓"
          
          if (config.doPush && ctx.repoUrl) {
            execSync("git push -u origin main", { cwd: finalProjectPath, stdio: "ignore" })
            writeLog("Push zu GitHub erfolgreich", 'OK')
            task.title = "13/14: Initial Commit + Push ✓"
          }
        } catch (error) {
          task.title = `13/14: Commit ⚠ (${error.message})`
        }
      },
      skip: () => !config.doInitialCommit,
    },

    // ── 14/14: Log ──
    {
      title: "Log abschliessen",
      task: async (taskCtx, task) => {
        writeLog(`\n# ================================================`, 'INFO')
        writeLog(`# ZUSAMMENFASSUNG`, 'INFO')
        writeLog(`# ================================================`, 'INFO')
        writeLog(`Projekt: ${config.projectName}`, 'INFO')
        writeLog(`Pfad: ${finalProjectPath}`, 'INFO')
        writeLog(`Supabase: ${config.supabase?.url} (${config.supabase?.projectRef})`, 'INFO')
        writeLog(`Clerk: ${config.clerkMode}`, 'INFO')
        writeLog(`SpacetimeDB: ${config.spacetimeDatabase || 'uebersprungen'}`, 'INFO')
        writeLog(`GitHub: ${ctx.repoUrl || 'nicht erstellt'}`, 'INFO')
        
        const logFilePath = closeLog()
        ctx.logFilePath = logFilePath
        task.title = `Log gespeichert ✓`
      },
    },
  ]
  
  return {
    tasks: taskDefinitions,
    listr: new Listr(taskDefinitions, {
      concurrent: false,
      renderer: 'verbose',
      rendererOptions: { collapseSubtasks: false, showTimer: false, clearOutput: false, formatOutput: 'default' },
    }),
    closeLog,
  }
}
