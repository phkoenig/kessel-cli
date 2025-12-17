#!/usr/bin/env node
/**
 * Migrations-Script: Überträgt Secrets vom alten zum neuen Supabase Vault
 * 
 * Altes Vault: https://uigpauojizbrzaoxyyst.supabase.co
 * Neues Vault: https://zedhieyjlfhygsfxzbze.supabase.co
 */

import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import chalk from "chalk"
import { execSync } from "child_process"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Konfiguration
const OLD_VAULT_URL = "https://uigpauojizbrzaoxyyst.supabase.co"
const NEW_VAULT_URL = "https://zedhieyjlfhygsfxzbze.supabase.co"

// Pfad zur boiler_plate_A .env Datei (für alten SERVICE_ROLE_KEY)
const BOILERPLATE_ENV_PATH = "B:/Nextcloud/CODE/proj/boiler_plate_A/.env"

// Lade SERVICE_ROLE_KEY aus boiler_plate_A/.env (für alten Vault)
async function loadOldServiceRoleKey() {
  // Versuche zuerst aus .env Datei
  if (fs.existsSync(BOILERPLATE_ENV_PATH)) {
    try {
      const envContent = fs.readFileSync(BOILERPLATE_ENV_PATH, "utf-8")
      const match = envContent.match(/SERVICE_ROLE_KEY=(.+)/)
      if (match && match[1]) {
        const key = match[1].trim()
        // Teste ob der Key funktioniert
        try {
          const testResponse = await fetch(`${OLD_VAULT_URL}/rest/v1/`, {
            method: "GET",
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`
            }
          })
          if (testResponse.status === 200 || testResponse.status === 401) {
            return key
          }
        } catch {
          // Key funktioniert nicht, weiter zu anderen Quellen
        }
      }
    } catch (error) {
      // Ignorieren
    }
  }
  
  // Versuche aus Doppler zu laden
  try {
    const dopplerKey = execSync('doppler secrets get SERVICE_ROLE_KEY --plain 2>/dev/null', { encoding: 'utf-8' }).trim()
    if (dopplerKey && dopplerKey.length > 50) {
      // Teste ob der Key funktioniert
      try {
        const testResponse = await fetch(`${OLD_VAULT_URL}/rest/v1/`, {
          method: "GET",
          headers: {
            apikey: dopplerKey,
            Authorization: `Bearer ${dopplerKey}`
          }
        })
        if (testResponse.status === 200 || testResponse.status === 401) {
          console.log(chalk.cyan("✓ SERVICE_ROLE_KEY aus Doppler geladen"))
          return dopplerKey
        }
      } catch {
        // Key funktioniert nicht
      }
    }
  } catch {
    // Doppler nicht verfügbar oder Fehler
  }
  
  return null
}

// Lade SERVICE_ROLE_KEY für neuen Vault (aus Profil oder manuell)
function loadNewServiceRoleKey() {
  // Versuche aus Profil zu laden
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

// Hole Secrets aus einem Vault
async function getSecretsFromVault(vaultUrl, serviceRoleKey) {
  console.log(chalk.blue(`\n📥 Lade Secrets von ${vaultUrl}...`))
  
  const supabase = createClient(vaultUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  try {
    // Versuche RPC
    const { data, error } = await supabase.rpc("get_all_secrets_for_env", {})
    
    if (error) {
      console.log(chalk.yellow("⚠️  RPC fehlgeschlagen, versuche HTTP-Fallback..."))
      return await getSecretsViaHttp(vaultUrl, serviceRoleKey)
    }
    
    return data || {}
  } catch (error) {
    console.log(chalk.yellow("⚠️  RPC fehlgeschlagen, versuche HTTP-Fallback..."))
    return await getSecretsViaHttp(vaultUrl, serviceRoleKey)
  }
}

// Füge Secret zu einem Vault hinzu
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
async function migrateSecrets() {
  console.log(chalk.cyan.bold("\n🔄 Secrets-Migration: Alt → Neu\n"))
  
  // Lade Keys
  console.log(chalk.blue("1. Lade SERVICE_ROLE_KEYs..."))
  const oldKey = await loadOldServiceRoleKey()
  const newKey = loadNewServiceRoleKey()
  
  if (!oldKey) {
    console.error(chalk.red("❌ SERVICE_ROLE_KEY für alten Vault nicht gefunden"))
    console.error(chalk.yellow(`   Versucht: ${BOILERPLATE_ENV_PATH} und Doppler`))
    console.error(chalk.yellow("   Bitte gib den SERVICE_ROLE_KEY für den alten Vault ein:"))
    const readline = await import('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    
    const oldKeyInput = await new Promise(resolve => {
      rl.question("SERVICE_ROLE_KEY (für uigpauojizbrzaoxyyst): ", resolve)
    })
    rl.close()
    
    if (!oldKeyInput || oldKeyInput.trim().length === 0) {
      console.error(chalk.red("❌ SERVICE_ROLE_KEY ist erforderlich"))
      process.exit(1)
    }
    
    const finalOldKey = oldKeyInput.trim()
    
    // Hole Secrets vom alten Vault
    console.log(chalk.blue("\n2. Hole Secrets vom alten Vault..."))
    const oldSecrets = await getSecretsFromVault(OLD_VAULT_URL, finalOldKey)
    
    console.log(chalk.green(`✓ ${Object.keys(oldSecrets).length} Secrets gefunden:`))
    Object.keys(oldSecrets).forEach(key => {
      console.log(chalk.dim(`   - ${key}`))
    })
    
    // Prüfe welche Secrets bereits im neuen Vault sind
    console.log(chalk.blue("\n3. Prüfe neue Secrets..."))
    const newSecrets = await getSecretsFromVault(NEW_VAULT_URL, newKey)
    console.log(chalk.green(`✓ ${Object.keys(newSecrets).length} Secrets bereits im neuen Vault`))
    
    // Finde fehlende Secrets
    const missingSecrets = {}
    for (const [key, value] of Object.entries(oldSecrets)) {
      if (!newSecrets[key]) {
        missingSecrets[key] = value
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
    const allTransferred = Object.keys(oldSecrets).every(key => finalSecrets[key])
    if (allTransferred) {
      console.log(chalk.green.bold("\n✅ Migration erfolgreich abgeschlossen!"))
    } else {
      const stillMissing = Object.keys(oldSecrets).filter(key => !finalSecrets[key])
      console.log(chalk.yellow(`\n⚠️  Noch fehlend: ${stillMissing.join(", ")}`))
    }
    
    return
  }
  
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
    
    // Hole Secrets vom alten Vault
    console.log(chalk.blue("\n2. Hole Secrets vom alten Vault..."))
    const oldSecrets = await getSecretsFromVault(OLD_VAULT_URL, oldKey)
    
    console.log(chalk.green(`✓ ${Object.keys(oldSecrets).length} Secrets gefunden:`))
    Object.keys(oldSecrets).forEach(key => {
      console.log(chalk.dim(`   - ${key}`))
    })
    
    // Übertrage Secrets zum neuen Vault
    console.log(chalk.blue("\n3. Übertrage Secrets zum neuen Vault..."))
    let successCount = 0
    let errorCount = 0
    
    for (const [key, value] of Object.entries(oldSecrets)) {
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
    console.log(chalk.green(`✓ Erfolgreich: ${successCount}`))
    if (errorCount > 0) {
      console.log(chalk.red(`✗ Fehler: ${errorCount}`))
    }
    
    // Prüfe neue Secrets
    console.log(chalk.blue("\n4. Prüfe neue Secrets..."))
    const newSecrets = await getSecretsFromVault(NEW_VAULT_URL, finalNewKey)
    console.log(chalk.green(`✓ ${Object.keys(newSecrets).length} Secrets im neuen Vault`))
    
    return
  }
  
  // Wenn beide Keys vorhanden sind, fahre fort
  console.log(chalk.green("✓ Keys geladen"))
  
  // Hole Secrets vom alten Vault
  console.log(chalk.blue("\n2. Hole Secrets vom alten Vault..."))
  const oldSecrets = await getSecretsFromVault(OLD_VAULT_URL, oldKey)
  
  console.log(chalk.green(`✓ ${Object.keys(oldSecrets).length} Secrets gefunden:`))
  Object.keys(oldSecrets).forEach(key => {
    console.log(chalk.dim(`   - ${key}`))
  })
  
  // Prüfe welche Secrets bereits im neuen Vault sind
  console.log(chalk.blue("\n3. Prüfe neue Secrets..."))
  const newSecrets = await getSecretsFromVault(NEW_VAULT_URL, newKey)
  console.log(chalk.green(`✓ ${Object.keys(newSecrets).length} Secrets bereits im neuen Vault`))
  
  // Finde fehlende Secrets
  const missingSecrets = {}
  for (const [key, value] of Object.entries(oldSecrets)) {
    if (!newSecrets[key]) {
      missingSecrets[key] = value
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
  const allTransferred = Object.keys(oldSecrets).every(key => finalSecrets[key])
  if (allTransferred) {
    console.log(chalk.green.bold("\n✅ Migration erfolgreich abgeschlossen!"))
  } else {
    const stillMissing = Object.keys(oldSecrets).filter(key => !finalSecrets[key])
    console.log(chalk.yellow(`\n⚠️  Noch fehlend: ${stillMissing.join(", ")}`))
  }
}

// Führe Migration aus
migrateSecrets().catch(error => {
  console.error(chalk.red.bold("\n❌ Fehler bei der Migration:"))
  console.error(chalk.red(error.message))
  if (error.stack) {
    console.error(chalk.dim(error.stack))
  }
  process.exit(1)
})

