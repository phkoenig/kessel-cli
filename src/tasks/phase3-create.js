import { Listr } from "listr2"
import { Octokit } from "octokit"
import degit from "degit"
import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import chalk from "chalk"
import { fetchAnonKeyFromSupabase, fetchServiceRoleKeyFromSupabase } from "../utils/supabase.js"

/**
 * Log-Datei für Projekt-Erstellung
 */
let logFile = null
let logPath = null

function initLog(projectPath, projectName) {
  const logsDir = path.join(projectPath, '.kessel')
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  logPath = path.join(logsDir, `creation-${timestamp}.log`)
  logFile = fs.createWriteStream(logPath, { flags: 'a' })
  
  // Header
  logFile.write(`# Kessel CLI - Projekt-Erstellung Log\n`)
  logFile.write(`# Projekt: ${projectName}\n`)
  logFile.write(`# Erstellt: ${new Date().toISOString()}\n`)
  logFile.write(`# ================================================\n\n`)
}

function writeLog(message, level = 'INFO') {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] [${level}] ${message}\n`
  if (logFile) {
    logFile.write(line)
  }
}

function closeLog() {
  if (logFile) {
    writeLog(`Log abgeschlossen`, 'INFO')
    logFile.end()
  }
  return logPath
}

/**
 * Promise mit Timeout
 */
function withTimeout(promise, ms, operation) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout nach ${ms}ms bei: ${operation}`)), ms)
    )
  ])
}

/**
 * Erstellt listr2 Tasks für Phase 3: Projekt-Erstellung (11 Schritte)
 * @param {Object} config - KesselConfig-Objekt
 * @param {Object} ctx - Context mit githubToken, packageManager, etc.
 * @param {string} projectPath - Pfad zum Projekt-Verzeichnis
 * @param {Object} options - Optionen (z.B. verbose)
 * @returns {Object} Objekt mit tasks-Array und listr-Instanz
 */
export function createProjectTasks(config, ctx, projectPath, options = {}) {
  const { verbose } = options
  
  // Log wird erst nach Template-Klonen initialisiert (wenn Verzeichnis existiert)
  let logInitialized = false
  
  // Debug-Funktion die IMMER logged wenn verbose=true UND ins Log schreibt (wenn initialisiert)
  const debug = (taskCtx, msg) => {
    // Ins Log schreiben falls initialisiert
    if (logInitialized) {
      writeLog(msg, 'DEBUG')
    }
    
    if (verbose) {
      // Versuche über taskCtx.debug, fallback zu console.log
      if (taskCtx && taskCtx.debug) {
        taskCtx.debug(msg)
      } else {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
        console.log(`[${timestamp}] ${msg}`)
      }
    }
  }
  
  // Funktion um Log zu initialisieren (wird nach Template-Klonen aufgerufen)
  const initializeLog = () => {
    try {
      initLog(projectPath, config.projectName)
      writeLog(`Starte Projekt-Erstellung: ${config.projectName}`)
      writeLog(`INFRA-DB: ${config.infraDb.url}`)
      writeLog(`DEV-DB: ${config.devDb.url}`)
      writeLog(`Schema: ${config.schemaName}`)
      writeLog(`GitHub: ${config.createGithub}`)
      logInitialized = true
    } catch (e) {
      // Log-Fehler ignorieren, nicht kritisch
      if (verbose) {
        console.log(`[WARN] Log konnte nicht initialisiert werden: ${e.message}`)
      }
    }
  }

  const taskDefinitions = [
    {
      title: "1/12: GitHub Repository erstellen",
      task: async (taskCtx, task) => {
        writeLog(`Task 1/12: GitHub Repository`, 'TASK')
        debug(taskCtx, `🚀 GitHub Task gestartet`)
        debug(taskCtx, `createGithub: ${config.createGithub}`)
        debug(taskCtx, `projectName: ${config.projectName}`)
        
        if (config.createGithub === 'none') {
          debug(taskCtx, `GitHub übersprungen (config.createGithub === 'none')`)
          writeLog(`GitHub übersprungen`, 'SKIP')
          task.skip("GitHub Repo-Erstellung übersprungen")
          return
        }
        
        try {
          debug(taskCtx, `GitHub Token vorhanden: ${!!ctx.githubToken}`)
          debug(taskCtx, `Token-Länge: ${ctx.githubToken ? ctx.githubToken.length : 0}`)
          
          debug(taskCtx, `Erstelle Octokit Client...`)
          const octokit = new Octokit({ 
            auth: ctx.githubToken,
            request: {
              timeout: 30000 // 30 Sekunden Timeout
            }
          })
          
          debug(taskCtx, `Hole User-Daten von GitHub API (Timeout: 30s)...`)
          const { data: userData } = await withTimeout(
            octokit.rest.users.getAuthenticated(),
            30000,
            'GitHub User-Authentifizierung'
          )
          debug(taskCtx, `✓ User: ${userData.login}`)
          writeLog(`GitHub User: ${userData.login}`)
          
          // Prüfe ob Repo bereits existiert
          debug(taskCtx, `Prüfe ob Repo existiert: ${userData.login}/${config.projectName}`)
          try {
            const { data: existingRepo } = await withTimeout(
              octokit.rest.repos.get({
                owner: userData.login,
                repo: config.projectName,
              }),
              15000,
              'GitHub Repo-Check'
            )
            // Repo existiert bereits
            ctx.repoUrl = existingRepo.html_url
            debug(taskCtx, `✓ Repo existiert bereits: ${existingRepo.html_url}`)
            writeLog(`Repo existiert: ${existingRepo.html_url}`, 'OK')
            task.title = `1/12: GitHub Repository existiert bereits ✓ (${existingRepo.html_url})`
            return
          } catch (e) {
            // 404 = Repo existiert nicht, das ist OK
            if (e.status !== 404 && !e.message.includes('Timeout')) {
              debug(taskCtx, `✗ Unerwarteter Fehler beim Prüfen: ${e.status} - ${e.message}`)
              throw e
            }
            if (e.message.includes('Timeout')) {
              debug(taskCtx, `⚠ Timeout beim Prüfen, versuche trotzdem zu erstellen...`)
            } else {
              debug(taskCtx, `Repo existiert nicht (404), wird erstellt...`)
            }
          }
          
          debug(taskCtx, `Erstelle neues Repo: ${config.projectName} (private: ${config.createGithub === 'private'})`)
          const { data: repo } = await withTimeout(
            octokit.rest.repos.createForAuthenticatedUser({
              name: config.projectName,
              private: config.createGithub === 'private',
              auto_init: false,
            }),
            30000,
            'GitHub Repo-Erstellung'
          )
          
          ctx.repoUrl = repo.html_url
          debug(taskCtx, `✓ Repo erstellt: ${repo.html_url}`)
          writeLog(`Repo erstellt: ${repo.html_url}`, 'OK')
          task.title = `1/12: GitHub Repository erstellt ✓ (${repo.html_url})`
        } catch (error) {
          debug(taskCtx, `✗ GitHub Fehler: ${error.message}`)
          writeLog(`GitHub Fehler: ${error.message}`, 'ERROR')
          
          // Bei Timeout oder 422 trotzdem weitermachen
          if (error.message.includes('Timeout')) {
            task.title = `1/12: GitHub Repository ⚠ (Timeout - manuell prüfen)`
            return
          }
          if (error.message.includes('already exists') || error.status === 422) {
            task.title = `1/12: GitHub Repository existiert bereits ⚠`
            return
          }
          task.title = `1/12: GitHub Repository ✗ (${error.message})`
          throw error
        }
      },
    },
    {
      title: "2/12: Template klonen",
      task: async (taskCtx, task) => {
        debug(taskCtx, `Prüfe Zielverzeichnis: ${projectPath}`)
        
        // Prüfe ob Verzeichnis bereits existiert
        if (fs.existsSync(projectPath)) {
          const files = fs.readdirSync(projectPath)
          if (files.length > 0) {
            debug(taskCtx, `Verzeichnis existiert bereits mit ${files.length} Dateien`)
            // Prüfe ob es ein Kessel-Projekt ist (package.json existiert)
            if (fs.existsSync(path.join(projectPath, 'package.json'))) {
              debug(taskCtx, `Bestehendes Kessel-Projekt gefunden, überspringe Klonen`)
              task.title = "2/12: Bestehendes Projekt verwendet ✓"
              initializeLog() // Log initialisieren
              return
            }
          }
        }
        
        try {
          const templateRepo = "phkoenig/kessel-boilerplate"
          const gitUrl = `https://${ctx.githubToken}@github.com/${templateRepo}.git`
          
          debug(taskCtx, `Git clone: ${templateRepo} → ${projectPath}`)
          execSync(
            `git clone --depth 1 --branch main ${gitUrl} ${projectPath}`,
            {
              stdio: "pipe",
              env: {
                ...process.env,
                GIT_TERMINAL_PROMPT: "0",
              },
            }
          )
          
          // Entferne .git Verzeichnis
          const gitPath = path.join(projectPath, ".git")
          if (fs.existsSync(gitPath)) {
            fs.rmSync(gitPath, { recursive: true, force: true })
          }
          
          debug(taskCtx, `Template erfolgreich geklont`)
          task.title = "2/12: Template geklont ✓"
          initializeLog() // Log initialisieren
        } catch (error) {
          debug(taskCtx, `Git clone fehlgeschlagen: ${error.message}`)
          // Fallback zu degit
          try {
            const templateRepo = "phkoenig/kessel-boilerplate"
            debug(taskCtx, `Versuche degit Fallback...`)
            const emitter = degit(`${templateRepo}#main`, {
              cache: false,
              force: true,
            })
            await emitter.clone(projectPath)
            debug(taskCtx, `Degit erfolgreich`)
            task.title = "2/12: Template geklont (degit) ✓"
            initializeLog() // Log initialisieren
          } catch (degitError) {
            debug(taskCtx, `Degit auch fehlgeschlagen: ${degitError.message}`)
            task.title = `2/12: Template klonen ✗`
            throw new Error(`Git: ${error.message}, Degit: ${degitError.message}`)
          }
        }
      },
    },
    {
      title: "3/12: Bootstrap-Credentials (.env)",
      task: async (taskCtx, task) => {
        const envContent = `# Bootstrap-Credentials für Vault-Zugriff (INFRA-DB)
# WICHTIG: Dies ist die URL der INFRA-DB (Kessel) mit integriertem Vault
NEXT_PUBLIC_SUPABASE_URL=${config.infraDb.url}
SERVICE_ROLE_KEY=${config.serviceRoleKey}
`
        fs.writeFileSync(path.join(projectPath, ".env"), envContent)
        task.title = "3/12: .env erstellt ✓"
      },
    },
    {
      title: "4/12: Public-Credentials (.env.local)",
      task: async (taskCtx, task) => {
        // Hole Anon Key falls noch nicht vorhanden
        if (!ctx.anonKey) {
          ctx.anonKey = await fetchAnonKeyFromSupabase(config.infraDb.projectRef, () => {})
        }
        
        if (!ctx.anonKey) {
          throw new Error("Anon Key konnte nicht abgerufen werden")
        }
        
        const cleanAnonKey = ctx.anonKey.replace(/\x1b\[[0-9;]*m/g, '').replace(/\u001b\[\d+m/g, '').trim()
        const cleanServiceRoleKey = ctx.serviceRoleKey.replace(/\x1b\[[0-9;]*m/g, '').replace(/\u001b\[\d+m/g, '').trim()
        
        const envLocalContent = `# Public-Credentials für Next.js Client
# Multi-Tenant Architektur: INFRA-DB (Auth, Vault) + DEV-DB (App-Daten)
# Jedes Projekt hat ein eigenes Schema für Daten-Isolation

# INFRA-DB (Kessel) - Auth, Vault, Multi-Tenant
NEXT_PUBLIC_SUPABASE_URL=${config.infraDb.url}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${cleanAnonKey}
NEXT_PUBLIC_PROJECT_SCHEMA=${config.schemaName}

# DEV-DB - App-Daten, Entwicklung
# Hinweis: Kann gleich INFRA-DB sein oder separate DB für fachliche Daten
NEXT_PUBLIC_DEV_SUPABASE_URL=${config.devDb.url}

# Service Role Key für Server-Side Operationen (User-Erstellung, etc.)
SUPABASE_SERVICE_ROLE_KEY=${cleanServiceRoleKey}

# ════════════════════════════════════════════════════════════════════
# Local Development Defaults
# ════════════════════════════════════════════════════════════════════
# Auth-Bypass aktiviert den DevUserSelector auf der Login-Seite
NEXT_PUBLIC_AUTH_BYPASS=true
`
        fs.writeFileSync(path.join(projectPath, ".env.local"), envLocalContent)
        task.title = "4/12: .env.local erstellt ✓"
      },
    },
    {
      title: "5/12: Git initialisieren",
      task: async (taskCtx, task) => {
        const gitDir = path.join(projectPath, ".git")
        if (!fs.existsSync(gitDir)) {
          execSync("git init", { cwd: projectPath, stdio: "ignore" })
        }
        
        if (ctx.repoUrl) {
          const remoteUrl = ctx.repoUrl.replace("https://", `https://${ctx.githubToken}@`)
          try {
            execSync("git remote remove origin", { cwd: projectPath, stdio: "ignore" })
          } catch {
            // Ignorieren falls nicht vorhanden
          }
          execSync(`git remote add origin ${ctx.repoUrl}`, {
            cwd: projectPath,
            stdio: "ignore",
          })
        }
        
        task.title = "5/12: Git initialisiert ✓"
      },
    },
    {
      title: "6/12: Dependencies installieren",
      task: async (taskCtx, task) => {
        if (!config.autoInstallDeps) {
          task.skip("Dependencies-Installation übersprungen")
          return
        }
        
        const installCmd = ctx.packageManager?.installCommand || "pnpm install"
        execSync(installCmd, { cwd: projectPath, stdio: "inherit" })
        task.title = "6/12: Dependencies installiert ✓"
      },
      skip: () => !config.autoInstallDeps,
    },
    {
      title: "7/12: Supabase Link",
      task: async (taskCtx, task) => {
        try {
          execSync(`supabase link --project-ref ${config.infraDb.projectRef}`, {
            cwd: projectPath,
            stdio: "pipe",
          })
          task.title = "7/12: INFRA-DB verlinkt ✓"
        } catch (error) {
          task.title = "7/12: Supabase Link ⚠ (nicht kritisch)"
        }
      },
    },
    {
      title: "8/12: Multi-Tenant Schema erstellen",
      task: async (taskCtx, task) => {
        debug(taskCtx, `Erstelle Schema: ${config.schemaName}`)
        
        // Schema über Supabase REST API erstellen
        try {
          const sql = `
            -- Schema erstellen falls nicht vorhanden
            CREATE SCHEMA IF NOT EXISTS "${config.schemaName}";
            
            -- Grant für authenticated und anon
            GRANT USAGE ON SCHEMA "${config.schemaName}" TO authenticated, anon;
            GRANT ALL ON ALL TABLES IN SCHEMA "${config.schemaName}" TO authenticated;
            GRANT SELECT ON ALL TABLES IN SCHEMA "${config.schemaName}" TO anon;
            
            -- Default privileges für zukünftige Tabellen
            ALTER DEFAULT PRIVILEGES IN SCHEMA "${config.schemaName}" 
              GRANT ALL ON TABLES TO authenticated;
            ALTER DEFAULT PRIVILEGES IN SCHEMA "${config.schemaName}" 
              GRANT SELECT ON TABLES TO anon;
          `
          
          const response = await fetch(`${config.infraDb.url}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': ctx.serviceRoleKey,
              'Authorization': `Bearer ${ctx.serviceRoleKey}`,
            },
            body: JSON.stringify({ sql_query: sql }),
          })
          
          if (!response.ok) {
            // Fallback: Versuche direkt über SQL-Endpoint
            debug(taskCtx, `exec_sql nicht verfügbar, Schema wird beim ersten Start erstellt`)
            task.title = `8/12: Schema "${config.schemaName}" ⚠ (wird bei Migration erstellt)`
            return
          }
          
          debug(taskCtx, `Schema "${config.schemaName}" erstellt`)
          task.title = `8/12: Schema "${config.schemaName}" erstellt ✓`
        } catch (error) {
          debug(taskCtx, `Schema-Erstellung Fehler: ${error.message}`)
          task.title = `8/12: Schema "${config.schemaName}" ⚠ (manuell erstellen)`
        }
      },
    },
    {
      title: "9/12: Datenbank-Migrationen",
      task: async (taskCtx, task) => {
        debug(taskCtx, `Migration-Script suchen...`)
        const migrationScript = path.join(projectPath, "scripts", "apply-migrations-to-schema.mjs")
        if (!fs.existsSync(migrationScript)) {
          debug(taskCtx, `Migration-Script nicht gefunden: ${migrationScript}`)
          task.skip("Migration-Script nicht gefunden")
          return
        }
        
        debug(taskCtx, `Migrationen brauchen DB_PASSWORD - überspringe automatische Ausführung`)
        task.title = "9/12: Migrationen ⚠ (manuell: pnpm db:migrate)"
        
        // Info für User
        ctx.migrationPending = true
      },
    },
    {
      title: "10/12: Standard-User prüfen",
      task: async (taskCtx, task) => {
        const createUsersScript = path.join(projectPath, "scripts", "create-test-users.mjs")
        if (!fs.existsSync(createUsersScript)) {
          task.skip("User-Script nicht gefunden")
          return
        }
        
        try {
          const userEnv = {
            ...process.env,
            NEXT_PUBLIC_SUPABASE_URL: config.infraDb.url,
            SUPABASE_SERVICE_ROLE_KEY: ctx.serviceRoleKey,
          }
          
          execSync("node scripts/create-test-users.mjs", {
            cwd: projectPath,
            stdio: "inherit",
            env: userEnv,
          })
          task.title = "10/12: Standard-User erstellt ✓"
        } catch (error) {
          task.title = "10/12: Standard-User ⚠"
        }
      },
    },
    {
      title: "11/12: Vercel Link",
      task: async (taskCtx, task) => {
        if (!config.linkVercel) {
          task.skip("Vercel Link übersprungen")
          return
        }
        
        try {
          execSync("vercel link --yes", {
            cwd: projectPath,
            stdio: "pipe",
          })
          task.title = "11/12: Vercel verlinkt ✓"
        } catch (error) {
          task.title = "11/12: Vercel Link ⚠ (nicht kritisch)"
        }
      },
      skip: () => !config.linkVercel,
    },
    {
      title: "12/12: MCP-Konfiguration aktualisieren",
      task: async (taskCtx, task) => {
        const mcpConfigPath = path.join(projectPath, ".cursor", "mcp.json")
        const cursorDir = path.join(projectPath, ".cursor")
        
        if (!fs.existsSync(cursorDir)) {
          fs.mkdirSync(cursorDir, { recursive: true })
        }
        
        let mcpConfig = { mcpServers: {} }
        if (fs.existsSync(mcpConfigPath)) {
          mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"))
        }
        
        // Entferne alle Supabase MCPs
        const supabaseKeys = Object.keys(mcpConfig.mcpServers || {})
          .filter(key => key.toLowerCase().includes("supabase"))
        for (const key of supabaseKeys) {
          delete mcpConfig.mcpServers[key]
        }
        
        // Füge neuen DEV-DB MCP hinzu
        const mcpServerName = `supabase_DEV_${config.schemaName}`
        mcpConfig.mcpServers[mcpServerName] = {
          type: "http",
          url: `https://mcp.supabase.com/mcp?project_ref=${config.devDb.projectRef}`
        }
        
        fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2))
        task.title = "11/12: MCP-Konfiguration aktualisiert ✓"
      },
    },
    {
      title: "Log abschließen",
      task: async (taskCtx, task) => {
        // Schreibe Zusammenfassung ins Log
        writeLog(`\n# ================================================`, 'INFO')
        writeLog(`# ZUSAMMENFASSUNG`, 'INFO')
        writeLog(`# ================================================`, 'INFO')
        writeLog(`Projekt: ${config.projectName}`, 'INFO')
        writeLog(`Pfad: ${projectPath}`, 'INFO')
        writeLog(`Schema: ${config.schemaName}`, 'INFO')
        writeLog(`INFRA-DB: ${config.infraDb.url}`, 'INFO')
        writeLog(`DEV-DB: ${config.devDb.url}`, 'INFO')
        writeLog(`GitHub: ${ctx.repoUrl || 'nicht erstellt'}`, 'INFO')
        writeLog(`Migration pending: ${ctx.migrationPending ? 'JA' : 'NEIN'}`, 'INFO')
        
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
      rendererOptions: {
        collapseSubtasks: false,
        showTimer: false,
        clearOutput: false,
        formatOutput: 'default',
      },
    }),
    closeLog, // Exportiere für manuellen Aufruf falls nötig
  }
}

