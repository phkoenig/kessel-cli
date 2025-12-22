import path from "path"
import { renderBanner, renderPhaseHeader } from "../ui/banner.js"
import { runInitWizard } from "../wizard/initWizard.js"
import { createPrecheckTasks } from "../tasks/phase1-prechecks.js"
import { createSetupTasks } from "../tasks/phase2-setup.js"
import { createProjectTasks } from "../tasks/phase3-create.js"
import chalk from "chalk"

/**
 * Init Command - Erstellt ein neues Projekt
 * @param {string} projectNameArg - Projektname als Argument
 * @param {Object} options - Commander-Optionen
 */
export async function runInitCommand(projectNameArg, options) {
  const verbose = options.verbose || false
  
  // Banner anzeigen
  renderBanner()
  
  // Bestimme Projekt-Pfad
  const currentCwd = process.cwd()
  const projectName = projectNameArg || path.basename(currentCwd)
  const projectPath = path.resolve(currentCwd, projectName)
  
  try {
    // Phase 0: Wizard - Sammle alle Informationen
    renderPhaseHeader(0, "WIZARD", 0)
    const config = await runInitWizard(projectNameArg, currentCwd)
    console.log(chalk.green("✓ Wizard abgeschlossen\n"))
    
    // Phase 1: Pre-Checks
    renderPhaseHeader(1, "PRE-CHECKS", 20)
    const ctx = {}
    
    // Führe Pre-Checks aus
    try {
      const precheckTasks = createPrecheckTasks(config)
      
      // Zeige Fortschritt während der Ausführung
      precheckTasks.on('SUBTASK', (task) => {
        process.stdout.write(chalk.cyan(`  → ${task.title}\n`))
      })
      
      await precheckTasks.run(ctx)
      console.log(chalk.green("\n✓ Pre-Checks abgeschlossen\n"))
    } catch (error) {
      console.error(chalk.red.bold("\n❌ Pre-Check Fehler:"))
      console.error(chalk.red(error.message))
      if (verbose) {
        console.error(chalk.dim(error.stack))
      }
      throw error
    }
    
    // Phase 2: Setup
    renderPhaseHeader(2, "SETUP", 40)
    const setupTasks = createSetupTasks(config)
    await setupTasks.run(ctx)
    console.log(chalk.green("✓ Setup abgeschlossen\n"))
    
    // Phase 3: Create
    renderPhaseHeader(3, "PROJEKT-ERSTELLUNG", 60)
    const createTasks = createProjectTasks(config, ctx, projectPath)
    await createTasks.run(ctx)
    console.log(chalk.green("✓ Projekt-Erstellung abgeschlossen\n"))
    
    // Erfolg
    console.log(chalk.green.bold(`\n✨ Projekt "${config.projectName}" erfolgreich erstellt!\n`))
    console.log(chalk.cyan("📋 Nächste Schritte:"))
    console.log(chalk.white(`  cd ${projectName}`))
    console.log(chalk.white(`  ${ctx.packageManager?.devCommand || "pnpm dev"}`))
    console.log(chalk.white(`  http://localhost:3000\n`))
    
  } catch (error) {
    console.error(chalk.red.bold("\n❌ Fehler:"))
    console.error(chalk.red(error.message))
    if (verbose) {
      console.error(chalk.dim(error.stack))
    }
    process.exit(1)
  }
}

