import { execSync } from "child_process"
import { debugLog, debugError, maskSecret } from "./debug.js"

/**
 * Direkter SQL-Fallback für Secrets (umgeht PostgREST Schema-Cache)
 * @param {string} supabaseUrl - Supabase URL
 * @param {string} serviceRoleKey - Service Role Key
 * @param {string|null} secretName - Name des Secrets (optional)
 * @param {boolean} verbose - Verbose-Modus
 * @returns {Promise<{data: any, error: null}|{data: null, error: Error}>}
 */
export async function getSecretsViaDirectSql(supabaseUrl, serviceRoleKey, secretName = null, verbose = false) {
  debugLog("Direkter SQL-Fallback: Rufe Vault-Funktion direkt über SQL auf", { secretName }, verbose)
  
  try {
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
      // Alle Secrets
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
        body: JSON.stringify({})
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        debugLog(`HTTP Response Error: ${response.status} - ${errorText}`, null, verbose)
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

/**
 * HTTP-Fallback für RPC-Calls (wenn Schema-Cache Problem)
 * @param {string} supabaseUrl - Supabase URL
 * @param {string} serviceRoleKey - Service Role Key
 * @param {string} functionName - RPC-Funktionsname
 * @param {Object} params - Parameter-Objekt
 * @param {boolean} verbose - Verbose-Modus
 * @returns {Promise<{data: any, error: null}|{data: null, error: Error}>}
 */
export async function callRpcViaHttp(supabaseUrl, serviceRoleKey, functionName, params = {}, verbose = false) {
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

/**
 * Liste Supabase-Projekte auf (via CLI)
 * @param {Function} debugFn - Debug-Funktion
 * @returns {Promise<Array>} Array von Projekt-Objekten
 */
export async function listSupabaseProjects(debugFn) {
  try {
    let output
    try {
      output = execSync("supabase projects list", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env,
        shell: true,
      })
    } catch (execError) {
      if (execError.stdout) {
        output = execError.stdout.toString("utf-8")
      } else if (execError.stderr) {
        output = execError.stderr.toString("utf-8")
      } else {
        if (debugFn) {
          debugFn(`execSync Error: ${execError.message}`)
        }
        throw execError
      }
    }
    
    const normalizedOutput = output.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const lines = normalizedOutput.split("\n")
    const projects = []
    let headerFound = false
    let inTable = false

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (trimmed.includes("LINKED") && trimmed.includes("ORG ID")) {
        headerFound = true
        continue
      }

      if (headerFound && (trimmed.includes("─") || trimmed.includes("┼")) && trimmed.length > 50) {
        inTable = true
        continue
      }

      if ((inTable || headerFound) && trimmed.includes("│") && !trimmed.includes("LINKED")) {
        const parts = trimmed.split("│").map((p) => p.trim())
        if (parts.length >= 4) {
          const referenceId = parts[2] || ""
          const name = parts[3] || ""
          if (referenceId && referenceId.length > 0 && !referenceId.includes("zedhieyjlfhygsfxzbze")) {
            projects.push({
              id: referenceId,
              project_ref: referenceId,
              name: name,
              org_id: parts[1] || "",
              region: parts[4] || "",
            })
          }
        }
      }
    }

    return projects
  } catch (error) {
    if (debugFn) {
      debugFn(`Fehler beim Abrufen der Projekte: ${error.message}`)
    }
    return []
  }
}

/**
 * Versuche Anon Key automatisch abzurufen (via Supabase CLI)
 * @param {string} projectRef - Project Reference ID
 * @param {Function} debugFn - Debug-Funktion
 * @returns {Promise<string|null>} Anon Key oder null
 */
export async function fetchAnonKeyFromSupabase(projectRef, debugFn) {
  try {
    let output
    try {
      output = execSync(
        `supabase projects api-keys --project-ref ${projectRef} --output json`,
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
          debugFn(`⚠️  CLI-Fehler: ${execError.message}`)
        }
        return null
      }
    }
    
    const trimmedOutput = output.trim()
    if (!trimmedOutput || trimmedOutput.length === 0) {
      return null
    }
    
    let keys
    try {
      keys = JSON.parse(trimmedOutput)
    } catch (parseError) {
      // Fallback: Tabellen-Format parsen
      const lines = trimmedOutput.split("\n")
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.includes("anon") || trimmed.includes("public")) {
          const parts = trimmed.split("│").map((p) => p.trim())
          if (parts.length >= 2) {
            const keyName = parts[0].toLowerCase()
            const keyValue = parts[1]
            if ((keyName.includes("anon") || keyName.includes("public")) && keyValue && keyValue.length > 20) {
              return keyValue
            }
          }
        }
      }
      return null
    }
    
    if (Array.isArray(keys)) {
      let anonKey = keys.find((k) => {
        const name = (k.name || "").toLowerCase()
        const id = (k.id || "").toLowerCase()
        return name === "anon" || id === "anon"
      })
      
      if (!anonKey) {
        anonKey = keys.find((k) => {
          const type = (k.type || "").toLowerCase()
          return type === "publishable"
        })
      }
      
      if (anonKey && anonKey.api_key) {
        return anonKey.api_key
      }
    } else if (keys.anon_key || keys.anon || keys.public || keys.api_key) {
      return keys.anon_key || keys.anon || keys.public || keys.api_key
    }
    
    return null
  } catch (error) {
    if (debugFn) {
      debugFn(`⚠️  Fehler beim Abrufen des Anon Keys: ${error.message}`)
    }
    return null
  }
}

/**
 * Versuche Service Role Key automatisch abzurufen (via Supabase CLI Management API)
 * @param {string} projectRef - Project Reference ID
 * @param {Function} debugFn - Debug-Funktion
 * @returns {Promise<string|null>} Service Role Key oder null
 */
export async function fetchServiceRoleKeyFromSupabase(projectRef, debugFn) {
  try {
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
        return null
      }
    }
    
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '').replace(/\u001b\[\d+m/g, '')
    const lines = cleanOutput.split("\n")
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.includes("service_role")) {
        const parts = trimmed.split("│").map((p) => p.trim())
        if (parts.length >= 2) {
          const keyName = parts[0].toLowerCase()
          const keyValue = parts[1].replace(/\x1b\[[0-9;]*m/g, '').trim()
          if (keyName.includes("service_role") && keyValue && keyValue.length > 20) {
            return keyValue
          }
        }
      }
    }
    
    return null
  } catch (error) {
    if (debugFn) {
      debugFn(`❌ Fehler beim Abrufen von Service Role Key: ${error.message}`)
    }
    return null
  }
}

/**
 * Versuche Service Role Key aus dem Vault der INFRA-DB zu holen
 * @param {string} infraDbUrl - INFRA-DB URL
 * @param {string} tempServiceRoleKey - Temporärer Service Role Key (z.B. aus Profil) für Vault-Zugriff
 * @param {Function} debugFn - Debug-Funktion
 * @returns {Promise<string|null>} Service Role Key oder null
 */
export async function fetchServiceRoleKeyFromVault(infraDbUrl, tempServiceRoleKey, debugFn) {
  if (!tempServiceRoleKey) {
    if (debugFn) {
      debugFn("⚠️  Kein temporärer Service Role Key für Vault-Zugriff vorhanden")
    }
    return null
  }

  try {
    if (debugFn) {
      debugFn(`🔍 Versuche SERVICE_ROLE_KEY aus Vault zu holen...`)
    }

    // Versuche über RPC-Funktion
    const { callRpcViaHttp } = await import("./supabase.js")
    const result = await callRpcViaHttp(
      infraDbUrl,
      tempServiceRoleKey,
      "read_secret",
      { secret_name: "SERVICE_ROLE_KEY" },
      false // verbose
    )

    if (result.error) {
      if (debugFn) {
        debugFn(`⚠️  Vault-Zugriff fehlgeschlagen: ${result.error.message}`)
      }
      return null
    }

    if (result.data && typeof result.data === 'string' && result.data.length > 20) {
      if (debugFn) {
        debugFn(`✅ SERVICE_ROLE_KEY aus Vault geholt`)
      }
      return result.data
    }

    return null
  } catch (error) {
    if (debugFn) {
      debugFn(`⚠️  Fehler beim Abrufen aus Vault: ${error.message}`)
    }
    return null
  }
}

/**
 * Erstelle neues Supabase-Projekt
 * @param {string} projectName - Projektname
 * @param {string} organizationId - Organization ID
 * @param {string} dbPassword - Datenbank-Passwort
 * @param {string} region - Region (default: eu-central-1)
 * @returns {Promise<Object>} Projekt-Objekt
 */
export async function createSupabaseProject(projectName, organizationId, dbPassword, region = "eu-central-1") {
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

