/**
 * @fileoverview Git Security & Diff Scanner Strategy for Enterprise Guard.
 * Inspects git commit messages, git add targets, and git push commands for secret leaks and destructive actions.
 * Pure in-process implementation complying strictly with engine sandbox constraints (zero node:child_process imports).
 */

import {
  SECURITY_MESSAGES,
  SECURITY_PATTERNS,
  TOOL_NAMES
} from '../../shared/constants.js'
import type { ISecurityRule, RuleEvaluationResult, ToolInvocationContext } from './rules.js'
import { sharedConfigManager, type GuardUserConfig } from '../config/ConfigManager.js'

export class GitDiffScannerRule implements ISecurityRule {
  private readonly configProvider: () => GuardUserConfig

  constructor(configProvider: () => GuardUserConfig = () => sharedConfigManager.getConfig()) {
    this.configProvider = configProvider
  }

  /**
   * Scans a text diff or staged patch payload for leaked secrets and private keys.
   * Pure in-memory analysis without disk or subprocess execution.
   * @param {string} diffText - Raw diff content.
   * @returns {RuleEvaluationResult} Verdict.
   */
  public scanDiffText(diffText: string): RuleEvaluationResult {
    if (!diffText || typeof diffText !== 'string') {
      return { isSafe: true }
    }

    const config = this.configProvider()
    const addedLines = diffText
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))

    for (const line of addedLines) {
      // Check built-in secret patterns
      for (const { name, regex } of SECURITY_PATTERNS.DIFF_SECRET_PATTERNS) {
        if (regex.test(line)) {
          return {
            isSafe: false,
            reason: `${SECURITY_MESSAGES.GIT_STAGED_SECRET_CONTENT_REASON} [${name}]`
          }
        }
      }

      // Check custom secret patterns from user config
      for (const customSecret of config.custom_secret_patterns) {
        try {
          if (new RegExp(customSecret, 'i').test(line)) {
            return {
              isSafe: false,
              reason: `${SECURITY_MESSAGES.GIT_STAGED_SECRET_CONTENT_REASON} [Custom User Secret]`
            }
          }
        } catch {
          if (line.includes(customSecret)) {
            return {
              isSafe: false,
              reason: `${SECURITY_MESSAGES.GIT_STAGED_SECRET_CONTENT_REASON} [Custom User Secret]`
            }
          }
        }
      }
    }

    return { isSafe: true }
  }

  /**
   * Evaluates shell tool invocation for git operations:
   * - git push to protected branches with force or delete
   * - git add targeting sensitive secret files
   * - git commit with secrets in message or targeting secret files
   * @param {ToolInvocationContext} context - Tool call context.
   * @returns {RuleEvaluationResult} Verdict.
   */
  public evaluate(context: ToolInvocationContext): RuleEvaluationResult {
    if (context.tool !== TOOL_NAMES.BASH || !context.command) {
      return { isSafe: true }
    }

    const config = this.configProvider()
    if (!config.enable_git_scan) {
      return { isSafe: true }
    }

    const cmd = context.command.trim()

    // 1. Inspect git push commands for dangerous force-pushes or protected branch deletion
    if (/\bgit\s+push\b/i.test(cmd)) {
      for (const pattern of SECURITY_PATTERNS.DANGEROUS_GIT_PUSH_PATTERNS) {
        if (pattern.test(cmd)) {
          return {
            isSafe: false,
            reason: SECURITY_MESSAGES.PROTECTED_BRANCH_PUSH_REASON
          }
        }
      }

      for (const branch of config.protected_branches) {
        const forceBranchRegex = new RegExp(
          `\\bgit\\s+push\\s+[^;&|]*(-f\\b|--force\\b|--force-with-lease\\b)[^;&|]*\\b${branch}\\b`,
          'i'
        )
        const deleteBranchRegex = new RegExp(`\\bgit\\s+push\\s+[^;&|]*\\s+:${branch}\\b`, 'i')
        if (forceBranchRegex.test(cmd) || deleteBranchRegex.test(cmd)) {
          return {
            isSafe: false,
            reason: SECURITY_MESSAGES.PROTECTED_BRANCH_PUSH_REASON
          }
        }
      }
    }

    // 2. Inspect git add commands targeting secret files
    if (/\bgit\s+add\b/i.test(cmd)) {
      const parts = cmd.split(/\s+/)
      for (const part of parts) {
        const target = part.replace(/['"]/g, '')
        if (target.startsWith('-') || target === 'git' || target === 'add') continue

        // Check if explicitly allowed template
        if (SECURITY_PATTERNS.ENV_TEMPLATE_REGEX.test(target)) continue

        // Check if user custom allowed
        const isAllowed = config.allowed_patterns.some((pattern) => {
          try {
            return new RegExp(pattern, 'i').test(target) || target.includes(pattern)
          } catch {
            return target.includes(pattern)
          }
        })
        if (isAllowed) continue

        // Check secret .env files
        if (SECURITY_PATTERNS.ENV_FILE_REGEX.test(target)) {
          return {
            isSafe: false,
            reason: `${SECURITY_MESSAGES.GIT_STAGED_SENSITIVE_FILE_REASON} (${target})`
          }
        }

        // Check sensitive credentials
        for (const pattern of SECURITY_PATTERNS.SENSITIVE_FILE_PATTERNS) {
          if (pattern.test(target)) {
            return {
              isSafe: false,
              reason: `${SECURITY_MESSAGES.GIT_STAGED_SENSITIVE_FILE_REASON} (${target})`
            }
          }
        }
      }
    }

    // 3. Inspect git commit commands for leaked secrets in commit message or flags
    if (/\bgit\s+commit\b/i.test(cmd)) {
      // Check if commit targets secret files via -i / -o / --only
      for (const pattern of SECURITY_PATTERNS.SENSITIVE_FILE_PATTERNS) {
        if (pattern.test(cmd)) {
          return {
            isSafe: false,
            reason: `${SECURITY_MESSAGES.GIT_STAGED_SENSITIVE_FILE_REASON} (git commit flag)`
          }
        }
      }

      // Check commit message for leaked secrets
      const messageMatch = cmd.match(/(?:-m\s+|--message[=\s]+)(["'])(.*?)\1/)
      if (messageMatch && messageMatch[2]) {
        const commitMsg = messageMatch[2]
        for (const { name, regex } of SECURITY_PATTERNS.DIFF_SECRET_PATTERNS) {
          if (regex.test(commitMsg)) {
            return {
              isSafe: false,
              reason: `${SECURITY_MESSAGES.GIT_STAGED_SECRET_CONTENT_REASON} in commit message [${name}]`
            }
          }
        }
      }
    }

    return { isSafe: true }
  }
}
