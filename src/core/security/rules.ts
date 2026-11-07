/**
 * @fileoverview Security inspection rules implementing the Strategy and Specification design patterns.
 * Adheres to Clean Code principles: Single Responsibility, Open/Closed for new rules, and explicit JSDoc typing.
 */

import {
  SECURITY_MESSAGES,
  SECURITY_PATTERNS,
  TOOL_NAMES
} from '../../shared/constants.js'
import { sharedConfigManager, type GuardUserConfig } from '../config/ConfigManager.js'

export { GitDiffScannerRule } from './git-scanner.js'

/**
 * Result of evaluating a security rule.
 * @typedef {Object} RuleEvaluationResult
 * @property {boolean} isSafe - Whether the evaluated payload passed inspection.
 * @property {string} [reason] - Specific security violation message if unsafe.
 */
export interface RuleEvaluationResult {
  readonly isSafe: boolean
  readonly reason?: string
}

/**
 * Standard tool invocation parameters to be inspected.
 * @typedef {Object} ToolInvocationContext
 * @property {string} tool - Name of the invoked tool (e.g., 'Bash', 'Read').
 * @property {string} [command] - Shell command if tool is Bash.
 * @property {string} [file_path] - File path if tool is Read/Edit/Write.
 * @property {string} [path] - Path parameter for search tools like Grep/Glob.
 */
export interface ToolInvocationContext {
  readonly tool: string
  readonly command?: string
  readonly file_path?: string
  readonly path?: string
}

/**
 * Strategy interface defining a security specification.
 */
export interface ISecurityRule {
  /**
   * Evaluates the given tool invocation context.
   * @param {ToolInvocationContext} context - The tool call parameters.
   * @returns {RuleEvaluationResult} The verdict.
   */
  evaluate(context: ToolInvocationContext): RuleEvaluationResult
}

/**
 * Security Rule Strategy: Detects destructive bash operations.
 * Implements ISecurityRule.
 */
export class DestructiveCommandRule implements ISecurityRule {
  private readonly configProvider: () => GuardUserConfig

  constructor(configProvider: () => GuardUserConfig = () => sharedConfigManager.getConfig()) {
    this.configProvider = configProvider
  }

  /**
   * Inspects command for destructive patterns like rm -rf / or mkfs.
   * Also checks user custom blocked commands.
   * @param {ToolInvocationContext} context - The tool invocation parameters.
   * @returns {RuleEvaluationResult} Verification result.
   */
  public evaluate(context: ToolInvocationContext): RuleEvaluationResult {
    if (context.tool !== TOOL_NAMES.BASH || !context.command) {
      return { isSafe: true }
    }

    const command = context.command.trim()
    const config = this.configProvider()

    // 1. Explicitly allow user custom whitelisted commands
    const isCustomAllowed = (config.allowed_commands || []).some((allowedCmd) => {
      try {
        return new RegExp(allowedCmd, 'i').test(command) || command.includes(allowedCmd)
      } catch {
        return command.includes(allowedCmd)
      }
    })
    if (isCustomAllowed) {
      return { isSafe: true }
    }

    for (const pattern of SECURITY_PATTERNS.DESTRUCTIVE_BASH_PATTERNS) {
      if (pattern.test(command)) {
        return {
          isSafe: false,
          reason: SECURITY_MESSAGES.DESTRUCTIVE_COMMAND_REASON
        }
      }
    }

    // Check user custom blocked commands
    for (const customCmd of config.custom_blocked_commands) {
      try {
        if (new RegExp(customCmd, 'i').test(command) || command.includes(customCmd)) {
          return {
            isSafe: false,
            reason: `${SECURITY_MESSAGES.CUSTOM_BLOCKED_COMMAND_REASON} (${customCmd})`
          }
        }
      } catch {
        if (command.includes(customCmd)) {
          return {
            isSafe: false,
            reason: `${SECURITY_MESSAGES.CUSTOM_BLOCKED_COMMAND_REASON} (${customCmd})`
          }
        }
      }
    }

    return { isSafe: true }
  }
}

/**
 * Security Rule Strategy: Detects attempts to access environment secret files (.env*) and sensitive system credentials.
 * Implements ISecurityRule.
 */
export class EnvFileAccessRule implements ISecurityRule {
  private readonly configProvider: () => GuardUserConfig

  constructor(configProvider: () => GuardUserConfig = () => sharedConfigManager.getConfig()) {
    this.configProvider = configProvider
  }

  /**
   * Normalizes file paths to strip traversal sequences, URL encodings, null bytes, and trailing slashes.
   * @param {string} inputPath - Raw path argument.
   * @returns {string} Sanitized path.
   * @private
   */
  private normalizePath(inputPath: string): string {
    let clean = inputPath.replace(/\0/g, '').trim()
    try {
      clean = decodeURIComponent(clean)
    } catch {
      // Retain raw string if URI decode fails
    }
    clean = clean.replace(/\0/g, '').replace(/\\/g, '/')
    clean = clean.replace(/\/(\.|\/)*$/, '')
    return clean
  }

  /**
   * Inspects file target path for .env patterns, sensitive credential stores, and user custom blocked files.
   * Allows benign template files such as .env.example or user custom allowed patterns.
   * @param {ToolInvocationContext} context - The tool invocation parameters.
   * @returns {RuleEvaluationResult} Verification result.
   */
  public evaluate(context: ToolInvocationContext): RuleEvaluationResult {
    const toolLower = (context.tool || '').toLowerCase()
    const isFileTool =
      toolLower === TOOL_NAMES.READ.toLowerCase() ||
      toolLower === TOOL_NAMES.EDIT.toLowerCase() ||
      toolLower === TOOL_NAMES.WRITE.toLowerCase() ||
      toolLower === TOOL_NAMES.GREP.toLowerCase() ||
      toolLower === TOOL_NAMES.GLOB.toLowerCase() ||
      toolLower.includes('read') ||
      toolLower.includes('write')

    const rawPath = context.file_path || context.path

    if (isFileTool && rawPath) {
      const normalized = this.normalizePath(rawPath)
      const config = this.configProvider()

      // 1. Explicitly allow legitimate environment templates (.env.example, .env.sample, etc.)
      if (SECURITY_PATTERNS.ENV_TEMPLATE_REGEX.test(normalized)) {
        return { isSafe: true }
      }

      // 2. Explicitly allow user custom whitelisted patterns
      const isCustomAllowed = config.allowed_patterns.some((pattern) => {
        try {
          return new RegExp(pattern, 'i').test(normalized) || normalized.includes(pattern)
        } catch {
          return normalized.includes(pattern)
        }
      })
      if (isCustomAllowed) {
        return { isSafe: true }
      }

      // 3. Block secret .env files
      if (SECURITY_PATTERNS.ENV_FILE_REGEX.test(normalized)) {
        const reason =
          toolLower === TOOL_NAMES.GREP.toLowerCase()
            ? SECURITY_MESSAGES.GREP_ENV_PROHIBITED
            : SECURITY_MESSAGES.ENV_FILE_ACCESS_REASON

        return {
          isSafe: false,
          reason
        }
      }

      // 4. Block sensitive credentials: SSH keys, cloud configs, git/npm tokens, private keys
      for (const pattern of SECURITY_PATTERNS.SENSITIVE_FILE_PATTERNS) {
        if (pattern.test(normalized)) {
          return {
            isSafe: false,
            reason: SECURITY_MESSAGES.SENSITIVE_FILE_REASON
          }
        }
      }

      // 5. Block user custom blocked file patterns
      for (const customFile of config.custom_blocked_files) {
        try {
          if (new RegExp(customFile, 'i').test(normalized) || normalized.includes(customFile)) {
            return {
              isSafe: false,
              reason: `${SECURITY_MESSAGES.CUSTOM_BLOCKED_FILE_REASON} (${customFile})`
            }
          }
        } catch {
          if (normalized.includes(customFile)) {
            return {
              isSafe: false,
              reason: `${SECURITY_MESSAGES.CUSTOM_BLOCKED_FILE_REASON} (${customFile})`
            }
          }
        }
      }
    }

    return { isSafe: true }
  }
}

/**
 * Security Rule Strategy: Detects shell commands attempting to leak .env files, SSH keys, or cloud credentials.
 * Implements ISecurityRule.
 */
export class EnvShellLeakRule implements ISecurityRule {
  private readonly configProvider: () => GuardUserConfig

  constructor(configProvider: () => GuardUserConfig = () => sharedConfigManager.getConfig()) {
    this.configProvider = configProvider
  }

  /**
   * Inspects bash command string for mentions of .env, credentials, or local server daemons.
   * Allows benign template references like cat .env.example.
   * @param {ToolInvocationContext} context - The tool invocation parameters.
   * @returns {RuleEvaluationResult} Verification result.
   */
  public evaluate(context: ToolInvocationContext): RuleEvaluationResult {
    if (context.tool !== TOOL_NAMES.BASH || !context.command) {
      return { isSafe: true }
    }

    const cmd = context.command
    const config = this.configProvider()

    // Explicitly allow user custom whitelisted commands
    const isCustomAllowed = (config.allowed_commands || []).some((allowedCmd) => {
      try {
        return new RegExp(allowedCmd, 'i').test(cmd) || cmd.includes(allowedCmd)
      } catch {
        return cmd.includes(allowedCmd)
      }
    })
    if (isCustomAllowed) {
      return { isSafe: true }
    }

    // Check sensitive credentials (SSH keys, cloud configs, tokens)
    for (const pattern of SECURITY_PATTERNS.BASH_SENSITIVE_LEAK_PATTERNS) {
      if (pattern.test(cmd)) {
        return {
          isSafe: false,
          reason: SECURITY_MESSAGES.SENSITIVE_SHELL_LEAK_REASON
        }
      }
    }

    // Mask out allowed template occurrences (e.g., .env.example) before checking .env leak rules
    const templateMasked = cmd.replace(
      /(^|[\s/'"=])\.env\.(example|sample|template|dist|schema|defaults)\b/gi,
      '$1env_template_placeholder'
    )

    // Check verbatim regex for .env leaks
    if (SECURITY_PATTERNS.BASH_ENV_LEAK_REGEX.test(templateMasked)) {
      return {
        isSafe: false,
        reason: SECURITY_MESSAGES.ENV_SHELL_LEAK_REASON
      }
    }

    // Check quote and escape stripped command
    const stripped = templateMasked.replace(/['"\\]/g, '')
    if (SECURITY_PATTERNS.BASH_ENV_LEAK_REGEX.test(stripped)) {
      return {
        isSafe: false,
        reason: SECURITY_MESSAGES.ENV_SHELL_LEAK_REASON
      }
    }

    for (const pattern of SECURITY_PATTERNS.BASH_SENSITIVE_LEAK_PATTERNS) {
      if (pattern.test(cmd.replace(/['"\\]/g, ''))) {
        return {
          isSafe: false,
          reason: SECURITY_MESSAGES.SENSITIVE_SHELL_LEAK_REASON
        }
      }
    }

    // Block unauthenticated local web server daemons exposing repository root
    if (
      /\b(python[0-9.]*|py)\s+-[a-zA-Z]*m\s+(http\.server|SimpleHTTPServer)\b/i.test(cmd) ||
      /\bnpx\s+(http-server|serve)\b/i.test(cmd) ||
      /\bphp\s+-[a-zA-Z]*S\b/i.test(cmd)
    ) {
      return {
        isSafe: false,
        reason: SECURITY_MESSAGES.ENV_SHELL_LEAK_REASON
      }
    }

    return { isSafe: true }
  }
}

/**
 * Composite Security Scanner coordinating multiple security rule strategies.
 */
export class SecurityScanner {
  private readonly rules: readonly ISecurityRule[]

  /**
   * @param {readonly ISecurityRule[]} rules - Ordered array of security rule strategies.
   */
  constructor(rules: readonly ISecurityRule[]) {
    this.rules = rules
  }

  /**
   * Scans a tool invocation against all registered strategies.
   * Fails fast on the first security violation detected.
   * @param {ToolInvocationContext} context - The tool invocation context.
   * @returns {RuleEvaluationResult} Overall result.
   */
  public scan(context: ToolInvocationContext): RuleEvaluationResult {
    for (const rule of this.rules) {
      const result = rule.evaluate(context)
      if (!result.isSafe) {
        return result
      }
    }
    return { isSafe: true }
  }
}
