#!/usr/bin/env node

import { program } from "commander"
import inquirer from "inquirer"
import { Octokit } from "octokit"
import degit from "degit"
import chalk from "chalk"
import fs from "fs"
import path from "path"
import { execSync } from "child_process"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { createProgressBar, updateProgress, completeProgress } from "./lib/progress.js"
import {
  checkGitHubCLI,
  checkVercelCLI,
  checkSupabaseCLI,
  checkPackageManager,
  setupSupabase,
  setupSecrets,
} from "./lib/prechecks.js"
import { loadProfile, normalizeUsername } from "./lib/profile.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Pfad zur kessel-boilerplate .env Datei (absoluter Pfad)
const BOILERPLATE_ENV_PATH = "B:/Nextcloud/CODE/proj/kessel-boilerplate/.env"

// Lade Config-Datei (falls vorhanden)
function loadConfig() {
  const configPath = path.join(__dirname, "config.json")
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"))
    } catch (error) {
      console.warn(chalk.yellow("⚠️  Konfigurationsdatei konnte nicht geladen werden, verwende Standardwerte"))
    }
  }
  return {
    sharedSupabaseProject: {
      url: "https://ufqlocxqizmiaozkashi.supabase.co",
      projectRef: "ufqlocxqizmiaozkashi",
    },
    vaultSupabaseUrl: "https://zedhieyjlfhygsfxzbze.supabase.co",
    defaultTemplateRepo: "phkoenig/kessel-boilerplate",
  }
}

// Lade SERVICE_ROLE_KEY aus boiler_plate_A/.env
function loadServiceRoleKey() {
  if (fs.existsSync(BOILERPLATE_ENV_PATH)) {
    try {
      const envContent = fs.readFileSync(BOILERPLATE_ENV_PATH, "utf-8")
      const match = envContent.match(/SERVICE_ROLE_KEY=(.+)/)
      if (match && match[1]) {
        return match[1].trim()
      }
    } catch (error) {
      console.error(chalk.red(`❌ Fehler beim Lesen der .env Datei: ${error.message}`))
      return null
    }
  } else {
    console.error(chalk.red(`❌ .env Datei nicht gefunden: ${BOILERPLATE_ENV_PATH}`))
    return null
  }
  return null
}

// Debug-Helper-Funktionen
function maskSecret(secret) {
  if (!secret || secret.length < 8) return "***"
  return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`
}

function debugLog(message, data = null, verbose = false) {
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

function debugError(error, verbose = false) {
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

// Direkter SQL-Fallback für Secrets (umgeht PostgREST Schema-Cache)
async function getSecretsViaDirectSql(supabaseUrl, serviceRoleKey, secretName = null, verbose = false) {
  debugLog("Direkter SQL-Fallback: Rufe Vault-Funktion direkt über SQL auf", { secretName }, verbose)
  
  try {
    // Verwende die Supabase REST API, um die Funktion direkt aufzurufen
    // Da PostgREST die Funktion nicht findet, rufen wir sie über einen alternativen Weg auf
    // Wir verwenden die RPC-Endpoint mit dem korrekten Parameter-Format für JSONB
    
    if (secretName) {
      // Einzelnes Secret
      const url = `${supabaseUrl}/rest/v1/rpc/read_secret`
      debugLog(`HTTP Request URL: ${url}`, null, verbose)
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ secret_name: secretName })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        debugLog(`HTTP Response Error: ${response.status} - ${errorText}`, null, verbose)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
      
      const data = await response.text()
      debugLog(`HTTP Response Data: ${data.substring(0, 100)}`, null, verbose)
      return { data: data, error: null }
    } else {
      // Alle Secrets - verwende die Funktion mit JSONB-Parameter
      const url = `${supabaseUrl}/rest/v1/rpc/get_all_secrets_for_env`
      debugLog(`HTTP Request URL: ${url}`, null, verbose)
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({})  // Unbenannter JSON-Parameter wird als gesamtes Body übergeben
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        debugLog(`HTTP Response Error: ${response.status} - ${errorText}`, null, verbose)
        
        // Wenn das auch fehlschlägt, versuche es mit params als Key
        if (response.status === 404 || errorText.includes('PGRST202')) {
          debugLog("Versuche alternativen Parameter-Namen 'params'...", null, verbose)
          const retryResponse = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Prefer': 'return=representation'
            },
            // Versuche es mit dem gesamten Body als unbenanntem Parameter
            body: JSON.stringify({})
          })
          
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text()
            throw new Error(`HTTP ${retryResponse.status}: ${retryErrorText}`)
          }
          
          const retryData = await retryResponse.json()
          debugLog(`HTTP Retry Response Data`, typeof retryData === 'object' ? Object.keys(retryData) : retryData, verbose)
          return { data: retryData, error: null }
        }
        
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
      
      const data = await response.json()
      debugLog(`HTTP Response Data`, typeof data === 'object' ? Object.keys(data) : data, verbose)
      return { data: data, error: null }
    }
  } catch (error) {
    debugError(error, verbose)
    throw error
  }
}

// HTTP-Fallback für RPC-Calls (wenn Schema-Cache Problem)
async function callRpcViaHttp(supabaseUrl, serviceRoleKey, functionName, params = {}, verbose = false) {
  debugLog(`HTTP-Fallback: Rufe ${functionName} über PostgREST auf`, { url: supabaseUrl, function: functionName }, verbose)
  
  try {
    const url = `${supabaseUrl}/rest/v1/rpc/${functionName}`
    debugLog(`HTTP Request URL: ${url}`, null, verbose)
    
    const headers = {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Prefer': 'return=representation'
    }
    
    debugLog(`HTTP Request Headers`, { 
      'Content-Type': headers['Content-Type'],
      'apikey': maskSecret(serviceRoleKey),
      'Authorization': `Bearer ${maskSecret(serviceRoleKey)}`,
      'Prefer': headers['Prefer']
    }, verbose)
    
    debugLog(`HTTP Request Body`, params, verbose)
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(params)
    })
    
    debugLog(`HTTP Response Status: ${response.status} ${response.statusText}`, null, verbose)
    
    const responseHeaders = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })
    debugLog(`HTTP Response Headers`, responseHeaders, verbose)
    
    if (!response.ok) {
      const errorText = await response.text()
      debugLog(`HTTP Response Error Body`, errorText, verbose)
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
    
    const data = await response.json()
    debugLog(`HTTP Response Data`, typeof data === 'object' ? Object.keys(data) : data, verbose)
    
    return { data, error: null }
  } catch (error) {
    debugError(error, verbose)
    throw error
  }
}

// Lade GitHub Token aus GitHub CLI (gh auth token)
function loadGitHubToken() {
  try {
    const token = execSync("gh auth token", {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim()
    if (token && token.length > 0) {
      return token
    }
  } catch (error) {
    // GitHub CLI nicht verfügbar oder nicht authentifiziert
    return null
  }
  return null
}

// Liste Supabase-Projekte auf (via CLI)
async function listSupabaseProjects(debugFn) {
  try {
    // Versuche mit Shell, um sicherzustellen dass Umgebungsvariablen und Auth übernommen werden
    let output
    try {
      // Verwende Shell explizit, damit Umgebungsvariablen und Auth-Kontext übernommen werden
      output = execSync("supabase projects list", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"], // stdin, stdout, stderr
        env: process.env, // Stelle sicher, dass Umgebungsvariablen übernommen werden
        shell: true, // Verwende Shell, damit Auth-Kontext übernommen wird
      })
    } catch (execError) {
      // Falls execSync einen Fehler wirft, könnte die Ausgabe trotzdem in stdout/stderr sein
      if (execError.stdout) {
        output = execError.stdout.toString("utf-8")
      } else if (execError.stderr) {
        output = execError.stderr.toString("utf-8")
      } else {
        // Wenn weder stdout noch stderr vorhanden, werfe den Fehler weiter
        if (debugFn) {
          debugFn(`execSync Error: ${execError.message}`)
        }
        throw execError
      }
    }
    
    // Kombiniere stdout und stderr falls nötig
    if (debugFn) {
      debugFn(`Output length: ${output.length} characters`)
      debugFn(`First 200 chars: ${output.substring(0, 200)}`)
    }

    // Parse die Tabellen-Ausgabe
    // Format: LINKED │ ORG ID │ REFERENCE ID │ NAME │ REGION │ CREATED AT
    // Normalisiere Zeilenenden (Windows: \r\n, Unix: \n)
    const normalizedOutput = output.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const lines = normalizedOutput.split("\n")
    const projects = []
    let headerFound = false
    let inTable = false

    if (debugFn) {
      debugFn(`Raw output lines: ${lines.length}`)
      debugFn(`First 5 lines:`)
      lines.slice(0, 5).forEach((line, i) => {
        debugFn(`  Line ${i}: "${line.substring(0, 80)}"`)
      })
      debugFn(`All lines with content:`)
      lines.forEach((line, i) => {
        const trimmed = line.trim()
        if (trimmed && trimmed.length > 0) {
          debugFn(`  Line ${i}: "${trimmed.substring(0, 100)}"`)
        }
      })
    }

    for (const line of lines) {
      const trimmed = line.trim()
      
      // Überspringe leere Zeilen
      if (!trimmed) {
        continue
      }

      // Überspringe Warnungen und andere Meldungen
      if (trimmed.includes("Cannot find") || trimmed.includes("version") || trimmed.includes("recommend") || trimmed.includes("updating")) {
        continue
      }

      // Erkenne Header-Zeile (kann mit Leerzeichen beginnen)
      if (trimmed.includes("LINKED") && trimmed.includes("ORG ID")) {
        headerFound = true
        if (debugFn) debugFn(`Header gefunden in Zeile: "${trimmed.substring(0, 60)}"`)
        continue
      }

      // Erkenne Trennlinie nach Header (enthält ─ oder ┼)
      if (headerFound && (trimmed.includes("─") || trimmed.includes("┼")) && trimmed.length > 50) {
        inTable = true
        if (debugFn) debugFn(`Trennlinie gefunden, inTable = true. Zeile: "${trimmed.substring(0, 60)}"`)
        continue
      }

      // Parse Tabellenzeilen (getrennt durch │)
      // WICHTIG: Prüfe auch ob headerFound gesetzt ist, falls inTable noch nicht gesetzt wurde
      if ((inTable || headerFound) && trimmed.includes("│") && !trimmed.includes("LINKED")) {
        if (debugFn) {
          debugFn(`[inTable=${inTable}] Parsing Zeile: "${trimmed.substring(0, 80)}"`)
        }
        const parts = trimmed.split("│").map((p) => p.trim())
        
        if (debugFn) {
          debugFn(`Parsing line: ${trimmed.substring(0, 60)}... (${parts.length} parts)`)
        }
        
        // Erwartetes Format: [LINKED, ORG_ID, REFERENCE_ID, NAME, REGION, CREATED_AT]
        // Normalerweise haben wir 6-7 Teile (LINKED kann leer sein)
        if (debugFn) {
          debugFn(`  → parts.length: ${parts.length}, parts: [${parts.slice(0, 5).map(p => `"${p.substring(0, 20)}"`).join(", ")}]`)
        }
        
        if (parts.length >= 4) {
          // Index 0: LINKED (kann leer sein)
          // Index 1: ORG ID
          // Index 2: REFERENCE ID (project_ref)
          // Index 3: NAME
          // Index 4: REGION
          const orgId = parts[1] || ""
          const referenceId = parts[2] || ""
          const name = parts[3] || ""
          const region = parts[4] || ""

          if (debugFn) {
            debugFn(`  → referenceId: "${referenceId}", name: "${name}", length: ${referenceId.length}`)
          }

          // Filtere das Secret-Projekt raus (zedhieyjlfhygsfxzbze)
          if (referenceId && referenceId.length > 0 && !referenceId.includes("zedhieyjlfhygsfxzbze")) {
            projects.push({
              id: referenceId,
              project_ref: referenceId,
              name: name,
              org_id: orgId,
              region: region,
            })
            if (debugFn) {
              debugFn(`  ✓ Projekt hinzugefügt: ${name} (${referenceId})`)
            }
          } else if (debugFn) {
            if (!referenceId || referenceId.length === 0) {
              debugFn(`  ✗ Übersprungen: referenceId ist leer`)
            } else if (referenceId.includes("zedhieyjlfhygsfxzbze")) {
              debugFn(`  ✗ Übersprungen: Secret-Projekt gefiltert`)
            }
          }
        } else if (debugFn) {
          debugFn(`  ✗ Übersprungen: parts.length (${parts.length}) < 4`)
        }
      }
    }

    if (debugFn) {
      debugFn(`Parsing abgeschlossen. Gefundene Projekte: ${projects.length}`)
    }

    return projects
  } catch (error) {
    if (debugFn) {
      debugFn(`Fehler beim Abrufen der Projekte: ${error.message}`)
      debugFn(`Error stack: ${error.stack}`)
      if (error.stdout) {
        debugFn(`stdout: ${error.stdout.toString("utf-8").substring(0, 300)}`)
      }
      if (error.stderr) {
        debugFn(`stderr: ${error.stderr.toString("utf-8").substring(0, 300)}`)
      }
    }
    // Falls CLI nicht verfügbar oder nicht authentifiziert
    return []
  }
}

// Erstelle neues Supabase-Projekt
async function createSupabaseProject(projectName, organizationId, dbPassword, region = "eu-central-1") {
  try {
    const output = execSync(
      `supabase projects create "${projectName}" --org-id ${organizationId} --db-password "${dbPassword}" --region ${region} --output json`,
      {
        encoding: "utf-8",
        stdio: "pipe",
      }
    )
    return JSON.parse(output)
  } catch (error) {
    throw new Error(`Fehler beim Erstellen des Supabase-Projekts: ${error.message}`)
  }
}

// Versuche Anon Key automatisch abzurufen (via Supabase Management API)
async function fetchAnonKeyFromSupabase(projectRef, debugFn) {
  try {
    // Versuche über Supabase CLI die API-Keys abzurufen
    // Hinweis: Die CLI gibt möglicherweise keine Keys zurück, aber wir versuchen es
    let output
    try {
      output = execSync(
        `supabase projects api-keys --project-ref ${projectRef} --output json`,
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"], // stdin, stdout, stderr
          shell: true,
        }
      )
    } catch (execError) {
      // Falls execSync einen Fehler wirft, könnte die Ausgabe trotzdem in stdout/stderr sein
      if (execError.stdout) {
        output = execError.stdout.toString("utf-8")
      } else if (execError.stderr) {
        output = execError.stderr.toString("utf-8")
      } else {
        if (debugFn) {
          debugFn(`⚠️  CLI-Fehler: ${execError.message}`)
        }
        return null
      }
    }
    
    if (debugFn) {
      debugFn(`API-Keys Output (${output.length} chars): ${output.substring(0, 300)}`)
    }
    
    // Prüfe ob Output leer ist oder nur Warnungen enthält
    const trimmedOutput = output.trim()
    if (!trimmedOutput || trimmedOutput.length === 0) {
      if (debugFn) {
        debugFn(`⚠️  CLI gibt keine Keys zurück (leere Ausgabe)`)
      }
      return null
    }
    
    // Versuche JSON zu parsen
    let keys
    try {
      keys = JSON.parse(trimmedOutput)
    } catch (parseError) {
      // Falls kein JSON, könnte es eine Tabellen-Ausgabe sein
      if (debugFn) {
        debugFn(`⚠️  Ausgabe ist kein JSON, versuche Tabellen-Parsing...`)
      }
      
      // Versuche Tabellen-Format zu parsen (falls CLI kein JSON unterstützt)
      // Format: NAME │ KEY VALUE
      const lines = trimmedOutput.split("\n")
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.includes("anon") || trimmed.includes("public")) {
          const parts = trimmed.split("│").map((p) => p.trim())
          if (parts.length >= 2) {
            const keyName = parts[0].toLowerCase()
            const keyValue = parts[1]
            if ((keyName.includes("anon") || keyName.includes("public")) && keyValue && keyValue.length > 20) {
              if (debugFn) {
                debugFn(`✓ Anon Key aus Tabelle gefunden: ${keyValue.substring(0, 20)}...`)
              }
              return keyValue
            }
          }
        }
      }
      
      if (debugFn) {
        debugFn(`⚠️  Konnte Keys nicht aus Tabellen-Format parsen`)
      }
      return null
    }
    
    // Suche nach dem "anon" oder "publishable" Key im JSON
    if (Array.isArray(keys)) {
      // Bevorzuge "anon" Key (legacy), sonst "publishable" Key
      let anonKey = keys.find((k) => {
        const name = (k.name || "").toLowerCase()
        const id = (k.id || "").toLowerCase()
        return name === "anon" || id === "anon"
      })
      
      // Falls kein "anon" Key, nimm "publishable" Key
      if (!anonKey) {
        anonKey = keys.find((k) => {
          const type = (k.type || "").toLowerCase()
          return type === "publishable"
        })
      }
      
      if (anonKey && anonKey.api_key) {
        const keyValue = anonKey.api_key
        if (debugFn) {
          debugFn(`✓ Anon Key automatisch abgerufen (${anonKey.name || anonKey.type}): ${keyValue.substring(0, 20)}...`)
        }
        return keyValue
      }
    } else if (keys.anon_key || keys.anon || keys.public || keys.api_key) {
      const key = keys.anon_key || keys.anon || keys.public || keys.api_key
      if (debugFn) {
        debugFn(`✓ Anon Key automatisch abgerufen: ${key.substring(0, 20)}...`)
      }
      return key
    }
    
    if (debugFn) {
      debugFn(`⚠️  Kein Anon Key im JSON gefunden`)
    }
    return null
  } catch (error) {
    // Falls Abruf fehlschlägt, geben wir null zurück (Fallback zu manueller Eingabe)
    if (debugFn) {
      debugFn(`⚠️  Fehler beim Abrufen des Anon Keys: ${error.message}`)
      if (error.stack) {
        debugFn(`Stack: ${error.stack.substring(0, 200)}`)
      }
    }
    return null
  }
}

async function fetchServiceRoleKeyFromSupabase(projectRef, debugFn) {
  try {
    // Versuche über Supabase CLI die API-Keys abzurufen
    let output
    try {
      output = execSync(
        `supabase projects api-keys --project-ref ${projectRef}`,
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          shell: true,
        }
      )
    } catch (execError) {
      if (execError.stdout) {
        output = execError.stdout.toString("utf-8")
      } else if (execError.stderr) {
        output = execError.stderr.toString("utf-8")
      } else {
        if (debugFn) {
          debugFn(`⚠️  CLI-Fehler beim Abrufen von Service Role Key: ${execError.message}`)
        }
        return null
      }
    }
    
    if (debugFn) {
      debugFn(`Service Role Key Output (${output.length} chars): ${output.substring(0, 300)}`)
    }
    
    // Entferne ANSI Escape Codes aus dem Output
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '').replace(/\u001b\[\d+m/g, '')
    
    // Parse Tabellen-Format: service_role │ KEY VALUE
    const lines = cleanOutput.split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.includes("service_role")) {
        const parts = trimmed.split("│").map((p) => p.trim())
        if (parts.length >= 2) {
          const keyName = parts[0].toLowerCase()
          const keyValue = parts[1].replace(/\x1b\[[0-9;]*m/g, '').trim() // Entferne ANSI Codes auch aus dem Key
          if (keyName.includes("service_role") && keyValue && keyValue.length > 20) {
            if (debugFn) {
              debugFn(`✓ Service Role Key aus Tabelle gefunden: ${keyValue.substring(0, 20)}...`)
            }
            return keyValue
          }
        }
      }
    }
    
    if (debugFn) {
      debugFn(`⚠️  Konnte Service Role Key nicht aus Tabellen-Format parsen`)
    }
    return null
  } catch (error) {
    if (debugFn) {
      debugFn(`❌ Fehler beim Abrufen von Service Role Key: ${error.message}`)
    }
    return null
  }
}

const config = loadConfig()

program
  .name("kessel-cli")
  .description("CLI für die Kessel Boilerplate - Erstellt neue Next.js-Projekte mit Supabase & ShadCN UI")
  .version("2.0.0")

// ============================================================================
// SECRETS MANAGEMENT COMMANDS (müssen VOR dem Haupt-Command registriert werden)
// ============================================================================

// Secrets Subcommand
const secretsCommand = program
  .command("secrets")
  .description("Verwaltet Secrets im Supabase Vault")

// Get Secrets Command
secretsCommand
  .command("get")
  .description("Ruft Secrets aus dem Supabase Vault ab")
  .argument("[secret-name]", "Name des Secrets (optional, zeigt alle wenn nicht angegeben)")
  .option("--json", "Ausgabe im JSON-Format")
  .option("--env", "Ausgabe im .env-Format")
  .option("-v, --verbose", "Detaillierte Debug-Ausgaben")
  .action(async (secretName, options) => {
    // Commander.js: Bei verschachtelten Commands werden Boolean-Optionen nicht immer korrekt weitergegeben
    // Fallback: Prüfe direkt process.argv
    const verbose = options.verbose === true || process.argv.includes('--verbose') || process.argv.includes('-v')
    
    try {
      debugLog("=== Secrets Get Command gestartet ===", { verbose, optionsVerbose: options.verbose }, verbose)
      
      // Config Loading
      debugLog("Lade Config...", null, verbose)
      const config = loadConfig()
      debugLog("Config geladen", {
        defaultSupabaseUrl: config.defaultSupabaseUrl,
        configPath: path.join(__dirname, "config.json"),
        configExists: fs.existsSync(path.join(__dirname, "config.json"))
      }, verbose)
      
      debugLog("Lade SERVICE_ROLE_KEY...", null, verbose)
      const serviceRoleKey = loadServiceRoleKey()
      
      if (!serviceRoleKey) {
        console.error(chalk.red("❌ SERVICE_ROLE_KEY nicht gefunden. Bitte konfiguriere die .env Datei."))
        debugLog("SERVICE_ROLE_KEY nicht gefunden", {
          envPath: BOILERPLATE_ENV_PATH,
          envExists: fs.existsSync(BOILERPLATE_ENV_PATH)
        }, verbose)
        process.exit(1)
      }
      
      debugLog("SERVICE_ROLE_KEY geladen", {
        keyMasked: maskSecret(serviceRoleKey),
        keyLength: serviceRoleKey.length
      }, verbose)

      // Supabase Client Erstellung
      debugLog("Erstelle Supabase Client...", {
        url: config.defaultSupabaseUrl,
        authConfig: {
          autoRefreshToken: false,
          persistSession: false
        }
      }, verbose)
      
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
        // Verwende unbenannten JSON-Parameter für PostgREST-Kompatibilität
        // PostgREST erwartet bei Funktionen mit unbenanntem Parameter das gesamte Body als Parameter
        const { data, error } = await supabase.rpc("get_all_secrets_for_env", {})
        
        debugLog("RPC Response erhalten", {
          hasData: !!data,
          hasError: !!error,
          dataType: typeof data,
          dataKeys: data && typeof data === 'object' ? Object.keys(data) : null
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
          debugLog("Schema-Cache Problem erkannt, versuche HTTP-Fallback...", null, verbose)
          
          // Versuche HTTP-Fallback
          try {
            debugLog("Versuche get_all_secrets_for_env über HTTP...", null, verbose)
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
            debugLog(`HTTP-Fallback erfolgreich: ${Object.keys(secrets).length} Secrets abgerufen`, null, verbose)
          } catch (httpError) {
            debugError(httpError, verbose)
            
            // Fallback zu read_secret für einzelnes Secret
            if (secretName) {
              console.warn(chalk.yellow("⚠ Versuche einzelnes Secret über read_secret..."))
              debugLog(`Versuche read_secret für: ${secretName}`, null, verbose)
              
              try {
                // Verwende JSONB-Parameter für PostgREST-Kompatibilität
                const { data, error: readError } = await supabase.rpc("read_secret", {
                  secret_name: secretName
                })
                
                if (readError) {
                  debugError(readError, verbose)
                  
                  // Versuche HTTP-Fallback für read_secret
                  try {
                    debugLog("Versuche read_secret über HTTP...", null, verbose)
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
                    
                    if (options.json) {
                      console.log(JSON.stringify({ [secretName]: secretValue }, null, 2))
                    } else if (options.env) {
                      console.log(`${secretName}=${secretValue}`)
                    } else {
                      console.log(chalk.green(`✓ ${secretName}: ${secretValue}`))
                    }
                    return
                  } catch (httpReadError) {
                    debugError(httpReadError, verbose)
                    throw readError
                  }
                }
                
                if (options.json) {
                  console.log(JSON.stringify({ [secretName]: data }, null, 2))
                } else if (options.env) {
                  console.log(`${secretName}=${data}`)
                } else {
                  console.log(chalk.green(`✓ ${secretName}: ${data}`))
                }
                return
              } catch (readError) {
                debugError(readError, verbose)
                throw readError
              }
            } else {
              // Finaler Fallback: Direkter SQL-Zugriff über HTTP mit verschiedenen Parameter-Formaten
              console.warn(chalk.yellow("⚠ Schema-Cache Problem: Versuche direkten SQL-Fallback..."))
              debugLog("Finaler Fallback: Direkter SQL-Zugriff", null, verbose)
              
              try {
                debugLog("Versuche direkten SQL-Fallback für get_all_secrets_for_env...", null, verbose)
                const sqlResult = await getSecretsViaDirectSql(
                  config.defaultSupabaseUrl,
                  serviceRoleKey,
                  null,
                  verbose
                )
                
                if (sqlResult.error) {
                  throw sqlResult.error
                }
                
                // Die Funktion gibt ein JSONB-Objekt zurück, das direkt als Objekt interpretiert werden sollte
                secrets = sqlResult.data || {}
                
                // Wenn data ein String ist (JSON), parse es
                if (typeof secrets === 'string') {
                  try {
                    secrets = JSON.parse(secrets)
                  } catch (parseError) {
                    debugLog("Fehler beim Parsen der Response", parseError, verbose)
                    throw new Error("Ungültiges JSON-Format in Response")
                  }
                }
                
                debugLog(`SQL-Fallback erfolgreich: ${Object.keys(secrets).length} Secrets abgerufen`, null, verbose)
              } catch (sqlError) {
                debugError(sqlError, verbose)
                throw new Error(
                  "Schema-Cache noch nicht aktualisiert. " +
                  "Die Funktion ist in der Datenbank vorhanden, aber PostgREST findet sie noch nicht. " +
                  "Bitte warte einige Minuten oder verwende 'secrets get <secret-name>' für einzelne Secrets. " +
                  `Fehler: ${sqlError.message}`
                )
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

        if (options.json) {
          console.log(JSON.stringify({ [secretName]: value }, null, 2))
        } else if (options.env) {
          console.log(`${secretName}=${value}`)
        } else {
          console.log(chalk.green(`✓ ${secretName}: ${value}`))
        }
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
      
      // Detaillierte Fehlerinformationen auch ohne --verbose bei kritischen Fehlern
      if (error.code) {
        console.error(chalk.red.dim(`   Code: ${error.code}`))
      }
      if (error.details) {
        console.error(chalk.red.dim(`   Details: ${error.details}`))
      }
      if (error.hint) {
        console.error(chalk.yellow.dim(`   Hinweis: ${error.hint}`))
      }
      
      // Vollständige Debug-Informationen mit --verbose
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
      debugLog("=== Secrets Add Command gestartet ===", { secretName, valueLength: secretValue.length }, verbose)
      
      const config = loadConfig()
      debugLog("Config geladen", { defaultSupabaseUrl: config.defaultSupabaseUrl }, verbose)
      
      const serviceRoleKey = loadServiceRoleKey()
      
      if (!serviceRoleKey) {
        console.error(chalk.red("❌ SERVICE_ROLE_KEY nicht gefunden. Bitte konfiguriere die .env Datei."))
        debugLog("SERVICE_ROLE_KEY nicht gefunden", { envPath: BOILERPLATE_ENV_PATH }, verbose)
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

      // Prüfe ob Secret existiert
      if (!options.force) {
        debugLog(`Prüfe ob Secret "${secretName}" bereits existiert...`, null, verbose)
        try {
          const { data, error } = await supabase.rpc("read_secret", {
            secret_name: secretName
          })
          
          debugLog("read_secret Response", { hasData: !!data, hasError: !!error }, verbose)
          
          if (!error && data) {
            console.error(chalk.red(`❌ Secret "${secretName}" existiert bereits`))
            console.error(chalk.yellow(`   Aktueller Wert: ${data.substring(0, 50)}...`))
            console.error(chalk.yellow(`   Verwende --force um zu überschreiben\n`))
            process.exit(1)
          }
        } catch (error) {
          debugLog("Secret existiert nicht (erwartet)", null, verbose)
          // Secret existiert nicht, weiter
        }
      }

      console.log(chalk.blue(`📝 Füge Secret "${secretName}" hinzu...`))
      debugLog("Rufe insert_secret RPC auf...", { name: secretName, valueLength: secretValue.length }, verbose)

      const { data, error } = await supabase.rpc("insert_secret", {
        name: secretName,
        secret: secretValue
      })
      
      debugLog("insert_secret Response", { hasData: !!data, hasError: !!error, data }, verbose)

      if (error) {
        debugError(error, verbose)
        
        if (error.message?.includes("schema cache")) {
          debugLog("Schema-Cache Problem, versuche HTTP-Fallback...", null, verbose)
          
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
            throw new Error("Schema-Cache noch nicht aktualisiert. Bitte warte einige Minuten oder verwende Supabase MCP.")
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
      console.error(chalk.dim("\n💡 Tipp: Verwende --verbose für detaillierte Debug-Informationen"))
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
      debugLog("=== Secrets Update Command gestartet ===", { secretName, valueLength: secretValue.length }, verbose)
      
      const config = loadConfig()
      const serviceRoleKey = loadServiceRoleKey()
      
      if (!serviceRoleKey) {
        console.error(chalk.red("❌ SERVICE_ROLE_KEY nicht gefunden. Bitte konfiguriere die .env Datei."))
        debugLog("SERVICE_ROLE_KEY nicht gefunden", { envPath: BOILERPLATE_ENV_PATH }, verbose)
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

      // Prüfe ob Secret existiert
      console.log(chalk.blue(`🔍 Prüfe ob Secret "${secretName}" existiert...`))
      debugLog(`Prüfe ob Secret "${secretName}" existiert...`, null, verbose)

      let existingValue = null
      try {
        const { data, error } = await supabase.rpc("read_secret", {
          secret_name: secretName
        })
        
        debugLog("read_secret Response", { hasData: !!data, hasError: !!error }, verbose)
        
        if (error) {
          debugError(error, verbose)
          
          if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
            console.error(chalk.red(`❌ Secret "${secretName}" existiert nicht`))
            console.error(chalk.yellow(`   Verwende "secrets add" um ein neues Secret hinzuzufügen\n`))
            process.exit(1)
          }
          
          // Versuche HTTP-Fallback
          debugLog("RPC fehlgeschlagen, versuche HTTP-Fallback...", null, verbose)
          try {
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
            debugLog("HTTP-Fallback erfolgreich", null, verbose)
          } catch (httpError) {
            debugError(httpError, verbose)
            throw error
          }
        } else {
          existingValue = data
        }
      } catch (error) {
        debugError(error, verbose)
        
        if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
          console.error(chalk.red(`❌ Secret "${secretName}" existiert nicht`))
          console.error(chalk.yellow(`   Verwende "secrets add" um ein neues Secret hinzuzufügen\n`))
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
      debugLog("Lösche altes Secret...", null, verbose)

      const { error: deleteError } = await supabase.rpc("delete_secret", {
        secret_name: secretName
      })
      
      debugLog("delete_secret Response", { hasError: !!deleteError }, verbose)

      if (deleteError) {
        debugError(deleteError, verbose)
        
        if (deleteError.message?.includes("schema cache")) {
          debugLog("Schema-Cache Problem bei delete, versuche HTTP-Fallback...", null, verbose)
          
          try {
            await callRpcViaHttp(
              config.defaultSupabaseUrl,
              serviceRoleKey,
              "delete_secret",
              { secret_name: secretName },
              verbose
            )
            debugLog("HTTP-Fallback für delete erfolgreich", null, verbose)
          } catch (httpError) {
            debugError(httpError, verbose)
            throw new Error("Schema-Cache noch nicht aktualisiert. Bitte warte einige Minuten oder verwende Supabase MCP.")
          }
        } else {
          throw deleteError
        }
      }

      debugLog("Erstelle neues Secret...", null, verbose)
      const { data, error: insertError } = await supabase.rpc("insert_secret", {
        name: secretName,
        secret: secretValue
      })
      
      debugLog("insert_secret Response", { hasData: !!data, hasError: !!insertError }, verbose)

      if (insertError) {
        debugError(insertError, verbose)
        
        if (insertError.message?.includes("schema cache")) {
          debugLog("Schema-Cache Problem bei insert, versuche HTTP-Fallback...", null, verbose)
          
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
            
            console.log(chalk.green(`✓ Secret "${secretName}" erfolgreich aktualisiert`))
            console.log(chalk.dim(`  Alte Länge: ${existingValue.length} Zeichen`))
            console.log(chalk.dim(`  Neue Länge: ${secretValue.length} Zeichen`))
            console.log(chalk.dim(`  UUID: ${httpResult.data}\n`))
            return
          } catch (httpError) {
            debugError(httpError, verbose)
            throw insertError
          }
        }
        
        throw insertError
      }

      console.log(chalk.green(`✓ Secret "${secretName}" erfolgreich aktualisiert`))
      console.log(chalk.dim(`  Alte Länge: ${existingValue.length} Zeichen`))
      console.log(chalk.dim(`  Neue Länge: ${secretValue.length} Zeichen`))
      console.log(chalk.dim(`  UUID: ${data}\n`))
    } catch (error) {
      console.error(chalk.red.bold("\n❌ Fehler beim Aktualisieren des Secrets:"))
      console.error(chalk.red(error.message))
      debugError(error, verbose)
      console.error(chalk.dim("\n💡 Tipp: Verwende --verbose für detaillierte Debug-Informationen"))
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
      debugLog("=== Secrets Delete Command gestartet ===", { secretName }, verbose)
      
      const config = loadConfig()
      const serviceRoleKey = loadServiceRoleKey()
      
      if (!serviceRoleKey) {
        console.error(chalk.red("❌ SERVICE_ROLE_KEY nicht gefunden. Bitte konfiguriere die .env Datei."))
        debugLog("SERVICE_ROLE_KEY nicht gefunden", { envPath: BOILERPLATE_ENV_PATH }, verbose)
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

      // Bestätigung (außer --force)
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
      debugLog(`Rufe delete_secret RPC auf...`, { secretName }, verbose)

      const { error } = await supabase.rpc("delete_secret", {
        secret_name: secretName
      })
      
      debugLog("delete_secret Response", { hasError: !!error }, verbose)

      if (error) {
        debugError(error, verbose)
        
        if (error.message?.includes("schema cache")) {
          debugLog("Schema-Cache Problem, versuche HTTP-Fallback...", null, verbose)
          
          try {
            await callRpcViaHttp(
              config.defaultSupabaseUrl,
              serviceRoleKey,
              "delete_secret",
              { secret_name: secretName },
              verbose
            )
            
            console.log(chalk.green(`✓ Secret "${secretName}" erfolgreich gelöscht\n`))
            return
          } catch (httpError) {
            debugError(httpError, verbose)
            throw new Error("Schema-Cache noch nicht aktualisiert. Bitte warte einige Minuten oder verwende Supabase MCP.")
          }
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
      console.error(chalk.dim("\n💡 Tipp: Verwende --verbose für detaillierte Debug-Informationen"))
      process.exit(1)
    }
  })

// ============================================================================
// HAUPT-COMMAND (Projekt erstellen)
// ============================================================================

program
  .argument("[project-name]", "Name des Projekts (optional, wird interaktiv abgefragt)")
  .option(
    "-t, --template-version <version>",
    "Template-Version (z.B. v1.2.0). Standard: latest (main branch)"
  )
  .option("-v, --verbose", "Detaillierte Debug-Ausgaben", false)

program.action(async (projectNameArg, options) => {
  // ========================================================================
  // PHASE 0: Initialisierung
  // ========================================================================
  
  // Debug-Modus ZUERST definieren (wird später verwendet)
  const verbose = options.verbose || false
  const debug = (message) => {
    if (verbose) {
      console.log(chalk.dim(`[DEBUG] ${message}`))
    }
  }
  
  // Progress Bar initialisieren
  const progressBar = createProgressBar(100, "Initialisiere...")
  
  // WICHTIG: Speichere aktuelles Verzeichnis SOFORT beim Start
  // ABER: Wenn wir im Script-Verzeichnis sind, bedeutet das, dass ein Alias/Wrapper
  // das Verzeichnis gewechselt hat. In diesem Fall müssen wir das ursprüngliche Verzeichnis
  // aus der Umgebungsvariable PWD oder OLDPWD holen (falls verfügbar)
  let initialCwd = process.cwd()
  const scriptDir = __dirname // Verzeichnis in dem das Script liegt (für Referenz)
  
  // Prüfe ob wir versehentlich im Script-Verzeichnis sind (durch Alias/Wrapper)
  // Wenn ja, versuche das ursprüngliche Verzeichnis zu finden
  if (initialCwd === scriptDir) {
    // PROBLEM: process.env.PWD wird durch den Alias (cd ... && node) aktualisiert
    // Lösung: Prüfe ob wir im Parent-Verzeichnis ein Verzeichnis finden, das wie ein Projekt aussieht
    // Oder: Wenn projectNameArg gegeben ist, verwende das als Hinweis
    
    // Versuche PWD (Present Working Directory) aus der Umgebung zu holen
    // ABER: In Git Bash/MINGW64 wird PWD durch cd aktualisiert, also nicht zuverlässig
    const originalPwd = process.env.PWD || process.env.OLDPWD
    
    // Wenn PWD verfügbar und nicht scriptDir, verwende es
    if (originalPwd && originalPwd !== scriptDir && fs.existsSync(originalPwd)) {
      // Prüfe ob PWD wirklich ein anderes Verzeichnis ist (nicht nur ein anderer Pfad-Format)
      const normalizedPwd = path.resolve(originalPwd)
      const normalizedScript = path.resolve(scriptDir)
      
      if (normalizedPwd !== normalizedScript) {
        initialCwd = normalizedPwd
        process.chdir(initialCwd)
        debug(`Ursprüngliches Verzeichnis aus PWD wiederhergestellt: ${initialCwd}`)
      } else {
        // PWD zeigt auf scriptDir (durch Alias geändert) - verwende Fallback
        debug(`PWD zeigt auf scriptDir, verwende Fallback-Logik`)
        const parentDir = path.dirname(initialCwd)
        process.chdir(parentDir)
        initialCwd = process.cwd()
        debug(`Automatisch ins Parent-Verzeichnis gewechselt: ${initialCwd}`)
      }
      } else {
        // Fallback: PWD nicht verfügbar oder zeigt auf scriptDir
        // Versuche intelligente Erkennung: Suche im Parent nach Projekt-Verzeichnissen
        const parentDir = path.dirname(initialCwd)
        
        // Wenn projectNameArg gegeben ist, könnte das der Ordnername sein
        if (projectNameArg) {
          // Prüfe ob im Parent ein Verzeichnis mit diesem Namen existiert
          const possibleProjectDir = path.join(parentDir, projectNameArg)
          if (fs.existsSync(possibleProjectDir) && fs.statSync(possibleProjectDir).isDirectory()) {
            initialCwd = possibleProjectDir
            process.chdir(initialCwd)
            debug(`Projekt-Verzeichnis aus Argument gefunden: ${initialCwd}`)
          } else {
            // Verwende Parent, aber projectNameArg wird später als Projektname verwendet
            process.chdir(parentDir)
            initialCwd = process.cwd()
            debug(`Automatisch ins Parent-Verzeichnis gewechselt: ${initialCwd}`)
          }
        } else {
          // Kein Argument: Versuche automatisch das richtige Verzeichnis zu finden
          // Liste alle Verzeichnisse im Parent auf (außer bekannte wie kessel, boiler_plate_A)
          const knownDirs = ["kessel-cli", "kessel-boilerplate", ".git", "node_modules"]
          let foundProjectDir = null
          
          try {
            const parentEntries = fs.readdirSync(parentDir, { withFileTypes: true })
            const projectDirs = parentEntries
              .filter(entry => entry.isDirectory())
              .map(entry => entry.name)
              .filter(name => !knownDirs.includes(name) && !name.startsWith("."))
            
            debug(`Gefundene Verzeichnisse im Parent: ${projectDirs.join(", ")}`)
            
            // Wenn genau ein Verzeichnis gefunden wurde, verwende es
            if (projectDirs.length === 1) {
              foundProjectDir = path.join(parentDir, projectDirs[0])
              debug(`Einziges Projekt-Verzeichnis gefunden: ${foundProjectDir}`)
            } else if (projectDirs.length > 1) {
              // Mehrere Verzeichnisse: Versuche das neueste zu finden (wahrscheinlich das aktuelle)
              // Sortiere nach Änderungsdatum (neuestes zuerst)
              const dirsWithStats = projectDirs.map(name => {
                const dirPath = path.join(parentDir, name)
                try {
                  const stats = fs.statSync(dirPath)
                  return { name, path: dirPath, mtime: stats.mtime }
                } catch {
                  return null
                }
              }).filter(Boolean)
              
              if (dirsWithStats.length > 0) {
                dirsWithStats.sort((a, b) => b.mtime - a.mtime)
                foundProjectDir = dirsWithStats[0].path
                debug(`Neuestes Projekt-Verzeichnis gefunden: ${foundProjectDir}`)
              }
            }
            
            if (foundProjectDir && fs.existsSync(foundProjectDir)) {
              initialCwd = foundProjectDir
              process.chdir(initialCwd)
              debug(`Automatisch Projekt-Verzeichnis erkannt: ${initialCwd}`)
            } else {
              // Kein Projekt-Verzeichnis gefunden: Verwende Parent
              process.chdir(parentDir)
              initialCwd = process.cwd()
              debug(`Kein Projekt-Verzeichnis gefunden, verwende Parent: ${initialCwd}`)
              debug(`⚠️  Kein Projektname-Argument gegeben, verwende Parent-Verzeichnis`)
              debug(`💡 Tipp: Rufe kessel aus dem Projekt-Verzeichnis auf oder gib den Namen als Argument`)
            }
          } catch (error) {
            // Fehler beim Lesen des Parent-Verzeichnisses: Verwende Parent
            process.chdir(parentDir)
            initialCwd = process.cwd()
            debug(`Fehler beim Lesen des Parent-Verzeichnisses: ${error.message}`)
            debug(`Verwende Parent-Verzeichnis: ${initialCwd}`)
          }
        }
      }
  }
  
  // Sicherstellen, dass wir IMMER im initialCwd bleiben
  // Falls irgendwo ein Verzeichniswechsel stattfindet, wechseln wir zurück
  const ensureCwd = () => {
    const currentCwd = process.cwd()
    if (currentCwd !== initialCwd) {
      process.chdir(initialCwd)
    }
  }
  
  // Zeige immer das initiale Verzeichnis an (auch ohne --verbose)
  console.log(chalk.dim(`📁 Arbeitsverzeichnis: ${initialCwd}`))
  debug(`Initiales Verzeichnis: ${initialCwd}`)
  debug(`Script-Verzeichnis: ${scriptDir}`)
  
  // Stelle sicher, dass wir im richtigen Verzeichnis sind
  ensureCwd()

  // ========================================================================
  // PHASE 1: Pre-Checks (0-20%)
  // ========================================================================
  
  console.log(chalk.cyan.bold("\n🔍 Pre-Checks\n"))
  
  let githubToken = null
  let packageManager = null
  let supabaseSetup = null
  let secretsSetup = null
  
  try {
    // 1. GitHub CLI Check (0-5%)
    updateProgress(progressBar, 0, "GitHub CLI prüfen...")
    githubToken = await checkGitHubCLI(progressBar)
    console.log(chalk.green("✓ GitHub CLI bereit\n"))
    
    // 2. Vercel CLI Check (5-10%)
    updateProgress(progressBar, 5, "Vercel CLI prüfen...")
    await checkVercelCLI(progressBar)
    console.log(chalk.green("✓ Vercel CLI bereit\n"))
    
    // 3. Package Manager Check (10-12%)
    updateProgress(progressBar, 10, "Package Manager prüfen...")
    packageManager = await checkPackageManager(progressBar)
    console.log(chalk.green(`✓ Package Manager bereit (${packageManager.name})\n`))
    
    // 4. Supabase CLI Check (12-15%)
    updateProgress(progressBar, 12, "Supabase CLI prüfen...")
    await checkSupabaseCLI(progressBar)
    console.log(chalk.green("✓ Supabase CLI bereit\n"))
    
    // 5. Supabase Setup (15-20%)
    updateProgress(progressBar, 15, "Supabase Setup...")
    supabaseSetup = await setupSupabase(progressBar, initialCwd)
    console.log(chalk.green("✓ Supabase Setup abgeschlossen\n"))
    
    // 6. Secrets Setup (20%)
    updateProgress(progressBar, 20, "Secrets Setup...")
    secretsSetup = await setupSecrets(progressBar, supabaseSetup)
    if (secretsSetup) {
      console.log(chalk.green("✓ Secrets Setup abgeschlossen\n"))
    } else {
      console.log(chalk.dim("Secrets Setup übersprungen\n"))
    }
    
    updateProgress(progressBar, 20, "Pre-Checks abgeschlossen")
    console.log(chalk.green.bold("✅ Alle Pre-Checks erfolgreich\n"))
  } catch (error) {
    completeProgress(progressBar, "Pre-Checks fehlgeschlagen")
    console.error(chalk.red.bold("\n❌ Pre-Check Fehler:"))
    console.error(chalk.red(error.message))
    process.exit(1)
  }
  
  // Legacy-Fallback: Lade SERVICE_ROLE_KEY automatisch aus boiler_plate_A/.env (für Rückwärtskompatibilität)
  const autoServiceRoleKey = loadServiceRoleKey()
  if (autoServiceRoleKey && !secretsSetup?.serviceRoleKey) {
    debug(`SERVICE_ROLE_KEY automatisch geladen aus: ${BOILERPLATE_ENV_PATH}`)
    console.log(chalk.green("✓ SERVICE_ROLE_KEY automatisch geladen aus boiler_plate_A/.env"))
    // Verwende Legacy-Wert falls kein Secrets Setup vorhanden
    if (!secretsSetup) {
      secretsSetup = {
        serviceRoleKey: autoServiceRoleKey,
        vaultUrl: config.defaultSupabaseUrl,
      }
    }
  }

  // Legacy-Fallback: Lade GitHub Token automatisch aus GitHub CLI (für Rückwärtskompatibilität)
  const autoGitHubToken = loadGitHubToken()
  if (autoGitHubToken && !githubToken) {
    debug("GitHub Token automatisch geladen aus GitHub CLI (gh auth token)")
    console.log(chalk.green("✓ GitHub Token automatisch geladen aus GitHub CLI"))
    githubToken = autoGitHubToken
  }

  // Bestimme Projektname: Wenn kein Argument, verwende aktuellen Ordnernamen
  // WICHTIG: Verwende initialCwd, nicht process.cwd() (könnte sich geändert haben)
  // Prüfe auch nochmal aktuelles Verzeichnis zur Sicherheit
  const currentCwd = process.cwd()
  const currentDirName = path.basename(initialCwd)
  
  // Fallback: Wenn initialCwd nicht das aktuelle Verzeichnis ist, verwende aktuelles Verzeichnis
  const actualDirName = (initialCwd === currentCwd) ? currentDirName : path.basename(currentCwd)
  
  // Normalisiere Ordnername (kann Unterstriche enthalten, aber Projektname sollte Bindestriche haben)
  const normalizedCurrentDirName = actualDirName.replace(/_/g, "-").toLowerCase()
  const defaultProjectName = projectNameArg || normalizedCurrentDirName || "mein-neues-projekt"
  
  debug(`Initiales Verzeichnis: ${initialCwd}`)
  debug(`Aktuelles Verzeichnis: ${currentCwd}`)
  debug(`Aktueller Ordnername: ${actualDirName} (normalisiert: ${normalizedCurrentDirName})`)
  debug(`Standard-Projektname: ${defaultProjectName}`)
  
  // ========================================================================
  // PHASE 2: Projekt-Setup (20-40%)
  // ========================================================================
  
  console.log(chalk.cyan.bold("\n📦 Projekt-Setup\n"))
  
  // 1. Projektname bestimmen
  let projectName = null
  
  // Wenn Projektname als Argument übergeben wurde und gültig ist, verwende ihn direkt
  if (projectNameArg && /^[a-z0-9-]+$/.test(projectNameArg)) {
    projectName = projectNameArg
    updateProgress(progressBar, 20, "Projektname verwendet...")
    console.log(chalk.green(`✓ Projektname: ${projectName}`))
  } else {
    // Sonst frage nach Projektname
    updateProgress(progressBar, 20, "Projektname abfragen...")
    const { projectName: promptedProjectName } = await inquirer.prompt([
      {
        type: "input",
        name: "projectName",
        message: "Wie lautet der Name deines Projekts?",
        default: defaultProjectName,
        validate: (input) => {
          if (/^[a-z0-9-]+$/.test(input)) return true
          return "Projektname darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten."
        },
      },
    ])
    projectName = promptedProjectName
  }

  // Verwende Werte aus Pre-Checks
  const vaultServiceRoleKey = secretsSetup?.serviceRoleKey || autoServiceRoleKey
  const vaultSupabaseUrl = secretsSetup?.vaultUrl || config.defaultSupabaseUrl

  // 2. Schema im Shared Supabase-Projekt erstellen
  updateProgress(progressBar, 25, "Supabase Schema konfigurieren...")
  
  console.log(chalk.blue("\n📊 Multi-Tenant Setup: Erstelle Schema im Shared-Projekt..."))
  
  // Lade Shared-Projekt-Konfiguration
  const sharedProject = config.sharedSupabaseProject || {
    url: "https://ufqlocxqizmiaozkashi.supabase.co",
    projectRef: "ufqlocxqizmiaozkashi",
  }
  
  const appSupabaseUrl = sharedProject.url
  const projectRef = sharedProject.projectRef
  
  // Normalisiere Projektname für Schema (Postgres erlaubt keine Bindestriche in Schema-Namen)
  const schemaName = projectName.replace(/-/g, "_").toLowerCase()
  
  console.log(chalk.dim(`   Shared-Projekt: ${projectRef}`))
  console.log(chalk.dim(`   Schema-Name: ${schemaName}`))
  
  // Versuche Anon Key vom Shared-Projekt abzurufen
  console.log(chalk.blue("🔑 Rufe Anon Key vom Shared-Projekt ab..."))
  let appSupabaseAnonKey = await fetchAnonKeyFromSupabase(projectRef, debug)
  
  if (!appSupabaseAnonKey) {
    // Fallback zu manueller Eingabe
    console.log(chalk.yellow("⚠️  Konnte Anon Key nicht automatisch abrufen"))
    const keyAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "appSupabaseAnonKey",
        message: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (vom Shared-Projekt ${projectRef}):`,
        validate: (input) => input.length > 0 || "Publishable Key ist erforderlich.",
      },
    ])
    appSupabaseAnonKey = keyAnswer.appSupabaseAnonKey
  } else {
    console.log(chalk.green("✓ Anon Key automatisch abgerufen"))
  }
  
  // Versuche Service Role Key vom Shared-Projekt abzurufen
  console.log(chalk.blue("🔑 Rufe Service Role Key vom Shared-Projekt ab..."))
  let appSupabaseServiceRoleKey = await fetchServiceRoleKeyFromSupabase(projectRef, debug)
  
  if (!appSupabaseServiceRoleKey) {
    // Fallback: Verwende Vault Service Role Key (falls Shared-Projekt = Vault)
    console.log(chalk.yellow("⚠️  Konnte Service Role Key nicht automatisch abrufen"))
    console.log(chalk.dim("   → Verwende Vault Service Role Key als Fallback"))
    appSupabaseServiceRoleKey = vaultServiceRoleKey
  } else {
    console.log(chalk.green("✓ Service Role Key automatisch abgerufen"))
  }

  // 3. Dependencies-Installation
  updateProgress(progressBar, 30, "Dependencies-Installation konfigurieren...")
  
  const { installDeps } = await inquirer.prompt([
    {
      type: "confirm",
      name: "installDeps",
      message: "Dependencies automatisch installieren?",
      default: true,
    },
  ])

  // ========================================================================
  // PHASE 3: Projekt-Verknüpfung (40-60%)
  // ========================================================================
  
  // Wenn Projektname = aktueller Ordnername (normalisiert), klone direkt ins aktuelle Verzeichnis
  // Prüfe sowohl den normalisierten als auch den originalen Ordnernamen
  // WICHTIG: Verwende aktuelles Verzeichnis (könnte sich geändert haben)
  const normalizedProjectName = projectName.replace(/_/g, "-").toLowerCase()
  
  // Prüfe ob Projektname dem Ordnernamen entspricht
  const actualCwd = process.cwd()
  const actualCwdBasename = path.basename(actualCwd)
  const normalizedActualCwdBasename = actualCwdBasename.replace(/_/g, "-").toLowerCase()
  
  const isCurrentDir = (
    normalizedProjectName === normalizedCurrentDirName || 
    normalizedProjectName === normalizedActualCwdBasename ||
    projectName === actualDirName || 
    projectName === actualCwdBasename
  ) && !projectNameArg
  
  // Verwende aktuelles Verzeichnis für projectPath
  // WICHTIG: Verwende let, damit wir es später überschreiben können
  let projectPath = isCurrentDir 
    ? actualCwd 
    : path.resolve(actualCwd, projectName)
  
  debug(`Projektname: ${projectName} (normalisiert: ${normalizedProjectName})`)
  debug(`Aktuelles Verzeichnis: ${actualCwd}`)
  debug(`Aktueller Ordnername: ${actualCwdBasename} (normalisiert: ${normalizedActualCwdBasename})`)
  debug(`Verwendet aktuelles Verzeichnis: ${isCurrentDir}`)
  debug(`Projekt-Pfad: ${projectPath}`)

  // Prüfe ob Verzeichnis bereits existiert (nur wenn neuer Ordner erstellt wird)
  if (!isCurrentDir && fs.existsSync(projectPath)) {
    // Prüfe ob das Verzeichnis im Parent-Verzeichnis existiert (User möchte vielleicht dort erstellen)
    const parentDir = path.dirname(actualCwd)
    const projectPathInParent = path.resolve(parentDir, projectName)
    
    if (fs.existsSync(projectPathInParent)) {
      // Verzeichnis existiert im Parent - frage ob dort erstellt werden soll
      console.log(chalk.yellow(`\n⚠️  Das Verzeichnis "${projectName}" existiert bereits im aktuellen Verzeichnis.`))
      console.log(chalk.dim(`   Aktuelles Verzeichnis: ${actualCwd}`))
      console.log(chalk.dim(`   Gefundenes Verzeichnis: ${projectPathInParent}`))
      
      const useParentAnswer = await inquirer.prompt([
        {
          type: "confirm",
          name: "useParent",
          message: `Soll das Projekt im Verzeichnis "${projectPathInParent}" erstellt werden?`,
          default: true,
        },
      ])
      
      if (useParentAnswer.useParent) {
        // Verwende das Verzeichnis im Parent
        const projectPathFinal = projectPathInParent
        const files = fs.readdirSync(projectPathFinal).filter(f => f !== ".git" && f !== ".cursor")
        if (files.length > 0) {
          console.log(chalk.yellow(`⚠️  Das Verzeichnis ist nicht leer (${files.length} Dateien/Ordner gefunden)`))
          const continueAnswer = await inquirer.prompt([
            {
              type: "confirm",
              name: "continue",
              message: "Möchtest du trotzdem fortfahren? (Bestehende Dateien werden überschrieben)",
              default: false,
            },
          ])
          if (!continueAnswer.continue) {
            console.log(chalk.red("Abgebrochen."))
            process.exit(0)
          }
        }
        // Überschreibe projectPath mit dem Parent-Pfad
        projectPath = projectPathFinal
        debug(`Verwende Parent-Verzeichnis: ${projectPath}`)
      } else {
        console.error(
          chalk.red.bold(`\n❌ Abgebrochen. Das Verzeichnis "${projectName}" existiert bereits.\n`)
        )
        process.exit(1)
      }
    } else {
      // Verzeichnis existiert im aktuellen Verzeichnis - frage ob überschreiben
      console.log(chalk.yellow(`\n⚠️  Das Verzeichnis "${projectName}" existiert bereits.`))
      console.log(chalk.dim(`   Pfad: ${projectPath}`))
      
      const files = fs.readdirSync(projectPath).filter(f => f !== ".git" && f !== ".cursor" && f !== "node_modules")
      if (files.length > 0) {
        console.log(chalk.dim(`   Inhalt: ${files.length} Dateien/Ordner (ohne node_modules)`))
      }
      
      const overwriteAnswer = await inquirer.prompt([
        {
          type: "confirm",
          name: "overwrite",
          message: "Möchtest du das Template in dieses Verzeichnis installieren? (Bestehende Dateien werden überschrieben, node_modules bleibt erhalten)",
          default: false,
        },
      ])
      
      if (!overwriteAnswer.overwrite) {
        console.log(chalk.red("Abgebrochen."))
        process.exit(0)
      }
      
      debug(`Überschreibe bestehendes Verzeichnis: ${projectPath}`)
    }
  }
  
  // Wenn aktuelles Verzeichnis verwendet wird, prüfe ob es leer ist (außer .git)
  if (isCurrentDir) {
    const files = fs.readdirSync(projectPath).filter(f => f !== ".git" && f !== ".cursor")
    if (files.length > 0) {
      console.log(chalk.yellow(`⚠️  Das aktuelle Verzeichnis ist nicht leer (${files.length} Dateien/Ordner gefunden)`))
      const continueAnswer = await inquirer.prompt([
        {
          type: "confirm",
          name: "continue",
          message: "Möchtest du trotzdem fortfahren? (Bestehende Dateien werden überschrieben)",
          default: false,
        },
      ])
      if (!continueAnswer.continue) {
        console.log(chalk.red("Abgebrochen."))
        process.exit(0)
      }
    }
  }

  if (isCurrentDir) {
    console.log(chalk.yellow(`\n📦 Erstelle Projekt "${projectName}" im aktuellen Verzeichnis...\n`))
  } else {
    console.log(chalk.yellow(`\n📦 Erstelle Projekt "${projectName}"...\n`))
  }

  try {
    // ========================================================================
    // PHASE 4: Projekt-Erstellung (40-60%)
    // ========================================================================
    
    // 1. GitHub Repository Erstellung
    updateProgress(progressBar, 40, "Erstelle GitHub Repository...")
    console.log(chalk.blue("\n1/11: Erstelle GitHub Repository..."))
    const octokit = new Octokit({ auth: githubToken })

    try {
      await octokit.rest.repos.createForAuthenticatedUser({
        name: projectName,
        private: true,
        auto_init: false,
      })
      console.log(chalk.green("✓ GitHub Repository erstellt"))
    } catch (repoError) {
      // Prüfe ob Repository bereits existiert
      if (repoError.status === 422 && repoError.message?.includes("already exists")) {
        console.log(chalk.yellow(`⚠️  Repository "${projectName}" existiert bereits`))
        
        // Frage ob Repository gelöscht werden soll
        const deleteAnswer = await inquirer.prompt([
          {
            type: "confirm",
            name: "deleteRepo",
            message: `Soll das bestehende Repository "${projectName}" gelöscht werden?`,
            default: false,
          },
        ])

              if (deleteAnswer.deleteRepo) {
                try {
                  const { data: userData } = await octokit.rest.users.getAuthenticated()
                  await octokit.rest.repos.delete({
                    owner: userData.login,
                    repo: projectName,
                  })
                  console.log(chalk.green(`✓ Altes Repository "${projectName}" gelöscht`))
                  
                  // Erstelle Repository neu
                  await octokit.rest.repos.createForAuthenticatedUser({
                    name: projectName,
                    private: true,
                    auto_init: false,
                  })
                  console.log(chalk.green("✓ GitHub Repository erstellt"))
                } catch (deleteError) {
                  // Wenn Löschen fehlschlägt (z.B. keine Admin-Rechte), verwende bestehendes Repository
                  if (deleteError.status === 403 || deleteError.message?.includes("admin rights")) {
                    console.log(chalk.yellow(`⚠️  Repository kann nicht gelöscht werden (keine Admin-Rechte)`))
                    console.log(chalk.blue(`✓ Verwende bestehendes Repository "${projectName}"`))
                  } else {
                    throw new Error(`Fehler beim Löschen/Erstellen des Repositories: ${deleteError.message}`)
                  }
                }
              } else {
                // Verwende bestehendes Repository
                console.log(chalk.blue(`✓ Verwende bestehendes Repository "${projectName}"`))
              }
      } else {
        throw repoError
      }
    }

    // 2. Klonen des Templates
    updateProgress(progressBar, 45, "Klonen Template...")
    // Verwende git clone statt degit für private Repositories mit Authentifizierung
    const templateRepo = config.defaultTemplateRepo
    const templateVersion = options.templateVersion || "main" // Standard: main (latest)
    
    console.log(chalk.blue(`\n2/11: Klone Template von ${templateRepo}...`))
    if (templateVersion !== "main") {
      console.log(chalk.dim(`   Version: ${templateVersion}`))
    }

    // Verwende git clone mit GitHub Token für private Repositories
    const gitUrl = `https://${githubToken}@github.com/${templateRepo}.git`
    const branch = templateVersion === "main" ? "main" : templateVersion
    
    let cloneSuccess = false
    
    try {
      // Prüfe ob Verzeichnis bereits existiert und nicht leer ist
      if (fs.existsSync(projectPath)) {
        const existingFiles = fs.readdirSync(projectPath).filter(f => f !== ".git" && f !== ".cursor")
        if (existingFiles.length > 0) {
          debug(`Verzeichnis existiert bereits mit ${existingFiles.length} Dateien`)
          // Verzeichnis ist nicht leer - überspringe git clone, verwende degit direkt
          throw new Error("Verzeichnis nicht leer")
        }
      }
      
      execSync(
        `git clone --depth 1 --branch ${branch} ${gitUrl} ${projectPath}`,
        {
          stdio: "pipe",
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: "0", // Verhindere interaktive Prompts
          },
        }
      )
      console.log(chalk.green(`✓ Template geklont (Version: ${templateVersion})`))
      
      // Prüfe ob Dateien geklont wurden
      const files = fs.readdirSync(projectPath)
      if (files.length === 0 || (files.length === 1 && files[0] === ".git")) {
        throw new Error("Template wurde geklont, aber keine Dateien gefunden!")
      }
      
      debug(`Geklonte Dateien: ${files.length} Dateien gefunden`)
      cloneSuccess = true
      
      // Entferne .git Verzeichnis (degit macht das auch)
      const gitPath = path.join(projectPath, ".git")
      if (fs.existsSync(gitPath)) {
        fs.rmSync(gitPath, { recursive: true, force: true })
      }
    } catch (gitError) {
      // Fallback zu degit falls git clone fehlschlägt oder Verzeichnis nicht leer ist
      debug(`Git clone übersprungen: ${gitError.message}`)
      if (gitError.message === "Verzeichnis nicht leer") {
        console.log(chalk.blue("📦 Verwende degit für bestehendes Verzeichnis..."))
      } else {
        console.log(chalk.yellow("⚠️  Git clone fehlgeschlagen, versuche degit..."))
      }
      
      try {
        // Verwende degit mit Branch-Name (nicht Commit-Hash)
        // degit unterstützt Branch-Namen direkt
        const templateSource = `${templateRepo}#${branch}`
        
        debug(`Degit Template Source: ${templateSource}`)
        
        const emitter = degit(templateSource, {
          cache: false,
          force: true,
        })
        
        await emitter.clone(projectPath)
        console.log(chalk.green(`✓ Template geklont (Version: ${templateVersion})`))
        cloneSuccess = true
      } catch (degitError) {
        // Wenn auch degit fehlschlägt, werfe Fehler
        throw new Error(`Template konnte nicht geklont werden. Git: ${gitError.message}, Degit: ${degitError.message}`)
      }
    }
    
    if (!cloneSuccess) {
      throw new Error("Template-Klonen ist fehlgeschlagen")
    }

    // 3. Bootstrap-Umgebungsvariablen (.env für pull-env Skript)
    updateProgress(progressBar, 50, "Konfiguriere Bootstrap-Credentials...")
    console.log(chalk.blue("\n3/11: Konfiguriere Bootstrap-Credentials (.env)..."))
    console.log(chalk.dim("   → Zentrale Supabase URL für Vault-Zugriff"))
    const bootstrapEnvContent = `# Bootstrap-Credentials für Vault-Zugriff
# WICHTIG: Dies ist die URL des ZENTRALEN Supabase-Projekts (für Secrets)
NEXT_PUBLIC_SUPABASE_URL=${vaultSupabaseUrl}
SERVICE_ROLE_KEY=${vaultServiceRoleKey}
`
    fs.writeFileSync(path.join(projectPath, ".env"), bootstrapEnvContent)
    console.log(chalk.green("✓ .env erstellt (Zentrale Supabase URL + SERVICE_ROLE_KEY)"))

    // 4. Public-Umgebungsvariablen (.env.local für Next.js)
    updateProgress(progressBar, 52, "Konfiguriere Public-Credentials...")
    console.log(chalk.blue("\n4/11: Konfiguriere Public-Credentials (.env.local)..."))
    console.log(chalk.dim("   → Shared Supabase-Projekt + Schema-Name"))
    // Entferne ANSI Escape Codes aus den Keys (falls vorhanden)
    const cleanAnonKey = appSupabaseAnonKey.replace(/\x1b\[[0-9;]*m/g, '').replace(/\u001b\[\d+m/g, '').trim()
    const cleanServiceRoleKey = appSupabaseServiceRoleKey.replace(/\x1b\[[0-9;]*m/g, '').replace(/\u001b\[\d+m/g, '').trim()
    
    const envLocalContent = `# Public-Credentials für Next.js Client
# WICHTIG: Multi-Tenant Architektur - Alle Projekte teilen sich ein Supabase-Projekt
# Jedes Projekt hat ein eigenes Schema für Daten-Isolation
NEXT_PUBLIC_SUPABASE_URL=${appSupabaseUrl}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${cleanAnonKey}
NEXT_PUBLIC_PROJECT_SCHEMA=${schemaName}

# Service Role Key für Server-Side Operationen (User-Erstellung, etc.)
# WICHTIG: Verwende den Service Role Key für das Shared-Projekt
SUPABASE_SERVICE_ROLE_KEY=${cleanServiceRoleKey}
`
    // Schreibe .env.local (bereits bereinigt)
    fs.writeFileSync(path.join(projectPath, ".env.local"), envLocalContent)
    console.log(chalk.green("✓ .env.local erstellt (Shared Supabase URL + Schema-Name)"))

    // 4.5. Schema im Shared-Projekt erstellen (über Supabase CLI)
    updateProgress(progressBar, 53, "Erstelle Schema im Shared-Projekt...")
    console.log(chalk.blue("\n4.5/11: Erstelle Schema im Shared-Projekt..."))
    console.log(chalk.dim(`   → Schema: ${schemaName}`))
    
    // Schema wird automatisch beim Migration-Lauf erstellt
    // Das Migration-Script erstellt das Schema, falls es nicht existiert
    console.log(chalk.dim(`   → Schema wird beim Migration-Lauf automatisch erstellt`))

    // 5. Git initialisieren und Remote setzen
    updateProgress(progressBar, 54, "Initialisiere Git...")
    console.log(chalk.blue("\n5/11: Initialisiere Git..."))
    
    // Prüfe ob Git bereits initialisiert ist
    const gitDir = path.join(projectPath, ".git")
    if (!fs.existsSync(gitDir)) {
      execSync("git init", { cwd: projectPath, stdio: "ignore" })
    }

    const { data: userData } = await octokit.rest.users.getAuthenticated()
    const remoteUrl = `https://github.com/${userData.login}/${projectName}.git`

    // Prüfe ob Remote bereits existiert
    try {
      const existingRemote = execSync("git remote get-url origin", {
        cwd: projectPath,
        stdio: "pipe",
        encoding: "utf-8",
      }).trim()
      
      if (existingRemote === remoteUrl) {
        console.log(chalk.green("✓ Git Remote bereits korrekt konfiguriert"))
      } else {
        // Remote existiert, aber mit anderer URL - entferne und füge neu hinzu
        execSync("git remote remove origin", { cwd: projectPath, stdio: "ignore" })
        execSync(`git remote add origin ${remoteUrl}`, {
          cwd: projectPath,
          stdio: "ignore",
        })
        console.log(chalk.green("✓ Git Remote aktualisiert"))
      }
    } catch (remoteError) {
      // Remote existiert nicht - füge hinzu
      execSync(`git remote add origin ${remoteUrl}`, {
        cwd: projectPath,
        stdio: "ignore",
      })
      console.log(chalk.green("✓ Git Remote gesetzt"))
    }

    // 6. Abhängigkeiten installieren
    if (installDeps) {
      updateProgress(progressBar, 56, "Installiere Abhängigkeiten...")
      const pmName = packageManager?.name || "pnpm"
      const installCmd = packageManager?.installCommand || "pnpm install"
      console.log(chalk.blue(`\n6/11: Installiere Abhängigkeiten mit ${pmName}...`))
      console.log(chalk.dim("(Das kann einige Minuten dauern...)\n"))
      execSync(installCmd, { cwd: projectPath, stdio: "inherit" })
      console.log(chalk.green("\n✓ Dependencies installiert"))
    } else {
      console.log(chalk.yellow("\n6/11: Übersprungen (Dependencies nicht installiert)"))
    }

    // 7. Supabase Link zum Shared-Projekt
    let supabaseLinked = false
    
    if (appSupabaseUrl && appSupabaseAnonKey) {
      updateProgress(progressBar, 55, "Verlinke Shared Supabase-Projekt...")
      console.log(chalk.blue("\n7/11: Verlinke Shared Supabase-Projekt..."))
      console.log(chalk.dim(`   → Project Ref: ${projectRef}`))
      try {
        // Führe supabase link aus (zum Shared-Projekt)
        execSync(`supabase link --project-ref ${projectRef}`, {
          cwd: projectPath,
          stdio: "pipe",
        })
        console.log(chalk.green(`✓ Shared Supabase-Projekt verlinkt (${projectRef})`))
        supabaseLinked = true
      } catch (linkError) {
        // Link-Fehler sind nicht kritisch - das Projekt funktioniert trotzdem
        console.log(chalk.yellow("⚠️  Supabase Link fehlgeschlagen (nicht kritisch)"))
        debug(`Link Error: ${linkError.message}`)
      }
    } else {
      console.log(chalk.yellow("\n7/11: Übersprungen (kein Supabase-Projekt konfiguriert)"))
    }

    // 8. Datenbank-Migrationen im Schema anwenden
    updateProgress(progressBar, 56, "Wende Datenbank-Migrationen im Schema an...")
    console.log(chalk.blue("\n8/11: Wende Datenbank-Migrationen an..."))
    console.log(chalk.dim(`   → Schema: ${schemaName}`))
    console.log(chalk.dim("   → Erstelle Tabellen: roles, profiles, themes, bugs, features..."))
    
    try {
      // Warte kurz, damit das Schema vollständig erstellt ist
      await new Promise((resolve) => setTimeout(resolve, 1000))
      
      // Verwende das Migration-Script aus der Boilerplate
      const migrationScript = path.join(projectPath, "scripts", "apply-migrations-to-schema.mjs")
      
      if (fs.existsSync(migrationScript)) {
        // Setze Environment-Variablen für das Script
        // DB-Password aus config.json oder ENV holen
        const dbPassword = config.sharedSupabaseProject?.dbPassword || process.env.SUPABASE_DB_PASSWORD
        
        if (!dbPassword) {
          console.log(chalk.yellow("⚠️  SUPABASE_DB_PASSWORD nicht gefunden"))
          console.log(chalk.dim("   → Migrationen können nicht automatisch ausgeführt werden"))
          console.log(chalk.dim("   → Setze SUPABASE_DB_PASSWORD in config.json oder als ENV-Variable"))
          console.log(chalk.dim("   → Oder führe Migrationen manuell im Supabase Dashboard aus"))
        }
        
        const env = {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: appSupabaseUrl,
          SERVICE_ROLE_KEY: appSupabaseServiceRoleKey, // Verwende Service Role Key vom Shared-Projekt
          SUPABASE_SERVICE_ROLE_KEY: appSupabaseServiceRoleKey, // Auch als SUPABASE_SERVICE_ROLE_KEY für Scripts
          NEXT_PUBLIC_PROJECT_SCHEMA: schemaName,
          SUPABASE_PROJECT_REF: projectRef,
          SUPABASE_DB_PASSWORD: dbPassword, // DB-Password für direkte PostgreSQL-Verbindung
        }
        
        try {
          execSync(`node scripts/apply-migrations-to-schema.mjs ${schemaName}`, {
            cwd: projectPath,
            stdio: "inherit",
            env: env,
          })
          console.log(chalk.green("✓ Datenbank-Migrationen im Schema angewendet"))
        } catch (migrationError) {
          console.log(chalk.yellow("⚠️  Migrationen konnten nicht automatisch angewendet werden"))
          debug(`Migration Error: ${migrationError.message}`)
          console.log(chalk.dim(`   → Führe manuell aus: node scripts/apply-migrations-to-schema.mjs ${schemaName}`))
          console.log(chalk.dim(`   → Oder verwende Supabase Dashboard SQL Editor`))
        }
      } else {
        console.log(chalk.yellow("⚠️  Migration-Script nicht gefunden"))
        console.log(chalk.dim(`   → Erstelle Schema manuell: CREATE SCHEMA "${schemaName}";`))
        console.log(chalk.dim(`   → Dann führe Migrationen im Supabase Dashboard aus`))
      }
    } catch (migrationError) {
      console.log(chalk.yellow("⚠️  Migrationen konnten nicht automatisch angewendet werden"))
      debug(`Migration Error: ${migrationError.message}`)
      console.log(chalk.dim(`   → Führe manuell aus: CREATE SCHEMA "${schemaName}"; dann Migrationen`))
    }

    // 9. Standard-User anlegen (Shared Auth - nur einmal, falls nicht existiert)
    if (supabaseLinked && installDeps) {
      updateProgress(progressBar, 57, "Prüfe Standard-User...")
      console.log(chalk.blue("\n9/11: Prüfe Standard-User (Shared Auth)..."))
      console.log(chalk.dim("   → admin@local / admin123 (wird nur einmal erstellt)"))
      console.log(chalk.dim("   → user@local / user123 (wird nur einmal erstellt)"))
      
      try {
        // Warte kurz, damit die Migrationen vollständig angewendet sind
        await new Promise((resolve) => setTimeout(resolve, 2000))
        
        // Erstelle Supabase Client für User-Check
        const { createClient: createSupabaseClient } = await import("@supabase/supabase-js")
        const supabaseAdmin = createSupabaseClient(
          appSupabaseUrl,
          appSupabaseServiceRoleKey, // Verwende Service Role Key vom Shared-Projekt
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          }
        )
        
        // Prüfe ob Standard-User bereits existieren
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        const adminExists = existingUsers?.users?.some(u => u.email === "admin@local")
        const userExists = existingUsers?.users?.some(u => u.email === "user@local")
        
        if (adminExists && userExists) {
          console.log(chalk.green("✓ Standard-User existieren bereits (Shared Auth)"))
        } else {
          // Führe das create-test-users Script aus (erstellt nur fehlende User)
          const createUsersScript = path.join(projectPath, "scripts", "create-test-users.mjs")
          if (fs.existsSync(createUsersScript)) {
            // Setze Environment-Variablen für das Script
            const userEnv = {
              ...process.env,
              NEXT_PUBLIC_SUPABASE_URL: appSupabaseUrl,
              SUPABASE_SERVICE_ROLE_KEY: appSupabaseServiceRoleKey, // Verwende Service Role Key vom Shared-Projekt
            }
            
            try {
              execSync("node scripts/create-test-users.mjs", {
                cwd: projectPath,
                stdio: "inherit", // Zeige Output für Debugging
                env: userEnv,
              })
              console.log(chalk.green("✓ Standard-User erstellt/aktualisiert"))
            } catch (userScriptError) {
              console.log(chalk.yellow("⚠️  User-Script fehlgeschlagen"))
              debug(`User Script Error: ${userScriptError.message}`)
              console.log(chalk.dim("   → Führe manuell aus: pnpm run setup:users"))
            }
          } else {
            console.log(chalk.yellow("⚠️  create-test-users.mjs nicht gefunden"))
            debug(`Script nicht gefunden: ${createUsersScript}`)
          }
        }
        
        console.log(chalk.dim("   Login: admin@local / admin123 (Admin-Rolle)"))
        console.log(chalk.dim("   Login: user@local / user123 (User-Rolle)"))
      } catch (userError) {
        console.log(chalk.yellow("⚠️  User-Check konnte nicht durchgeführt werden"))
        debug(`User Check Error: ${userError.message}`)
        console.log(chalk.dim("   → Führe manuell aus: pnpm run setup:users"))
      }
    } else if (!supabaseLinked) {
      console.log(chalk.yellow("\n9/11: Übersprungen (Supabase nicht verlinkt)"))
    } else if (!installDeps) {
      console.log(chalk.yellow("\n9/11: Übersprungen (Dependencies nicht installiert)"))
    }

    // 10. Vercel Link (optional)
    updateProgress(progressBar, 58, "Verlinke Vercel-Projekt...")
    console.log(chalk.blue("\n10/11: Verlinke Vercel-Projekt (optional)..."))
    try {
      // Prüfe ob Vercel CLI verfügbar ist
      let vercelAvailable = false
      try {
        execSync("vercel --version", { stdio: "pipe" })
        vercelAvailable = true
      } catch {
        // Vercel CLI nicht verfügbar
        console.log(chalk.yellow("⚠️  Vercel CLI nicht gefunden"))
        console.log(chalk.dim("   Installiere mit: npm install -g vercel"))
        console.log(chalk.dim("   Oder besuche: https://vercel.com/login"))
      }

      if (vercelAvailable) {
        // Prüfe ob User eingeloggt ist
        let vercelAuthenticated = false
        try {
          execSync("vercel whoami", { stdio: "pipe" })
          vercelAuthenticated = true
        } catch {
          console.log(chalk.yellow("⚠️  Nicht bei Vercel eingeloggt"))
          console.log(chalk.dim("   Login mit: vercel login"))
          console.log(chalk.dim("   Oder besuche: https://vercel.com/login"))
        }

        if (vercelAuthenticated) {
          // Frage User ob er verknüpfen möchte
          const vercelAnswer = await inquirer.prompt([
            {
              type: "confirm",
              name: "linkVercel",
              message: "Möchtest du das Projekt jetzt mit Vercel verknüpfen?",
              default: false,
            },
          ])

          if (vercelAnswer.linkVercel) {
            try {
              execSync("vercel link --yes", {
                cwd: projectPath,
                stdio: "pipe",
              })
              console.log(chalk.green("✓ Vercel-Projekt verlinkt"))
            } catch (linkError) {
              // Link-Fehler sind nicht kritisch - das Projekt funktioniert trotzdem
              console.log(chalk.yellow("⚠️  Vercel Link fehlgeschlagen (nicht kritisch)"))
              debug(`Vercel Link Error: ${linkError.message}`)
            }
          } else {
            console.log(chalk.dim("   Übersprungen (User-Auswahl)"))
          }
        }
      }
    } catch (vercelError) {
      // Vercel-Fehler sind nicht kritisch
      console.log(chalk.yellow("⚠️  Vercel-Integration übersprungen (nicht kritisch)"))
      debug(`Vercel Error: ${vercelError.message}`)
    }

    // ========================================================================
    // PHASE 5: Validierung (60-80%)
    // ========================================================================
    
    // 11. Automatische Validierung
    updateProgress(progressBar, 60, "Validiere Projekt-Setup...")
    console.log(chalk.blue("\n11/11: Validiere Projekt-Setup...\n"))
    const validationResults = await validateProject(projectPath, verbose, debug)

    // Validierungs-Ergebnisse ausgeben
    updateProgress(progressBar, 80, "Validierung abgeschlossen...")
    let hasErrors = false
    let hasWarnings = false

    if (validationResults.errors.length > 0) {
      hasErrors = true
      console.log(chalk.red.bold("\n❌ Fehler gefunden:\n"))
      validationResults.errors.forEach((error) => {
        console.log(chalk.red(`  ✗ ${error}`))
      })
    }

    if (validationResults.warnings.length > 0) {
      hasWarnings = true
      console.log(chalk.yellow.bold("\n⚠️  Warnungen:\n"))
      validationResults.warnings.forEach((warning) => {
        console.log(chalk.yellow(`  ⚠ ${warning}`))
      })
    }

    if (validationResults.success.length > 0) {
      console.log(chalk.green.bold("\n✅ Erfolgreich validiert:\n"))
      validationResults.success.forEach((item) => {
        console.log(chalk.green(`  ✓ ${item}`))
      })
    }

    // ========================================================================
    // PHASE 6: Finalisierung (80-100%)
    // ========================================================================
    
    updateProgress(progressBar, 90, "Finalisiere...")
    
    // Erfolgsmeldung
    if (hasErrors) {
      completeProgress(progressBar, "Projekt erstellt mit Fehlern")
      console.log(
        chalk.red.bold(
          `\n❌ Projekt "${projectName}" wurde erstellt, aber es wurden Fehler gefunden!\n`
        )
      )
      console.log(chalk.yellow("Bitte prüfe die Fehler oben und behebe sie manuell.\n"))
      process.exit(1)
    } else {
      completeProgress(progressBar, "Projekt erfolgreich erstellt")
      console.log(
        chalk.green.bold(`\n✨ Projekt "${projectName}" erfolgreich erstellt und validiert!\n`)
      )
      if (hasWarnings) {
        console.log(
          chalk.yellow("⚠️  Es gibt Warnungen, aber das Projekt sollte funktionieren.\n")
        )
      }
    }

          console.log(chalk.cyan("\n📋 Nächste Schritte:"))
          console.log(chalk.white(`\n  Das Projekt wurde erstellt in:`))
          console.log(chalk.cyan(`  ${projectPath}\n`))
          
          if (!isCurrentDir) {
            console.log(chalk.white(`  cd ${path.relative(process.cwd(), projectPath) || projectName}`))
          } else {
            console.log(chalk.dim(`  (Du bist bereits im Projekt-Verzeichnis)`))
          }
          if (!installDeps) {
            const installCmd = packageManager?.installCommand || "pnpm install"
            console.log(chalk.white(`  ${installCmd}`))
          }
          const devCmd = packageManager?.devCommand || "pnpm dev"
          console.log(chalk.white(`  ${devCmd}`))
          console.log(
            chalk.dim("\n💡 Tipp: Vergiss nicht, deine Supabase-Datenbank zu konfigurieren!\n")
          )
          
          // WICHTIG: Bleibe im Projekt-Verzeichnis (nicht zurück zum ursprünglichen Verzeichnis)
          // Wenn das Projekt im aktuellen Verzeichnis erstellt wurde, bleiben wir dort
          // Wenn ein neues Verzeichnis erstellt wurde, wechseln wir dorthin
          if (!isCurrentDir) {
            // Projekt wurde in neuem Verzeichnis erstellt - wechsle dorthin
            process.chdir(projectPath)
            debug(`Gewechselt ins Projekt-Verzeichnis: ${process.cwd()}`)
          } else {
            // Projekt wurde im aktuellen Verzeichnis erstellt - bleiben wir hier
            debug(`Bleibe im Projekt-Verzeichnis: ${process.cwd()}`)
          }
          
          // Stelle sicher, dass wir NICHT im kessel Verzeichnis sind
          const finalCwd = process.cwd()
          if (path.basename(finalCwd) === "kessel" || finalCwd === scriptDir) {
            // Wir sind versehentlich im kessel Verzeichnis - wechsle ins Projekt
            process.chdir(projectPath)
            debug(`Korrigiert: Gewechselt von kessel ins Projekt-Verzeichnis: ${process.cwd()}`)
          }
          
          debug(`Finales Verzeichnis: ${process.cwd()}`)
  } catch (error) {
    // WICHTIG: Stelle sicher, dass wir auch bei Fehlern wieder im ursprünglichen Verzeichnis sind
    ensureCwd()
    
    // Progress Bar bei Fehler abschließen
    completeProgress(progressBar, "Fehler aufgetreten")
    
    console.error(chalk.red.bold("\n❌ Ein Fehler ist aufgetreten:\n"))
    console.error(chalk.red(error.message))
    
    if (verbose || options.verbose) {
      console.error(chalk.dim("\nStack Trace:"))
      console.error(chalk.dim(error.stack))
    }

    // Cleanup bei Fehler
    if (fs.existsSync(projectPath)) {
      console.log(chalk.yellow("\n🧹 Räume auf..."))
      try {
        // Versuche mehrfach zu löschen (manchmal ist das Verzeichnis kurz gesperrt)
        let retries = 3
        let cleanupSuccess = false
        
        while (retries > 0 && !cleanupSuccess) {
          try {
            fs.rmSync(projectPath, { recursive: true, force: true })
            cleanupSuccess = true
            console.log(chalk.green("✓ Aufräumen abgeschlossen"))
          } catch (retryError) {
            retries--
            if (retryError.code === "EBUSY" || retryError.message?.includes("locked")) {
              if (retries > 0) {
                debug(`Verzeichnis gesperrt, warte 500ms und versuche erneut... (${retries} Versuche übrig)`)
                await new Promise(resolve => setTimeout(resolve, 500))
              } else {
                console.log(chalk.yellow(`⚠️  Verzeichnis ist gesperrt und konnte nicht gelöscht werden`))
                console.log(chalk.yellow(`Bitte lösche manuell: ${projectPath}`))
                console.log(chalk.dim(`Tipp: Schließe alle Programme die auf dieses Verzeichnis zugreifen`))
              }
            } else {
              throw retryError
            }
          }
        }
      } catch (cleanupError) {
        console.error(chalk.red(`Fehler beim Aufräumen: ${cleanupError.message}`))
        console.log(chalk.yellow(`Bitte lösche manuell: ${projectPath}`))
      }
    }

    process.exit(1)
  }
})

// Validierungs-Funktion
async function validateProject(projectPath, verbose, debug) {
  const results = {
    success: [],
    warnings: [],
    errors: [],
  }

  try {
    // 1. Prüfe .env Datei (Zentrale Supabase für Vault)
    debug("Validiere .env Datei...")
    const envPath = path.join(projectPath, ".env")
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8")
      if (envContent.includes("NEXT_PUBLIC_SUPABASE_URL") && envContent.includes("SERVICE_ROLE_KEY")) {
        // Prüfe ob es die zentrale URL ist
        if (envContent.includes("zedhieyjlfhygsfxzbze")) {
          results.success.push(".env Datei korrekt erstellt (Zentrale Supabase URL + SERVICE_ROLE_KEY für Vault)")
        } else {
          results.warnings.push(".env Datei enthält möglicherweise nicht die zentrale Supabase URL")
        }
      } else {
        results.errors.push(".env Datei fehlt erforderliche Variablen (URL oder SERVICE_ROLE_KEY)")
      }
    } else {
      results.errors.push(".env Datei wurde nicht erstellt")
    }

    // 2. Prüfe .env.local Datei (Projekt-spezifische Supabase für App)
    debug("Validiere .env.local Datei...")
    const envLocalPath = path.join(projectPath, ".env.local")
    if (fs.existsSync(envLocalPath)) {
      const envLocalContent = fs.readFileSync(envLocalPath, "utf-8")
      if (
        envLocalContent.includes("NEXT_PUBLIC_SUPABASE_URL") &&
        envLocalContent.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
      ) {
        // Prüfe dass es NICHT die zentrale URL ist
        if (!envLocalContent.includes("zedhieyjlfhygsfxzbze")) {
          results.success.push(".env.local Datei korrekt erstellt (Projekt-spezifische Supabase URL + PUBLISHABLE_KEY)")
        } else {
          results.warnings.push(".env.local enthält möglicherweise die zentrale URL statt der projekt-spezifischen")
        }
      } else {
        results.errors.push(".env.local Datei fehlt erforderliche Variablen")
      }
      // Prüfe dass SERVICE_ROLE_KEY NICHT in .env.local ist (SUPABASE_SERVICE_ROLE_KEY ist OK für Multi-Tenant)
      if (envLocalContent.includes("SERVICE_ROLE_KEY=") && !envLocalContent.includes("SUPABASE_SERVICE_ROLE_KEY=")) {
        results.errors.push("KRITISCH: SERVICE_ROLE_KEY ist in .env.local! Das ist ein Sicherheitsrisiko!")
        results.errors.push("   → Verwende SUPABASE_SERVICE_ROLE_KEY für Multi-Tenant Architektur")
      }
    } else {
      results.errors.push(".env.local Datei wurde nicht erstellt")
    }

    // 3. Prüfe Git Remote
    debug("Validiere Git Remote...")
    try {
      const gitRemote = execSync("git remote -v", {
        cwd: projectPath,
        encoding: "utf-8",
        stdio: "pipe",
      })
      if (gitRemote.includes("origin") && gitRemote.includes("github.com")) {
        results.success.push("Git Remote korrekt konfiguriert")
      } else {
        results.warnings.push("Git Remote scheint nicht korrekt konfiguriert zu sein")
      }
    } catch (gitError) {
      results.warnings.push("Git Remote konnte nicht geprüft werden")
      debug(`Git Error: ${gitError.message}`)
    }

    // 4. Prüfe Template-Struktur
    debug("Validiere Template-Struktur...")
    const requiredFiles = [
      "package.json",
      "tsconfig.json",
      // Tailwind CSS v4 benötigt keine tailwind.config.ts mehr - Konfiguration in globals.css
      "README.md",
      ".cursor/mcp.json",
      ".cursor/rules/prohibitions.mdc",
      "docs/04_knowledge/mcp-setup.md",
      "scripts/pull-env.mjs",
      ".husky/pre-commit",
    ]

    const missingFiles = []
    requiredFiles.forEach((file) => {
      const filePath = path.join(projectPath, file)
      if (!fs.existsSync(filePath)) {
        missingFiles.push(file)
      }
    })

    if (missingFiles.length === 0) {
      results.success.push("Alle erforderlichen Dateien vorhanden")
    } else {
      results.errors.push(`Fehlende Dateien: ${missingFiles.join(", ")}`)
    }

    // 5. Prüfe MCP-Konfiguration
    debug("Validiere MCP-Konfiguration...")
    const mcpPath = path.join(projectPath, ".cursor/mcp.json")
    if (fs.existsSync(mcpPath)) {
      try {
        const mcpContent = JSON.parse(fs.readFileSync(mcpPath, "utf-8"))
        if (mcpContent.mcpServers?.supabase && mcpContent.mcpServers?.context7) {
          results.success.push("MCP-Konfiguration vorhanden (Supabase + Context7)")
        } else {
          results.warnings.push("MCP-Konfiguration unvollständig")
        }
      } catch (parseError) {
        results.errors.push("MCP-Konfiguration ist kein gültiges JSON")
      }
    } else {
      results.errors.push("MCP-Konfiguration (.cursor/mcp.json) fehlt")
    }

    // 6. Prüfe Dokumentationsstruktur
    debug("Validiere Dokumentationsstruktur...")
    const docsDirs = [
      "docs/01_governance",
      "docs/02_architecture",
      "docs/03_features",
      "docs/04_knowledge",
      "docs/05_communication",
      "docs/06_history",
      "docs/07_automation",
    ]

    const missingDocs = []
    docsDirs.forEach((dir) => {
      const dirPath = path.join(projectPath, dir)
      if (!fs.existsSync(dirPath)) {
        missingDocs.push(dir)
      }
    })

    if (missingDocs.length === 0) {
      results.success.push("Dokumentationsstruktur vollständig (7 Ebenen)")
    } else {
      results.warnings.push(`Fehlende Dokumentations-Ebenen: ${missingDocs.join(", ")}`)
    }

    // 7. Prüfe Pre-Commit Hook
    debug("Validiere Pre-Commit Hook...")
    const preCommitPath = path.join(projectPath, ".husky/pre-commit")
    if (fs.existsSync(preCommitPath)) {
      const hookContent = fs.readFileSync(preCommitPath, "utf-8")
      if (hookContent.includes("validate-docs-structure.mjs")) {
        results.success.push("Pre-Commit Hook vorhanden und konfiguriert")
      } else {
        results.warnings.push("Pre-Commit Hook vorhanden, aber scheint nicht korrekt konfiguriert")
      }
    } else {
      results.warnings.push("Pre-Commit Hook fehlt")
    }

    // 8. Prüfe package.json Scripts
    debug("Validiere package.json Scripts...")
    const packageJsonPath = path.join(projectPath, "package.json")
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))
        const requiredScripts = ["dev", "build", "validate-docs", "pull-env"]
        const missingScripts = requiredScripts.filter(
          (script) => !packageJson.scripts?.[script]
        )

        if (missingScripts.length === 0) {
          results.success.push("Alle erforderlichen Scripts in package.json vorhanden")
        } else {
          results.warnings.push(`Fehlende Scripts: ${missingScripts.join(", ")}`)
        }
      } catch (parseError) {
        results.errors.push("package.json ist kein gültiges JSON")
      }
    } else {
      results.errors.push("package.json fehlt")
    }
  } catch (validationError) {
    results.errors.push(`Validierungsfehler: ${validationError.message}`)
    if (verbose) {
      debug(`Validation Error Stack: ${validationError.stack}`)
    }
  }

  return results
}

program.parse(process.argv)

