import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import SelectInput from 'ink-select-input'
// ConfirmInput wird durch einfache TextInput + Enter-Validation ersetzt
import Spinner from 'ink-spinner'

/**
 * Wizard-Komponente für die Eingabe aller benötigten Informationen
 */
export function Wizard({ projectNameArg, onComplete, onError }) {
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

  // Schritt 6: GitHub Repo
  const [createGithub, setCreateGithub] = useState(null)

  // Schritt 7: Auto Install
  const [autoInstallDeps, setAutoInstallDeps] = useState(null)

  // Schritt 8: Vercel Link
  const [linkVercel, setLinkVercel] = useState(null)

  // Schritt 9: Initial Commit
  const [doInitialCommit, setDoInitialCommit] = useState(null)

  // Schritt 10: Push
  const [doPush, setDoPush] = useState(null)

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

  const handleComplete = async () => {
    setLoading(true)
    setLoadingMessage('Finalisiere Konfiguration...')

    try {
      const { DEFAULTS } = await import('../config.js')
      const infraProjectRef = infraUrl ? new URL(infraUrl).hostname.split(".")[0] : null
      const devProjectRef = devUrl ? new URL(devUrl).hostname.split(".")[0] : null
      const schemaName = projectName.replace(/-/g, "_").toLowerCase()

      const finalConfig = {
        username: username.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        projectName,
        schemaName,
        infraDb: {
          url: infraUrl.trim(),
          projectRef: infraProjectRef,
        },
        devDb: {
          url: devUrl.trim(),
          projectRef: devProjectRef,
        },
        serviceRoleKey: serviceRoleKey.trim(),
        createGithub: createGithub || 'none',
        autoInstallDeps: autoInstallDeps !== false,
        linkVercel: linkVercel === true,
        doInitialCommit: doInitialCommit !== false,
        doPush: doPush === true,
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
                  const infraProjectRef = infraUrl ? new URL(infraUrl).hostname.split(".")[0] : null
                  
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
                  
                  // Versuche 3: Aus Profil
                  if (!fetchedKey && tempServiceRoleKey) {
                    setServiceRoleKeyStatus('ℹ️  Verwende SERVICE_ROLE_KEY aus Profil')
                    setServiceRoleKey(tempServiceRoleKey)
                    setFetchingServiceRoleKey(false)
                    setServiceRoleKeySubmitted(true)
                    setStep(4) // Überspringe manuelle Eingabe
                    return
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
    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>SERVICE_ROLE_KEY (für INFRA-DB/Vault-Zugriff):</Text>
        <TextInput
          value={serviceRoleKey}
          onChange={setServiceRoleKey}
          mask="*"
          onSubmit={(value) => {
            if (value.trim()) {
              setServiceRoleKeySubmitted(true)
              setStep(4)
            }
          }}
        />
      </Box>
    )
  }

  if (step === 4) {
    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>Projektname:</Text>
        <TextInput
          value={projectName}
          onChange={setProjectName}
          onSubmit={(value) => {
            if (value.trim() && /^[a-z0-9-]+$/.test(value)) {
              setProjectNameSubmitted(true)
              setStep(6)
            }
          }}
        />
      </Box>
    )
  }

  if (step === 5) {
    const githubOptions = [
      { label: 'Ja, privat', value: 'private' },
      { label: 'Ja, öffentlich', value: 'public' },
      { label: 'Nein, nur lokal', value: 'none' },
    ]

    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>GitHub Repository erstellen?</Text>
        <SelectInput
          items={githubOptions}
          onSelect={(item) => {
            setCreateGithub(item.value)
            setStep(6)
          }}
        />
      </Box>
    )
  }

  if (step === 6) {
    const yesNoOptions = [
      { label: 'Ja', value: true },
      { label: 'Nein', value: false },
    ]
    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>Dependencies automatisch installieren?</Text>
        <SelectInput
          items={yesNoOptions}
          initialSelectedIndex={0}
          onSelect={(item) => {
            setAutoInstallDeps(item.value)
            setStep(7)
          }}
        />
      </Box>
    )
  }

  if (step === 7) {
    const yesNoOptions = [
      { label: 'Ja', value: true },
      { label: 'Nein', value: false },
    ]
    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>Mit Vercel verknüpfen?</Text>
        <SelectInput
          items={yesNoOptions}
          initialSelectedIndex={1}
          onSelect={(item) => {
            setLinkVercel(item.value)
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
        <Text color="cyan" bold>Initial Commit erstellen?</Text>
        <SelectInput
          items={yesNoOptions}
          initialSelectedIndex={0}
          onSelect={(item) => {
            setDoInitialCommit(item.value)
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
    const defaultIndex = (createGithub !== 'none' && doInitialCommit) ? 0 : 1
    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>Änderungen zu GitHub pushen?</Text>
        <SelectInput
          items={yesNoOptions}
          initialSelectedIndex={defaultIndex}
          onSelect={(item) => {
            setDoPush(item.value)
            handleComplete()
          }}
        />
      </Box>
    )
  }

  return null
}

