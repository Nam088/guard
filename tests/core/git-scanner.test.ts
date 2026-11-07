/**
 * @fileoverview Unit tests for GitDiffScannerRule (Pre-commit diff and push protection).
 * Pure in-process testing complying with engine sandbox constraints.
 */

import { describe, expect, test } from 'claude-code/testing'
import { GitDiffScannerRule } from '../../src/core/security/git-scanner.js'
import { SECURITY_MESSAGES, TOOL_NAMES } from '../../src/shared/constants.js'
import { DEFAULT_GUARD_CONFIG } from '../../src/core/config/ConfigManager.js'

describe('GitDiffScannerRule (TDD)', () => {
  describe('Branch Protection & Push Safety', () => {
    const scanner = new GitDiffScannerRule()

    test('blocks force push to main and master branches', () => {
      expect(
        scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git push -f origin main' }).isSafe
      ).toBe(false)
      expect(
        scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git push --force origin master' }).isSafe
      ).toBe(false)
      expect(
        scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git push origin main --force' }).isSafe
      ).toBe(false)
    })

    test('blocks branch deletion push to main and master branches', () => {
      expect(
        scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git push origin :main' }).isSafe
      ).toBe(false)
      expect(
        scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git push origin --delete master' }).isSafe
      ).toBe(false)
    })

    test('blocks force push to custom protected branch from user config', () => {
      const customConfig = {
        ...DEFAULT_GUARD_CONFIG,
        protected_branches: ['production', 'release-2026']
      }
      const customScanner = new GitDiffScannerRule(() => customConfig)
      expect(
        customScanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git push -f origin release-2026' }).isSafe
      ).toBe(false)
    })

    test('allows safe non-force pushes to feature branches', () => {
      expect(
        scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git push origin feature/login' }).isSafe
      ).toBe(true)
      expect(
        scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git push -u origin branch-test' }).isSafe
      ).toBe(true)
    })
  })

  describe('Staged Files Interception on git add', () => {
    const scanner = new GitDiffScannerRule()

    test('blocks git add when targeting secret .env file', () => {
      const evaluation = scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git add .env' })
      expect(evaluation.isSafe).toBe(false)
      expect(evaluation.reason).toContain(SECURITY_MESSAGES.GIT_STAGED_SENSITIVE_FILE_REASON)
      expect(evaluation.reason).toContain('.env')
    })

    test('blocks git add when targeting nested .env.local or .env.production', () => {
      expect(
        scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git add backend/.env.production' }).isSafe
      ).toBe(false)
      expect(
        scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git add .env.local' }).isSafe
      ).toBe(false)
    })

    test('allows git add when targeting benign .env.example template', () => {
      expect(
        scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git add .env.example' }).isSafe
      ).toBe(true)
      expect(
        scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git add backend/.env.sample' }).isSafe
      ).toBe(true)
    })

    test('blocks git add when targeting SSH keys or AWS credentials', () => {
      expect(
        scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git add ~/.ssh/id_rsa' }).isSafe
      ).toBe(false)
      expect(
        scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git add id_ed25519' }).isSafe
      ).toBe(false)
      expect(
        scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git add ~/.aws/credentials' }).isSafe
      ).toBe(false)
      expect(
        scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git add certs/server.key' }).isSafe
      ).toBe(false)
      expect(
        scanner.evaluate({ tool: TOOL_NAMES.BASH, command: 'git add terraform.tfvars' }).isSafe
      ).toBe(false)
    })
  })

  describe('Commit Message & Diff Content Secret Interception', () => {
    const scanner = new GitDiffScannerRule()

    test('blocks git commit when message contains AWS Access Key', () => {
      const evaluation = scanner.evaluate({
        tool: TOOL_NAMES.BASH,
        command: 'git commit -m "added key AKIA1234567890ABCDEF for auth"'
      })
      expect(evaluation.isSafe).toBe(false)
      expect(evaluation.reason).toContain('AWS Access Key')
    })

    test('blocks git commit when message contains GitHub Token', () => {
      const evaluation = scanner.evaluate({
        tool: TOOL_NAMES.BASH,
        command: 'git commit -m "token: ghp_123456789012345678901234567890123456"'
      })
      expect(evaluation.isSafe).toBe(false)
      expect(evaluation.reason).toContain('GitHub Token')
    })

    test('blocks git commit when message contains Anthropic or OpenAI Key', () => {
      expect(
        scanner.evaluate({
          tool: TOOL_NAMES.BASH,
          command: 'git commit -m "sk-ant-api03-abcdefghijklmnopqrstuvwxyz"'
        }).isSafe
      ).toBe(false)
      expect(
        scanner.evaluate({
          tool: TOOL_NAMES.BASH,
          command: 'git commit -m "sk-123456789012345678901234567890"'
        }).isSafe
      ).toBe(false)
    })

    test('allows git commit when message is clean standard text', () => {
      expect(
        scanner.evaluate({
          tool: TOOL_NAMES.BASH,
          command: 'git commit -m "feat(auth): implement oauth login"'
        }).isSafe
      ).toBe(true)
    })

    test('scanDiffText detects secrets in diff added lines', () => {
      const diffWithAws = '+const AWS_KEY = "AKIA1234567890ABCDEF";\n'
      expect(scanner.scanDiffText(diffWithAws).isSafe).toBe(false)

      const diffWithPrivateHeader = '+-----BEGIN RSA PRIVATE KEY-----\n+MIIEowIBAAKCAQEA...\n'
      expect(scanner.scanDiffText(diffWithPrivateHeader).isSafe).toBe(false)

      const cleanDiff = '+export function safeFunction() {\n+  return 42;\n+}\n'
      expect(scanner.scanDiffText(cleanDiff).isSafe).toBe(true)
    })
  })
})
