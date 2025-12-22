import { Listr } from "listr2"
import { Octokit } from "octokit"
import degit from "degit"
import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import chalk from "chalk"
import { fetchAnonKeyFromSupabase, fetchServiceRoleKeyFromSupabase } from "../utils/supabase.js"

/**
 * Erstellt listr2 Tasks für Phase 3: Projekt-Erstellung (11 Schritte)
 * @param {Object} config - KesselConfig-Objekt
 * @param {Object} ctx - Context mit githubToken, packageManager, etc.
 * @param {string} projectPath - Pfad zum Projekt-Verzeichnis
 * @returns {Object} Objekt mit tasks-Array und listr-Instanz
 */
export function createProjectTasks(config, ctx, projectPath) {
  const taskDefinitions = [
    {
      title: "1/11: GitHub Repository erstellen",
      task: async (taskCtx, task) => {
        if (config.createGithub === 'none') {
          task.skip("GitHub Repo-Erstellung übersprungen")
          return
        }
        
        try {
          const octokit = new Octokit({ auth: ctx.githubToken })
          const { data: userData } = await octokit.rest.users.getAuthenticated()
          
          const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
            name: config.projectName,
            private: config.createGithub === 'private',
            auto_init: false,
          })
          
          ctx.repoUrl = repo.html_url
          task.title = `1/11: GitHub Repository erstellt ✓ (${repo.html_url})`
        } catch (error) {
          task.title = `1/11: GitHub Repository ✗ (${error.message})`
          throw error
        }
      },
    },
    {
      title: "2/11: Template klonen",
      task: async (taskCtx, task) => {
        try {
          const templateRepo = "phkoenig/kessel-boilerplate"
          const gitUrl = `https://${ctx.githubToken}@github.com/${templateRepo}.git`
          
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
          
          task.title = "2/11: Template geklont ✓"
        } catch (error) {
          // Fallback zu degit
          try {
            const emitter = degit(`${templateRepo}#main`, {
              cache: false,
              force: true,
            })
            await emitter.clone(projectPath)
            task.title = "2/11: Template geklont (degit) ✓"
          } catch (degitError) {
            task.title = `2/11: Template klonen ✗`
            throw new Error(`Git: ${error.message}, Degit: ${degitError.message}`)
          }
        }
      },
    },
    {
      title: "3/11: Bootstrap-Credentials (.env)",
      task: async (taskCtx, task) => {
        const envContent = `# Bootstrap-Credentials für Vault-Zugriff (INFRA-DB)
# WICHTIG: Dies ist die URL der INFRA-DB (Kessel) mit integriertem Vault
NEXT_PUBLIC_SUPABASE_URL=${config.infraDb.url}
SERVICE_ROLE_KEY=${config.serviceRoleKey}
`
        fs.writeFileSync(path.join(projectPath, ".env"), envContent)
        task.title = "3/11: .env erstellt ✓"
      },
    },
    {
      title: "4/11: Public-Credentials (.env.local)",
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
`
        fs.writeFileSync(path.join(projectPath, ".env.local"), envLocalContent)
        task.title = "4/11: .env.local erstellt ✓"
      },
    },
    {
      title: "5/11: Git initialisieren",
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
        
        task.title = "5/11: Git initialisiert ✓"
      },
    },
    {
      title: "6/11: Dependencies installieren",
      task: async (taskCtx, task) => {
        if (!config.autoInstallDeps) {
          task.skip("Dependencies-Installation übersprungen")
          return
        }
        
        const installCmd = ctx.packageManager?.installCommand || "pnpm install"
        execSync(installCmd, { cwd: projectPath, stdio: "inherit" })
        task.title = "6/11: Dependencies installiert ✓"
      },
      skip: () => !config.autoInstallDeps,
    },
    {
      title: "7/11: Supabase Link",
      task: async (taskCtx, task) => {
        try {
          execSync(`supabase link --project-ref ${config.infraDb.projectRef}`, {
            cwd: projectPath,
            stdio: "pipe",
          })
          task.title = "7/11: INFRA-DB verlinkt ✓"
        } catch (error) {
          task.title = "7/11: Supabase Link ⚠ (nicht kritisch)"
        }
      },
    },
    {
      title: "8/11: Datenbank-Migrationen",
      task: async (taskCtx, task) => {
        const migrationScript = path.join(projectPath, "scripts", "apply-migrations-to-schema.mjs")
        if (!fs.existsSync(migrationScript)) {
          task.skip("Migration-Script nicht gefunden")
          return
        }
        
        try {
          const env = {
            ...process.env,
            NEXT_PUBLIC_SUPABASE_URL: config.infraDb.url,
            SERVICE_ROLE_KEY: ctx.serviceRoleKey,
            SUPABASE_SERVICE_ROLE_KEY: ctx.serviceRoleKey,
            NEXT_PUBLIC_PROJECT_SCHEMA: config.schemaName,
            SUPABASE_PROJECT_REF: config.infraDb.projectRef,
          }
          
          execSync(`node scripts/apply-migrations-to-schema.mjs ${config.schemaName}`, {
            cwd: projectPath,
            stdio: "inherit",
            env: env,
          })
          task.title = "8/11: Migrationen angewendet ✓"
        } catch (error) {
          task.title = "8/11: Migrationen ⚠ (manuell erforderlich)"
        }
      },
    },
    {
      title: "9/11: Standard-User prüfen",
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
          task.title = "9/11: Standard-User erstellt ✓"
        } catch (error) {
          task.title = "9/11: Standard-User ⚠"
        }
      },
    },
    {
      title: "10/11: Vercel Link",
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
          task.title = "10/11: Vercel verlinkt ✓"
        } catch (error) {
          task.title = "10/11: Vercel Link ⚠ (nicht kritisch)"
        }
      },
      skip: () => !config.linkVercel,
    },
    {
      title: "11/11: MCP-Konfiguration aktualisieren",
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
        task.title = "11/11: MCP-Konfiguration aktualisiert ✓"
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
  }
}

