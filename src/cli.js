#!/usr/bin/env node

import { program } from "commander"
import { fileURLToPath } from "url"
import path from "path"
import fs from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Lade Boilerplate-Version (falls verfügbar)
function getBoilerplateVersion() {
  try {
    const boilerplatePath = path.resolve(__dirname, "..", "kessel-boilerplate", "boilerplate.json")
    if (fs.existsSync(boilerplatePath)) {
      const data = JSON.parse(fs.readFileSync(boilerplatePath, "utf-8"))
      return data.version || "unknown"
    }
  } catch (e) {
    // Ignorieren
  }
  return "unknown"
}

const CLI_VERSION = "2.1.0"
const BOILERPLATE_VERSION = getBoilerplateVersion()

program
  .name("kessel")
  .description("CLI für die Kessel Boilerplate - Erstellt neue Next.js-Projekte mit Supabase & ShadCN UI")
  .version(CLI_VERSION)
  .configureOutput({
    writeOut: (str) => process.stdout.write(str),
    writeErr: (str) => process.stderr.write(str),
  })

// Version-Command als separates Subcommand
program
  .command("version")
  .description("Zeigt CLI und Boilerplate Version")
  .action(() => {
    console.log(`Kessel CLI: v${CLI_VERSION}`)
    console.log(`Boilerplate: v${BOILERPLATE_VERSION}`)
  })

// Init Command
program
  .argument("[project-name]", "Name des Projekts (optional)")
  .option("-v, --verbose", "Detaillierte Debug-Ausgaben", false)
  .action(async (projectNameArg, options) => {
    const { runInitCommand } = await import("./commands/init.js")
    await runInitCommand(projectNameArg, options)
  })

// Status Command
program
  .command("status")
  .description("Zeigt Status-Dashboard für CLI, DB, Secrets und MCP")
  .action(async () => {
    const { runStatusCommand } = await import("./commands/status.js")
    await runStatusCommand()
  })

// Secrets Commands - werden vorerst aus index.js geladen (temporär)
// TODO: Vollständig nach src/commands/secrets.js migrieren
const secretsCommand = program
  .command("secrets")
  .description("Verwaltet Secrets in der INFRA-DB (Kessel Vault)")

// Die Secrets-Subcommands werden dynamisch aus index.js geladen
// Dies ist eine temporäre Lösung bis die vollständige Migration erfolgt ist

program.parse(process.argv)

