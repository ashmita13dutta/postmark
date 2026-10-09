import { useSyncExternalStore } from 'react'
import { getReaderState, subscribeReader } from './client'

/** The reader's current state: { status, loaded, total, error }. Re-renders when it changes. */
export function useReader() {
  return useSyncExternalStore(subscribeReader, getReaderState)
}
