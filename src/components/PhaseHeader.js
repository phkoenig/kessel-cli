import React from 'react'
import { Box, Text } from 'ink'

/**
 * Phase-Header mit Progress Bar
 */
export function PhaseHeader({ phase, title, progress }) {
  const progressBarWidth = 30
  const filled = Math.round((progress / 100) * progressBarWidth)
  const empty = progressBarWidth - filled
  const progressBar = '█'.repeat(filled) + '░'.repeat(empty)
  const progressStr = `${progress}%`.padStart(4)
  const titlePadding = 30 - title.length

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Text color="cyan" bold>
        {`  ╔═══ PHASE ${phase}: ${title} ${'═'.repeat(titlePadding)}╗`}
      </Text>
      <Text color="cyan">
        {`  ║ ${progressBar} ${progressStr} ║`}
      </Text>
      <Text color="cyan">
        {`  ╚${'═'.repeat(45)}╝`}
      </Text>
    </Box>
  )
}

