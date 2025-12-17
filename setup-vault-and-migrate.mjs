#!/usr/bin/env node
/**
 * Setup Vault Functions und migriere Secrets aus Doppler
 * 
 * 1. Erstellt die Vault-Funktionen im neuen Supabase-Projekt
 * 2. Migriert alle Secrets aus Doppler
 */

import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import chalk from "chalk"
import { createClient } from "@supabase/supabase-js"

const NEW_VAULT_URL = "https://zedhieyjlfhygsfxzbze.supabase.co"
const DOPPLER_PROJECT = "megabrain"
const DOPPLER_CONFIG = "dev"

// Lade SERVICE_ROLE_KEY für neuen Vault aus Profil
function loadNewServiceRoleKey() {
  const profilePath = path.join(process.env.HOME || process.env.USERPROFILE, ".kessel", "phkoenig.kesselprofile")
  if (fs.existsSync(profilePath)) {
    try {
      const content = fs.readFileSync(profilePath, "utf-8")
      const match = content.match(/SUPABASE_VAULT_SERVICE_ROLE_KEY=(.+)/)
      if (match && match[1]) {
        return match[1].trim()
      }
    } catch (error) {
      // Ignorieren
    }
  }
  return null
}

// Führe SQL über Supabase REST API aus
async function executeSQL(supabaseUrl, serviceRoleKey, sql) {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  // Verwende rpc für SQL-Ausführung (falls verfügbar)
  // Oder direkt über REST API
  try {
    // Versuche über PostgREST
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ sql })
    })
    
    if (response.ok) {
      return await response.json()
    }
  } catch (error) {
    // Fallback: Verwende Supabase Client direkt
  }
  
  // Alternative: Verwende Supabase Management API oder SQL Editor API
  // Für jetzt: Gib SQL zurück, das manuell ausgeführt werden muss
  throw new Error("SQL muss manuell im Dashboard ausgeführt werden")
}

// Hole alle Secret-Namen aus Doppler
function getDopplerSecretNames() {
  try {
    const output = execSync(
      `doppler secrets --project ${DOPPLER_PROJECT} --config ${DOPPLER_CONFIG} --only-names`,
      { encoding: 'utf-8' }
    )
    
    const lines = output.split('\n')
    const secretNames = []
    let inTable = false
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      if (trimmed.includes('─') || trimmed.includes('┼')) {
        inTable = true
        continue
      }
      
      if (trimmed.includes('NAME') && !trimmed.includes('│')) {
        continue
      }
      
      if (inTable) {
        let secretName = null
        
        if (trimmed.includes('│')) {
          const parts = trimmed.split('│').map(p => p.trim()).filter(p => p)
          if (parts.length >= 1) {
            secretName = parts[0]
          }
        } else if (trimmed && 
                   !trimmed.includes('─') && 
                   !trimmed.includes('┼') && 
                   !trimmed.includes('└') && 
                   !trimmed.includes('┌') &&
                   !trimmed.includes('├') &&
                   !trimmed.includes('┤')) {
          secretName = trimmed
        }
        
        if (secretName && secretName !== 'NAME' && /^[A-Z_][A-Z0-9_]*$/.test(secretName)) {
          secretNames.push(secretName)
        }
      }
    }
    
    return secretNames
  } catch (error) {
    throw new Error(`Fehler beim Abrufen der Secret-Namen aus Doppler: ${error.message}`)
  }
}

// Hole ein einzelnes Secret aus Doppler
function getDopplerSecret(secretName) {
  try {
    const value = execSync(
      `doppler secrets get ${secretName} --project ${DOPPLER_PROJECT} --config ${DOPPLER_CONFIG} --plain`,
      { encoding: 'utf-8' }
    ).trim()
    return value
  } catch (error) {
    throw new Error(`Fehler beim Abrufen von ${secretName} aus Doppler: ${error.message}`)
  }
}

// Füge Secret über native Vault API hinzu
async function addSecretViaVaultAPI(supabaseUrl, serviceRoleKey, secretName, secretValue) {
  // Nutze die native vault.create_secret() Funktion über RPC
  // Aber zuerst müssen die Wrapper-Funktionen existieren
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  try {
    // Versuche über insert_secret (falls bereits erstellt)
    const { data, error } = await supabase.rpc("insert_secret", {
      name: secretName,
      secret: secretValue
    })
    
    if (error) {
      // Versuche direkt über vault.create_secret
      const { data: vaultData, error: vaultError } = await supabase.rpc("vault.create_secret", {
        secret: secretValue,
        name: secretName
      })
      
      if (vaultError) {
        throw vaultError
      }
      
      return vaultData
    }
    
    return data
  } catch (error) {
    throw error
  }
}

// Hauptfunktion
async function setupAndMigrate() {
  console.log(chalk.cyan.bold("\n🔄 Vault Setup & Secrets-Migration\n"))
  
  // Lade SERVICE_ROLE_KEY
  console.log(chalk.blue("1. Lade SERVICE_ROLE_KEY..."))
  const serviceRoleKey = loadNewServiceRoleKey()
  
  if (!serviceRoleKey) {
    console.error(chalk.red("❌ SERVICE_ROLE_KEY nicht gefunden"))
    process.exit(1)
  }
  
  console.log(chalk.green("✓ Key geladen"))
  
  // Lade SQL-Script
  console.log(chalk.blue("\n2. Lade SQL-Script für Vault-Funktionen..."))
  const sqlScript = fs.readFileSync("create-vault-functions.sql", "utf-8")
  console.log(chalk.green("✓ SQL-Script geladen"))
  
  // Versuche SQL auszuführen
  console.log(chalk.blue("\n3. Erstelle Vault-Funktionen..."))
  console.log(chalk.yellow("⚠️  SQL muss im Supabase Dashboard ausgeführt werden:"))
  console.log(chalk.cyan("   https://supabase.com/dashboard/project/zedhieyjlfhygsfxzbze/sql/new"))
  console.log(chalk.dim("\n   Kopiere den Inhalt von create-vault-functions.sql"))
  
  // Frage ob SQL bereits ausgeführt wurde
  const readline = await import('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  const sqlExecuted = await new Promise(resolve => {
    rl.question("\nWurde das SQL-Script bereits im Dashboard ausgeführt? (j/n): ", answer => {
      resolve(answer.toLowerCase() === 'j' || answer.toLowerCase() === 'y' || answer.toLowerCase() === 'ja')
    })
  })
  
  rl.close()
  
  if (!sqlExecuted) {
    console.log(chalk.yellow("\n⚠️  Bitte führe zuerst das SQL-Script im Dashboard aus"))
    console.log(chalk.dim("   Datei: create-vault-functions.sql"))
    process.exit(0)
  }
  
  // Warte kurz, damit Schema-Cache aktualisiert wird
  console.log(chalk.blue("\n4. Warte auf Schema-Cache-Aktualisierung..."))
  await new Promise(resolve => setTimeout(resolve, 3000))
  
  // Hole Secrets aus Doppler
  console.log(chalk.blue("\n5. Hole Secrets aus Doppler..."))
  const secretNames = getDopplerSecretNames()
  const dopplerInternalSecrets = ['DOPPLER_CONFIG', 'DOPPLER_ENVIRONMENT', 'DOPPLER_PROJECT', 'DOPPLER_TOKEN']
  const secretsToMigrate = secretNames.filter(name => !dopplerInternalSecrets.includes(name))
  
  console.log(chalk.green(`✓ ${secretsToMigrate.length} Secrets zum Übertragen gefunden`))
  
  // Übertrage Secrets
  console.log(chalk.blue("\n6. Übertrage Secrets zum neuen Vault..."))
  let successCount = 0
  let errorCount = 0
  
  for (const secretName of secretsToMigrate) {
    try {
      const secretValue = getDopplerSecret(secretName)
      await addSecretViaVaultAPI(NEW_VAULT_URL, serviceRoleKey, secretName, secretValue)
      console.log(chalk.green(`✓ ${secretName}`))
      successCount++
    } catch (error) {
      console.error(chalk.red(`✗ ${secretName}: ${error.message}`))
      errorCount++
    }
  }
  
  console.log(chalk.cyan.bold(`\n📊 Zusammenfassung:`))
  console.log(chalk.green(`✓ Erfolgreich: ${successCount}`))
  if (errorCount > 0) {
    console.log(chalk.red(`✗ Fehler: ${errorCount}`))
  }
  
  if (successCount > 0) {
    console.log(chalk.green.bold("\n✅ Migration erfolgreich!"))
  }
}

setupAndMigrate().catch(error => {
  console.error(chalk.red.bold("\n❌ Fehler:"))
  console.error(chalk.red(error.message))
  if (error.stack) {
    console.error(chalk.dim(error.stack))
  }
  process.exit(1)
})

