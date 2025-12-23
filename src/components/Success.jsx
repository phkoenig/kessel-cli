import React from 'react'
import { Box, Text } from 'ink'

/**
 * Success-Komponente nach erfolgreicher Projekt-Erstellung
 */
export function Success({ config, ctx, projectPath }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="green" bold>
        {`✨ Projekt "${config.projectName}" erfolgreich erstellt!`}
      </Text>
      
      <Box marginTop={1} flexDirection="column">
        <Text color="cyan" bold>📋 Nächste Schritte:</Text>
        <Text color="white">{`  1. cd ${config.projectName}`}</Text>
        {ctx.migrationPending && (
          <>
            <Text color="yellow">{`  2. export SUPABASE_DB_PASSWORD=dein-password`}</Text>
            <Text color="yellow">{`  3. pnpm db:migrate`}</Text>
            <Text color="white">{`  4. pnpm dev`}</Text>
          </>
        )}
        {!ctx.migrationPending && (
          <Text color="white">{`  2. pnpm dev`}</Text>
        )}
        <Text color="white">{`  → http://localhost:3000`}</Text>
      </Box>
      
      <Box marginTop={1} flexDirection="column">
        <Text color="gray" bold>📝 Projekt-Details:</Text>
        <Text color="gray">{`  Schema: ${config.schemaName}`}</Text>
        <Text color="gray">{`  INFRA-DB: ${config.infraDb?.projectRef || 'N/A'}`}</Text>
        <Text color="gray">{`  DEV-DB: ${config.devDb?.projectRef || 'N/A'}`}</Text>
        {ctx.repoUrl && <Text color="gray">{`  GitHub: ${ctx.repoUrl}`}</Text>}
      </Box>
      
      {ctx.logFilePath && (
        <Box marginTop={1} flexDirection="column">
          <Text color="gray" bold>📄 Log-Datei:</Text>
          <Text color="gray">{`  ${ctx.logFilePath}`}</Text>
        </Box>
      )}
      
      <Text color="green" bold marginTop={1}>{`\n🚀 Happy Coding!\n`}</Text>
    </Box>
  )
}

