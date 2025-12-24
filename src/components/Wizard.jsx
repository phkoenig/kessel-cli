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
 * Schritt-Titel für Wizard-Progress
 */
const STEP_TITLES = [
  'Username eingeben',
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
  const [step, setStep] = useState(0)
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')

  // Schritt 1: Username
  const [username, setUsername] = useState('')
  const [usernameSubmitted, setUsernameSubmitted] = useState(false)

  // Schritt 2: INFRA-DB URL
  const [infraUrl, setInfraUrl] = useState('')
  const [infraUrlSubmitted, setInfraUrlSubmitted] = useState(false)

  // Schritt 3: DEV-DB URL
  const [devUrl, setDevUrl] = useState('')
  const [devUrlSubmitted, setDevUrlSubmitted] = useState(false)

  // Schritt 4: SERVICE_ROLE_KEY
  const [serviceRoleKey, setServiceRoleKey] = useState('')
  const [serviceRoleKeySubmitted, setServiceRoleKeySubmitted] = useState(false)
  const [fetchingServiceRoleKey, setFetchingServiceRoleKey] = useState(false)
  const [serviceRoleKeyStatus, setServiceRoleKeyStatus] = useState('')

  // Schritt 5: Projektname
  const [projectName, setProjectName] = useState(projectNameArg || '')
  const [projectNameSubmitted, setProjectNameSubmitted] = useState(false)

  // Schritt 6: Installationsordner
  const [installPath, setInstallPath] = useState('')
  const [installPathSubmitted, setInstallPathSubmitted] = useState(false)

  // Schritt 7: GitHub Repo
  const [createGithub, setCreateGithub] = useState(null)

  // Schritt 8: Auto Install
  const [autoInstallDeps, setAutoInstallDeps] = useState(null)

  // Schritt 9: Vercel Link
  const [linkVercel, setLinkVercel] = useState(null)

  // Schritt 10: Initial Commit
  const [doInitialCommit, setDoInitialCommit] = useState(null)

  // Schritt 11: Push
  const [doPush, setDoPush] = useState(null)

  // Schritt 6: DB-Passwort (optional, für automatische Schema-Konfiguration)
  const [dbPassword, setDbPassword] = useState('')
  const [dbPasswordSubmitted, setDbPasswordSubmitted] = useState(false)
  const [skipDbPassword, setSkipDbPassword] = useState(false)
  const [fetchingDbPassword, setFetchingDbPassword] = useState(false)
  const [dbPasswordFromVault, setDbPasswordFromVault] = useState(false)

  // Schritt 13: Dev-Server starten
  const [startDevServer, setStartDevServer] = useState(null)

  useEffect(() => {
    // Lade existierendes Profil beim Start
    const loadProfile = async () => {
      try {
        const { loadExistingProfile } = await import('../wizard/initWizard.js')
        const { DEFAULTS } = await import('../config.js')
        const existing = await loadExistingProfile(process.cwd())
        
        if (existing?.profile) {
          const profile = existing.profile
          setUsername(profile.USERNAME || existing.username || '')
          
          // INFRA-DB: Verwende SUPABASE_INFRA_URL oder SUPABASE_BACKEND_URL (nur wenn es Kessel ist)
          const backendUrl = profile.SUPABASE_BACKEND_URL
          const isValidInfraDb = backendUrl?.includes(DEFAULTS.infraDb.projectRef)
          const infraUrlDefault = profile.SUPABASE_INFRA_URL || (isValidInfraDb ? backendUrl : null) || DEFAULTS.infraDb.url
          setInfraUrl(infraUrlDefault)
          
          setDevUrl(profile.SUPABASE_DEV_URL || DEFAULTS.devDb.url)
        } else {
          // Setze Defaults wenn kein Profil gefunden
          const { DEFAULTS } = await import('../config.js')
          setInfraUrl(DEFAULTS.infraDb.url)
          setDevUrl(DEFAULTS.devDb.url)
        }
      } catch (error) {
        // Setze Defaults bei Fehler
        import('../config.js').then(({ DEFAULTS }) => {
          setInfraUrl(DEFAULTS.infraDb.url)
          setDevUrl(DEFAULTS.devDb.url)
        })
      }
    }

    loadProfile()
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
      let projectPath
      if (installPath && installPath.trim()) {
        // Wenn absoluter Pfad angegeben wurde
        if (path.isAbsolute(installPath.trim())) {
          projectPath = path.resolve(installPath.trim(), projectName)
        } else {
          // Relativer Pfad - relativ zum aktuellen Verzeichnis
          projectPath = path.resolve(process.cwd(), installPath.trim(), projectName)
        }
      } else {
        // Fallback: Aktuelles Verzeichnis + Projektname
        projectPath = path.resolve(process.cwd(), projectName)
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
    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} stepTitle={STEP_TITLES[step]} />
        <Text color="cyan" bold>Dein Username:</Text>
        <TextInput
          value={username}
          onChange={setUsername}
          onSubmit={(value) => {
            if (value.trim()) {
              setUsernameSubmitted(true)
              setStep(1)
            }
          }}
        />
      </Box>
    )
  }

  if (step === 1) {
    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} stepTitle={STEP_TITLES[step]} />
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
        <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} stepTitle={STEP_TITLES[step]} />
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
        <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} stepTitle={STEP_TITLES[step]} />
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
        <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} stepTitle={STEP_TITLES[step]} />
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
    
    // Berechne vollständigen Pfad für Anzeige
    const calculateFullPath = (inputPath) => {
      if (!inputPath || !inputPath.trim()) {
        return path.resolve(defaultPath, projectName)
      }
      if (path.isAbsolute(inputPath.trim())) {
        return path.resolve(inputPath.trim(), projectName)
      }
      return path.resolve(defaultPath, inputPath.trim(), projectName)
    }
    
    const fullPath = calculateFullPath(installPath)
    
    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} stepTitle={STEP_TITLES[step]} />
        <Text color="cyan" bold>Installationsordner:</Text>
        <Text color="gray">Aktuelles Verzeichnis: {defaultPath}</Text>
        <Text color="gray">Leer lassen für: {defaultPath}</Text>
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
          <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} stepTitle={STEP_TITLES[step]} />
          <Text color="cyan" bold>DB-Passwort (optional):</Text>
          <Box>
            <Text color="yellow"><Spinner type="dots" /></Text>
            <Text color="gray"> Suche Passwort im Vault...</Text>
          </Box>
        </Box>
      )
    }
    
    return (
      <Box flexDirection="column">
        <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} stepTitle={STEP_TITLES[step]} />
        <Text color="cyan" bold>DB-Passwort (optional):</Text>
        {dbPasswordFromVault ? (
          <Text color="green">✓ Aus Vault geladen (SUPABASE_DB_PASSWORD)</Text>
        ) : (
          <>
            <Text color="gray">Für automatische Schema-Konfiguration (PostgREST)</Text>
            <Text color="gray">Leer lassen = später manuell via Migration</Text>
          </>
        )}
        <TextInput
          value={dbPassword}
          onChange={(value) => {
            setDbPassword(value)
            // Wenn User ändert, ist es nicht mehr aus Vault
            if (dbPasswordFromVault && value !== dbPassword) {
              setDbPasswordFromVault(false)
            }
          }}
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
            ? (dbPasswordFromVault ? '↵ Enter zum Bestätigen' : '✓ Passwort eingegeben')
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
        <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} stepTitle={STEP_TITLES[step]} />
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
        <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} stepTitle={STEP_TITLES[step]} />
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
        <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} stepTitle={STEP_TITLES[step]} />
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
        <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} stepTitle={STEP_TITLES[step]} />
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
        <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} stepTitle={STEP_TITLES[step]} />
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
        <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} stepTitle={STEP_TITLES[step]} />
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

