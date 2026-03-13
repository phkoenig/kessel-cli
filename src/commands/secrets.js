import { execFileSync } from "child_process"
import chalk from "chalk"
import inquirer from "inquirer"

/**
 * Secrets Commands - Verwaltet Secrets in 1Password fuer Boilerplate 3.0.
 */

const DEFAULT_VAULT_NAME = process.env.KESSEL_OP_VAULT || "Kessel Boilerplate"

const DEFAULT_ITEM_BY_SECRET = {
  SUPABASE_SERVICE_ROLE_KEY: "App Runtime",
  SERVICE_ROLE_KEY: "App Runtime",
  OPENROUTER_API_KEY: "AI Runtime",
  FAL_API_KEY: "AI Runtime",
  CLERK_SECRET_KEY: "Auth Runtime",
  CLERK_WEBHOOK_SIGNING_SECRET: "Auth Runtime",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "Auth Runtime",
  NEXT_PUBLIC_SPACETIMEDB_URI: "Spacetime Runtime",
  NEXT_PUBLIC_SPACETIMEDB_DATABASE: "Spacetime Runtime",
}

const ensureOnePasswordCli = () => {
  try {
    execFileSync("op", ["account", "list", "--format", "json"], {
      stdio: "pipe",
      env: process.env,
    })
  } catch {
    throw new Error(
      "1Password CLI ist nicht betriebsbereit. Bitte fuehre zuerst einen stabilen `op signin`-Flow aus und pruefe `op vault list`."
    )
  }
}

const runOp = (args, input) => {
  const result = execFileSync("op", args, {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
    input,
  })

  return result.trim()
}

const buildReference = (vaultName, itemTitle, fieldName) => `op://${vaultName}/${itemTitle}/${fieldName}`

const getDefaultItemTitle = (secretName) => DEFAULT_ITEM_BY_SECRET[secretName] ?? "App Runtime"

const readSecret = (secretName, itemTitle = getDefaultItemTitle(secretName), vaultName = DEFAULT_VAULT_NAME) =>
  runOp(["read", buildReference(vaultName, itemTitle, secretName)])

const listVaultItems = (vaultName = DEFAULT_VAULT_NAME) =>
  JSON.parse(runOp(["item", "list", "--vault", vaultName, "--format", "json"]) || "[]")

const getItemJson = (itemTitle, vaultName = DEFAULT_VAULT_NAME) =>
  JSON.parse(runOp(["item", "get", itemTitle, "--vault", vaultName, "--format", "json"]))

const upsertFieldInItem = ({ itemTitle, secretName, secretValue, vaultName = DEFAULT_VAULT_NAME }) => {
  const item = getItemJson(itemTitle, vaultName)
  const fields = Array.isArray(item.fields) ? item.fields : []
  const fieldIndex = fields.findIndex((field) => field?.label === secretName || field?.id === secretName)

  if (fieldIndex >= 0) {
    fields[fieldIndex] = {
      ...fields[fieldIndex],
      label: secretName,
      value: secretValue,
      type: "CONCEALED",
    }
  } else {
    fields.push({
      id: secretName,
      label: secretName,
      value: secretValue,
      type: "CONCEALED",
    })
  }

  item.fields = fields
  runOp(["item", "edit", item.id, "--vault", vaultName], JSON.stringify(item))
}

const createRuntimeItem = ({ itemTitle, secretName, secretValue, vaultName = DEFAULT_VAULT_NAME }) => {
  const template = {
    title: itemTitle,
    category: "SECURE_NOTE",
    fields: [
      {
        id: "notesPlain",
        type: "STRING",
        purpose: "NOTES",
        label: "notesPlain",
        value: `${itemTitle} fuer Boilerplate 3.0`,
      },
      {
        id: secretName,
        label: secretName,
        type: "CONCEALED",
        value: secretValue,
      },
    ],
  }

  runOp(["item", "create", "--vault", vaultName, "-"], JSON.stringify(template))
}

const deleteFieldFromItem = ({ itemTitle, secretName, vaultName = DEFAULT_VAULT_NAME }) => {
  const item = getItemJson(itemTitle, vaultName)
  const fields = Array.isArray(item.fields) ? item.fields : []
  const nextFields = fields.filter((field) => field?.label !== secretName && field?.id !== secretName)

  if (nextFields.length === fields.length) {
    return false
  }

  item.fields = nextFields
  runOp(["item", "edit", item.id, "--vault", vaultName], JSON.stringify(item))
  return true
}

const outputSecret = (name, value, options) => {
  if (options.json) {
    console.log(JSON.stringify({ [name]: value }, null, 2))
    return
  }

  if (options.env) {
    console.log(`${name}=${value}`)
    return
  }

  console.log(chalk.green(`✓ ${name}: ${value}`))
}

/**
 * Registriert alle Secrets-Subcommands
 * @param {Object} secretsCommand - Commander Command-Instanz
 */
export function registerSecretsCommands(secretsCommand) {
  secretsCommand
    .command("get")
    .description("Ruft Secrets aus dem 1Password-Vault fuer Boilerplate 3.0 ab")
    .argument("[secret-name]", "Name des Secrets (optional, zeigt alle wenn nicht angegeben)")
    .option("--json", "Ausgabe im JSON-Format")
    .option("--env", "Ausgabe im .env-Format")
    .option("--item <item-title>", "Abweichender 1Password-Item-Titel")
    .option("--vault <vault-name>", "Abweichender 1Password-Vault")
    .action(async (secretName, options) => {
      try {
        ensureOnePasswordCli()
        const vaultName = options.vault || DEFAULT_VAULT_NAME

        if (secretName) {
          const itemTitle = options.item || getDefaultItemTitle(secretName)
          const value = readSecret(secretName, itemTitle, vaultName)
          outputSecret(secretName, value, options)
          return
        }

        const items = listVaultItems(vaultName).sort((a, b) => a.title.localeCompare(b.title))

        if (options.json) {
          console.log(JSON.stringify(items, null, 2))
          return
        }

        console.log(chalk.cyan.bold(`\n📋 1Password Runtime-Items in "${vaultName}" (${items.length}):\n`))
        items.forEach((item) => {
          console.log(chalk.white(`  ${item.title}`))
        })
        console.log()
      } catch (error) {
        console.error(chalk.red.bold("\n❌ Fehler beim Abrufen der Secrets:"))
        console.error(chalk.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  secretsCommand
    .command("add")
    .description("Fuegt ein neues Secret-Feld in 1Password hinzu")
    .argument("<secret-name>", "Name des Secrets")
    .argument("<secret-value>", "Wert des Secrets")
    .option("--force", "Überschreibt existierendes Secret")
    .option("--item <item-title>", "Abweichender 1Password-Item-Titel")
    .option("--vault <vault-name>", "Abweichender 1Password-Vault")
    .action(async (secretName, secretValue, options) => {
      try {
        ensureOnePasswordCli()
        const vaultName = options.vault || DEFAULT_VAULT_NAME
        const itemTitle = options.item || getDefaultItemTitle(secretName)

        if (!options.force) {
          try {
            readSecret(secretName, itemTitle, vaultName)
            console.error(chalk.red(`❌ Secret "${secretName}" existiert bereits in "${itemTitle}"`))
            console.error(chalk.yellow("   Verwende --force, um das Feld zu aktualisieren.\n"))
            process.exit(1)
          } catch {
            // Feld existiert noch nicht
          }
        }

        const existingItems = listVaultItems(vaultName)
        const itemExists = existingItems.some((item) => item.title === itemTitle)

        if (itemExists) {
          upsertFieldInItem({ itemTitle, secretName, secretValue, vaultName })
        } else {
          createRuntimeItem({ itemTitle, secretName, secretValue, vaultName })
        }

        console.log(chalk.green(`✓ Secret "${secretName}" in "${itemTitle}" gespeichert\n`))
      } catch (error) {
        console.error(chalk.red.bold("\n❌ Fehler beim Hinzufügen des Secrets:"))
        console.error(chalk.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  secretsCommand
    .command("update")
    .description("Aktualisiert ein existierendes Secret-Feld in 1Password")
    .argument("<secret-name>", "Name des Secrets")
    .argument("<secret-value>", "Neuer Wert des Secrets")
    .option("--item <item-title>", "Abweichender 1Password-Item-Titel")
    .option("--vault <vault-name>", "Abweichender 1Password-Vault")
    .action(async (secretName, secretValue, options) => {
      try {
        ensureOnePasswordCli()
        const vaultName = options.vault || DEFAULT_VAULT_NAME
        const itemTitle = options.item || getDefaultItemTitle(secretName)
        const existingValue = readSecret(secretName, itemTitle, vaultName)

        if (existingValue === secretValue) {
          console.log(chalk.yellow(`⚠ Secret "${secretName}" hat bereits diesen Wert`))
          process.exit(0)
        }

        upsertFieldInItem({ itemTitle, secretName, secretValue, vaultName })
        console.log(chalk.green(`✓ Secret "${secretName}" in "${itemTitle}" aktualisiert\n`))
      } catch (error) {
        console.error(chalk.red.bold("\n❌ Fehler beim Aktualisieren des Secrets:"))
        console.error(chalk.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  secretsCommand
    .command("delete")
    .description("Loescht ein Secret-Feld aus 1Password")
    .argument("<secret-name>", "Name des Secrets")
    .option("--force", "Löscht ohne Bestätigung")
    .option("--item <item-title>", "Abweichender 1Password-Item-Titel")
    .option("--vault <vault-name>", "Abweichender 1Password-Vault")
    .action(async (secretName, options) => {
      try {
        ensureOnePasswordCli()
        const vaultName = options.vault || DEFAULT_VAULT_NAME
        const itemTitle = options.item || getDefaultItemTitle(secretName)

        if (!options.force) {
          const { confirm } = await inquirer.prompt([
            {
              type: "confirm",
              name: "confirm",
              message: `Möchtest du das Secret "${secretName}" wirklich löschen?`,
              default: false
            }
          ])

          if (!confirm) {
            console.log(chalk.yellow("Abgebrochen."))
            process.exit(0)
          }
        }

        const deleted = deleteFieldFromItem({ itemTitle, secretName, vaultName })
        if (!deleted) {
          console.error(chalk.red(`❌ Secret "${secretName}" existiert in "${itemTitle}" nicht`))
          process.exit(1)
        }

        console.log(chalk.green(`✓ Secret "${secretName}" erfolgreich gelöscht\n`))
      } catch (error) {
        console.error(chalk.red.bold("\n❌ Fehler beim Löschen des Secrets:"))
        console.error(chalk.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })
}
