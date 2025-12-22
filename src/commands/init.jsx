import path from "path"
import React from "react"
import { render } from "ink"
import { App } from "../components/App.jsx"

/**
 * Init Command - Erstellt ein neues Projekt
 * Verwendet React-TUI mit ink
 * @param {string} projectNameArg - Projektname als Argument
 * @param {Object} options - Commander-Optionen
 */
export async function runInitCommand(projectNameArg, options) {
  const verbose = options.verbose || false
  
  // Bestimme Projekt-Pfad
  const currentCwd = process.cwd()
  const projectName = projectNameArg || path.basename(currentCwd)
  const projectPath = path.resolve(currentCwd, projectName)

  return new Promise((resolve, reject) => {
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
      />
    )
  })
}
