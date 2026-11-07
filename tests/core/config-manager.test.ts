/**
 * @fileoverview Unit tests for GuardConfigManager (pure in-process configuration management).
 */

import { describe, expect, test } from 'claude-code/testing'
import { GuardConfigManager, DEFAULT_GUARD_CONFIG } from '../../src/core/config/ConfigManager.js'

describe('GuardConfigManager (TDD)', () => {
  test('returns default configuration when no user options are passed', () => {
    const manager = new GuardConfigManager()
    const config = manager.load()

    expect(config.strict_mode).toBe(true)
    expect(config.enable_git_scan).toBe(true)
    expect(config.enable_usage_bar).toBe(true)
    expect(config.enable_rate_limits).toBe(true)
    expect(config.notification_mode).toBe('toast')
    expect(config.protected_branches).toContain('main')
    expect(config.protected_branches).toContain('master')
  })

  test('merges user configuration object correctly', () => {
    const manager = new GuardConfigManager()
    const config = manager.load({
      strict_mode: false,
      enable_git_scan: true,
      enable_usage_bar: false,
      notification_mode: 'silent',
      allowed_patterns: ['custom\\.env\\.test'],
      allowed_commands: ['npm test'],
      custom_blocked_files: ['confidential\\.pdf'],
      custom_blocked_commands: ['sudo reboot'],
      custom_secret_patterns: ['SECRET_COMPANY_KEY_[0-9]+'],
      protected_branches: ['staging']
    })

    expect(config.strict_mode).toBe(false)
    expect(config.enable_usage_bar).toBe(false)
    expect(config.notification_mode).toBe('silent')
    expect(config.allowed_patterns).toContain('custom\\.env\\.test')
    expect(config.allowed_commands).toContain('npm test')
    expect(config.custom_blocked_files).toContain('confidential\\.pdf')
    expect(config.custom_blocked_commands).toContain('sudo reboot')
    expect(config.custom_secret_patterns).toContain('SECRET_COMPANY_KEY_[0-9]+')
    expect(config.protected_branches).toContain('staging')
    expect(config.protected_branches).toContain('main')
  })

  test('parses and merges raw JSON string options correctly', () => {
    const jsonStr = JSON.stringify({
      strict_mode: false,
      allowed_patterns: ['whitelist-pattern'],
      custom_blocked_files: ['passwords.txt']
    })

    const manager = new GuardConfigManager()
    const config = manager.load(jsonStr)

    expect(config.strict_mode).toBe(false)
    expect(config.allowed_patterns).toContain('whitelist-pattern')
    expect(config.custom_blocked_files).toContain('passwords.txt')
  })

  test('gracefully recovers from malformed JSON string without crashing', () => {
    const manager = new GuardConfigManager()
    expect(() => {
      const config = manager.load('{ malformed json: not valid ...')
      expect(config.strict_mode).toBe(DEFAULT_GUARD_CONFIG.strict_mode)
    }).not.toThrow()
  })

  test('generates valid JSON starter template configuration', () => {
    const manager = new GuardConfigManager()
    const template = manager.generateTemplateConfig()
    expect(template).toContain('strict_mode')
    expect(template).toContain('allowed_patterns')
    expect(template).toContain('protected_branches')

    const parsed = JSON.parse(template)
    expect(parsed.strict_mode).toBe(true)
    expect(parsed.protected_branches).toContain('main')
  })

  test('hierarchically resolves configuration from user global and workspace files', async () => {
    const mockFiles: Record<string, string> = {
      '/home/user/.guardrc.json': JSON.stringify({
        allowed_patterns: ['global-whitelist'],
        protected_branches: ['prod-global']
      }),
      '.guardrc.json': JSON.stringify({
        strict_mode: false,
        allowed_patterns: ['repo-whitelist'],
        custom_blocked_files: ['repo-secret.txt']
      })
    }

    const mockEngine = {
      fs: {
        read: async (path: string) => mockFiles[path] || '',
        exists: async (path: string) => Boolean(mockFiles[path])
      },
      env: {
        get: async (key: string) => (key === 'HOME' ? '/home/user' : undefined)
      }
    }

    const manager = new GuardConfigManager()
    const resolved = await manager.loadHierarchicalConfig(mockEngine, {
      enable_git_scan: false // Manifest option overrides
    })

    expect(resolved.strict_mode).toBe(false) // from repo .guardrc.json
    expect(resolved.enable_git_scan).toBe(false) // from manifest
    expect(resolved.allowed_patterns).toContain('global-whitelist') // from global
    expect(resolved.allowed_patterns).toContain('repo-whitelist') // from repo
    expect(resolved.protected_branches).toContain('prod-global') // from global
    expect(resolved.custom_blocked_files).toContain('repo-secret.txt') // from repo
  })
})
