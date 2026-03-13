import React, { useEffect, useState } from 'react'
import { Box, Text, useApp } from 'ink'
import { spawn } from 'child_process'

/**
 * Success-Komponente nach erfolgreicher Projekt-Erstellung
 * Boilerplate 3.0: Supabase + Clerk + SpacetimeDB
 */
export function Success({ config, ctx, projectPath }) {
  const { exit } = useApp()
  const [devServerStarting, setDevServerStarting] = useState(false)

  useEffect(() => {
    if (config.startDevServer && !devServerStarting) {
      setDevServerStarting(true)
      const timer = setTimeout(() => {
        exit()
        console.log(`\n🚀 Starte Dev-Server in ${projectPath}...\n`)
        const devCmd = ctx.packageManager?.name === 'npm' ? 'npm' : 'pnpm'
        const devProcess = spawn(devCmd, ['run', 'dev'], { cwd: projectPath, stdio: 'inherit', shell: true })
        devProcess.on('error', (err) => { console.error(`\n❌ Fehler: ${err.message}`); process.exit(1) })
        devProcess.on('close', (code) => { process.exit(code || 0) })
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [config.startDevServer, devServerStarting, exit, projectPath, ctx.packageManager])

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="green" bold>
        {`✨ Projekt "${config.projectName}" erfolgreich erstellt!`}
      </Text>
      
      {config.startDevServer ? (
        <Box marginTop={1} flexDirection="column">
          <Text color="cyan" bold>🚀 Dev-Server wird gestartet...</Text>
          <Text color="white">{`  → http://localhost:3000`}</Text>
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          <Text color="cyan" bold>📋 Naechste Schritte:</Text>
          <Text color="white">{`  1. cd ${config.projectName}`}</Text>
          <Text color="white">{`  2. pnpm dev`}</Text>
          <Text color="white">{`  → http://localhost:3000`}</Text>
        </Box>
      )}
      
      <Box marginTop={1} flexDirection="column">
        <Text color="gray" bold>📝 Projekt-Details:</Text>
        <Text color="gray">{`  Supabase:    ${config.supabase?.projectRef || 'N/A'}`}</Text>
        <Text color="gray">{`  Clerk:       ${config.clerkMode === 'dedicated' ? 'Eigene Application' : 'Shared (pull-env)'}`}</Text>
        <Text color="gray">{`  SpacetimeDB: ${config.spacetimeDatabase || 'uebersprungen'}`}</Text>
        {ctx.repoUrl && <Text color="gray">{`  GitHub:      ${ctx.repoUrl}`}</Text>}
      </Box>
      
      {ctx.logFilePath && (
        <Box marginTop={1} flexDirection="column">
          <Text color="gray" bold>📄 Log-Datei:</Text>
          <Text color="gray">{`  ${ctx.logFilePath}`}</Text>
        </Box>
      )}
      
      {!config.startDevServer && (
        <Text color="green" bold marginTop={1}>{`\n🚀 Happy Coding!\n`}</Text>
      )}
    </Box>
  )
}
