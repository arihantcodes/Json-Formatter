"use client"

import { useState, useCallback, useRef } from "react"

interface HistoryState<T> {
  past: T[]
  present: T
  future: T[]
}

interface UseHistoryReturn<T> {
  state: T
  setState: (newState: T) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  clear: () => void
  historySize: number
}

export function useHistory<T>(initialState: T, maxHistorySize = 50): UseHistoryReturn<T> {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  })

  const lastUpdateTime = useRef<number>(0)
  const debounceDelay = 500 // 500ms debounce for history entries

  const setState = useCallback(
    (newState: T) => {
      const now = Date.now()
      const shouldCreateHistoryEntry = now - lastUpdateTime.current > debounceDelay

      setHistory((prev) => {
        // If the new state is the same as current, don't update
        if (JSON.stringify(prev.present) === JSON.stringify(newState)) {
          return prev
        }

        if (shouldCreateHistoryEntry) {
          // Create new history entry
          const newPast = [...prev.past, prev.present]

          // Limit history size
          if (newPast.length > maxHistorySize) {
            newPast.shift()
          }

          lastUpdateTime.current = now
          return {
            past: newPast,
            present: newState,
            future: [], // Clear future when new state is set
          }
        } else {
          // Just update present without creating history entry
          return {
            ...prev,
            present: newState,
          }
        }
      })
    },
    [maxHistorySize, debounceDelay],
  )

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev

      const previous = prev.past[prev.past.length - 1]
      const newPast = prev.past.slice(0, prev.past.length - 1)

      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev

      const next = prev.future[0]
      const newFuture = prev.future.slice(1)

      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      }
    })
  }, [])

  const clear = useCallback(() => {
    setHistory((prev) => ({
      past: [],
      present: prev.present,
      future: [],
    }))
  }, [])

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    clear,
    historySize: history.past.length + history.future.length + 1,
  }
}
