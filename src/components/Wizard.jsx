import React, { useState, useEffect } from 'react'
import { Box, Text, useStdin } from 'ink'
import TextInput from 'ink-text-input'
import SelectInput from 'ink-select-input'
// ConfirmInput wird durch einfache TextInput + Enter-Validation ersetzt
import Spinner from 'ink-spinner'
import { WizardProgress } from './WizardProgress.jsx'
import path from 'path'
import fs from 'fs'

/**
 * Bereinigt eine URL von Carriage-Return und anderen ungültigen Zeichen
 */
function cleanUrl(url) {
  if (!url) return ''
  // Entferne \r, \n, # und andere ungültige Zeichen am Anfang/Ende
  return url.replace(/[\r\n#]+/g, '').trim()
}

/**
 * Extrahiert die Project-Ref aus einem Supabase JWT
 * @param {string} jwt - Der JWT Token
 * @returns {string|null} Die Project-Ref oder null
 */
function extractProjectRefFromJwt(jwt) {
  if (!jwt || typeof jwt !== 'string') return null
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'))
    return payload.ref || null
  } catch {
    return null
  }
}

/**
 * Prüft, ob ein SERVICE_ROLE_KEY zum Projekt passt
 * @param {string} serviceRoleKey - Der Service Role Key
 * @param {string} expectedProjectRef - Die erwartete Project-Ref
 * @returns {boolean} True wenn der Key zum Projekt passt
 */
function isKeyForProject(serviceRoleKey, expectedProjectRef) {
  if (!serviceRoleKey || !expectedProjectRef) return false
  const keyProjectRef = extractProjectRefFromJwt(serviceRoleKey)
  return keyProjectRef === expectedProjectRef
}

/**
 * Findet alle verfügbaren Profile im System
 * @returns {Promise<Array>} Array von {username, profile, source, path}
 */
async function findAllProfiles() {
  const profiles = []
  
  try {
    // 1. Suche lokale Profile im aktuellen Verzeichnis
    const cwd = process.cwd()
    const localFiles = fs.readdirSync(cwd).filter(f => f.endsWith('.kesselprofile'))
    
    for (const file of localFiles) {
      const filePath = path.join(cwd, file)
      try {
        const stats = fs.statSync(filePath)
        const content = fs.readFileSync(filePath, 'utf-8')
        const profile = parseProfileContent(content)
        const username = file.replace('.kesselprofile', '')
        profiles.push({
          username,
          profile,
          source: 'local',
          path: filePath,
          mtime: stats.mtime,
        })
      } catch { /* ignore */ }
    }
    
    // 2. Suche systemweite Profile in ~/.kessel/
    const os = await import('os')
    const profileDir = path.join(os.default.homedir(), '.kessel')
    
    if (fs.existsSync(profileDir)) {
      const systemFiles = fs.readdirSync(profileDir).filter(f => f.endsWith('.kesselprofile'))
      
      for (const file of systemFiles) {
        const filePath = path.join(profileDir, file)
        const username = file.replace('.kesselprofile', '')
        
        // Überspringe wenn bereits als lokales Profil gefunden
        if (profiles.some(p => p.username === username)) continue
        
        try {
          const stats = fs.statSync(filePath)
          const content = fs.readFileSync(filePath, 'utf-8')
          const profile = parseProfileContent(content)
          profiles.push({
            username,
            profile,
            source: 'system',
            path: filePath,
            mtime: stats.mtime,
          })
        } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
  
  // Sortiere nach Änderungsdatum (neueste zuerst)
  profiles.sort((a, b) => b.mtime - a.mtime)
  return profiles
}

/**
 * Parsed Profil-Inhalt im .env-Format
 */
function parseProfileContent(content) {
  const profile = {}
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      profile[key] = value
    }
  }
  return profile
}

/**
 * Schritt-Titel für Wizard-Progress
 * Step 0 ist jetzt nur "Profil auswählen" (nur bei mehreren Profilen sichtbar)
 */
const STEP_TITLES = [
  'Profil auswählen',
  'INFRA-DB URL eingeben',
  'DEV-DB URL eingeben',
  'SERVICE_ROLE_KEY eingeben',
  'Projektname eingeben',
  'Installationsordner eingeben',
  'DB-Passwort eingeben (optional)',
  'GitHub Repository konfigurieren',
  'Dependencies-Installation konfigurieren',
  'Vercel-Verknüpfung konfigurieren',
  'Initial Commit konfigurieren',
  'Push konfigurieren',
  'Dev-Server konfigurieren',
]

const TOTAL_STEPS = 13

/**
 * Wizard-Komponente für die Eingabe aller benötigten Informationen
 */
export function Wizard({ projectNameArg, onComplete, onError }) {
  const { isRawModeSupported } = useStdin()
  const [step, setStep] = useState(-1) // -1 = Loading, 0 = Profile-Auswahl (nur bei mehreren), 1+ = restliche Steps
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState('Lade Profile...')

  // Profil-System
  const [availableProfiles, setAvailableProfiles] = useState([])
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [username, setUsername] = useState('')

  // INFRA-DB URL
  const [infraUrl, setInfraUrl] = useState('')
  const [infraUrlSubmitted, setInfraUrlSubmitted] = useState(false)

  // DEV-DB URL
  const [devUrl, setDevUrl] = useState('')
  const [devUrlSubmitted, setDevUrlSubmitted] = useState(false)

  // SERVICE_ROLE_KEY
  const [serviceRoleKey, setServiceRoleKey] = useState('')
  const [serviceRoleKeySubmitted, setServiceRoleKeySubmitted] = useState(false)
  const [fetchingServiceRoleKey, setFetchingServiceRoleKey] = useState(false)
  const [serviceRoleKeyStatus, setServiceRoleKeyStatus] = useState('')

  // Projektname
  const [projectName, setProjectName] = useState(projectNameArg || '')
  const [projectNameSubmitted, setProjectNameSubmitted] = useState(false)

  // Installationsordner
  const [installPath, setInstallPath] = useState('')
  const [installPathSubmitted, setInstallPathSubmitted] = useState(false)

  // GitHub Repo
  const [createGithub, setCreateGithub] = useState(null)

  // Auto Install
  const [autoInstallDeps, setAutoInstallDeps] = useState(null)

  // Vercel Link
  const [linkVercel, setLinkVercel] = useState(null)

  // Initial Commit
  const [doInitialCommit, setDoInitialCommit] = useState(null)

  // Push
  const [doPush, setDoPush] = useState(null)

  // DB-Passwort (optional)
  const [dbPassword, setDbPassword] = useState('')
  const [dbPasswordSubmitted, setDbPasswordSubmitted] = useState(false)
  const [skipDbPassword, setSkipDbPassword] = useState(false)
  const [fetchingDbPassword, setFetchingDbPassword] = useState(false)
  const [dbPasswordFromVault, setDbPasswordFromVault] = useState(false)

  // Dev-Server starten
  const [startDevServer, setStartDevServer] = useState(null)

  // Hilfsfunktion: Profil auf State anwenden
  const applyProfile = async (profile, profileUsername) => {
    const { DEFAULTS } = await import('../config.js')
    
    setUsername(profileUsername || profile?.USERNAME || '')
    
    // INFRA-DB: Verwende SUPABASE_INFRA_URL oder SUPABASE_BACKEND_URL (nur wenn es Kessel ist)
    const backendUrl = profile?.SUPABASE_BACKEND_URL
    const isValidInfraDb = backendUrl?.includes(DEFAULTS.infraDb.projectRef)
    const infraUrlDefault = profile?.SUPABASE_INFRA_URL || (isValidInfraDb ? backendUrl : null) || DEFAULTS.infraDb.url
    setInfraUrl(infraUrlDefault)
    
    setDevUrl(profile?.SUPABASE_DEV_URL || DEFAULTS.devDb.url)
  }

  useEffect(() => {
    // Lade alle verfügbaren Profile beim Start
    const initProfiles = async () => {
      try {
        const profiles = await findAllProfiles()
        setAvailableProfiles(profiles)
        
        const { DEFAULTS } = await import('../config.js')
        
        if (profiles.length === 0) {
          // Keine Profile gefunden - nur Defaults setzen, direkt zu Step 1
          setInfraUrl(DEFAULTS.infraDb.url)
          setDevUrl(DEFAULTS.devDb.url)
          setStep(1) // Überspringe Profil-Auswahl
        } else if (profiles.length === 1) {
          // Genau ein Profil - automatisch laden, direkt zu Step 1
          const { profile, username: profileUsername } = profiles[0]
          await applyProfile(profile, profileUsername)
          setSelectedProfile(profiles[0])
          setStep(1) // Überspringe Profil-Auswahl
        } else {
          // Mehrere Profile - Auswahl anzeigen (Step 0)
          // Lade erstmal das neueste als Default
          const { profile, username: profileUsername } = profiles[0]
          await applyProfile(profile, profileUsername)
          setSelectedProfile(profiles[0])
          setStep(0) // Zeige Profil-Auswahl
        }
      } catch (error) {
        // Bei Fehler: Defaults setzen und zu Step 1
        const { DEFAULTS } = await import('../config.js')
        setInfraUrl(DEFAULTS.infraDb.url)
        setDevUrl(DEFAULTS.devDb.url)
        setStep(1)
      } finally {
        setLoading(false)
      }
    }

    initProfiles()
  }, [])

  // Versuche DB-Passwort aus Vault zu laden wenn Step 6 erreicht wird
  useEffect(() => {
    if (step === 6 && !dbPasswordSubmitted && !fetchingDbPassword && infraUrl && serviceRoleKey) {
      const fetchFromVault = async () => {
        setFetchingDbPassword(true)
        try {
          const { fetchDbPasswordFromVault } = await import('../utils/supabase.js')
          const cleanedInfraUrl = cleanUrl(infraUrl)
          const cleanedServiceRoleKey = serviceRoleKey.trim()
          
          const vaultPassword = await fetchDbPasswordFromVault(
            cleanedInfraUrl,
            cleanedServiceRoleKey,
            null // debugFn
          )
          
          if (vaultPassword) {
            setDbPassword(vaultPassword)
            setDbPasswordFromVault(true)
          }
        } catch (error) {
          // Vault-Zugriff fehlgeschlagen - ignorieren, User kann manuell eingeben
        } finally {
          setFetchingDbPassword(false)
        }
      }
      
      fetchFromVault()
    }
  }, [step, dbPasswordSubmitted, fetchingDbPassword, infraUrl, serviceRoleKey])

  // handleComplete akzeptiert optionale overrides für async-sichere Werte
  const handleComplete = async (overrides = {}) => {
    setLoading(true)
    setLoadingMessage('Finalisiere Konfiguration...')

    try {
      const { DEFAULTS } = await import('../config.js')
      const cleanedInfraUrl = cleanUrl(infraUrl)
      const cleanedDevUrl = cleanUrl(devUrl)
      const cleanedServiceRoleKey = serviceRoleKey.trim()
      const infraProjectRef = cleanedInfraUrl ? new URL(cleanedInfraUrl).hostname.split(".")[0] : null
      const devProjectRef = cleanedDevUrl ? new URL(cleanedDevUrl).hostname.split(".")[0] : null
      const schemaName = projectName.replace(/-/g, "_").toLowerCase()
      
      // Berechne projectPath basierend auf Installationsordner
      // WICHTIG: Wenn aktueller Ordner bereits Projektname ist, KEINEN Unterordner erstellen!
      const currentCwd = process.cwd()
      const currentDirName = path.basename(currentCwd)
      let projectPath
      
      if (installPath && installPath.trim() && installPath.trim() !== '.') {
        // Wenn absoluter Pfad angegeben wurde
        if (path.isAbsolute(installPath.trim())) {
          const targetPath = installPath.trim()
          const targetDirName = path.basename(targetPath)
          // Prüfe ob Zielordner bereits Projektname ist
          if (targetDirName === projectName) {
            projectPath = targetPath // KEIN zusätzlicher Unterordner!
          } else {
            projectPath = path.resolve(targetPath, projectName)
          }
        } else {
          // Relativer Pfad - relativ zum aktuellen Verzeichnis
          const resolvedPath = path.resolve(currentCwd, installPath.trim())
          const resolvedDirName = path.basename(resolvedPath)
          // Prüfe ob aufgelöster Pfad bereits Projektname ist
          if (resolvedDirName === projectName) {
            projectPath = resolvedPath // KEIN zusätzlicher Unterordner!
          } else {
            projectPath = path.resolve(resolvedPath, projectName)
          }
        }
      } else {
        // Fallback: Aktuelles Verzeichnis
        // Prüfe ob aktueller Ordner bereits Projektname ist
        if (currentDirName === projectName) {
          projectPath = currentCwd // Direkt im aktuellen Ordner, KEIN Unterordner!
        } else {
          projectPath = path.resolve(currentCwd, projectName)
        }
      }
      
      // Validiere SERVICE_ROLE_KEY gegen INFRA-DB
      if (infraProjectRef && cleanedServiceRoleKey) {
        if (!isKeyForProject(cleanedServiceRoleKey, infraProjectRef)) {
          const keyRef = extractProjectRefFromJwt(cleanedServiceRoleKey)
          throw new Error(
            `SERVICE_ROLE_KEY passt nicht zur INFRA-DB!\n` +
            `Key gehört zu: ${keyRef}\n` +
            `INFRA-DB ist: ${infraProjectRef}\n\n` +
            `Bitte den korrekten SERVICE_ROLE_KEY für "${infraProjectRef}" verwenden.`
          )
        }
      }

      // Verwende overrides wenn vorhanden (wegen async setState)
      const finalStartDevServer = overrides.startDevServer !== undefined 
        ? overrides.startDevServer 
        : startDevServer

      const finalConfig = {
        username: username.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        projectName,
        schemaName,
        projectPath, // Installationspfad hinzufügen
        infraDb: {
          url: cleanedInfraUrl,
          projectRef: infraProjectRef,
        },
        devDb: {
          url: cleanedDevUrl,
          projectRef: devProjectRef,
        },
        serviceRoleKey: cleanedServiceRoleKey,
        dbPassword: dbPassword || null, // Optional: für automatische Schema-Konfiguration
        createGithub: createGithub || 'none',
        autoInstallDeps: autoInstallDeps !== false,
        linkVercel: linkVercel === true,
        doInitialCommit: doInitialCommit !== false,
        doPush: doPush === true,
        startDevServer: finalStartDevServer === true,
      }

      if (onComplete) {
        onComplete(finalConfig)
      }
    } catch (error) {
      if (onError) {
        onError(error)
      }
    } finally {
      setLoading(false)
    }
  }

  // Berechne effektive Schrittnummer für Anzeige
  // Wenn Profil-Auswahl übersprungen wurde (0 oder 1 Profile), zeige "1/12" statt "2/13"
  const profileStepWasShown = availableProfiles.length > 1
  const effectiveTotalSteps = profileStepWasShown ? TOTAL_STEPS : TOTAL_STEPS - 1
  const effectiveCurrentStep = profileStepWasShown ? step : Math.max(0, step - 1)
  const effectiveStepTitle = profileStepWasShown ? STEP_TITLES[step] : STEP_TITLES[step] || STEP_TITLES[1]

  // Render-Schritte
  if (!isRawModeSupported) {
    return (
      <Box flexDirection="column">
        <Text color="red" bold>❌ Fehler: Raw mode wird nicht unterstützt</Text>
        <Text color="yellow">   Diese CLI benötigt ein interaktives Terminal.</Text>
        <Text color="yellow">   Bitte führe die CLI in einem Terminal aus (nicht in einem Pipe oder Script).</Text>
      </Box>
    )
  }

  if (loading) {
    return (
      <Box>
        <Spinner type="dots" />
        <Text> {loadingMessage}</Text>
      </Box>
    )
  }

  if (step === 0) {
    // Profil-Auswahl - nur wenn mehrere Profile existieren
    const profileOptions = availableProfiles.map(p => ({
      label: `${p.username} (${p.source === 'local' ? 'lokal' : '~/.kessel'})`,
      value: p.username,
    }))
    
    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={effectiveCurrentStep} totalSteps={effectiveTotalSteps} stepTitle={effectiveStepTitle} />
        <Text color="cyan" bold>Mehrere Profile gefunden - welches verwenden?</Text>
        <Text color="gray" dimColor>Die Auswahl füllt INFRA-DB, DEV-DB und andere Felder vor.</Text>
        <Box marginTop={1}>
          <SelectInput
            items={profileOptions}
            onSelect={async (item) => {
              const selected = availableProfiles.find(p => p.username === item.value)
              if (selected) {
                setSelectedProfile(selected)
                await applyProfile(selected.profile, selected.username)
              }
              setStep(1)
            }}
          />
        </Box>
        <Text color="gray" marginTop={1}>
          Aktuell vorausgewählt: {selectedProfile?.username || 'keins'}
        </Text>
      </Box>
    )
  }

  if (step === 1) {
    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={effectiveCurrentStep} totalSteps={effectiveTotalSteps} stepTitle={effectiveStepTitle} />
        <Text color="cyan" bold>INFRA-DB URL (Kessel - Auth, Vault, Multi-Tenant):</Text>
        <TextInput
          value={infraUrl}
          onChange={setInfraUrl}
          onSubmit={(value) => {
            if (value.trim()) {
              try {
                new URL(value)
                setInfraUrlSubmitted(true)
                setStep(2)
              } catch {
                // Invalid URL - bleibt auf diesem Schritt
              }
            }
          }}
        />
      </Box>
    )
  }

  if (step === 2) {
    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={effectiveCurrentStep} totalSteps={effectiveTotalSteps} stepTitle={effectiveStepTitle} />
        <Text color="cyan" bold>DEV-DB URL (App-Daten, Entwicklung):</Text>
        <TextInput
          value={devUrl}
          onChange={setDevUrl}
          onSubmit={async (value) => {
            if (value.trim()) {
              try {
                new URL(value)
                setDevUrlSubmitted(true)
                
                // Versuche automatisch SERVICE_ROLE_KEY zu holen
                setFetchingServiceRoleKey(true)
                setServiceRoleKeyStatus('Versuche SERVICE_ROLE_KEY automatisch zu holen...')
                
                try {
                  const { fetchServiceRoleKeyFromVault, fetchServiceRoleKeyFromSupabase } = await import('../utils/supabase.js')
                  const { loadExistingProfile } = await import('../wizard/initWizard.js')
                  
                  const existing = await loadExistingProfile(process.cwd())
                  const profile = existing?.profile || {}
                  const tempServiceRoleKey = profile.SUPABASE_SERVICE_ROLE_KEY || profile.SUPABASE_VAULT_SERVICE_ROLE_KEY
                  
                  let fetchedKey = null
                  const cleanedInfraUrlForFetch = cleanUrl(infraUrl)
                  const infraProjectRef = cleanedInfraUrlForFetch ? new URL(cleanedInfraUrlForFetch).hostname.split(".")[0] : null
                  
                  // Versuche 1: Aus Vault holen
                  if (tempServiceRoleKey && infraUrl) {
                    setServiceRoleKeyStatus('🔍 Versuche SERVICE_ROLE_KEY aus Vault zu holen...')
                    fetchedKey = await fetchServiceRoleKeyFromVault(infraUrl, tempServiceRoleKey, () => {})
                    
                    if (fetchedKey) {
                      setServiceRoleKeyStatus('✓ SERVICE_ROLE_KEY aus Vault geholt')
                      setServiceRoleKey(fetchedKey)
                      setFetchingServiceRoleKey(false)
                      setServiceRoleKeySubmitted(true)
                      setStep(4) // Überspringe manuelle Eingabe
                      return
                    }
                  }
                  
                  // Versuche 2: Über Management API
                  if (!fetchedKey && infraProjectRef) {
                    setServiceRoleKeyStatus('🔍 Versuche SERVICE_ROLE_KEY über Management API...')
                    fetchedKey = await fetchServiceRoleKeyFromSupabase(infraProjectRef, () => {})
                    
                    if (fetchedKey) {
                      setServiceRoleKeyStatus('✓ SERVICE_ROLE_KEY über Management API geholt')
                      setServiceRoleKey(fetchedKey)
                      setFetchingServiceRoleKey(false)
                      setServiceRoleKeySubmitted(true)
                      setStep(4) // Überspringe manuelle Eingabe
                      return
                    }
                  }
                  
                  // Versuche 3: Aus Profil (NUR wenn Key zur INFRA-DB passt!)
                  if (!fetchedKey && tempServiceRoleKey && infraProjectRef) {
                    if (isKeyForProject(tempServiceRoleKey, infraProjectRef)) {
                      setServiceRoleKeyStatus('ℹ️  Verwende SERVICE_ROLE_KEY aus Profil')
                      setServiceRoleKey(tempServiceRoleKey)
                      setFetchingServiceRoleKey(false)
                      setServiceRoleKeySubmitted(true)
                      setStep(4) // Überspringe manuelle Eingabe
                      return
                    } else {
                      const keyRef = extractProjectRefFromJwt(tempServiceRoleKey)
                      setServiceRoleKeyStatus(`⚠️  Profil-Key gehört zu ${keyRef}, nicht zu ${infraProjectRef}`)
                    }
                  }
                  
                  // Kein Key gefunden - frage manuell
                  setServiceRoleKeyStatus('⚠️  Kein SERVICE_ROLE_KEY gefunden - bitte manuell eingeben')
                  setFetchingServiceRoleKey(false)
                  setStep(3) // Gehe zu manueller Eingabe
                } catch (error) {
                  setServiceRoleKeyStatus(`⚠️  Fehler beim Abrufen: ${error.message}`)
                  setFetchingServiceRoleKey(false)
                  setStep(3) // Gehe zu manueller Eingabe
                }
              } catch {
                // Invalid URL
              }
            }
          }}
        />
        {fetchingServiceRoleKey && (
          <Box marginTop={1}>
            <Spinner type="dots" />
            <Text> {serviceRoleKeyStatus}</Text>
          </Box>
        )}
        {serviceRoleKeyStatus && !fetchingServiceRoleKey && (
          <Text color={serviceRoleKeyStatus.startsWith('✓') ? 'green' : 'yellow'} marginTop={1}>
            {serviceRoleKeyStatus}
          </Text>
        )}
      </Box>
    )
  }

  if (step === 3) {
    // Extrahiere infraProjectRef für Validierung
    const cleanedInfraUrlForValidation = cleanUrl(infraUrl)
    const infraProjectRefForValidation = cleanedInfraUrlForValidation 
      ? new URL(cleanedInfraUrlForValidation).hostname.split(".")[0] 
      : null
    
    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={effectiveCurrentStep} totalSteps={effectiveTotalSteps} stepTitle={effectiveStepTitle} />
        <Text color="cyan" bold>SERVICE_ROLE_KEY (für INFRA-DB: {infraProjectRefForValidation}):</Text>
        <Text color="gray">Der Key muss zur INFRA-DB passen, nicht zur DEV-DB!</Text>
        <TextInput
          value={serviceRoleKey}
          onChange={setServiceRoleKey}
          mask="*"
          onSubmit={(value) => {
            if (value.trim()) {
              // Validiere, ob der Key zum INFRA-Projekt passt
              if (infraProjectRefForValidation && !isKeyForProject(value.trim(), infraProjectRefForValidation)) {
                const keyRef = extractProjectRefFromJwt(value.trim())
                setServiceRoleKeyStatus(`⚠️  WARNUNG: Key gehört zu "${keyRef}", nicht zu "${infraProjectRefForValidation}"!`)
                // Trotzdem fortfahren, aber warnen
              }
              setServiceRoleKeySubmitted(true)
              setStep(4)
            }
          }}
        />
        {serviceRoleKeyStatus && <Text color="yellow">{serviceRoleKeyStatus}</Text>}
      </Box>
    )
  }

  if (step === 4) {
    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={effectiveCurrentStep} totalSteps={effectiveTotalSteps} stepTitle={effectiveStepTitle} />
        <Text color="cyan" bold>Projektname:</Text>
        <TextInput
          value={projectName}
          onChange={setProjectName}
          onSubmit={(value) => {
            if (value.trim() && /^[a-z0-9-]+$/.test(value)) {
              setProjectNameSubmitted(true)
              setStep(5)
            }
          }}
        />
      </Box>
    )
  }

  if (step === 5) {
    // Berechne Standard-Installationsordner (aktuelles Verzeichnis)
    const defaultPath = process.cwd()
    const currentDirName = path.basename(defaultPath)
    
    // Berechne vollständigen Pfad für Anzeige
    // WICHTIG: Wenn aktueller Ordner bereits Projektname ist, KEINEN Unterordner erstellen!
    const calculateFullPath = (inputPath) => {
      // Fall 1: Kein Installationspfad angegeben (leer oder ".")
      if (!inputPath || !inputPath.trim() || inputPath.trim() === '.') {
        // Prüfe ob aktueller Ordner bereits Projektname ist
        if (currentDirName === projectName) {
          return defaultPath // Direkt im aktuellen Ordner, KEIN Unterordner!
        }
        return path.resolve(defaultPath, projectName)
      }
      
      // Fall 2: Absoluter Pfad angegeben
      if (path.isAbsolute(inputPath.trim())) {
        const targetPath = inputPath.trim()
        const targetDirName = path.basename(targetPath)
        // Prüfe ob Zielordner bereits Projektname ist
        if (targetDirName === projectName) {
          return targetPath // KEIN zusätzlicher Unterordner!
        }
        return path.resolve(targetPath, projectName)
      }
      
      // Fall 3: Relativer Pfad angegeben
      const resolvedPath = path.resolve(defaultPath, inputPath.trim())
      const resolvedDirName = path.basename(resolvedPath)
      // Prüfe ob aufgelöster Pfad bereits Projektname ist
      if (resolvedDirName === projectName) {
        return resolvedPath // KEIN zusätzlicher Unterordner!
      }
      return path.resolve(resolvedPath, projectName)
    }
    
    const fullPath = calculateFullPath(installPath)
    const willUseCurrentDir = currentDirName === projectName && (!installPath || !installPath.trim() || installPath.trim() === '.')
    
    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={effectiveCurrentStep} totalSteps={effectiveTotalSteps} stepTitle={effectiveStepTitle} />
        <Text color="cyan" bold>Installationsordner:</Text>
        <Text color="gray">Aktuelles Verzeichnis: {defaultPath}</Text>
        {willUseCurrentDir ? (
          <Text color="green">✓ Ordner "{currentDirName}" entspricht Projektname - wird direkt verwendet</Text>
        ) : (
          <Text color="gray">Leer lassen für: {defaultPath}</Text>
        )}
        <TextInput
          value={installPath}
          onChange={setInstallPath}
          onSubmit={(value) => {
          setInstallPathSubmitted(true)
          setStep(6) // DB-Passwort Step
          }}
        />
        <Text color="gray" marginTop={1}>
          Vollständiger Pfad: {fullPath}
        </Text>
      </Box>
    )
  }

  if (step === 6) {
    // Optionaler DB-Passwort Step für automatische Schema-Konfiguration
    
    // Zeige Spinner während Vault-Lookup
    if (fetchingDbPassword) {
      return (
        <Box flexDirection="column">
          <WizardProgress currentStep={effectiveCurrentStep} totalSteps={effectiveTotalSteps} stepTitle={effectiveStepTitle} />
          <Text color="cyan" bold>DB-Passwort (optional):</Text>
          <Box>
            <Text color="yellow"><Spinner type="dots" /></Text>
            <Text color="gray"> Suche Passwort im Vault...</Text>
          </Box>
        </Box>
      )
    }
    
    // Wenn Passwort aus Vault geladen wurde: Automatisch übernehmen und weitermachen
    if (dbPasswordFromVault && dbPassword && !dbPasswordSubmitted) {
      // Auto-advance nach kurzer Anzeige
      setTimeout(() => {
        setDbPasswordSubmitted(true)
        setStep(7)
      }, 500)
      
      return (
        <Box flexDirection="column">
          <WizardProgress currentStep={effectiveCurrentStep} totalSteps={effectiveTotalSteps} stepTitle={effectiveStepTitle} />
          <Text color="cyan" bold>DB-Passwort (optional):</Text>
          <Text color="green">✓ Aus Vault geladen (SUPABASE_DB_PASSWORD)</Text>
          <Text color="gray">Passwort: {dbPassword.substring(0, 4)}{'*'.repeat(Math.max(0, dbPassword.length - 4))}</Text>
          <Text color="green" marginTop={1}>→ Wird automatisch übernommen...</Text>
        </Box>
      )
    }
    
    // Manuelle Eingabe (nur wenn kein Vault-Passwort)
    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={effectiveCurrentStep} totalSteps={effectiveTotalSteps} stepTitle={effectiveStepTitle} />
        <Text color="cyan" bold>DB-Passwort (optional):</Text>
        <Text color="gray">Für automatische Schema-Konfiguration (PostgREST)</Text>
        <Text color="gray">Leer lassen = später manuell via Migration</Text>
        <TextInput
          value={dbPassword}
          onChange={setDbPassword}
          onSubmit={(value) => {
            if (value.trim()) {
              setDbPassword(value.trim())
            }
            setDbPasswordSubmitted(true)
            setStep(7) // Weiter zu GitHub
          }}
        />
        <Text color="gray" marginTop={1}>
          {dbPassword 
            ? '✓ Passwort eingegeben - Enter zum Fortfahren'
            : 'Leer lassen = Migration-Datei wird erstellt'}
        </Text>
      </Box>
    )
  }

  if (step === 7) {
    const githubOptions = [
      { label: 'Ja, privat', value: 'private' },
      { label: 'Ja, öffentlich', value: 'public' },
      { label: 'Nein, nur lokal', value: 'none' },
    ]

    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={effectiveCurrentStep} totalSteps={effectiveTotalSteps} stepTitle={effectiveStepTitle} />
        <Text color="cyan" bold>GitHub Repository erstellen?</Text>
        <SelectInput
          items={githubOptions}
          onSelect={(item) => {
            setCreateGithub(item.value)
            setStep(8)
          }}
        />
      </Box>
    )
  }

  if (step === 8) {
    const yesNoOptions = [
      { label: 'Ja', value: true },
      { label: 'Nein', value: false },
    ]
    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={effectiveCurrentStep} totalSteps={effectiveTotalSteps} stepTitle={effectiveStepTitle} />
        <Text color="cyan" bold>Dependencies automatisch installieren?</Text>
        <SelectInput
          items={yesNoOptions}
          initialSelectedIndex={0}
          onSelect={(item) => {
            setAutoInstallDeps(item.value)
            setStep(9)
          }}
        />
      </Box>
    )
  }

  if (step === 9) {
    const yesNoOptions = [
      { label: 'Ja', value: true },
      { label: 'Nein', value: false },
    ]
    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={effectiveCurrentStep} totalSteps={effectiveTotalSteps} stepTitle={effectiveStepTitle} />
        <Text color="cyan" bold>Mit Vercel verknüpfen?</Text>
        <SelectInput
          items={yesNoOptions}
          initialSelectedIndex={1}
          onSelect={(item) => {
            setLinkVercel(item.value)
            setStep(10)
          }}
        />
      </Box>
    )
  }

  if (step === 10) {
    const yesNoOptions = [
      { label: 'Ja', value: true },
      { label: 'Nein', value: false },
    ]
    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={effectiveCurrentStep} totalSteps={effectiveTotalSteps} stepTitle={effectiveStepTitle} />
        <Text color="cyan" bold>Initial Commit erstellen?</Text>
        <SelectInput
          items={yesNoOptions}
          initialSelectedIndex={0}
          onSelect={(item) => {
            setDoInitialCommit(item.value)
            setStep(11)
          }}
        />
      </Box>
    )
  }

  if (step === 11) {
    const yesNoOptions = [
      { label: 'Ja', value: true },
      { label: 'Nein', value: false },
    ]
    const defaultIndex = (createGithub !== 'none' && doInitialCommit) ? 0 : 1
    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={effectiveCurrentStep} totalSteps={effectiveTotalSteps} stepTitle={effectiveStepTitle} />
        <Text color="cyan" bold>Änderungen zu GitHub pushen?</Text>
        <SelectInput
          items={yesNoOptions}
          initialSelectedIndex={defaultIndex}
          onSelect={(item) => {
            setDoPush(item.value)
            setStep(12)
          }}
        />
      </Box>
    )
  }

  if (step === 12) {
    const yesNoOptions = [
      { label: 'Ja, Dev-Server starten', value: true },
      { label: 'Nein, nur Projekt erstellen', value: false },
    ]
    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={effectiveCurrentStep} totalSteps={effectiveTotalSteps} stepTitle={effectiveStepTitle} />
        <Text color="cyan" bold>Dev-Server nach Erstellung starten?</Text>
        <Text color="gray">Startet `pnpm dev` im Projekt-Verzeichnis</Text>
        <SelectInput
          items={yesNoOptions}
          initialSelectedIndex={0}
          onSelect={(item) => {
            setStartDevServer(item.value)
            // WICHTIG: Wert direkt übergeben wegen async setState!
            handleComplete({ startDevServer: item.value })
          }}
        />
      </Box>
    )
  }

  return null
}

