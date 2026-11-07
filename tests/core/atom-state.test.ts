/**
 * @fileoverview Unit tests for Versioned State Atom Pattern.
 * Follows TDD methodology.
 */

import { describe, expect, test } from 'claude-code/testing'
import {
  createAtom,
  readAtom,
  updateAtom,
  resetMemoryStoreForTesting,
  type AtomDefinition
} from '../../src/core/state/atom.js'

interface SampleState {
  counter: number
  message: string
}

describe('Versioned State Atom Pattern (TDD)', () => {
  const sampleAtom: AtomDefinition<SampleState> = createAtom<SampleState>({
    key: 'test:sample_state',
    version: 2,
    initial: {
      counter: 0,
      message: 'initial'
    },
    migrate: (staleValue: any, staleVersion: number) => {
      if (staleVersion === 1) {
        return {
          counter: typeof staleValue?.count === 'number' ? staleValue.count : 0,
          message: 'migrated-from-v1'
        }
      }
      return { counter: 0, message: 'fresh-after-incompatible' }
    }
  })

  test('initializes with default value if state is empty', async ($) => {
    resetMemoryStoreForTesting()
    const value = readAtom($, sampleAtom)
    expect(value.counter).toBe(0)
    expect(value.message).toBe('initial')
  })

  test('updates state atomically via functional updater', async ($) => {
    resetMemoryStoreForTesting()
    updateAtom($, sampleAtom, (prev) => ({
      ...prev,
      counter: prev.counter + 5
    }))

    const value = readAtom($, sampleAtom)
    expect(value.counter).toBe(5)
  })

  test('migrates stale version 1 data automatically when stored', async ($) => {
    resetMemoryStoreForTesting()
    // Test with mock engine state
    const mock$ = {
      state: {
        store: new Map<string, any>([
          [
            sampleAtom.key,
            {
              version: 1,
              data: { count: 42 }
            }
          ]
        ]),
        get(key: string) {
          return this.store.get(key)
        },
        set(key: string, value: any) {
          this.store.set(key, value)
        }
      }
    } as any

    const migrated = readAtom(mock$, sampleAtom)
    expect(migrated.counter).toBe(42)
    expect(migrated.message).toBe('migrated-from-v1')
  })
})
