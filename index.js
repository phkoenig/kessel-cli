#!/usr/bin/env node

/**
 * Kessel CLI Entry Point
 * 
 * Diese Datei leitet alle Commands an src/cli.js weiter.
 * Die gesamte CLI-Logik wurde in modulare Dateien unter src/ migriert.
 */

// Registriere esbuild für JSX-Unterstützung
import { register } from 'esbuild-register/dist/node.js'

register({
  target: 'node18',
  format: 'esm',
  loader: {
    '.js': 'jsx',
  },
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
})

// Importiere und starte die neue CLI
import("./src/cli.js").catch((error) => {
  console.error("❌ Fehler beim Laden der CLI:", error.message)
        process.exit(1)
})
