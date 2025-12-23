import { Listr } from "listr2"
import { fetchAnonKeyFromSupabase, fetchServiceRoleKeyFromSupabase } from "../utils/supabase.js"
import chalk from "chalk"

/**
 * Erstellt listr2 Tasks für Phase 2: Setup
 * @param {Object} config - KesselConfig-Objekt
 * @param {Object} options - Optionen (z.B. verbose)
 * @returns {Object} Objekt mit tasks-Array und listr-Instanz
 */
export function createSetupTasks(config, options = {}) {
  const { verbose } = options
  const debug = (ctx, msg) => {
    if (verbose && ctx.debug) {
      ctx.debug(msg)
    }
  }

  const taskDefinitions = [
    {
      title: "Schema-Name generieren",
      task: (ctx, task) => {
        ctx.schemaName = config.schemaName
        debug(ctx, `Schema-Name: ${ctx.schemaName}`)
        task.title = `Schema-Name: ${ctx.schemaName} ✓`
      },
    },
    {
      title: "Anon Key von INFRA-DB abrufen",
      task: async (ctx, task) => {
        const debugFn = (msg) => {
          debug(ctx, msg)
        }
        
        debug(ctx, `Hole Anon Key für: ${config.infraDb.projectRef}`)
        ctx.anonKey = await fetchAnonKeyFromSupabase(config.infraDb.projectRef, debugFn)
        
        if (!ctx.anonKey) {
          debug(ctx, "Anon Key nicht gefunden")
          task.title = "Anon Key von INFRA-DB abrufen ⚠ (manuell erforderlich)"
        } else {
          debug(ctx, `Anon Key: ${ctx.anonKey.substring(0, 20)}...`)
          task.title = "Anon Key von INFRA-DB abgerufen ✓"
        }
      },
    },
    {
      title: "Service Role Key von INFRA-DB abrufen",
      task: async (ctx, task) => {
        const debugFn = (msg) => {
          debug(ctx, msg)
        }
        
        debug(ctx, `Hole Service Role Key für: ${config.infraDb.projectRef}`)
        ctx.serviceRoleKey = await fetchServiceRoleKeyFromSupabase(config.infraDb.projectRef, debugFn)
        
        if (!ctx.serviceRoleKey) {
          // Fallback auf config.serviceRoleKey
          debug(ctx, "Service Role Key nicht gefunden, verwende Config")
          ctx.serviceRoleKey = config.serviceRoleKey
          task.title = "Service Role Key verwendet (aus Config) ✓"
        } else {
          debug(ctx, `Service Role Key: ${ctx.serviceRoleKey.substring(0, 20)}...`)
          task.title = "Service Role Key von INFRA-DB abgerufen ✓"
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
      },
    }),
  }
}

