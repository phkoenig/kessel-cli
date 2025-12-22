import chalk from "chalk"

/**
 * Rendert das Kessel CLI Banner
 */
export function renderBanner() {
  console.log()
  console.log(chalk.cyan.bold("  ╔═══════════════════════════════════════════════════════╗"))
  console.log(chalk.cyan.bold("  ║                                                       ║"))
  console.log(chalk.cyan.bold("  ║     🚀  KESSEL CLI v2.1.0                            ║"))
  console.log(chalk.cyan.bold("  ║     B2B App Boilerplate Generator                     ║"))
  console.log(chalk.cyan.bold("  ║                                                       ║"))
  console.log(chalk.cyan.bold("  ╚═══════════════════════════════════════════════════════╝"))
  console.log()
}

/**
 * Rendert einen Phase-Header mit Progress Bar
 * @param {number} phase - Phasen-Nummer
 * @param {string} title - Phasen-Titel
 * @param {number} progress - Fortschritt in Prozent (0-100)
 */
export function renderPhaseHeader(phase, title, progress) {
  const progressBar = renderProgressBar(progress, 30)
  const progressStr = `${progress}%`.padStart(4)
  const phaseLabel = `PHASE ${phase}`
  const titleLength = title.length + phaseLabel.length + 3
  const dashes = Math.max(0, 50 - titleLength)
  
  console.log()
  console.log(chalk.cyan.bold(`  ╔═══ ${phaseLabel}: ${title} ${'═'.repeat(dashes)}╗`))
  console.log(chalk.cyan(`  ║ ${progressBar} ${progressStr}${' '.repeat(Math.max(0, 20 - progressStr.length))}║`))
  console.log(chalk.cyan(`  ╚${'═'.repeat(58)}╝`))
  console.log()
}

/**
 * Rendert eine Progress Bar
 * @param {number} percent - Fortschritt in Prozent (0-100)
 * @param {number} width - Breite der Progress Bar
 * @returns {string} Formatierte Progress Bar
 */
export function renderProgressBar(percent, width = 30) {
  const filled = Math.round((percent / 100) * width)
  const empty = width - filled
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty))
  return bar
}

/**
 * Rendert eine einfache Box mit Text
 * @param {string} title - Titel der Box
 * @param {string|Array<string>} content - Inhalt (String oder Array von Zeilen)
 */
export function renderBox(title, content) {
  const lines = Array.isArray(content) ? content : [content]
  const maxWidth = Math.max(
    title.length + 4,
    ...lines.map(line => line.length)
  )
  
  console.log(chalk.cyan(`┌─ ${title} ${'─'.repeat(maxWidth - title.length - 3)}┐`))
  for (const line of lines) {
    console.log(chalk.cyan(`│ ${line.padEnd(maxWidth)} │`))
  }
  console.log(chalk.cyan(`└${'─'.repeat(maxWidth + 2)}┘`))
}

