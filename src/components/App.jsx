import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import path from 'path'
import { Banner } from './Banner.jsx'
import { PhaseHeader } from './PhaseHeader.jsx'
import { TaskList } from './TaskList.jsx'
import { Wizard } from './Wizard.jsx'
import { Success } from './Success.jsx'
import { createPrecheckTasks } from '../tasks/phase1-prechecks.js'
import { createSetupTasks } from '../tasks/phase2-setup.js'
import { createProjectTasks } from '../tasks/phase3-create.js'

/**
 * Haupt-App-Komponente für den Init-Flow
 */
export function App({ projectNameArg, verbose, onComplete, onError }) {
  const [phase, setPhase] = useState('wizard') // wizard | prechecks | setup | create | success
  const [config, setConfig] = useState(null)
  const [ctx, setCtx] = useState({})
  const [tasks, setTasks] = useState([])
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  
  // Berechne projectPath basierend auf projectNameArg
  const currentCwd = process.cwd()
  const projectName = projectNameArg || path.basename(currentCwd)
  const projectPath = path.resolve(currentCwd, projectName)

  // Phase 0: Wizard
  const handleWizardComplete = (wizardConfig) => {
    setConfig(wizardConfig)
    setPhase('prechecks')
  }

  // Phase 1: Pre-Checks
  useEffect(() => {
    if (phase === 'prechecks' && config) {
      const precheckTasks = createPrecheckTasks(config, { verbose })
      setTasks(precheckTasks.tasks || [])
      setCurrentTaskIndex(0)
    }
  }, [phase, config, verbose])

  // Phase 2: Setup
  useEffect(() => {
    if (phase === 'setup' && config) {
      const setupTasks = createSetupTasks(config, { verbose })
      setTasks(setupTasks.tasks || [])
      setCurrentTaskIndex(0)
    }
  }, [phase, config, verbose])

  // Phase 3: Create
  useEffect(() => {
    if (phase === 'create' && config && projectPath) {
      const createTasks = createProjectTasks(config, ctx, projectPath, { verbose })
      setTasks(createTasks.tasks || [])
      setCurrentTaskIndex(0)
    }
  }, [phase, config, ctx, projectPath, verbose])

  const handleTasksComplete = () => {
    if (phase === 'prechecks') {
      setPhase('setup')
    } else if (phase === 'setup') {
      setPhase('create')
    } else if (phase === 'create') {
      setPhase('success')
      if (onComplete) {
        onComplete({ config, ctx, projectPath })
      }
    }
  }

  const handleError = (error) => {
    if (onError) {
      onError(error)
    }
  }

  return (
    <Box flexDirection="column">
      <Banner />
      
      {phase === 'wizard' && (
        <Wizard
          projectNameArg={projectNameArg}
          onComplete={handleWizardComplete}
          onError={handleError}
        />
      )}

      {phase === 'prechecks' && (
        <>
          <PhaseHeader phase={1} title="PRE-CHECKS" progress={20} />
          <TaskList
            tasks={tasks}
            ctx={ctx}
            setCtx={setCtx}
            verbose={verbose}
            onComplete={handleTasksComplete}
            onError={handleError}
          />
        </>
      )}

      {phase === 'setup' && (
        <>
          <PhaseHeader phase={2} title="SETUP" progress={40} />
          <TaskList
            tasks={tasks}
            ctx={ctx}
            setCtx={setCtx}
            verbose={verbose}
            onComplete={handleTasksComplete}
            onError={handleError}
          />
        </>
      )}

      {phase === 'create' && (
        <>
          <PhaseHeader phase={3} title="PROJEKT-ERSTELLUNG" progress={60} />
          <TaskList
            tasks={tasks}
            ctx={ctx}
            setCtx={setCtx}
            verbose={verbose}
            onComplete={handleTasksComplete}
            onError={handleError}
          />
        </>
      )}

      {phase === 'success' && config && (
        <Success config={config} ctx={ctx} projectPath={projectPath} />
      )}
    </Box>
  )
}

