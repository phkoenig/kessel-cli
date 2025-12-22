import React from 'react'
import { Box, Text } from 'ink'

/**
 * Banner-Komponente für die CLI
 */
export function Banner() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        {'  ╔═════════════════════════════════════╗'}
      </Text>
      <Text bold color="cyan">
        {'  ║     🚀 KESSEL CLI v2.1.0            ║'}
      </Text>
      <Text bold color="cyan">
        {'  ║     B2B App Boilerplate Generator   ║'}
      </Text>
      <Text bold color="cyan">
        {'  ╚═════════════════════════════════════╝'}
      </Text>
    </Box>
  )
}

