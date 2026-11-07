/**
 * @fileoverview Unit tests for SecurityStateStore concurrency safety and memory capping.
 */

import { describe, expect, test } from 'claude-code/testing'
import { sharedSecurityStore } from '../../src/core/state/store.js'
import { UI_IDENTIFIERS } from '../../src/shared/constants.js'

describe('SecurityStateStore Concurrency & Memory Safety', () => {
  test('generates unique monotonic IDs under synchronous/concurrent calls', () => {
    sharedSecurityStore.reset()
    sharedSecurityStore.recordViolation('cmd_1', 'reason_1')
    sharedSecurityStore.recordViolation('cmd_2', 'reason_2')

    const state = sharedSecurityStore.getState()
    expect(state.violations).toHaveLength(2)
    const first = state.violations[0]
    const second = state.violations[1]
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(first!.id).not.toBe(second!.id)
    expect(first!.id).toContain('-1')
    expect(second!.id).toContain('-2')
  })

  test('caps violations list to MAX_STORED_VIOLATIONS to prevent memory leak', () => {
    sharedSecurityStore.reset()
    const totalToAdd = UI_IDENTIFIERS.MAX_STORED_VIOLATIONS + 15
    for (let i = 0; i < totalToAdd; i++) {
      sharedSecurityStore.recordViolation(`cmd_${i}`, `reason_${i}`)
    }

    const state = sharedSecurityStore.getState()
    expect(state.blockedCount).toBe(totalToAdd)
    expect(state.violations.length).toBe(UI_IDENTIFIERS.MAX_STORED_VIOLATIONS)
    const latest = state.violations[state.violations.length - 1]
    expect(latest).toBeDefined()
    expect(latest!.command).toBe(`cmd_${totalToAdd - 1}`)
  })

  test('manages isGuardEnabled state with toggle and set methods', () => {
    sharedSecurityStore.reset()
    expect(sharedSecurityStore.getState().isGuardEnabled).toBe(true)

    sharedSecurityStore.setGuardEnabled(false)
    expect(sharedSecurityStore.getState().isGuardEnabled).toBe(false)

    sharedSecurityStore.toggleGuardEnabled()
    expect(sharedSecurityStore.getState().isGuardEnabled).toBe(true)

    sharedSecurityStore.toggleGuardEnabled()
    expect(sharedSecurityStore.getState().isGuardEnabled).toBe(false)

    sharedSecurityStore.reset()
    expect(sharedSecurityStore.getState().isGuardEnabled).toBe(true)
  })
})
