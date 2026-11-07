/**
 * @fileoverview Unit tests for Security Rules and Scanner using Strategy Pattern.
 * Follows TDD methodology, including adversarial red-team attack vectors,
 * template whitelisting (.env.example), and sensitive credential protection (SSH, Cloud, Keys).
 */

import { describe, expect, test } from 'claude-code/testing'
import {
  DestructiveCommandRule,
  EnvFileAccessRule,
  EnvShellLeakRule,
  SecurityScanner
} from '../../src/core/security/rules.js'
import { DEFAULT_GUARD_CONFIG } from '../../src/core/config/ConfigManager.js'
import { SECURITY_MESSAGES, TOOL_NAMES } from '../../src/shared/constants.js'

describe('Security Rules Strategy Pattern (TDD & Adversarial Hardening)', () => {
  describe('DestructiveCommandRule', () => {
    const rule = new DestructiveCommandRule()

    test('identifies and blocks rm -rf / commands', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'rm -rf /' })
      expect(evaluation.isSafe).toBe(false)
      expect(evaluation.reason).toBe(SECURITY_MESSAGES.DESTRUCTIVE_COMMAND_REASON)
    })

    test('identifies and blocks rm -fr ~ commands', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'rm -fr ~' })
      expect(evaluation.isSafe).toBe(false)
    })

    test('identifies and blocks split flags (rm -r -f /)', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'rm -r -f /' })
      expect(evaluation.isSafe).toBe(false)
    })

    test('identifies and blocks uppercase flags (rm -Rf /)', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'rm -Rf /' })
      expect(evaluation.isSafe).toBe(false)
    })

    test('identifies and blocks long options (rm --recursive --force /)', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'rm --recursive --force /' })
      expect(evaluation.isSafe).toBe(false)
    })

    test('identifies and blocks reordered options (rm --no-preserve-root -rf /)', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'rm --no-preserve-root -rf /' })
      expect(evaluation.isSafe).toBe(false)
    })

    test('identifies and blocks quoted targets (rm -rf "/" and rm -rf "${HOME}")', () => {
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'rm -rf "/"' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'rm -rf "${HOME}"' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'rm -rf "$HOME"' }).isSafe).toBe(false)
    })

    test('identifies and blocks inverted dd arguments', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'dd of=/dev/sda if=/dev/zero' })
      expect(evaluation.isSafe).toBe(false)
    })

    test('identifies and blocks macOS raw disk manipulation (/dev/rdisk0)', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'dd if=/dev/zero of=/dev/rdisk0' })
      expect(evaluation.isSafe).toBe(false)
    })

    test('identifies and blocks direct shell redirection to raw disk device', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'cat random.bin > /dev/sda' })
      expect(evaluation.isSafe).toBe(false)
    })

    test('identifies and blocks shell fork bombs', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.BASH, command: ':(){ :|:& };:' })
      expect(evaluation.isSafe).toBe(false)
    })

    test('allows safe shell commands', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'git status && npm run test' })
      expect(evaluation.isSafe).toBe(true)
      expect(evaluation.reason).toBeUndefined()
    })

    test('allows dangerous command if explicitly whitelisted in allowed_commands configuration', () => {
      const customRule = new DestructiveCommandRule(() => ({
        ...DEFAULT_GUARD_CONFIG,
        allowed_commands: ['rm -rf /tmp/build-cache']
      }))

      const evaluation = customRule.evaluate({
        tool: TOOL_NAMES.BASH,
        command: 'rm -rf /tmp/build-cache'
      })
      expect(evaluation.isSafe).toBe(true)
    })
  })

  describe('EnvFileAccessRule (Secrets, Templates & Sensitive Credentials)', () => {
    const rule = new EnvFileAccessRule()

    test('blocks direct reading of .env file', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.READ, file_path: '.env' })
      expect(evaluation.isSafe).toBe(false)
      expect(evaluation.reason).toBe(SECURITY_MESSAGES.ENV_FILE_ACCESS_REASON)
    })

    test('blocks direct reading of nested .env.production and .env.local', () => {
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: 'backend/config/.env.production' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.WRITE, file_path: '.env.local' }).isSafe).toBe(false)
    })

    test('explicitly ALLOWS legitimate environment template files (.env.example, .env.sample, .env.template)', () => {
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: '.env.example' }).isSafe).toBe(true)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: 'backend/.env.sample' }).isSafe).toBe(true)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: '.env.template' }).isSafe).toBe(true)
      expect(rule.evaluate({ tool: TOOL_NAMES.GREP, path: '.env.dist' }).isSafe).toBe(true)
    })

    test('blocks Grep searches targeting secret .env files', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.GREP, path: '.env' })
      expect(evaluation.isSafe).toBe(false)
      expect(evaluation.reason).toBe(SECURITY_MESSAGES.GREP_ENV_PROHIBITED)
    })

    test('blocks Glob listings targeting .env patterns', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.GLOB, path: 'config/.env' })
      expect(evaluation.isSafe).toBe(false)
    })

    test('blocks trailing segment and encoded path evasions', () => {
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: 'backend/.env/.' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: '.env/' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: '.env\0' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: '%2Eenv' }).isSafe).toBe(false)
    })

    test('blocks accessing SSH keys and configuration files (~/.ssh/*, id_rsa, id_ed25519)', () => {
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: '~/.ssh/id_rsa' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: '~/.ssh/id_ed25519' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: '~/.ssh/config' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: '/Users/test/.ssh/known_hosts' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: 'keys/id_rsa' }).isSafe).toBe(false)
    })

    test('blocks accessing Cloud credentials and auth tokens (AWS, Kube, NPM, Git credentials)', () => {
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: '~/.aws/credentials' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: '~/.kube/config' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: '~/.npmrc' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: '~/.git-credentials' }).isSafe).toBe(false)
    })

    test('blocks accessing shell history and Terraform secret files', () => {
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: '~/.zsh_history' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: 'infra/terraform.tfvars' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: 'terraform.tfstate' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: 'certs/server.key' }).isSafe).toBe(false)
    })

    test('allows accessing standard non-secret files', () => {
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: 'src/config/environment.ts' }).isSafe).toBe(true)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: 'package.json' }).isSafe).toBe(true)
      expect(rule.evaluate({ tool: TOOL_NAMES.READ, file_path: 'public/key.png' }).isSafe).toBe(true)
    })
  })

  describe('EnvShellLeakRule', () => {
    const rule = new EnvShellLeakRule()

    test('blocks cat .env execution', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'cat .env' })
      expect(evaluation.isSafe).toBe(false)
      expect(evaluation.reason).toBe(SECURITY_MESSAGES.ENV_SHELL_LEAK_REASON)
    })

    test('allows cat .env.example or inspecting template files in bash', () => {
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'cat .env.example' }).isSafe).toBe(true)
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'head -n 10 backend/.env.sample' }).isSafe).toBe(true)
    })

    test('blocks combined commands trying to sneak .env alongside .env.example', () => {
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'cat .env.example && cat .env' }).isSafe).toBe(false)
    })

    test('blocks sourcing .env files', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'source .env.staging && start' })
      expect(evaluation.isSafe).toBe(false)
    })

    test('blocks variable assignment referencing .env', () => {
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'FILE=.env && cat $FILE' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'E=.env; head $E' }).isSafe).toBe(false)
    })

    test('blocks quote and escape string concatenations (.e""nv, .e\'\'nv, .e\\nv)', () => {
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'cat .e""nv' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: "cat .e''nv" }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'cat .e\\nv' }).isSafe).toBe(false)
    })

    test('blocks shell commands attempting to read SSH keys, AWS credentials, or history', () => {
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'cat ~/.ssh/id_rsa' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'cat ~/.aws/credentials' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'head -n 20 ~/.zsh_history' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'cat terraform.tfvars' }).isSafe).toBe(false)
    })

    test('allows legitimate ssh commands and git operations', () => {
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'ssh -T git@github.com' }).isSafe).toBe(true)
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'ssh-keygen -t ed25519' }).isSafe).toBe(true)
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'git clone git@github.com:test/repo.git' }).isSafe).toBe(true)
    })

    test('blocks unauthenticated local web server daemons exposing repository root', () => {
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'python3 -m http.server 8000' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'npx serve -p 3000' }).isSafe).toBe(false)
      expect(rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'php -S 0.0.0.0:8080' }).isSafe).toBe(false)
    })

    test('allows commands that do not leak .env or credentials', () => {
      const evaluation = rule.evaluate({ tool: TOOL_NAMES.BASH, command: 'cat package.json' })
      expect(evaluation.isSafe).toBe(true)
    })
  })

  describe('SecurityScanner Composite', () => {
    const scanner = new SecurityScanner([
      new DestructiveCommandRule(),
      new EnvFileAccessRule(),
      new EnvShellLeakRule()
    ])

    test('evaluates payload against all registered strategies', () => {
      const resultSafe = scanner.scan({ tool: TOOL_NAMES.BASH, command: 'ls -la' })
      expect(resultSafe.isSafe).toBe(true)

      const resultUnsafe = scanner.scan({ tool: TOOL_NAMES.READ, file_path: '.env' })
      expect(resultUnsafe.isSafe).toBe(false)
      expect(resultUnsafe.reason).toBe(SECURITY_MESSAGES.ENV_FILE_ACCESS_REASON)

      const resultTemplateSafe = scanner.scan({ tool: TOOL_NAMES.READ, file_path: '.env.example' })
      expect(resultTemplateSafe.isSafe).toBe(true)

      const resultSshUnsafe = scanner.scan({ tool: TOOL_NAMES.READ, file_path: '~/.ssh/id_rsa' })
      expect(resultSshUnsafe.isSafe).toBe(false)
      expect(resultSshUnsafe.reason).toBe(SECURITY_MESSAGES.SENSITIVE_FILE_REASON)
    })
  })
})
