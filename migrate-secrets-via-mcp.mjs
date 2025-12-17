#!/usr/bin/env node
/**
 * Migrations-Script: Überträgt Secrets aus Doppler zum neuen Supabase Vault
 * Nutzt Supabase MCP Server (falls verfügbar) oder direkte API-Calls
 * 
 * Neues Vault: https://zedhieyjlfhygsfxzbze.supabase.co
 */

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

// Hauptfunktion
async function migrateSecretsViaMCP() {
  console.log(chalk.cyan.bold("\n🔄 Secrets-Migration: Doppler → Neuer Supabase Vault (via MCP)\n"))
  
  // Lade SERVICE_ROLE_KEY für neuen Vault
  console.log(chalk.blue("1. Lade SERVICE_ROLE_KEY für neuen Vault..."))
  const newKey = loadNewServiceRoleKey()
  
  if (!newKey) {
    console.error(chalk.red("❌ SERVICE_ROLE_KEY für neuen Vault nicht gefunden"))
    process.exit(1)
  }
  
  console.log(chalk.green("✓ Key geladen"))
  
  // Hole Secret-Namen aus Doppler
  console.log(chalk.blue("\n2. Hole Secret-Namen aus Doppler..."))
  const secretNames = getDopplerSecretNames()
  console.log(chalk.green(`✓ ${secretNames.length} Secrets in Doppler gefunden`))
  
  // Filtere Doppler-interne Secrets
  const dopplerInternalSecrets = ['DOPPLER_CONFIG', 'DOPPLER_ENVIRONMENT', 'DOPPLER_PROJECT', 'DOPPLER_TOKEN']
  const secretsToMigrate = secretNames.filter(name => !dopplerInternalSecrets.includes(name))
  
  console.log(chalk.blue(`\n3. Übertrage ${secretsToMigrate.length} Secrets zum neuen Vault...`))
  console.log(chalk.dim("   (Nutze Supabase Vault API direkt)\n"))
  
  let successCount = 0
  let errorCount = 0
  const errors = []
  
  // Übertrage Secrets direkt über Supabase Vault API
  for (const secretName of secretsToMigrate) {
    try {
      const secretValue = getDopplerSecret(secretName)
      
      // Nutze Supabase Vault API direkt
      // Die Vault API verwendet einen anderen Endpoint als RPC
      const response = await fetch(`${NEW_VAULT_URL}/v1/vault/secrets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': newKey,
          'Authorization': `Bearer ${newKey}`,
        },
        body: JSON.stringify({
          name: secretName,
          secret: secretValue
        })
      })
      
      if (response.ok) {
        console.log(chalk.green(`✓ ${secretName}`))
        successCount++
      } else {
        const errorText = await response.text()
        console.error(chalk.red(`✗ ${secretName}: HTTP ${response.status}`))
        errors.push({ name: secretName, error: errorText })
        errorCount++
      }
    } catch (error) {
      console.error(chalk.red(`✗ ${secretName}: ${error.message}`))
      errors.push({ name: secretName, error: error.message })
      errorCount++
    }
  }
  
  console.log(chalk.cyan.bold(`\n📊 Zusammenfassung:`))
  console.log(chalk.green(`✓ Erfolgreich übertragen: ${successCount}`))
  if (errorCount > 0) {
    console.log(chalk.red(`✗ Fehler: ${errorCount}`))
    console.log(chalk.yellow("\n⚠️  Fehler-Details:"))
    errors.forEach(({ name, error }) => {
      console.log(chalk.dim(`   ${name}: ${error.substring(0, 100)}`))
    })
  }
  
  if (successCount > 0) {
    console.log(chalk.green.bold("\n✅ Migration teilweise erfolgreich!"))
    console.log(chalk.dim("   Prüfe die Secrets im Supabase Dashboard"))
  }
}

// Führe Migration aus
migrateSecretsViaMCP().catch(error => {
  console.error(chalk.red.bold("\n❌ Fehler bei der Migration:"))
  console.error(chalk.red(error.message))
  if (error.stack) {
    console.error(chalk.dim(error.stack))
  }
  process.exit(1)
})

