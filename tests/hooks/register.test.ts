/**
 * @fileoverview Integration tests for Root Register Hook and Coordinators.
 * Follows TDD methodology.
 */

import { describe, expect, test } from 'claude-code/testing'
import { sharedSecurityStore } from '../../src/core/state/store.js'
import {
  SECURITY_MESSAGES,
  TOOL_NAMES
} from '../../src/shared/constants.js'

describe('Root Register Hook & Coordinators Integration (TDD)', () => {
  test('blocks destructive command on tool.call and records violation in state', async ($, on) => {
    sharedSecurityStore.reset()
    on('ui.toast' as any, () => ({ value: {} }))
    on('ui.invalidate' as any, () => ({ value: {} }))

    const result = await $.tool.call({
      tool: TOOL_NAMES.BASH,
      command: 'rm -rf /'
    })

    expect(result.deny).toBeDefined()
    expect(result.deny).toContain(SECURITY_MESSAGES.DESTRUCTIVE_COMMAND_REASON)
  })

  test('blocks reading sensitive .env files on Read tool call', async ($, on) => {
    sharedSecurityStore.reset()
    on('ui.toast' as any, () => ({ value: {} }))
    on('ui.invalidate' as any, () => ({ value: {} }))

    const result = await $.tool.call({
      tool: TOOL_NAMES.READ,
      file_path: '.env'
    })

    expect(result.deny).toBeDefined()
    expect(result.deny).toContain(SECURITY_MESSAGES.ENV_FILE_ACCESS_REASON)
  })

  test('allows safe tool call to proceed downstream', async ($, on) => {
    on('tool.call', { tool: TOOL_NAMES.BASH }, () => ({
      result: { exitCode: 0, stdout: 'success' }
    }))

    const result = await $.tool.call({
      tool: TOOL_NAMES.BASH,
      command: 'git status'
    })

    expect(result.deny).toBeUndefined()
    expect(result.result).toBeDefined()
  })

  test('strips Co-Author and git commit attribution text to empty string', async ($) => {
    const res = await ($.attribution as any).text({
      kind: 'commit',
      text: 'Co-Authored-By: Claude <noreply@anthropic.com>'
    })

    expect(res.text).toBe('')
  })

  test('allows tool call in pass-through mode when guard is toggled to paused state', async ($, on) => {
    on('ui.toast' as any, () => ({ value: {} }))
    on('ui.invalidate' as any, () => ({ value: {} }))
    on('tool.call', { tool: TOOL_NAMES.BASH }, () => ({
      result: { exitCode: 0, stdout: 'allowed in pass-through mode' }
    }))

    // Toggle Guard protection OFF via registered command
    const toggleResult = await ($.command as any).run({ command: 'guard-toggle' })
    expect(toggleResult.text).toContain('PAUSED')

    const result = await $.tool.call({
      tool: TOOL_NAMES.BASH,
      command: 'rm -rf /'
    })

    expect(result.deny).toBeUndefined()
    expect(result.result).toBeDefined()
    expect((result.result as any).stdout).toBe('allowed in pass-through mode')

    // Clean up: Toggle Guard back ON
    const toggleBackResult = await ($.command as any).run({ command: 'guard-toggle' })
    expect(toggleBackResult.text).toContain('ACTIVE')
  })

  test('executes guard-config command to view, init, and reload user configuration', async ($, on) => {
    on('ui.invalidate' as any, () => ({ value: {} }))

    // 1. View configuration
    const viewResult = await ($.command as any).run({ command: 'guard-config' })
    expect(viewResult.text).toContain('Enterprise Guard Active Configuration')
    expect(viewResult.text).toContain('Strict Mode: true')
    expect(viewResult.text).toContain('Protected Branches: [main, master')

    // 2. Reload configuration
    const reloadResult = await ($.command as any).run({ command: 'guard-config', args: 'reload' })
    expect(reloadResult.text).toContain('reloaded')
  })
})
