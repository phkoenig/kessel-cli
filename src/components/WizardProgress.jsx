import React from 'react'
import { Box, Text } from 'ink'

/**
 * Zeigt den Fortschritt des Wizards an
 * @param {number} currentStep - Aktueller Schritt (0-basiert)
 * @param {number} totalSteps - Gesamtzahl der Schritte
 * @param {string} stepTitle - Titel des aktuellen Schritts
 */
export function WizardProgress({ currentStep, totalSteps, stepTitle }) {
  const progress = Math.round(((currentStep + 1) / totalSteps) * 100)
  const progressBarWidth = 20
  const filled = Math.round((progress / 100) * progressBarWidth)
  const empty = progressBarWidth - filled
  
  const progressBar = '█'.repeat(filled) + '░'.repeat(empty)
  
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color="cyan" bold>
          Schritt {currentStep + 1}/{totalSteps}
        </Text>
        <Text color="gray"> - </Text>
        <Text color="white">{stepTitle}</Text>
      </Box>
      <Box>
        <Text color="cyan">{progressBar}</Text>
        <Text color="gray"> {progress}%</Text>
      </Box>
    </Box>
  )
}
