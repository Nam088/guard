/**
 * @fileoverview Versioned Reactive Atom State implementation.
 * Ensures type safety, atomic state updates, and schema migration across hot reloads.
 * Implements fallback memory storage for standalone unit tests.
 */

import type { EngineInterface } from 'claude-code'

/**
 * Specification for defining an isolated, versioned state atom.
 * @template T
 * @typedef {Object} AtomDefinition
 * @property {string} key - Unique key identifier in the engine state.
 * @property {number} version - Schema version number.
 * @property {T} initial - Default initial state value.
 * @property {Function} [migrate] - Migration handler when reading stale schema version.
 */
export interface AtomDefinition<T> {
  readonly key: string
  readonly version: number
  readonly initial: T
  readonly migrate?: (staleValue: unknown, staleVersion: number) => T
}

/**
 * Storage envelope wrapping state data with version metadata.
 * @template T
 */
interface StoredStateEnvelope<T> {
  readonly version: number
  readonly data: T
}

/**
 * Process-local fallback cache when running under test harnesses without $.state.
 */
const fallbackMemoryStore = new Map<string, StoredStateEnvelope<any>>()

/**
 * Factory helper to construct an AtomDefinition with inferred type.
 * @template T
 * @param {AtomDefinition<T>} definition - The atom definition properties.
 * @returns {AtomDefinition<T>} The typed atom definition.
 */
export function createAtom<T>(definition: AtomDefinition<T>): AtomDefinition<T> {
  return definition
}

/**
 * Internal storage getter safely checking engine $.state or memory store.
 */
function getStoredValue<T>($: EngineInterface | any, key: string): StoredStateEnvelope<T> | undefined {
  if ($ && $.state && typeof $.state.get === 'function') {
    return $.state.get(key) as StoredStateEnvelope<T> | undefined
  }
  return fallbackMemoryStore.get(key) as StoredStateEnvelope<T> | undefined
}

/**
 * Internal storage setter safely updating engine $.state or memory store.
 */
function setStoredValue<T>($: EngineInterface | any, key: string, envelope: StoredStateEnvelope<T>): void {
  if ($ && $.state && typeof $.state.set === 'function') {
    $.state.set(key, envelope)
  } else {
    fallbackMemoryStore.set(key, envelope)
  }
}

/**
 * Reads state for an atom, performing schema migration if needed.
 * @template T
 * @param {EngineInterface} $ - The EngineInterface instance.
 * @param {AtomDefinition<T>} atom - The atom definition to read.
 * @returns {T} Current valid state data.
 */
export function readAtom<T>($: EngineInterface | any, atom: AtomDefinition<T>): T {
  const raw = getStoredValue<T>($, atom.key)

  if (!raw || typeof raw !== 'object' || !('version' in raw) || !('data' in raw)) {
    const envelope: StoredStateEnvelope<T> = {
      version: atom.version,
      data: atom.initial
    }
    setStoredValue($, atom.key, envelope)
    return atom.initial
  }

  if (raw.version !== atom.version) {
    const migratedData = atom.migrate
      ? atom.migrate(raw.data, raw.version)
      : atom.initial

    const envelope: StoredStateEnvelope<T> = {
      version: atom.version,
      data: migratedData
    }
    setStoredValue($, atom.key, envelope)
    return migratedData
  }

  return raw.data
}

/**
 * Atomically updates state using a functional updater.
 * @template T
 * @param {EngineInterface} $ - The EngineInterface instance.
 * @param {AtomDefinition<T>} atom - The atom definition to mutate.
 * @param {function(T): T} updater - Pure function transforming previous state to next state.
 * @returns {T} Newly computed state.
 */
export function updateAtom<T>(
  $: EngineInterface | any,
  atom: AtomDefinition<T>,
  updater: (prev: T) => T
): T {
  const current = readAtom($, atom)
  const nextValue = updater(current)
  const envelope: StoredStateEnvelope<T> = {
    version: atom.version,
    data: nextValue
  }
  setStoredValue($, atom.key, envelope)
  return nextValue
}

/**
 * Resets fallback memory store (for testing cleanups).
 */
export function resetMemoryStoreForTesting(): void {
  fallbackMemoryStore.clear()
}
