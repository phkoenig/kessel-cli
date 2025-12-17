import chalk from "chalk"

/**
 * Erstellt eine neue Progress Bar
 * @param {number} total - Gesamtanzahl der Schritte (100 = 100%)
 * @param {string} initialStatus - Initialer Status-Text
 * @returns {Object} - Progress Bar Objekt mit update() und complete() Methoden
 */
export function createProgressBar(total = 100, initialStatus = "Initialisiere...") {
  const barLength = 20 // Anzahl der Zeichen in der Progress Bar
  let current = 0
  let status = initialStatus

  /**
   * Aktualisiert die Progress Bar
   * @param {number|null} value - Neuer Wert (0-100) oder null um nur Status zu ändern
   * @param {string} newStatus - Neuer Status-Text (optional)
   */
  const update = (value, newStatus = null) => {
    // Wenn value nicht null ist, aktualisiere den aktuellen Wert
    if (value !== null && value !== undefined) {
      current = Math.max(0, Math.min(100, value)) // Clamp zwischen 0 und 100
    }
    if (newStatus) {
      status = newStatus
    }

    const percentage = Math.round(current)
    const filled = Math.round((current / 100) * barLength)
    const empty = barLength - filled

    const bar = "█".repeat(filled) + "░".repeat(empty)
    
    // Überschreibe die vorherige Zeile
    process.stdout.write(`\r${chalk.cyan(`[${bar}]`)} ${chalk.bold(`${percentage}%`)} - ${chalk.dim(status)}`)
  }

  /**
   * Schließt die Progress Bar ab (100%)
   * @param {string} finalStatus - Finaler Status-Text (optional)
   */
  const complete = (finalStatus = "Abgeschlossen") => {
    update(100, finalStatus)
    process.stdout.write("\n") // Neue Zeile nach Abschluss
  }

  /**
   * Setzt die Progress Bar zurück
   */
  const reset = () => {
    current = 0
    status = initialStatus
    update(0)
  }

  // Initialisiere die Progress Bar
  update(0, initialStatus)

  return {
    update,
    complete,
    reset,
    getCurrent: () => current,
    getStatus: () => status,
  }
}

/**
 * Aktualisiert eine Progress Bar (Hilfsfunktion)
 * @param {Object} progressBar - Progress Bar Objekt
 * @param {number|null} value - Neuer Wert (0-100) oder null um nur Status zu ändern
 * @param {string} status - Neuer Status-Text (optional)
 */
export function updateProgress(progressBar, value, status = null) {
  if (progressBar && typeof progressBar.update === "function") {
    progressBar.update(value, status)
  }
}

/**
 * Schließt eine Progress Bar ab (Hilfsfunktion)
 * @param {Object} progressBar - Progress Bar Objekt
 * @param {string} status - Finaler Status-Text (optional)
 */
export function completeProgress(progressBar, status = null) {
  if (progressBar && typeof progressBar.complete === "function") {
    progressBar.complete(status)
  }
}
