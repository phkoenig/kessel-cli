import React from 'react'
import { Box, Text } from 'ink'

/**
 * Success-Komponente nach erfolgreicher Projekt-Erstellung
 */
export function Success({ config, ctx, projectPath }) {
  return (
    <Box flexDirection="column">
      <Text color="green" bold>
        {`\n✨ Projekt "${config.projectName}" erfolgreich erstellt!\n`}
      </Text>
      <Text color="cyan" bold>📋 Nächste Schritte:</Text>
      <Text>{`  cd ${config.projectName}`}</Text>
      <Text>{`  ${ctx.packageManager?.devCommand || "pnpm dev"}`}</Text>
      <Text>{`  http://localhost:3000\n`}</Text>
    </Box>
  )
}

