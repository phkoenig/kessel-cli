import { program } from "commander"
import chalk from "chalk"
import { createClient } from "@supabase/supabase-js"
import { loadConfig, loadServiceRoleKey, BOILERPLATE_ENV_PATH } from "../config.js"
import { debugLog, debugError, maskSecret } from "../utils/debug.js"
import { getSecretsViaDirectSql, callRpcViaHttp } from "../utils/supabase.js"
import path from "path"
import fs from "fs"
import inquirer from "inquirer"

/**
 * Secrets Commands - Verwaltet Secrets in der INFRA-DB (Kessel Vault)
 */

/**
 * Registriert alle Secrets-Subcommands
 * @param {Object} secretsCommand - Commander Command-Instanz
 */
export function registerSecretsCommands(secretsCommand) {
  // Get Secrets Command
  secretsCommand
    .command("get")
    .description("Ruft Secrets aus der INFRA-DB (Kessel Vault) ab")
    .argument("[secret-name]", "Name des Secrets (optional, zeigt alle wenn nicht angegeben)")
    .option("--json", "Ausgabe im JSON-Format")
    .option("--env", "Ausgabe im .env-Format")
    .option("-v, --verbose", "Detaillierte Debug-Ausgaben")
    .action(async (secretName, options) => {
      const verbose = options.verbose === true || process.argv.includes('--verbose') || process.argv.includes('-v')
      
      try {
        debugLog("=== Secrets Get Command gestartet ===", { verbose }, verbose)
        
        const config = loadConfig()
        const serviceRoleKey = loadServiceRoleKey()
        
        if (!serviceRoleKey) {
          console.error(chalk.red("❌ SERVICE_ROLE_KEY nicht gefunden. Bitte konfiguriere die .env Datei."))
          process.exit(1)
        }
        
        debugLog("SERVICE_ROLE_KEY geladen", { keyMasked: maskSecret(serviceRoleKey) }, verbose)

        const supabase = createClient(config.defaultSupabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })
        
        debugLog("Supabase Client erstellt", null, verbose)

        // Versuche RPC-Funktion zu verwenden
        let secrets = {}
        try {
          debugLog("Rufe get_all_secrets_for_env() RPC-Funktion auf...", null, verbose)
          const { data, error } = await supabase.rpc("get_all_secrets_for_env", {})
          
          debugLog("RPC Response erhalten", {
            hasData: !!data,
            hasError: !!error,
          }, verbose)
          
          if (error) {
            debugError(error, verbose)
            throw error
          }
          
          secrets = data || {}
          debugLog(`RPC erfolgreich: ${Object.keys(secrets).length} Secrets abgerufen`, null, verbose)
        } catch (error) {
          debugError(error, verbose)
          
          if (error.message?.includes("schema cache")) {
            console.warn(chalk.yellow("⚠ Schema-Cache noch nicht aktualisiert. Verwende Fallback..."))
            
            try {
              const httpResult = await callRpcViaHttp(
                config.defaultSupabaseUrl,
                serviceRoleKey,
                "get_all_secrets_for_env",
                {},
                verbose
              )
              
              if (httpResult.error) {
                throw httpResult.error
              }
              
              secrets = httpResult.data || {}
            } catch (httpError) {
              debugError(httpError, verbose)
              
              if (secretName) {
                // Fallback für einzelnes Secret
                try {
                  const { data, error: readError } = await supabase.rpc("read_secret", {
                    secret_name: secretName
                  })
                  
                  if (readError) {
                    const httpReadResult = await callRpcViaHttp(
                      config.defaultSupabaseUrl,
                      serviceRoleKey,
                      "read_secret",
                      { secret_name: secretName },
                      verbose
                    )
                    
                    if (httpReadResult.error) {
                      throw httpReadResult.error
                    }
                    
                    const secretValue = httpReadResult.data
                    outputSecret(secretName, secretValue, options)
                    return
                  }
                  
                  outputSecret(secretName, data, options)
                  return
                } catch (readError) {
                  debugError(readError, verbose)
                  throw readError
                }
              } else {
                // Finaler Fallback: Direkter SQL-Zugriff
                console.warn(chalk.yellow("⚠ Versuche direkten SQL-Fallback..."))
                const sqlResult = await getSecretsViaDirectSql(
                  config.defaultSupabaseUrl,
                  serviceRoleKey,
                  null,
                  verbose
                )
                
                if (sqlResult.error) {
                  throw sqlResult.error
                }
                
                secrets = sqlResult.data || {}
                if (typeof secrets === 'string') {
                  secrets = JSON.parse(secrets)
                }
              }
            }
          } else {
            throw error
          }
        }

        // Einzelnes Secret
        if (secretName) {
          const value = secrets[secretName]
          if (!value) {
            console.error(chalk.red(`❌ Secret "${secretName}" nicht gefunden`))
            process.exit(1)
          }
          outputSecret(secretName, value, options)
          return
        }

        // Alle Secrets
        const entries = Object.entries(secrets).sort(([a], [b]) => a.localeCompare(b))

        if (options.json) {
          console.log(JSON.stringify(secrets, null, 2))
        } else if (options.env) {
          entries.forEach(([key, value]) => console.log(`${key}=${value}`))
        } else {
          console.log(chalk.cyan.bold(`\n📋 Secrets (${entries.length}):\n`))
          entries.forEach(([key, value]) => {
            const preview = value.length > 50 ? value.substring(0, 50) + "..." : value
            console.log(chalk.white(`  ${key.padEnd(40)} ${chalk.dim(preview)}`))
          })
          console.log()
        }
      } catch (error) {
        console.error(chalk.red.bold("\n❌ Fehler beim Abrufen der Secrets:"))
        console.error(chalk.red(error.message))
        debugError(error, verbose)
        console.error(chalk.dim("\n💡 Tipp: Verwende --verbose für detaillierte Debug-Informationen"))
        process.exit(1)
      }
    })

  // Add Secret Command
  secretsCommand
    .command("add")
    .description("Fügt ein neues Secret zum Vault hinzu")
    .argument("<secret-name>", "Name des Secrets")
    .argument("<secret-value>", "Wert des Secrets")
    .option("--force", "Überschreibt existierendes Secret")
    .option("-v, --verbose", "Detaillierte Debug-Ausgaben")
    .action(async (secretName, secretValue, options) => {
      const verbose = !!options.verbose
      
      try {
        debugLog("=== Secrets Add Command gestartet ===", { secretName }, verbose)
        
        const config = loadConfig()
        const serviceRoleKey = loadServiceRoleKey()
        
        if (!serviceRoleKey) {
          console.error(chalk.red("❌ SERVICE_ROLE_KEY nicht gefunden."))
          process.exit(1)
        }

        const supabase = createClient(config.defaultSupabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })

        // Prüfe ob Secret existiert
        if (!options.force) {
          try {
            const { data, error } = await supabase.rpc("read_secret", {
              secret_name: secretName
            })
            
            if (!error && data) {
              console.error(chalk.red(`❌ Secret "${secretName}" existiert bereits`))
              console.error(chalk.yellow(`   Verwende --force um zu überschreiben\n`))
              process.exit(1)
            }
          } catch (error) {
            // Secret existiert nicht, weiter
          }
        }

        console.log(chalk.blue(`📝 Füge Secret "${secretName}" hinzu...`))

        const { data, error } = await supabase.rpc("insert_secret", {
          name: secretName,
          secret: secretValue
        })

        if (error) {
          debugError(error, verbose)
          
          if (error.message?.includes("schema cache")) {
            try {
              const httpResult = await callRpcViaHttp(
                config.defaultSupabaseUrl,
                serviceRoleKey,
                "insert_secret",
                { name: secretName, secret: secretValue },
                verbose
              )
              
              if (httpResult.error) {
                throw httpResult.error
              }
              
              console.log(chalk.green(`✓ Secret "${secretName}" erfolgreich hinzugefügt`))
              console.log(chalk.dim(`  UUID: ${httpResult.data}\n`))
              return
            } catch (httpError) {
              debugError(httpError, verbose)
              throw new Error("Schema-Cache noch nicht aktualisiert.")
            }
          }
          throw error
        }

        console.log(chalk.green(`✓ Secret "${secretName}" erfolgreich hinzugefügt`))
        console.log(chalk.dim(`  UUID: ${data}\n`))
      } catch (error) {
        console.error(chalk.red.bold("\n❌ Fehler beim Hinzufügen des Secrets:"))
        console.error(chalk.red(error.message))
        debugError(error, verbose)
        process.exit(1)
      }
    })

  // Update Secret Command
  secretsCommand
    .command("update")
    .description("Aktualisiert ein existierendes Secret")
    .argument("<secret-name>", "Name des Secrets")
    .argument("<secret-value>", "Neuer Wert des Secrets")
    .option("-v, --verbose", "Detaillierte Debug-Ausgaben")
    .action(async (secretName, secretValue, options) => {
      const verbose = !!options.verbose
      
      try {
        const config = loadConfig()
        const serviceRoleKey = loadServiceRoleKey()
        
        if (!serviceRoleKey) {
          console.error(chalk.red("❌ SERVICE_ROLE_KEY nicht gefunden."))
          process.exit(1)
        }

        const supabase = createClient(config.defaultSupabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })

        // Prüfe ob Secret existiert
        console.log(chalk.blue(`🔍 Prüfe ob Secret "${secretName}" existiert...`))

        let existingValue = null
        try {
          const { data, error } = await supabase.rpc("read_secret", {
            secret_name: secretName
          })
          
          if (error) {
            if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
              console.error(chalk.red(`❌ Secret "${secretName}" existiert nicht`))
              console.error(chalk.yellow(`   Verwende "secrets add" um ein neues Secret hinzuzufügen\n`))
              process.exit(1)
            }
            
            // HTTP-Fallback
            const httpResult = await callRpcViaHttp(
              config.defaultSupabaseUrl,
              serviceRoleKey,
              "read_secret",
              { secret_name: secretName },
              verbose
            )
            
            if (httpResult.error) {
              throw httpResult.error
            }
            
            existingValue = httpResult.data
          } else {
            existingValue = data
          }
        } catch (error) {
          if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
            console.error(chalk.red(`❌ Secret "${secretName}" existiert nicht`))
            process.exit(1)
          }
          throw error
        }

        if (existingValue === secretValue) {
          console.log(chalk.yellow(`⚠ Secret "${secretName}" hat bereits diesen Wert`))
          process.exit(0)
        }

        // Lösche altes Secret und erstelle neues
        console.log(chalk.blue(`🔄 Aktualisiere Secret "${secretName}"...`))

        const { error: deleteError } = await supabase.rpc("delete_secret", {
          secret_name: secretName
        })

        if (deleteError) {
          if (deleteError.message?.includes("schema cache")) {
            await callRpcViaHttp(
              config.defaultSupabaseUrl,
              serviceRoleKey,
              "delete_secret",
              { secret_name: secretName },
              verbose
            )
          } else {
            throw deleteError
          }
        }

        // Erstelle neues Secret
        const { data, error: insertError } = await supabase.rpc("insert_secret", {
          name: secretName,
          secret: secretValue
        })

        if (insertError) {
          if (insertError.message?.includes("schema cache")) {
            const httpResult = await callRpcViaHttp(
              config.defaultSupabaseUrl,
              serviceRoleKey,
              "insert_secret",
              { name: secretName, secret: secretValue },
              verbose
            )
            
            if (httpResult.error) {
              throw httpResult.error
            }
            
            console.log(chalk.green(`✓ Secret "${secretName}" erfolgreich aktualisiert`))
            console.log(chalk.dim(`  UUID: ${httpResult.data}\n`))
            return
          }
          throw insertError
        }

        console.log(chalk.green(`✓ Secret "${secretName}" erfolgreich aktualisiert`))
        console.log(chalk.dim(`  UUID: ${data}\n`))
      } catch (error) {
        console.error(chalk.red.bold("\n❌ Fehler beim Aktualisieren des Secrets:"))
        console.error(chalk.red(error.message))
        debugError(error, verbose)
        process.exit(1)
      }
    })

  // Delete Secret Command
  secretsCommand
    .command("delete")
    .description("Löscht ein Secret aus dem Vault")
    .argument("<secret-name>", "Name des Secrets")
    .option("--force", "Löscht ohne Bestätigung")
    .option("-v, --verbose", "Detaillierte Debug-Ausgaben")
    .action(async (secretName, options) => {
      const verbose = !!options.verbose
      
      try {
        const config = loadConfig()
        const serviceRoleKey = loadServiceRoleKey()
        
        if (!serviceRoleKey) {
          console.error(chalk.red("❌ SERVICE_ROLE_KEY nicht gefunden."))
          process.exit(1)
        }

        const supabase = createClient(config.defaultSupabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })

        // Bestätigung
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

        console.log(chalk.blue(`🗑️  Lösche Secret "${secretName}"...`))

        const { error } = await supabase.rpc("delete_secret", {
          secret_name: secretName
        })

        if (error) {
          debugError(error, verbose)
          
          if (error.message?.includes("schema cache")) {
            await callRpcViaHttp(
              config.defaultSupabaseUrl,
              serviceRoleKey,
              "delete_secret",
              { secret_name: secretName },
              verbose
            )
            
            console.log(chalk.green(`✓ Secret "${secretName}" erfolgreich gelöscht\n`))
            return
          }
          
          if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
            console.error(chalk.red(`❌ Secret "${secretName}" existiert nicht`))
            process.exit(1)
          }
          
          throw error
        }

        console.log(chalk.green(`✓ Secret "${secretName}" erfolgreich gelöscht\n`))
      } catch (error) {
        console.error(chalk.red.bold("\n❌ Fehler beim Löschen des Secrets:"))
        console.error(chalk.red(error.message))
        debugError(error, verbose)
        process.exit(1)
      }
    })
}

/**
 * Helper: Gibt ein Secret aus
 */
function outputSecret(name, value, options) {
  if (options.json) {
    console.log(JSON.stringify({ [name]: value }, null, 2))
  } else if (options.env) {
    console.log(`${name}=${value}`)
  } else {
    console.log(chalk.green(`✓ ${name}: ${value}`))
  }
}
