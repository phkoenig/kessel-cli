import { Listr } from "listr2"
import {
  checkGitHubCLI,
  checkVercelCLI,
  checkOnePasswordCLI,
  checkSupabaseCLI,
  checkPackageManager,
} from "../../lib/prechecks.js"

/**
 * Erstellt listr2 Tasks für Phase 1: Pre-Checks
 * @param {Object} config - KesselConfig-Objekt
 * @param {Object} options - Optionen (z.B. verbose)
 * @returns {Object} Objekt mit tasks-Array und listr-Instanz
 */
export function createPrecheckTasks(config, options = {}) {
  const { verbose } = options
  const debug = (ctx, msg) => {
    if (verbose && ctx.debug) {
      ctx.debug(msg)
    }
  }

  const taskDefinitions = [
    {
      title: "GitHub CLI",
      task: async (ctx, task) => {
        try {
          debug(ctx, "Prüfe GitHub CLI...")
          ctx.githubToken = await checkGitHubCLI(null, true) // silent = true
          debug(ctx, `GitHub Token: ${ctx.githubToken ? 'OK' : 'fehlt'}`)
          task.title = "GitHub CLI ✓"
        } catch (error) {
          debug(ctx, `GitHub CLI Fehler: ${error.message}`)
          task.title = `GitHub CLI ✗ (${error.message})`
          throw error
        }
      },
      enabled: () => true,
    },
    {
      title: "Vercel CLI",
      task: async (ctx, task) => {
        try {
          await checkVercelCLI(null, true) // silent = true
          ctx.vercelInstalled = true
          task.title = "Vercel CLI ✓"
        } catch (error) {
          ctx.vercelInstalled = false
          task.title = "Vercel CLI (optional)"
        }
      },
      skip: () => !config.linkVercel,
    },
    {
      title: "1Password CLI",
      task: async (_ctx, task) => {
        try {
          await checkOnePasswordCLI(null, true)
          task.title = "1Password CLI ✓"
        } catch (error) {
          task.title = `1Password CLI ✗ (${error.message})`
          throw error
        }
      },
    },
    {
      title: "Supabase CLI",
      task: async (ctx, task) => {
        try {
          await checkSupabaseCLI(null, true) // silent = true
          task.title = "Supabase CLI ✓"
        } catch (error) {
          task.title = `Supabase CLI ✗ (${error.message})`
          throw error
        }
      },
    },
    {
      title: "Package Manager",
      task: async (ctx, task) => {
        try {
          ctx.packageManager = await checkPackageManager(null, true) // silent = true
          task.title = `Package Manager: ${ctx.packageManager.name} ✓`
        } catch (error) {
          task.title = `Package Manager ✗ (${error.message})`
          throw error
        }
      },
    },
    {
      title: "App-Supabase Verbindung",
      task: async (ctx, task) => {
        try {
          const appDbUrl = config.appDb?.url || config.devDb?.url || config.infraDb?.url
          // Teste Verbindung
          const response = await fetch(`${appDbUrl}/rest/v1/`, {
            method: "GET",
            headers: { apikey: "test" },
          })
          
          if (response.status !== 401 && response.status !== 200) {
            throw new Error(`App-Supabase antwortet mit Status ${response.status}`)
          }
          
          task.title = "App-Supabase Verbindung ✓"
        } catch (error) {
          task.title = "App-Supabase Verbindung ✗"
          throw error
        }
      },
    },
    {
      title: "SpacetimeDB CLI",
      task: async (ctx, task) => {
        if (config.spacetimeMode === 'skip') {
          task.skip("SpacetimeDB uebersprungen")
          return
        }
        
        try {
          const { execSync } = await import('child_process')
          const version = execSync("spacetime version", { stdio: "pipe" }).toString().trim()
          ctx.spacetimeInstalled = true
          task.title = `SpacetimeDB CLI ✓ (${version})`
        } catch {
          ctx.spacetimeInstalled = false
          if (config.spacetimeMode === 'publish') {
            task.title = "SpacetimeDB CLI ✗ (wird fuer Publish benoetigt)"
            debug(ctx, "SpacetimeDB CLI nicht gefunden. Install: https://spacetimedb.com/install")
          } else {
            task.title = "SpacetimeDB CLI (optional)"
          }
        }
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
        showSubtasks: true,
        collapse: false,
      },
    }),
  }
}

