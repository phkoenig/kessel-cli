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

let logClosed = false

function writeLog(message, level = 'INFO') {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] [${level}] ${message}\n`
  // Prüfe ob Stream noch offen und beschreibbar ist
  if (logFile && !logClosed && logFile.writable) {
    try {
      logFile.write(line)
    } catch (e) {
      // Ignoriere Schreibfehler nach Stream-Ende
    }
  }
}

function closeLog() {
  if (logFile && !logClosed) {
    try {
      logFile.write(`[${new Date().toISOString()}] [INFO] Log abgeschlossen\n`)
      logFile.end()
    } catch (e) {
      // Ignoriere Fehler beim Schließen
    }
    logClosed = true
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
  const { verbose, dryRun } = options
  
  // WICHTIG: projectPath MUSS aus config kommen, falls als Parameter fehlt
  const finalProjectPath = projectPath || config?.projectPath
  if (!finalProjectPath) {
    throw new Error('projectPath ist nicht gesetzt! Bitte Installationsordner im Wizard angeben.')
  }
  
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
      initLog(finalProjectPath, config.projectName)
      writeLog(`Starte Projekt-Erstellung: ${config.projectName}`)
      writeLog(`Pfad: ${finalProjectPath}`)
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
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: GitHub Repository würde erstellt werden`)
          task.title = "1/12: GitHub Repository (DRY-RUN) ✓"
          return Promise.resolve()
        }
        
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
        
        // Prüfe ob GitHub Token vorhanden ist
        if (!ctx.githubToken) {
          debug(taskCtx, `GitHub Token fehlt - überspringe Repository-Erstellung`)
          task.title = "1/12: GitHub Repository ⚠ (Token fehlt - manuell erstellen)"
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
        debug(taskCtx, `Prüfe Zielverzeichnis: ${finalProjectPath}`)
        
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Template würde geklont werden nach ${finalProjectPath}`)
          task.title = "2/12: Template klonen (DRY-RUN) ✓"
          return
        }
        
        // Prüfe ob Verzeichnis bereits existiert
        if (fs.existsSync(finalProjectPath)) {
          const files = fs.readdirSync(finalProjectPath)
          if (files.length > 0) {
            debug(taskCtx, `Verzeichnis existiert bereits mit ${files.length} Dateien`)
            // Prüfe ob es ein Kessel-Projekt ist (package.json existiert)
            if (fs.existsSync(path.join(finalProjectPath, 'package.json'))) {
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
          
          debug(taskCtx, `Git clone: ${templateRepo} → ${finalProjectPath}`)
          execSync(
            `git clone --depth 1 --branch main ${gitUrl} ${finalProjectPath}`,
            {
              stdio: "pipe",
              env: {
                ...process.env,
                GIT_TERMINAL_PROMPT: "0",
              },
            }
          )
          
          // Entferne .git Verzeichnis
          const gitPath = path.join(finalProjectPath, ".git")
          if (fs.existsSync(gitPath)) {
            fs.rmSync(gitPath, { recursive: true, force: true })
          }
          
          debug(taskCtx, `Template erfolgreich geklont`)
          
          // Package.json mit korrektem Projektnamen aktualisieren
          const pkgPath = path.join(finalProjectPath, 'package.json')
          if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
            pkg.name = config.projectName
            pkg.version = '0.1.0'
            fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
            debug(taskCtx, `package.json aktualisiert: name=${config.projectName}`)
          }
          
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
            await emitter.clone(finalProjectPath)
            debug(taskCtx, `Degit erfolgreich`)
            
            // Package.json mit korrektem Projektnamen aktualisieren
            const pkgPath = path.join(finalProjectPath, 'package.json')
            if (fs.existsSync(pkgPath)) {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
              pkg.name = config.projectName
              pkg.version = '0.1.0'
              fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
              debug(taskCtx, `package.json aktualisiert: name=${config.projectName}`)
            }
            
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
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: .env würde erstellt werden`)
          task.title = "3/12: .env (DRY-RUN) ✓"
          return
        }
        
        const envContent = `# Bootstrap-Credentials für Vault-Zugriff (INFRA-DB)
# WICHTIG: Dies ist die URL der INFRA-DB (Kessel) mit integriertem Vault
NEXT_PUBLIC_SUPABASE_URL=${config.infraDb.url}
SERVICE_ROLE_KEY=${config.serviceRoleKey}
`
        fs.writeFileSync(path.join(finalProjectPath, ".env"), envContent)
        task.title = "3/12: .env erstellt ✓"
      },
    },
    {
      title: "4/12: Public-Credentials (.env.local)",
      task: async (taskCtx, task) => {
        // Hole Anon Key falls noch nicht vorhanden (auch im Dry-Run)
        if (!ctx.anonKey) {
          ctx.anonKey = await fetchAnonKeyFromSupabase(config.infraDb.projectRef, () => {})
        }
        
        if (!ctx.anonKey) {
          throw new Error("Anon Key konnte nicht abgerufen werden")
        }
        
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: .env.local würde erstellt werden`)
          task.title = "4/12: .env.local (DRY-RUN) ✓"
          return
        }
        
        const cleanAnonKey = ctx.anonKey.replace(/\x1b\[[0-9;]*m/g, '').replace(/\u001b\[\d+m/g, '').trim()
        const cleanServiceRoleKey = ctx.serviceRoleKey.replace(/\x1b\[[0-9;]*m/g, '').replace(/\u001b\[\d+m/g, '').trim()
        
        // App-Name aus Projektname generieren (Titel-Case)
        const appName = config.projectName
          .split(/[-_]/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
        
        const envLocalContent = `# Public-Credentials für Next.js Client
# Multi-Tenant Architektur: INFRA-DB (Auth, Vault) + DEV-DB (App-Daten)
# Tenant-Isolation erfolgt über RLS Policies basierend auf tenant_id im JWT

# App-Name (wird im UI angezeigt)
NEXT_PUBLIC_APP_NAME=${appName}

# INFRA-DB (Kessel) - Auth, Vault, Multi-Tenant
NEXT_PUBLIC_SUPABASE_URL=${config.infraDb.url}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${cleanAnonKey}
NEXT_PUBLIC_TENANT_SLUG=${config.schemaName}

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
        fs.writeFileSync(path.join(finalProjectPath, ".env.local"), envLocalContent)
        task.title = "4/12: .env.local erstellt ✓"
      },
    },
    {
      title: "5/12: Git initialisieren",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Git würde initialisiert werden`)
          task.title = "5/12: Git initialisieren (DRY-RUN) ✓"
          return
        }
        
        const gitDir = path.join(finalProjectPath, ".git")
        if (!fs.existsSync(gitDir)) {
          execSync("git init", { cwd: finalProjectPath, stdio: "ignore" })
        }
        
        if (ctx.repoUrl) {
          const remoteUrl = ctx.repoUrl.replace("https://", `https://${ctx.githubToken}@`)
          try {
            execSync("git remote remove origin", { cwd: finalProjectPath, stdio: "ignore" })
          } catch {
            // Ignorieren falls nicht vorhanden
          }
          execSync(`git remote add origin ${ctx.repoUrl}`, {
            cwd: finalProjectPath,
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
        
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Dependencies würden installiert werden`)
          task.title = "6/12: Dependencies installieren (DRY-RUN) ✓"
          return
        }
        
        const installCmd = ctx.packageManager?.installCommand || "pnpm install"
        execSync(installCmd, { cwd: finalProjectPath, stdio: "inherit" })
        task.title = "6/12: Dependencies installiert ✓"
      },
      skip: () => !config.autoInstallDeps,
    },
    {
      title: "7/12: Supabase Link",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Supabase würde verlinkt werden`)
          task.title = "7/12: Supabase Link (DRY-RUN) ✓"
          return
        }
        
        try {
          execSync(`supabase link --project-ref ${config.infraDb.projectRef}`, {
            cwd: finalProjectPath,
            stdio: "pipe",
          })
          task.title = "7/12: INFRA-DB verlinkt ✓"
        } catch (error) {
          task.title = "7/12: Supabase Link ⚠ (nicht kritisch)"
        }
      },
    },
    {
      title: "8/12: Tenant erstellen",
      task: async (taskCtx, task) => {
        debug(taskCtx, `Erstelle Tenant: ${config.schemaName}`)
        
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Tenant würde erstellt werden`)
          task.title = `8/12: Tenant "${config.schemaName}" (DRY-RUN) ✓`
          return
        }
        
        if (!ctx.serviceRoleKey || !config.infraDb?.url) {
          debug(taskCtx, `Service Role Key oder INFRA-DB URL fehlt`)
          task.title = `8/12: Tenant erstellen ⚠ (Service Role Key fehlt)`
          ctx.tenantId = null
          return
        }
        
        try {
          const { createTenant } = await import('../utils/supabase.js')
          const tenantResult = await createTenant(
            config.infraDb.url,
            ctx.serviceRoleKey,
            config.schemaName, // slug
            config.projectName, // name
            verbose
          )
          
          if (tenantResult.success && tenantResult.tenantId) {
            ctx.tenantId = tenantResult.tenantId
            debug(taskCtx, `Tenant erstellt: ${tenantResult.tenantId}`)
            writeLog(`Tenant erstellt: ${config.schemaName} (${tenantResult.tenantId})`, 'OK')
            
            // Alle Themes in tenant-Ordner kopieren
            try {
              const { copyDefaultTheme } = await import('../utils/supabase.js')
              const themeResult = await copyDefaultTheme(
                config.infraDb.url,
                ctx.serviceRoleKey,
                config.schemaName,
                verbose
              )
              if (themeResult.success) {
                const count = themeResult.copied?.length || 0
                debug(taskCtx, `${count} Themes kopiert nach ${config.schemaName}/`)
                writeLog(`${count} Themes kopiert: ${themeResult.copied?.join(', ') || 'keine'}`, 'OK')
              } else {
                debug(taskCtx, `Theme-Kopieren fehlgeschlagen: ${themeResult.error}`)
              }
            } catch (themeError) {
              debug(taskCtx, `Theme-Warnung: ${themeError.message}`)
            }
            
            task.title = `8/12: Tenant "${config.schemaName}" erstellt ✓`
          } else {
            debug(taskCtx, `Tenant-Erstellung fehlgeschlagen: ${tenantResult.error}`)
            writeLog(`Tenant-Erstellung fehlgeschlagen: ${tenantResult.error}`, 'ERROR')
            task.title = `8/12: Tenant erstellen ✗ (${tenantResult.error})`
            ctx.tenantId = null
          }
        } catch (error) {
          debug(taskCtx, `Fehler bei Tenant-Erstellung: ${error.message}`)
          writeLog(`Fehler bei Tenant-Erstellung: ${error.message}`, 'ERROR')
          task.title = `8/12: Tenant erstellen ✗`
          ctx.tenantId = null
        }
      },
    },
    {
      title: "9/12: Datenbank-Migrationen",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Migrationen würden ausgeführt werden`)
          task.title = "9/12: Migrationen (DRY-RUN) ✓"
          return
        }
        
        debug(taskCtx, `Migration-Script suchen...`)
        const migrationScript = path.join(finalProjectPath, "scripts", "apply-migrations-to-schema.mjs")
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
      title: "10/12: Standard-User prüfen und zu Tenant zuordnen",
      task: async (taskCtx, task) => {
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Standard-User würden erstellt werden`)
          task.title = "10/12: Standard-User (DRY-RUN) ✓"
          return
        }
        
        const createUsersScript = path.join(finalProjectPath, "scripts", "create-test-users.mjs")
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
            cwd: finalProjectPath,
            stdio: "inherit",
            env: userEnv,
          })
          
          // User zu Tenant zuordnen (falls Tenant erstellt wurde)
          if (ctx.tenantId && ctx.serviceRoleKey && config.infraDb?.url) {
            try {
              const { assignUserToTenant } = await import('../utils/supabase.js')
              
              // Hole User-IDs aus der Datenbank (admin@local, user@local)
              // Für jetzt: Versuche User zu finden und zuzuordnen
              // TODO: Bessere User-ID-Ermittlung implementieren
              debug(taskCtx, `User-Tenant-Zuordnung wird übersprungen (muss manuell erfolgen)`)
              writeLog(`User-Tenant-Zuordnung: Muss manuell erfolgen`, 'INFO')
            } catch (assignError) {
              debug(taskCtx, `Fehler bei User-Tenant-Zuordnung: ${assignError.message}`)
              writeLog(`Fehler bei User-Tenant-Zuordnung: ${assignError.message}`, 'WARN')
            }
          }
          
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
        
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: Vercel würde verlinkt werden`)
          task.title = "11/12: Vercel Link (DRY-RUN) ✓"
          return
        }
        
        try {
          execSync("vercel link --yes", {
            cwd: finalProjectPath,
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
        if (dryRun) {
          debug(taskCtx, `DRY-RUN: MCP-Konfiguration würde aktualisiert werden`)
          task.title = "12/12: MCP-Konfiguration (DRY-RUN) ✓"
          return
        }
        
        const mcpConfigPath = path.join(finalProjectPath, ".cursor", "mcp.json")
        const cursorDir = path.join(finalProjectPath, ".cursor")
        
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
        task.title = "12/12: MCP-Konfiguration aktualisiert ✓"
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
        writeLog(`Pfad: ${finalProjectPath}`, 'INFO')
        writeLog(`Tenant Slug: ${config.schemaName}`, 'INFO')
        writeLog(`Tenant ID: ${ctx.tenantId || 'nicht erstellt'}`, 'INFO')
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

