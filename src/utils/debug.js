import chalk from "chalk"

/**
 * Maskiert ein Secret für sichere Ausgabe
 * @param {string} secret - Das zu maskierende Secret
 * @returns {string} Maskiertes Secret (z.B. "abcd...xyz1")
 */
export function maskSecret(secret) {
  if (!secret || secret.length < 8) return "***"
  return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`
}

/**
 * Debug-Logging (nur wenn verbose aktiviert)
 * @param {string} message - Log-Nachricht
 * @param {any} data - Optionale Daten zum Loggen
 * @param {boolean} verbose - Ob verbose-Modus aktiv ist
 */
export function debugLog(message, data = null, verbose = false) {
  if (!verbose) return
  console.log(chalk.dim(`[DEBUG] ${message}`))
  if (data) {
    if (typeof data === 'object') {
      console.log(chalk.dim(JSON.stringify(data, null, 2)))
    } else {
      console.log(chalk.dim(String(data)))
    }
  }
}

/**
 * Debug-Error-Logging (nur wenn verbose aktiviert)
 * @param {Error} error - Fehler-Objekt
 * @param {boolean} verbose - Ob verbose-Modus aktiv ist
 */
export function debugError(error, verbose = false) {
  if (!verbose) return
  console.error(chalk.red.dim(`[DEBUG ERROR] ${error.message}`))
  if (error.stack) {
    console.error(chalk.red.dim(error.stack))
  }
  if (error.code) {
    console.error(chalk.red.dim(`[DEBUG ERROR CODE] ${error.code}`))
  }
  if (error.details) {
    console.error(chalk.red.dim(`[DEBUG ERROR DETAILS] ${error.details}`))
  }
  if (error.hint) {
    console.error(chalk.red.dim(`[DEBUG ERROR HINT] ${error.hint}`))
  }
}

