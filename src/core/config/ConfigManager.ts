/**
 * @fileoverview User Configuration Manager for Enterprise Guard.
 * Validates, merges, and manages hierarchical JSON configuration from:
 * 1. Default built-in security policies
 * 2. User-level global settings (~/.guardrc.json)
 * 3. Project-level repository settings (.guardrc.json / guard.config.json)
 * 4. Claude Code manifest/plugin options
 * Pure in-process implementation complying strictly with engine sandbox constraints (zero node:fs imports).
 */

import {
  CLAUDE_CONFIG_FILES,
  CONFIG_FILES,
  DEFAULT_NATIVE_ATTRIBUTION,
  UI_IDENTIFIERS
} from '../../shared/constants.js'

/**
 * Shape of the user-definable Enterprise Guard configuration.
 */
export interface GuardUserConfig {
  readonly strict_mode: boolean
  readonly enable_git_scan: boolean
  readonly enable_usage_bar: boolean
  readonly enable_rate_limits: boolean
  readonly auto_init_attribution: boolean
  readonly max_stored_violations: number
  readonly allowed_patterns: readonly string[]
  readonly allowed_commands: readonly string[]
  readonly custom_blocked_files: readonly string[]
  readonly custom_blocked_commands: readonly string[]
  readonly custom_secret_patterns: readonly string[]
  readonly protected_branches: readonly string[]
  readonly notification_mode: 'toast' | 'silent' | 'modal'
}

export const DEFAULT_GUARD_CONFIG: GuardUserConfig = {
  strict_mode: true,
  enable_git_scan: true,
  enable_usage_bar: true,
  enable_rate_limits: true,
  auto_init_attribution: true,
  max_stored_violations: UI_IDENTIFIERS.MAX_STORED_VIOLATIONS,
  allowed_patterns: [],
  allowed_commands: [],
  custom_blocked_files: [],
  custom_blocked_commands: [],
  custom_secret_patterns: [],
  protected_branches: ['main', 'master', 'prod', 'production', 'release'],
  notification_mode: 'toast'
}

export interface ConfigEngineContext {
  fs?: {
    read: (path: string) => Promise<string>
    write?: (path: string, text: string) => Promise<void>
    exists: (path: string) => Promise<boolean>
  }
  userHome?: string
  env?: {
    get: (name: string) => Promise<string | undefined>
  }
}

export class GuardConfigManager {
  private config: GuardUserConfig

  constructor(initialConfig: Partial<GuardUserConfig> = {}) {
    this.config = {
      ...DEFAULT_GUARD_CONFIG,
      ...initialConfig
    }
  }

  /**
   * Returns current active configuration.
   * @returns {GuardUserConfig} Current configuration.
   */
  public getConfig(): GuardUserConfig {
    return this.config
  }

  /**
   * Validates and parses a raw JSON string or object.
   * @param {unknown} input - Raw JSON string or parsed object.
   * @returns {Partial<GuardUserConfig>} Sanitized config fragment.
   */
  public parseConfigInput(input: unknown): Partial<GuardUserConfig> {
    if (!input) return {}

    let parsed: Record<string, unknown> = {}
    if (typeof input === 'string') {
      try {
        parsed = JSON.parse(input)
      } catch {
        return {}
      }
    } else if (typeof input === 'object' && !Array.isArray(input)) {
      parsed = input as Record<string, unknown>
    } else {
      return {}
    }

    const result: { -readonly [K in keyof GuardUserConfig]?: GuardUserConfig[K] } = {}

    if (typeof parsed.strict_mode === 'boolean') {
      result.strict_mode = parsed.strict_mode
    }
    if (typeof parsed.enable_git_scan === 'boolean') {
      result.enable_git_scan = parsed.enable_git_scan
    }
    if (typeof parsed.enable_usage_bar === 'boolean') {
      result.enable_usage_bar = parsed.enable_usage_bar
    }
    if (typeof parsed.enable_rate_limits === 'boolean') {
      result.enable_rate_limits = parsed.enable_rate_limits
    }
    if (typeof parsed.auto_init_attribution === 'boolean') {
      result.auto_init_attribution = parsed.auto_init_attribution
    }
    if (typeof parsed.max_stored_violations === 'number' && parsed.max_stored_violations > 0) {
      result.max_stored_violations = parsed.max_stored_violations
    }
    if (
      parsed.notification_mode === 'toast' ||
      parsed.notification_mode === 'silent' ||
      parsed.notification_mode === 'modal'
    ) {
      result.notification_mode = parsed.notification_mode
    }
    if (Array.isArray(parsed.allowed_patterns)) {
      result.allowed_patterns = parsed.allowed_patterns.filter((p): p is string => typeof p === 'string')
    }
    if (Array.isArray(parsed.allowed_commands)) {
      result.allowed_commands = parsed.allowed_commands.filter((p): p is string => typeof p === 'string')
    }
    if (Array.isArray(parsed.custom_blocked_files)) {
      result.custom_blocked_files = parsed.custom_blocked_files.filter(
        (p): p is string => typeof p === 'string'
      )
    }
    if (Array.isArray(parsed.custom_blocked_commands)) {
      result.custom_blocked_commands = parsed.custom_blocked_commands.filter(
        (p): p is string => typeof p === 'string'
      )
    }
    if (Array.isArray(parsed.custom_secret_patterns)) {
      result.custom_secret_patterns = parsed.custom_secret_patterns.filter(
        (p): p is string => typeof p === 'string'
      )
    }
    if (Array.isArray(parsed.protected_branches)) {
      result.protected_branches = parsed.protected_branches.filter(
        (p): p is string => typeof p === 'string'
      )
    }

    return result
  }

  /**
   * Merges two configuration objects together cleanly.
   * @param {GuardUserConfig} base - Base configuration.
   * @param {Partial<GuardUserConfig>} overlay - Overriding configuration layer.
   * @returns {GuardUserConfig} Merged result.
   */
  public mergeTwoConfigs(base: GuardUserConfig, overlay: Partial<GuardUserConfig>): GuardUserConfig {
    return {
      strict_mode: overlay.strict_mode ?? base.strict_mode,
      enable_git_scan: overlay.enable_git_scan ?? base.enable_git_scan,
      enable_usage_bar: overlay.enable_usage_bar ?? base.enable_usage_bar,
      enable_rate_limits: overlay.enable_rate_limits ?? base.enable_rate_limits,
      auto_init_attribution: overlay.auto_init_attribution ?? base.auto_init_attribution,
      max_stored_violations: overlay.max_stored_violations ?? base.max_stored_violations,
      notification_mode: overlay.notification_mode ?? base.notification_mode,
      allowed_patterns: [
        ...new Set([...base.allowed_patterns, ...(overlay.allowed_patterns || [])])
      ],
      allowed_commands: [
        ...new Set([...base.allowed_commands, ...(overlay.allowed_commands || [])])
      ],
      custom_blocked_files: [
        ...new Set([...base.custom_blocked_files, ...(overlay.custom_blocked_files || [])])
      ],
      custom_blocked_commands: [
        ...new Set([...base.custom_blocked_commands, ...(overlay.custom_blocked_commands || [])])
      ],
      custom_secret_patterns: [
        ...new Set([...base.custom_secret_patterns, ...(overlay.custom_secret_patterns || [])])
      ],
      protected_branches: [
        ...new Set([...base.protected_branches, ...(overlay.protected_branches || [])])
      ]
    }
  }

  /**
   * Merges user options passed from Claude Code manifest or settings.json into the active config.
   * @param {unknown} [userOptions] - User options from plugin registration.
   * @returns {GuardUserConfig} Merged active configuration.
   */
  public load(userOptions?: unknown): GuardUserConfig {
    const userConfig = this.parseConfigInput(userOptions)
    this.config = this.mergeTwoConfigs(DEFAULT_GUARD_CONFIG, userConfig)
    return this.config
  }

  /**
   * Loads hierarchical configuration across user home (~/.guardrc.json), workspace (.guardrc.json),
   * and runtime options passed from manifest.
   * Pure engine sandbox implementation using $.fs and $.env.
   *
   * @param {ConfigEngineContext} [engine] - Engine interface providing fs and env.
   * @param {unknown} [userOptions] - Manifest options.
   * @returns {Promise<GuardUserConfig>} Fully resolved configuration.
   */
  public async loadHierarchicalConfig(
    engine?: ConfigEngineContext,
    userOptions?: unknown
  ): Promise<GuardUserConfig> {
    const configLayers: Partial<GuardUserConfig>[] = []

    if (engine?.fs) {
      // 1. User Global Configuration: ~/.guardrc.json
      if (engine.userHome || engine.env) {
        try {
          const home = engine.userHome || (await engine.env?.get('HOME').catch(() => undefined))
          if (home) {
            const userRcPath = `${home}/${CONFIG_FILES.USER_RC}`
            const exists = await engine.fs.exists(userRcPath).catch(() => false)
            if (exists) {
              const raw = await engine.fs.read(userRcPath).catch(() => '')
              if (raw) {
                configLayers.push(this.parseConfigInput(raw))
              }
            }
          }
        } catch {
          // Fail open
        }
      }

      // 2. Project Workspace Configuration: .guardrc.json or guard.config.json
      for (const projectFile of [CONFIG_FILES.WORKSPACE_RC, CONFIG_FILES.WORKSPACE_CONFIG]) {
        try {
          const exists = await engine.fs.exists(projectFile).catch(() => false)
          if (exists) {
            const raw = await engine.fs.read(projectFile).catch(() => '')
            if (raw) {
              configLayers.push(this.parseConfigInput(raw))
              break
            }
          }
        } catch {
          // Fail open
        }
      }
    }

    // 3. Manifest Options
    if (userOptions) {
      configLayers.push(this.parseConfigInput(userOptions))
    }

    // Merge in hierarchical order
    let resolved = { ...DEFAULT_GUARD_CONFIG }
    for (const layer of configLayers) {
      resolved = this.mergeTwoConfigs(resolved, layer)
    }

    this.config = resolved
    return this.config
  }

  /**
   * Generates a starter template configuration in JSON format.
   * @returns {string} Formatted JSON template.
   */
  public generateTemplateConfig(): string {
    const template = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      strict_mode: true,
      enable_git_scan: true,
      enable_usage_bar: true,
      enable_rate_limits: true,
      auto_init_attribution: true,
      max_stored_violations: 100,
      notification_mode: 'toast',
      allowed_patterns: [
        '.env.example',
        '.env.sample',
        '.env.template'
      ],
      allowed_commands: [
        'git status',
        'npm test'
      ],
      custom_blocked_files: [
        'confidential.key',
        'internal-tokens.json'
      ],
      custom_blocked_commands: [
        'curl http://malicious-site.local'
      ],
      custom_secret_patterns: [
        'COMPANY_TOKEN_[0-9A-Za-z]{24}'
      ],
      protected_branches: [
        'main',
        'master',
        'prod',
        'production',
        'release'
      ]
    }
    return JSON.stringify(template, null, 2) + '\n'
  }

  /**
   * Ensures Claude Code native settings (.claude/settings.json) have attribution suppression configured:
   * "attribution": { "commit": "", "pr": "", "sessionUrl": false }
   * Preserves all other user-configured settings (e.g. enabledPlugins, permissions).
   *
   * @param {ConfigEngineContext} [engine] - Sandbox engine interface providing fs and env.
   * @returns {Promise<boolean>} Whether any settings file was created or updated.
   */
  public async ensureNativeAttribution(engine?: ConfigEngineContext): Promise<boolean> {
    if (!engine?.fs || !engine.fs.write) {
      return false
    }

    let modified = false
    const targets: string[] = [CLAUDE_CONFIG_FILES.WORKSPACE_SETTINGS]

    if (engine.userHome || engine.env) {
      try {
        const home = engine.userHome || (await engine.env?.get('HOME').catch(() => undefined))
        if (home) {
          const userGlobalPath = `${home}/${CLAUDE_CONFIG_FILES.USER_SETTINGS}`
          const userExists = await engine.fs.exists(userGlobalPath).catch(() => false)
          if (userExists) {
            targets.push(userGlobalPath)
          }
        }
      } catch {
        // Fail-open
      }
    }

    for (const targetPath of targets) {
      try {
        const exists = await engine.fs.exists(targetPath).catch(() => false)
        let currentSettings: Record<string, any> = {}

        if (exists) {
          const raw = await engine.fs.read(targetPath).catch(() => '')
          if (raw.trim()) {
            try {
              currentSettings = JSON.parse(raw)
            } catch {
              currentSettings = {}
            }
          }
        }

        const attr = currentSettings.attribution
        const isConfigured =
          typeof attr === 'object' &&
          attr !== null &&
          attr.commit === '' &&
          attr.pr === '' &&
          attr.sessionUrl === false

        if (!isConfigured) {
          const updatedSettings = {
            ...currentSettings,
            attribution: {
              ...(typeof attr === 'object' && attr !== null ? attr : {}),
              ...DEFAULT_NATIVE_ATTRIBUTION
            }
          }
          await engine.fs.write(targetPath, JSON.stringify(updatedSettings, null, 2) + '\n')
          modified = true
        }
      } catch {
        // Fail-open: do not crash plugin lifecycle on file write error
      }
    }

    return modified
  }
}

export const sharedConfigManager = new GuardConfigManager()
