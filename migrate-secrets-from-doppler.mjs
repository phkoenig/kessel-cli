#!/usr/bin/env node
/**
 * Migrations-Script: Überträgt Secrets aus Doppler zum neuen Supabase Vault
 * 
 * Neues Vault: https://zedhieyjlfhygsfxzbze.supabase.co
 */

import { createClient } from "@supabase/supabase-js"
import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import chalk from "chalk"

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

// Hole alle Secret-Namen aus Doppler
function getDopplerSecretNames() {
  try {
    const output = execSync(
      `doppler secrets --project ${DOPPLER_PROJECT} --config ${DOPPLER_CONFIG} --only-names`,
      { encoding: 'utf-8' }
    )
    
    // Parse Tabellen-Output
    const lines = output.split('\n')
    const secretNames = []
    let inTable = false
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      // Erkenne Tabellen-Start (nach Header)
      if (trimmed.includes('─') || trimmed.includes('┼')) {
        inTable = true
        continue
      }
      
      // Überspringe Header
      if (trimmed.includes('NAME') && !trimmed.includes('│')) {
        continue
      }
      
      // Parse Tabellenzeilen
      if (inTable) {
        // Die Tabelle hat das Format: │ SECRET_NAME │
        // Oder einfach: SECRET_NAME (ohne Rahmen)
        let secretName = null
        
        // Versuche mit │ zu parsen
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
          // Reine Textzeile ohne Rahmen
          secretName = trimmed
        }
        
        if (secretName) {
          // Validiere Secret-Name (nur Großbuchstaben, Zahlen, Unterstriche)
          // Ignoriere "NAME" (Tabellen-Header)
          if (secretName !== 'NAME' && /^[A-Z_][A-Z0-9_]*$/.test(secretName)) {
            secretNames.push(secretName)
          }
        }
      }
    }
    
    // Debug: Zeige gefundene Secrets
    if (secretNames.length === 0) {
      console.log(chalk.yellow("⚠️  Debug: Keine Secrets geparst. Output-Ausschnitt:"))
      console.log(chalk.dim(output.substring(0, 500)))
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

// Versuche Secrets über HTTP direkt abzurufen (Fallback)
async function getSecretsViaHttp(supabaseUrl, serviceRoleKey) {
  try {
    const url = `${supabaseUrl}/rest/v1/rpc/get_all_secrets_for_env`
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
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    throw error
  }
}

// Hole Secrets aus Vault
async function getSecretsFromVault(vaultUrl, serviceRoleKey) {
  const supabase = createClient(vaultUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  try {
    const { data, error } = await supabase.rpc("get_all_secrets_for_env", {})
    
    if (error) {
      return await getSecretsViaHttp(vaultUrl, serviceRoleKey)
    }
    
    return data || {}
  } catch (error) {
    return await getSecretsViaHttp(vaultUrl, serviceRoleKey)
  }
}

// Füge Secret zu Vault hinzu
async function addSecretToVault(vaultUrl, serviceRoleKey, secretName, secretValue) {
  const supabase = createClient(vaultUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  try {
    const { data, error } = await supabase.rpc("insert_secret", {
      name: secretName,
      secret: secretValue
    })
    
    if (error) {
      // Versuche HTTP-Fallback
      const url = `${vaultUrl}/rest/v1/rpc/insert_secret`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ name: secretName, secret: secretValue })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }
      
      return await response.json()
    }
    
    return data
  } catch (error) {
    throw error
  }
}

// Hauptfunktion
async function migrateSecretsFromDoppler() {
  console.log(chalk.cyan.bold("\n🔄 Secrets-Migration: Doppler → Neuer Supabase Vault\n"))
  
  // Lade SERVICE_ROLE_KEY für neuen Vault
  console.log(chalk.blue("1. Lade SERVICE_ROLE_KEY für neuen Vault..."))
  const newKey = loadNewServiceRoleKey()
  
  if (!newKey) {
    console.error(chalk.red("❌ SERVICE_ROLE_KEY für neuen Vault nicht gefunden"))
    console.error(chalk.yellow("   Bitte gib den SERVICE_ROLE_KEY für den neuen Vault ein:"))
    const readline = await import('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    
    const newKeyInput = await new Promise(resolve => {
      rl.question("SERVICE_ROLE_KEY: ", resolve)
    })
    rl.close()
    
    if (!newKeyInput || newKeyInput.trim().length === 0) {
      console.error(chalk.red("❌ SERVICE_ROLE_KEY ist erforderlich"))
      process.exit(1)
    }
    
    const finalNewKey = newKeyInput.trim()
    
    // Hole Secret-Namen aus Doppler
    console.log(chalk.blue("\n2. Hole Secret-Namen aus Doppler..."))
    const secretNames = getDopplerSecretNames()
    console.log(chalk.green(`✓ ${secretNames.length} Secrets in Doppler gefunden`))
    
    // Prüfe welche Secrets bereits im neuen Vault sind
    console.log(chalk.blue("\n3. Prüfe welche Secrets bereits im neuen Vault sind..."))
    const existingSecrets = await getSecretsFromVault(NEW_VAULT_URL, finalNewKey)
    console.log(chalk.green(`✓ ${Object.keys(existingSecrets).length} Secrets bereits im neuen Vault`))
    
    // Filtere Secrets, die wir übertragen wollen (ignoriere Doppler-interne Secrets)
    const dopplerInternalSecrets = ['DOPPLER_CONFIG', 'DOPPLER_ENVIRONMENT', 'DOPPLER_PROJECT', 'DOPPLER_TOKEN']
    const secretsToMigrate = secretNames.filter(name => !dopplerInternalSecrets.includes(name))
    
    // Finde fehlende Secrets
    const missingSecrets = {}
    for (const secretName of secretsToMigrate) {
      if (!existingSecrets[secretName]) {
        try {
          const value = getDopplerSecret(secretName)
          missingSecrets[secretName] = value
        } catch (error) {
          console.log(chalk.yellow(`⚠️  ${secretName}: ${error.message}`))
        }
      }
    }
    
    if (Object.keys(missingSecrets).length === 0) {
      console.log(chalk.green.bold("\n✅ Alle Secrets sind bereits im neuen Vault!"))
      return
    }
    
    console.log(chalk.yellow(`\n⚠️  ${Object.keys(missingSecrets).length} Secrets fehlen:`))
    Object.keys(missingSecrets).forEach(key => {
      console.log(chalk.dim(`   - ${key}`))
    })
    
    // Übertrage fehlende Secrets
    console.log(chalk.blue("\n4. Übertrage fehlende Secrets..."))
    let successCount = 0
    let errorCount = 0
    
    for (const [key, value] of Object.entries(missingSecrets)) {
      try {
        await addSecretToVault(NEW_VAULT_URL, finalNewKey, key, value)
        console.log(chalk.green(`✓ ${key}`))
        successCount++
      } catch (error) {
        console.error(chalk.red(`✗ ${key}: ${error.message}`))
        errorCount++
      }
    }
    
    console.log(chalk.cyan.bold(`\n📊 Zusammenfassung:`))
    console.log(chalk.green(`✓ Erfolgreich übertragen: ${successCount}`))
    if (errorCount > 0) {
      console.log(chalk.red(`✗ Fehler: ${errorCount}`))
    }
    
    // Finale Prüfung
    console.log(chalk.blue("\n5. Finale Prüfung..."))
    const finalSecrets = await getSecretsFromVault(NEW_VAULT_URL, finalNewKey)
    console.log(chalk.green(`✓ ${Object.keys(finalSecrets).length} Secrets im neuen Vault`))
    
    return
  }
  
  // Wenn Key vorhanden ist, fahre fort
  console.log(chalk.green("✓ Key geladen"))
  
  // Hole Secret-Namen aus Doppler
  console.log(chalk.blue("\n2. Hole Secret-Namen aus Doppler..."))
  const secretNames = getDopplerSecretNames()
  console.log(chalk.green(`✓ ${secretNames.length} Secrets in Doppler gefunden`))
  
  // Prüfe welche Secrets bereits im neuen Vault sind
  console.log(chalk.blue("\n3. Prüfe welche Secrets bereits im neuen Vault sind..."))
  let existingSecrets = {}
  try {
    existingSecrets = await getSecretsFromVault(NEW_VAULT_URL, newKey)
    console.log(chalk.green(`✓ ${Object.keys(existingSecrets).length} Secrets bereits im neuen Vault`))
  } catch (error) {
    if (error.message.includes('PGRST202') || error.message.includes('schema cache')) {
      console.log(chalk.yellow("⚠️  Vault-Funktionen noch nicht verfügbar (Schema-Cache)"))
      console.log(chalk.yellow("   Überspringe Prüfung, übertrage alle Secrets..."))
      existingSecrets = {}
    } else {
      throw error
    }
  }
  
  // Filtere Secrets, die wir übertragen wollen (ignoriere Doppler-interne Secrets)
  const dopplerInternalSecrets = ['DOPPLER_CONFIG', 'DOPPLER_ENVIRONMENT', 'DOPPLER_PROJECT', 'DOPPLER_TOKEN']
  const secretsToMigrate = secretNames.filter(name => !dopplerInternalSecrets.includes(name))
  
  // Finde fehlende Secrets
  const missingSecrets = {}
  for (const secretName of secretsToMigrate) {
    if (!existingSecrets[secretName]) {
      try {
        const value = getDopplerSecret(secretName)
        missingSecrets[secretName] = value
      } catch (error) {
        console.log(chalk.yellow(`⚠️  ${secretName}: ${error.message}`))
      }
    }
  }
  
  if (Object.keys(missingSecrets).length === 0) {
    console.log(chalk.green.bold("\n✅ Alle Secrets sind bereits im neuen Vault!"))
    return
  }
  
  console.log(chalk.yellow(`\n⚠️  ${Object.keys(missingSecrets).length} Secrets fehlen:`))
  Object.keys(missingSecrets).forEach(key => {
    console.log(chalk.dim(`   - ${key}`))
  })
  
  // Übertrage fehlende Secrets
  console.log(chalk.blue("\n4. Übertrage fehlende Secrets..."))
  let successCount = 0
  let errorCount = 0
  
  for (const [key, value] of Object.entries(missingSecrets)) {
    try {
      await addSecretToVault(NEW_VAULT_URL, newKey, key, value)
      console.log(chalk.green(`✓ ${key}`))
      successCount++
    } catch (error) {
      console.error(chalk.red(`✗ ${key}: ${error.message}`))
      errorCount++
    }
  }
  
  console.log(chalk.cyan.bold(`\n📊 Zusammenfassung:`))
  console.log(chalk.green(`✓ Erfolgreich übertragen: ${successCount}`))
  if (errorCount > 0) {
    console.log(chalk.red(`✗ Fehler: ${errorCount}`))
  }
  
  // Finale Prüfung
  console.log(chalk.blue("\n5. Finale Prüfung..."))
  const finalSecrets = await getSecretsFromVault(NEW_VAULT_URL, newKey)
  console.log(chalk.green(`✓ ${Object.keys(finalSecrets).length} Secrets im neuen Vault`))
  
  // Vergleich
  const allTransferred = secretsToMigrate.every(name => finalSecrets[name])
  if (allTransferred) {
    console.log(chalk.green.bold("\n✅ Migration erfolgreich abgeschlossen!"))
  } else {
    const stillMissing = secretsToMigrate.filter(name => !finalSecrets[name])
    console.log(chalk.yellow(`\n⚠️  Noch fehlend: ${stillMissing.join(", ")}`))
  }
}

// Führe Migration aus
migrateSecretsFromDoppler().catch(error => {
  console.error(chalk.red.bold("\n❌ Fehler bei der Migration:"))
  console.error(chalk.red(error.message))
  if (error.stack) {
    console.error(chalk.dim(error.stack))
  }
  process.exit(1)
})

