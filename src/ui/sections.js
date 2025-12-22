import chalk from "chalk"

/**
 * Rendert eine Status-Tabelle
 * @param {string} title - Titel der Sektion
 * @param {Array<{name: string, status: string, detail?: string}>} items - Array von Status-Items
 */
export function renderStatusTable(title, items) {
  console.log(chalk.white.bold(`\n  ${title}`))
  
  for (const item of items) {
    const icon = item.status === 'ok' ? chalk.green('✓') : 
                 item.status === 'warning' ? chalk.yellow('⚠') :
                 item.status === 'error' ? chalk.red('✗') :
                 chalk.gray('○')
    
    const statusText = item.detail ? chalk.gray(item.detail) : ''
    const padding = Math.max(0, 20 - item.name.length)
    
    console.log(`    ${icon} ${item.name.padEnd(padding + item.name.length)} ${statusText}`)
  }
}

/**
 * Rendert eine einfache Tabelle
 * @param {Array<string>} headers - Tabellen-Header
 * @param {Array<Array<string>>} rows - Tabellen-Zeilen
 */
export function renderTable(headers, rows) {
  // Berechne Spaltenbreiten
  const colWidths = headers.map((header, i) => {
    const maxWidth = Math.max(
      header.length,
      ...rows.map(row => (row[i] || '').toString().length)
    )
    return maxWidth + 2
  })
  
  // Header
  const headerRow = headers.map((h, i) => h.padEnd(colWidths[i]))
  console.log(chalk.cyan.bold(`  ${headerRow.join(' │ ')}`))
  console.log(chalk.cyan(`  ${'─'.repeat(headerRow.join(' │ ').length)}`))
  
  // Rows
  for (const row of rows) {
    const rowStr = row.map((cell, i) => (cell || '').toString().padEnd(colWidths[i]))
    console.log(`  ${rowStr.join(' │ ')}`)
  }
}

/**
 * Rendert eine Info-Box
 * @param {string} message - Nachricht
 * @param {string} type - Typ: 'info', 'success', 'warning', 'error'
 */
export function renderInfoBox(message, type = 'info') {
  const color = type === 'success' ? chalk.green :
                type === 'warning' ? chalk.yellow :
                type === 'error' ? chalk.red :
                chalk.blue
  
  const icon = type === 'success' ? '✓' :
               type === 'warning' ? '⚠' :
               type === 'error' ? '✗' :
               'ℹ'
  
  console.log(color(`\n  ${icon} ${message}\n`))
}

