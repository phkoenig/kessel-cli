import React, { useState, useEffect } from 'react'
import { Box, Text, useApp } from 'ink'
import Spinner from 'ink-spinner'
import { runInitWizard } from '../wizard/initWizard.js'

/**
 * Wizard-Wrapper fuer Ink.
 * Ruft den enquirer-basierten initWizard auf und uebergibt das Ergebnis.
 *
 * Boilerplate 3.0: Supabase + Clerk + SpacetimeDB
 * (kein INFRA-DB / DEV-DB mehr)
 */
export function Wizard({ projectNameArg, onComplete, onError }) {
  const { exit } = useApp()
  const [running, setRunning] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const run = async () => {
      try {
        const config = await runInitWizard(projectNameArg, process.cwd())
        setRunning(false)
        if (onComplete) onComplete(config)
      } catch (err) {
        setRunning(false)
        setError(err)
        if (onError) onError(err)
      }
    }
    run()
  }, [])

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red" bold>❌ Wizard fehlgeschlagen: {error.message}</Text>
      </Box>
    )
  }

  if (running) {
    return (
      <Box>
        <Spinner type="dots" />
        <Text> Wizard laeuft (enquirer)...</Text>
      </Box>
    )
  }

  return null
}
