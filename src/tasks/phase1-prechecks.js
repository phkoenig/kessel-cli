import { Listr } from "listr2"
import {
  checkGitHubCLI,
  checkVercelCLI,
  checkOnePasswordCLI,
  checkSupabaseCLI,
  checkPackageManager,
} from "../../lib/prechecks.js"
import { execSync } from "child_process"

/**
 * Phase 1: Pre-Checks
 * Prueft ob alle benoetigten CLIs und Tools installiert sind.
 */
export function createPrecheckTasks(config, options = {}) {
  const { verbose } = options
  const debug = (ctx, msg) => {
    if (verbose && ctx.debug) ctx.debug(msg)
  }

  const taskDefinitions = [
    {
      title: "GitHub CLI",
      task: async (ctx, task) => {
        try {
          ctx.githubToken = await checkGitHubCLI(null, true)
          task.title = "GitHub CLI ✓"
        } catch (error) {
          task.title = `GitHub CLI ✗ (${error.message})`
          throw error
        }
      },
    },
    {
      title: "Vercel CLI",
      task: async (ctx, task) => {
        try {
          await checkVercelCLI(null, true)
          ctx.vercelInstalled = true
          task.title = "Vercel CLI ✓"
        } catch {
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
          await checkSupabaseCLI(null, true)
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
          ctx.packageManager = await checkPackageManager(null, true)
          task.title = `Package Manager: ${ctx.packageManager.name} ✓`
        } catch (error) {
          task.title = `Package Manager ✗ (${error.message})`
          throw error
        }
      },
    },
    {
      title: "SpacetimeDB CLI",
      task: async (ctx, task) => {
        if (config.spacetimeMode === 'skip' || config.spacetimeMode === 'later') {
          task.skip("SpacetimeDB wird spaeter eingerichtet")
          return
        }
        try {
          const version = execSync("spacetime version", { stdio: "pipe" }).toString().trim()
          ctx.spacetimeInstalled = true
          task.title = `SpacetimeDB CLI ✓ (${version})`
        } catch {
          ctx.spacetimeInstalled = false
          if (config.spacetimeMode === 'publish') {
            task.title = "SpacetimeDB CLI ✗ (wird fuer Publish benoetigt)"
          } else {
            task.title = "SpacetimeDB CLI (optional)"
          }
        }
      },
    },
    {
      title: "Supabase-Verbindung",
      task: async (ctx, task) => {
        if (!config.supabase?.url) {
          task.skip("Supabase wird spaeter eingerichtet")
          return
        }
        try {
          const response = await fetch(`${config.supabase.url}/rest/v1/`, {
            method: "GET",
            headers: { apikey: "test" },
          })
          if (response.status !== 401 && response.status !== 200) {
            throw new Error(`Status ${response.status}`)
          }
          task.title = `Supabase-Verbindung ✓ (${config.supabase.projectRef})`
        } catch (error) {
          task.title = `Supabase-Verbindung ✗ (${error.message})`
          throw error
        }
      },
    },
  ]
  
  return {
    tasks: taskDefinitions,
    listr: new Listr(taskDefinitions, {
      concurrent: false,
      renderer: 'verbose',
      rendererOptions: { collapseSubtasks: false, showTimer: false, clearOutput: false, formatOutput: 'default', showSubtasks: true, collapse: false },
    }),
  }
}
