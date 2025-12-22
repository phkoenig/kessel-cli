import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import { Spinner } from 'ink-spinner'

/**
 * Task-Liste Komponente
 */
export function TaskList({ tasks, ctx, setCtx, onComplete, onError }) {
  const [taskStates, setTaskStates] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (tasks.length === 0) {
      return
    }

    const executeTasks = async () => {
      for (let i = 0; i < tasks.length; i++) {
        const taskDef = tasks[i]

        // Prüfe ob Task übersprungen werden soll
        if (taskDef.skip && typeof taskDef.skip === 'function' && taskDef.skip()) {
          setTaskStates(prev => ({
            ...prev,
            [i]: { status: 'skipped', message: 'übersprungen' }
          }))
          continue
        }

        // Setze Task auf "running"
        setTaskStates(prev => ({
          ...prev,
          [i]: { status: 'running' }
        }))
        setCurrentIndex(i)

        try {
          // Erstelle Mock-Task-Objekt für Task-Funktion
          const mockTask = {
            title: taskDef.title,
            output: '',
            skip: () => false,
          }

          // Erstelle lokale Kopie des Contexts für diese Task
          const taskCtx = { ...ctx }

          // Führe Task aus
          await taskDef.task(taskCtx, mockTask)

          // Update Context mit Änderungen aus der Task
          setCtx(prevCtx => ({ ...prevCtx, ...taskCtx }))

          // Setze Task auf "completed"
          setTaskStates(prev => ({
            ...prev,
            [i]: { status: 'completed' }
          }))
        } catch (error) {
          // Setze Task auf "error"
          setTaskStates(prev => ({
            ...prev,
            [i]: { status: 'error', error: error.message }
          }))
          
          if (onError) {
            onError(error)
          }
          return
        }
      }

      // Alle Tasks abgeschlossen
      if (onComplete) {
        onComplete()
      }
    }

    executeTasks()
  }, [tasks])

  return (
    <Box flexDirection="column">
      {tasks.map((taskDef, index) => {
        const state = taskStates[index]
        
        if (!state) {
          return null
        }

        if (state.status === 'skipped') {
          return (
            <Text key={index} dimColor>
              {`  ⏭  ${taskDef.title} (${state.message})`}
            </Text>
          )
        }

        if (state.status === 'running') {
          return (
            <Box key={index} flexDirection="row">
              <Text color="cyan">
                {`  ⏳ ${taskDef.title}...`}
              </Text>
              <Spinner type="dots" />
            </Box>
          )
        }

        if (state.status === 'completed') {
          return (
            <Text key={index} color="green">
              {`  ✓ ${taskDef.title}`}
            </Text>
          )
        }

        if (state.status === 'error') {
          return (
            <Box key={index} flexDirection="column">
              <Text color="red">
                {`  ✗ ${taskDef.title}`}
              </Text>
              <Text color="red">
                {`    Fehler: ${state.error}`}
              </Text>
            </Box>
          )
        }

        return null
      })}
    </Box>
  )
}

