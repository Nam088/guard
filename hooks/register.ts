/**
 * @fileoverview Main wire-up module registering Enterprise Guard hooks with Claude Code engine.
 * Adheres strictly to engine static analysis rules:
 * - String literal event names and matcher properties passed to on().
 * - Explicit full member invocations on $. Never pass $ as an argument.
 * - In-place toast throttling and UI invalidation to prevent render storms.
 * - Fail-closed .catch() handlers on all gating hooks.
 * - Full user customization with hierarchical config loading, config commands, and interactive UI.
 */

import type { On, PluginOptions } from 'claude-code'
import {
  DestructiveCommandRule,
  EnvFileAccessRule,
  EnvShellLeakRule,
  GitDiffScannerRule,
  SecurityScanner
} from '../src/core/security/rules.js'
import { sharedConfigManager } from '../src/core/config/ConfigManager.js'
import { sharedSecurityStore } from '../src/core/state/store.js'
import {
  CONFIG_FILES,
  SECURITY_MESSAGES,
  TOOL_NAMES,
  UI_IDENTIFIERS,
  UI_MESSAGES
} from '../src/shared/constants.js'
import {
  sharedTurnTracker,
  type RateLimitSnapshot
} from '../src/core/usage/telemetry.js'
import { buildAbovePromptTree } from '../src/ui/coordinators/AbovePromptCoordinator.js'
import { buildPaneTree } from '../src/ui/coordinators/PaneCoordinator.js'

let lastToastTime = 0
let lastToastText = ''
let lastModel: string | null = null
let lastEffort: string | null = null
let latestRateLimits: RateLimitSnapshot[] = []

/**
 * Main register function invoked by Claude Code engine when loading the mod.
 * @param {On} on - Event registration hook.
 * @param {PluginOptions} options - User configuration passed from manifest.
 */
export function register(on: On, options: PluginOptions): void {
  // Initial sync load from manifest options
  sharedConfigManager.load(options as any)

  const gitScanner = new GitDiffScannerRule()

  // Instantiate security strategies via Strategy Pattern
  const scanner = new SecurityScanner([
    new DestructiveCommandRule(),
    new EnvFileAccessRule(),
    new EnvShellLeakRule(),
    gitScanner
  ])

  // 1. Session start: Auto-load hierarchical user configuration and register commands
  on('session.start', async ($, e, next) => {
    // 1a. Load workspace configuration (.guardrc.json or guard.config.json)
    const wsExists = await $.fs.exists(CONFIG_FILES.WORKSPACE_RC).catch(() => false)
    if (wsExists) {
      const rawWs = await $.fs.read(CONFIG_FILES.WORKSPACE_RC).catch(() => '')
      if (rawWs) {
        sharedConfigManager.load(rawWs)
      }
    } else {
      const altExists = await $.fs.exists(CONFIG_FILES.WORKSPACE_CONFIG).catch(() => false)
      if (altExists) {
        const rawAlt = await $.fs.read(CONFIG_FILES.WORKSPACE_CONFIG).catch(() => '')
        if (rawAlt) {
          sharedConfigManager.load(rawAlt)
        }
      }
    }

    // 1b. Load user global configuration (~/.guardrc.json)
    const home = await $.env.get('HOME').catch(() => undefined)
    if (home) {
      const userRcPath = `${home}/${CONFIG_FILES.USER_RC}`
      const userExists = await $.fs.exists(userRcPath).catch(() => false)
      if (userExists) {
        const rawUser = await $.fs.read(userRcPath).catch(() => '')
        if (rawUser) {
          sharedConfigManager.load(rawUser)
        }
      }
    }

    // 1c. Register slash commands
    await $.command.register({
      name: 'guard-panel',
      description: UI_IDENTIFIERS.COMMAND_GUARD_PANEL_DESC
    })
    await $.command.register({
      name: 'guard-toggle',
      description: UI_IDENTIFIERS.COMMAND_GUARD_TOGGLE_DESC
    })
    await $.command.register({
      name: 'guard-config',
      description: UI_IDENTIFIERS.COMMAND_GUARD_CONFIG_DESC
    })
    await $.command.register({
      name: 'guard-scan',
      description: UI_IDENTIFIERS.COMMAND_GUARD_SCAN_DESC
    })
    return next(e)
  })

  // 2. Command run handler: Toggles the docked dashboard pane
  on('command.run', { command: 'guard-panel' }, async ($) => {
    const currentState = sharedSecurityStore.getState()
    if (currentState.isPaneOpen) {
      $.ui.close({ id: 'enterprise-guard-monitor-pane' })
      sharedSecurityStore.setPaneOpen(false)
      return { text: UI_MESSAGES.PANE_CLOSED_FEEDBACK }
    } else {
      $.ui.open({
        id: 'enterprise-guard-monitor-pane',
        title: UI_IDENTIFIERS.PANE_TITLE
      })
      sharedSecurityStore.setPaneOpen(true)
      return { text: UI_MESSAGES.PANE_OPENED_FEEDBACK }
    }
  }).catch(() => {
    return { text: UI_MESSAGES.PANE_ERROR_FEEDBACK }
  })

  // 3. Command run handler: Toggles protection state between active and paused
  on('command.run', { command: 'guard-toggle' }, async ($) => {
    const nextState = sharedSecurityStore.toggleGuardEnabled()
    $.ui.invalidate('ui.render')
    const message = nextState.isGuardEnabled
      ? UI_MESSAGES.TOAST_GUARD_ENABLED
      : UI_MESSAGES.TOAST_GUARD_DISABLED
    $.ui.toast(message)
    return { text: message }
  }).catch(() => {
    return { text: 'Unable to toggle Enterprise Guard protection state.' }
  })

  // 4. Command run handler: View, reload, or initialize user configuration
  on('command.run', { command: 'guard-config' }, async ($, e) => {
    const rawArgs = (e.args || '').trim().toLowerCase()

    if (rawArgs === 'init') {
      const exists = await $.fs.exists(CONFIG_FILES.WORKSPACE_RC).catch(() => false)
      if (exists) {
        return { text: UI_MESSAGES.CONFIG_ALREADY_EXISTS }
      }
      await $.fs.write(CONFIG_FILES.WORKSPACE_RC, sharedConfigManager.generateTemplateConfig())
      const rawWs = await $.fs.read(CONFIG_FILES.WORKSPACE_RC).catch(() => '')
      if (rawWs) {
        sharedConfigManager.load(rawWs)
      }
      $.ui.invalidate('ui.render')
      return { text: UI_MESSAGES.CONFIG_INIT_SUCCESS }
    }

    if (rawArgs === 'reload') {
      const wsExists = await $.fs.exists(CONFIG_FILES.WORKSPACE_RC).catch(() => false)
      if (wsExists) {
        const rawWs = await $.fs.read(CONFIG_FILES.WORKSPACE_RC).catch(() => '')
        if (rawWs) {
          sharedConfigManager.load(rawWs)
        }
      }
      const home = await $.env.get('HOME').catch(() => undefined)
      if (home) {
        const userRcPath = `${home}/${CONFIG_FILES.USER_RC}`
        const userExists = await $.fs.exists(userRcPath).catch(() => false)
        if (userExists) {
          const rawUser = await $.fs.read(userRcPath).catch(() => '')
          if (rawUser) {
            sharedConfigManager.load(rawUser)
          }
        }
      }
      $.ui.invalidate('ui.render')
      return { text: UI_MESSAGES.CONFIG_RELOAD_SUCCESS }
    }

    const active = sharedConfigManager.getConfig()
    return {
      text:
        `=== Enterprise Guard Active Configuration ===\n\n` +
        `Policy Enforcement:\n` +
        `- Strict Mode: ${active.strict_mode}\n` +
        `- Git Diff & Commit Scan: ${active.enable_git_scan}\n` +
        `- Usage Context Bar: ${active.enable_usage_bar}\n` +
        `- Rate Limit Meters: ${active.enable_rate_limits}\n` +
        `- Notification Mode: ${active.notification_mode}\n` +
        `- Protected Branches: [${active.protected_branches.join(', ')}]\n\n` +
        `Custom Whitelists:\n` +
        `- Allowed Files: [${active.allowed_patterns.join(', ') || 'none'}]\n` +
        `- Allowed Commands: [${active.allowed_commands.join(', ') || 'none'}]\n\n` +
        `Custom Blocklists:\n` +
        `- Blocked Files: [${active.custom_blocked_files.join(', ') || 'none'}]\n` +
        `- Blocked Commands: [${active.custom_blocked_commands.join(', ') || 'none'}]\n` +
        `- Secret Patterns: [${active.custom_secret_patterns.join(', ') || 'none'}]\n\n` +
        `Subcommands:\n` +
        `- /guard-config init   : Generate .guardrc.json in workspace\n` +
        `- /guard-config reload : Reload configuration from disk\n`
    }
  }).catch(() => {
    return { text: 'Unable to inspect or modify Enterprise Guard configuration.' }
  })

  // 5. Command run handler: Manual git diff & secret audit scan
  on('command.run', { command: 'guard-scan' }, async () => {
    const activeConfig = sharedConfigManager.getConfig()
    const protectedList = activeConfig.protected_branches.join(', ')
    return {
      text: `Enterprise Guard Git Protection Active: Scanning commits & pushes. Protected branches: [${protectedList}]. Git scan enabled: ${activeConfig.enable_git_scan}.`
    }
  }).catch(() => {
    return { text: 'Unable to complete git security audit scan.' }
  })

  // 6. Capture rate limits dynamically
  on('session.measure', async (_$, e, next) => {
    const activeConfig = sharedConfigManager.getConfig()
    if (activeConfig.enable_rate_limits && e.rateLimits && e.rateLimits.length > 0) {
      latestRateLimits = [...e.rateLimits]
    }
    return next(e)
  })

  // 7. Track model & effort per turn step
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      const effort = e.effort === undefined ? null : `${e.effort}`
      if (e.model !== lastModel || effort !== lastEffort) {
        lastModel = e.model
        lastEffort = effort
        $.ui.invalidate('ui.render')
      }
    }
    return yield* next(e)
  })

  // 8. Record turn end tokens for compaction forecasting
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) {
      const usage = await $.session.usage().catch(() => undefined)
      if (usage?.context?.tokens) {
        sharedTurnTracker.recordTurn(usage.context.tokens)
      }
    }
    return result
  })

  // 9. UI Render site: AbovePrompt status and usage context bar
  on('ui.render', { component: 'AbovePrompt' }, async ($, e) => {
    const activeConfig = sharedConfigManager.getConfig()
    if (!activeConfig.enable_usage_bar) {
      return null
    }

    const primitives = $.ui.resolve(e)
    const state = sharedSecurityStore.getState()
    const usage = await $.session.usage().catch(() => undefined)
    const model = lastModel ?? (await $.session.model().catch(() => ''))
    const columns = (e as any).viewport?.columns ?? (e as any).props?.bodyColumns ?? 80

    const handleToggleGuard = (): void => {
      const nextState = sharedSecurityStore.toggleGuardEnabled()
      $.ui.invalidate('ui.render')
      const toastMsg = nextState.isGuardEnabled
        ? UI_MESSAGES.TOAST_GUARD_ENABLED
        : UI_MESSAGES.TOAST_GUARD_DISABLED
      $.ui.toast(toastMsg)
    }

    return buildAbovePromptTree(
      state,
      {
        contextTokens: usage?.context?.tokens ?? 0,
        windowTokens: usage?.context?.window ?? UI_IDENTIFIERS.DEFAULT_WINDOW_TOKENS,
        contextPercent: usage?.context?.percent ?? 0,
        compactAt:
          usage?.context?.breakdown?.autoCompactThreshold ??
          usage?.context?.window ??
          UI_IDENTIFIERS.DEFAULT_WINDOW_TOKENS,
        costUsd: usage?.cost?.usd,
        rateLimits: activeConfig.enable_rate_limits ? latestRateLimits : [],
        model,
        effort: lastEffort
      },
      primitives,
      e.surface,
      columns,
      handleToggleGuard
    )
  })

  // 10. UI Render site: Docked dashboard pane
  on('ui.render', { component: 'Pane', requestId: 'enterprise-guard-monitor-pane' }, async ($, e) => {
    const primitives = $.ui.resolve(e)
    const state = sharedSecurityStore.getState()
    const usage = await $.session.usage().catch(() => undefined)
    const contextPercent = usage?.context?.percent || 0
    const activeConfig = sharedConfigManager.getConfig()

    const handleClose = (): void => {
      $.ui.close({ id: 'enterprise-guard-monitor-pane' })
      sharedSecurityStore.setPaneOpen(false)
    }

    const handleToggleGuard = (): void => {
      const nextState = sharedSecurityStore.toggleGuardEnabled()
      $.ui.invalidate('ui.render')
      const toastMsg = nextState.isGuardEnabled
        ? UI_MESSAGES.TOAST_GUARD_ENABLED
        : UI_MESSAGES.TOAST_GUARD_DISABLED
      $.ui.toast(toastMsg)
    }

    return buildPaneTree(
      state,
      contextPercent,
      primitives,
      e.surface,
      e.requestId,
      handleClose,
      handleToggleGuard,
      activeConfig
    )
  })

  // 11. Tool Call Interceptor: Gating security rules on all tools with Fail-Closed semantics
  on('tool.call', async ($, e, next) => {
    const currentState = sharedSecurityStore.getState()

    // If protection is paused via UI, allow tool calls in pass-through mode
    if (!currentState.isGuardEnabled) {
      return next(e)
    }

    const rawPayload = e as any
    const activeConfig = sharedConfigManager.getConfig()
    const isStrict = activeConfig.strict_mode !== false

    const assessment = scanner.scan({
      tool: rawPayload.tool,
      command: rawPayload.command,
      file_path: rawPayload.file_path || rawPayload.path,
      path: rawPayload.path
    })

    if (isStrict && !assessment.isSafe) {
      const targetIdentifier =
        rawPayload.command || rawPayload.file_path || rawPayload.path || rawPayload.tool || 'unknown'
      const reason = assessment.reason || SECURITY_MESSAGES.DESTRUCTIVE_COMMAND_REASON

      // Update state in repository
      sharedSecurityStore.recordViolation(targetIdentifier, reason)

      // Refresh UI render site directly on $
      $.ui.invalidate('ui.render')

      // Deliver toast notification if configured
      if (activeConfig.notification_mode !== 'silent') {
        const toastText =
          rawPayload.tool === TOOL_NAMES.BASH
            ? UI_MESSAGES.TOAST_DESTRUCTIVE_COMMAND_BLOCKED
            : UI_MESSAGES.TOAST_ENV_ACCESS_BLOCKED

        const now = Date.now()
        if (toastText !== lastToastText || now - lastToastTime >= 1500) {
          lastToastTime = now
          lastToastText = toastText
          $.ui.toast(toastText)
        }
      }

      return {
        deny: `${reason}`
      }
    }

    return next(e)
  }).catch(() => {
    return { deny: SECURITY_MESSAGES.INSPECTION_FAULT_PREFIX }
  })

  // 12. Block and strip Co-Author and Git/PR attribution completely
  on('attribution.text', async () => {
    return { text: '' }
  })
}
