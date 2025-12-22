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
    
    // Phase 1: Pre-Checks
    renderPhaseHeader(1, "PRE-CHECKS", 0)
    const ctx = {}
    const precheckTasks = createPrecheckTasks(config)
    await precheckTasks.run(ctx)
    
    // Phase 2: Setup
    renderPhaseHeader(2, "SETUP", 50)
    const setupTasks = createSetupTasks(config)
    await setupTasks.run(ctx)
    
    // Phase 3: Create
    renderPhaseHeader(3, "PROJEKT-ERSTELLUNG", 70)
    const createTasks = createProjectTasks(config, ctx, projectPath)
    await createTasks.run(ctx)
    
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

