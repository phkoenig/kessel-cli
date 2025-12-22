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
    
    // Führe Pre-Checks manuell aus mit eigener Ausgabe
    const precheckTasks = createPrecheckTasks(config)
    const tasks = precheckTasks.tasks || []
    
    for (const taskDef of tasks) {
      // Prüfe ob Task übersprungen werden soll
      if (taskDef.skip && typeof taskDef.skip === 'function' && taskDef.skip()) {
        console.log(chalk.dim(`  ⏭  ${taskDef.title} (übersprungen)`))
        continue
      }
      
      // Zeige Task-Start
      process.stdout.write(chalk.cyan(`  ⏳ ${taskDef.title}...`))
      
      try {
        // Erstelle Mock-Task-Objekt für Task-Funktion
        const mockTask = {
          title: taskDef.title,
          output: '',
          skip: () => false,
        }
        
        // Führe Task aus
        await taskDef.task(ctx, mockTask)
        
        // Zeige Erfolg
        process.stdout.write(chalk.green(` ✓\n`))
      } catch (error) {
        // Zeige Fehler
        process.stdout.write(chalk.red(` ✗\n`))
        console.error(chalk.red(`    Fehler: ${error.message}`))
        if (verbose) {
          console.error(chalk.dim(error.stack))
        }
        throw error
      }
    }
    
    console.log(chalk.green("\n✓ Pre-Checks abgeschlossen\n"))
    
    // Phase 2: Setup
    renderPhaseHeader(2, "SETUP", 40)
    const setupTasks = createSetupTasks(config)
    const setupTaskList = setupTasks.tasks || []
    
    for (const taskDef of setupTaskList) {
      if (taskDef.skip && typeof taskDef.skip === 'function' && taskDef.skip()) {
        console.log(chalk.dim(`  ⏭  ${taskDef.title} (übersprungen)`))
        continue
      }
      
      process.stdout.write(chalk.cyan(`  ⏳ ${taskDef.title}...`))
      
      try {
        const mockTask = {
          title: taskDef.title,
          output: '',
          skip: () => false,
        }
        
        await taskDef.task(ctx, mockTask)
        process.stdout.write(chalk.green(` ✓\n`))
      } catch (error) {
        process.stdout.write(chalk.red(` ✗\n`))
        console.error(chalk.red(`    Fehler: ${error.message}`))
        if (verbose) {
          console.error(chalk.dim(error.stack))
        }
        throw error
      }
    }
    
    console.log(chalk.green("\n✓ Setup abgeschlossen\n"))
    
    // Phase 3: Create
    renderPhaseHeader(3, "PROJEKT-ERSTELLUNG", 60)
    const createTasks = createProjectTasks(config, ctx, projectPath)
    const createTaskList = createTasks.tasks || []
    
    for (const taskDef of createTaskList) {
      if (taskDef.skip && typeof taskDef.skip === 'function' && taskDef.skip()) {
        console.log(chalk.dim(`  ⏭  ${taskDef.title} (übersprungen)`))
        continue
      }
      
      process.stdout.write(chalk.cyan(`  ⏳ ${taskDef.title}...`))
      
      try {
        const mockTask = {
          title: taskDef.title,
          output: '',
          skip: () => false,
        }
        
        await taskDef.task(ctx, mockTask)
        process.stdout.write(chalk.green(` ✓\n`))
      } catch (error) {
        process.stdout.write(chalk.red(` ✗\n`))
        console.error(chalk.red(`    Fehler: ${error.message}`))
        if (verbose) {
          console.error(chalk.dim(error.stack))
        }
        throw error
      }
    }
    
    console.log(chalk.green("\n✓ Projekt-Erstellung abgeschlossen\n"))
    
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
