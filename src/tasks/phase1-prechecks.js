import { Listr } from "listr2"
import {
  checkGitHubCLI,
  checkVercelCLI,
  checkSupabaseCLI,
  checkPackageManager,
} from "../../lib/prechecks.js"
import { createClient } from "@supabase/supabase-js"

/**
 * Erstellt listr2 Tasks für Phase 1: Pre-Checks
 * @param {Object} config - KesselConfig-Objekt
 * @returns {Listr} Listr-Instanz
 */
export function createPrecheckTasks(config) {
  return new Listr([
    {
      title: "GitHub CLI",
      task: async (ctx, task) => {
        try {
          ctx.githubToken = await checkGitHubCLI(null, true) // silent = true
          task.title = "GitHub CLI ✓"
        } catch (error) {
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
      title: "INFRA-DB Verbindung",
      task: async (ctx, task) => {
        try {
          const supabase = createClient(config.infraDb.url, config.serviceRoleKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          })
          
          // Teste Verbindung
          const response = await fetch(`${config.infraDb.url}/rest/v1/`, {
            method: "GET",
            headers: { apikey: "test" },
          })
          
          if (response.status !== 401 && response.status !== 200) {
            throw new Error(`INFRA-DB antwortet mit Status ${response.status}`)
          }
          
          task.title = "INFRA-DB Verbindung ✓"
        } catch (error) {
          task.title = "INFRA-DB Verbindung ✗"
          throw error
        }
      },
    },
    {
      title: "DEV-DB Verbindung",
      task: async (ctx, task) => {
        try {
          const response = await fetch(`${config.devDb.url}/rest/v1/`, {
            method: "GET",
            headers: { apikey: "test" },
          })
          
          if (response.status !== 401 && response.status !== 200) {
            throw new Error(`DEV-DB antwortet mit Status ${response.status}`)
          }
          
          task.title = "DEV-DB Verbindung ✓"
        } catch (error) {
          task.title = "DEV-DB Verbindung ✗"
          throw error
        }
      },
    },
  ], {
    concurrent: false,
    renderer: 'default',
    rendererOptions: {
      collapseSubtasks: false,
      showTimer: false,
      clearOutput: false,
      formatOutput: 'default',
      showSubtasks: true,
      collapse: false,
    },
  })
}

