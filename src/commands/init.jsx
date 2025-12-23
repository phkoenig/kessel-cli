import path from "path"
import React from "react"
import { render } from "ink"
import { App } from "../components/App.jsx"
import chalk from "chalk"

/**
 * Init Command - Erstellt ein neues Projekt
 * Verwendet React-TUI mit ink (wenn TTY verfügbar)
 * @param {string} projectNameArg - Projektname als Argument
 * @param {Object} options - Commander-Optionen
 */
export async function runInitCommand(projectNameArg, options) {
  const verbose = options.verbose || false
  
  // Bestimme Projekt-Pfad
  const currentCwd = process.cwd()
  const projectName = projectNameArg || path.basename(currentCwd)
  const projectPath = path.resolve(currentCwd, projectName)

  // Prüfe ob stdin ein TTY ist (für ink erforderlich)
  if (!process.stdin.isTTY) {
    console.error(chalk.red.bold("\n❌ Fehler: Diese CLI benötigt ein interaktives Terminal."))
    console.error(chalk.yellow("   Bitte führe die CLI in einem Terminal aus (nicht in einem Pipe oder Script).\n"))
    process.exit(1)
  }

  return new Promise((resolve, reject) => {
    try {
      const { unmount } = render(
        <App
          projectNameArg={projectNameArg}
          verbose={verbose}
          onComplete={({ config, ctx, projectPath }) => {
            unmount()
            resolve({ config, ctx, projectPath })
          }}
          onError={(error) => {
            unmount()
            reject(error)
          }}
        />,
        {
          stdin: process.stdin,
          stdout: process.stdout,
          stderr: process.stderr,
        }
      )
    } catch (error) {
      // Fallback wenn ink nicht funktioniert
      console.error(chalk.red.bold("\n❌ Fehler beim Starten der interaktiven UI:"))
      console.error(chalk.red(error.message))
      console.error(chalk.yellow("\nBitte stelle sicher, dass du die CLI in einem Terminal ausführst.\n"))
      reject(error)
    }
  })
}
