import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.js'],
  format: ['esm'],
  outDir: 'dist',
  outExtension() {
    return {
      js: '.mjs',
    }
  },
  // Banner wird nach dem Build hinzugefügt (siehe package.json scripts)
  splitting: false,
  sourcemap: false,
  clean: true,
  treeshake: true,
  // External: alle node_modules werden nicht gebundelt
  // Sie werden zur Laufzeit von Node geladen
  noExternal: [],
  // Explizit alle Dependencies als external markieren
  external: [
    // Alle node_modules sind external (Regex für relative/absolute Imports)
    /^[^./]|^\.[^./]|^\.\.[^/]/,
  ],
  // JSX-Unterstützung aktivieren
  esbuildOptions(options) {
    options.jsx = 'automatic'
    options.jsxFactory = 'React.createElement'
    options.jsxFragment = 'React.Fragment'
  },
})

