import { Listr } from "listr2"
import { fetchAnonKeyFromSupabase, fetchServiceRoleKeyFromSupabase } from "../utils/supabase.js"
import chalk from "chalk"

/**
 * Erstellt listr2 Tasks für Phase 2: Setup
 * @param {Object} config - KesselConfig-Objekt
 * @returns {Listr} Listr-Instanz
 */
export function createSetupTasks(config) {
  return new Listr([
    {
      title: "Schema-Name generieren",
      task: (ctx, task) => {
        ctx.schemaName = config.schemaName
        task.title = `Schema-Name: ${ctx.schemaName} ✓`
      },
    },
    {
      title: "Anon Key von INFRA-DB abrufen",
      task: async (ctx, task) => {
        const debugFn = (msg) => {
          // Silent in listr2
        }
        
        ctx.anonKey = await fetchAnonKeyFromSupabase(config.infraDb.projectRef, debugFn)
        
        if (!ctx.anonKey) {
          task.title = "Anon Key von INFRA-DB abrufen ⚠ (manuell erforderlich)"
          // In der echten Implementierung würde hier ein Prompt kommen
          // Für jetzt setzen wir null und lassen es später abfragen
        } else {
          task.title = "Anon Key von INFRA-DB abgerufen ✓"
        }
      },
    },
    {
      title: "Service Role Key von INFRA-DB abrufen",
      task: async (ctx, task) => {
        const debugFn = (msg) => {
          // Silent in listr2
        }
        
        ctx.serviceRoleKey = await fetchServiceRoleKeyFromSupabase(config.infraDb.projectRef, debugFn)
        
        if (!ctx.serviceRoleKey) {
          // Fallback auf config.serviceRoleKey
          ctx.serviceRoleKey = config.serviceRoleKey
          task.title = "Service Role Key verwendet (aus Config) ✓"
        } else {
          task.title = "Service Role Key von INFRA-DB abgerufen ✓"
        }
      },
    },
  ], {
    concurrent: false,
    rendererOptions: {
      collapseSubtasks: false,
      showTimer: true,
    },
  })
}

