import { Listr } from "listr2"

/**
 * Phase 2: Setup-Validierung
 * Prueft ob alle benoetigten Werte aus dem Wizard vorhanden sind.
 */
export function createSetupTasks(config, options = {}) {
  const { verbose } = options
  const debug = (ctx, msg) => {
    if (verbose && ctx.debug) ctx.debug(msg)
  }

  const taskDefinitions = [
    {
      title: "Supabase-Projekt validieren",
      task: (ctx, task) => {
        if (!config.supabase?.url || !config.supabase?.projectRef) {
          throw new Error("Supabase-URL oder Project-Ref fehlt")
        }
        ctx.supabaseProjectRef = config.supabase.projectRef
        debug(ctx, `Supabase: ${config.supabase.projectRef}`)
        task.title = `Supabase-Projekt: ${config.supabase.projectRef} ✓`
      },
    },
    {
      title: "Service Role Key validieren",
      task: (ctx, task) => {
        if (!config.serviceRoleKey) {
          throw new Error("Service Role Key fehlt")
        }
        ctx.serviceRoleKey = config.serviceRoleKey
        task.title = "Service Role Key vorhanden ✓"
      },
    },
    {
      title: "Clerk-Konfiguration pruefen",
      task: (ctx, task) => {
        if (config.clerkMode === 'dedicated' && config.clerkKeys) {
          ctx.clerkKeys = config.clerkKeys
          task.title = "Clerk: Eigene Application ✓"
        } else {
          task.title = "Clerk: Shared (via pull-env) ✓"
        }
      },
    },
    {
      title: "SpacetimeDB-Konfiguration pruefen",
      task: (ctx, task) => {
        if (config.spacetimeMode === 'skip') {
          task.skip("SpacetimeDB uebersprungen")
          return
        }
        ctx.spacetimeDatabase = config.spacetimeDatabase
        task.title = `SpacetimeDB: ${config.spacetimeDatabase} (${config.spacetimeMode}) ✓`
      },
    },
    {
      title: "Schema-Name generieren",
      task: (ctx, task) => {
        ctx.schemaName = config.schemaName
        task.title = `Schema-Name: ${ctx.schemaName} ✓`
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
