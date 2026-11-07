/**
 * @fileoverview Unit tests for Telemetry & Usage Analytics (TDD).
 * Covers model formatting, token formatting, rate limit countdowns, turn forecasting,
 * compact urgency calculation, and visual bar metrics.
 */

import { describe, expect, test } from 'claude-code/testing'
import {
  formatModel,
  formatTokens,
  formatUsd,
  formatCountdown,
  barColor,
  figureColor,
  filledCells,
  calculateCompactLevel,
  getGuardStatusBadge,
  filterActiveRateLimits,
  TurnHistoryTracker
} from '../../src/core/usage/telemetry.js'
import { COMPACT_LEVELS, UI_MESSAGES } from '../../src/shared/constants.js'

describe('Telemetry & Usage Analytics Engine (TDD)', () => {
  describe('formatModel', () => {
    test('formats claude model ids with version numbers cleanly', () => {
      expect(formatModel('claude-opus-5-5')).toBe('Opus 5.5')
      expect(formatModel('claude-opus-5-5-20251101')).toBe('Opus 5.5')
      expect(formatModel('claude-sonnet-4-5-20250929')).toBe('Sonnet 4.5')
      expect(formatModel('claude-haiku-4-5')).toBe('Haiku 4.5')
    })

    test('retains context bracket suffix like [1m]', () => {
      expect(formatModel('claude-opus-5-5[1m]')).toBe('Opus 5.5')
    })

    test('passes through unrecognized model ids or aliases without mutation', () => {
      expect(formatModel('gpt-4o')).toBe('gpt-4o')
      expect(formatModel('custom-finetuned')).toBe('custom-finetuned')
      expect(formatModel('')).toBe('')
    })
  })

  describe('formatTokens', () => {
    test('formats small numbers under 1000 verbatim', () => {
      expect(formatTokens(0)).toBe('0')
      expect(formatTokens(850)).toBe('850')
    })

    test('formats thousands with 1 decimal or integer k', () => {
      expect(formatTokens(1500)).toBe('1.5k')
      expect(formatTokens(82100)).toBe('82.1k')
      expect(formatTokens(100000)).toBe('100k')
      expect(formatTokens(150000)).toBe('150k')
    })

    test('formats millions with M suffix', () => {
      expect(formatTokens(1000000)).toBe('1M')
      expect(formatTokens(1500000)).toBe('1.5M')
      expect(formatTokens(2100000)).toBe('2.1M')
    })
  })

  describe('formatUsd', () => {
    test('formats costs from one dollar up to 2 decimal places', () => {
      expect(formatUsd(1.234)).toBe('$1.23')
      expect(formatUsd(5.0)).toBe('$5.00')
    })

    test('formats sub-dollar costs with 3 decimal precision when precision matters', () => {
      expect(formatUsd(0.005)).toBe('$0.005')
      expect(formatUsd(0.40)).toBe('$0.40')
    })
  })

  describe('formatCountdown', () => {
    test('returns empty string if resetsAt is undefined', () => {
      expect(formatCountdown(undefined, Date.now())).toBe('')
    })

    test('returns "now" if reset timestamp is in the past', () => {
      const now = Date.now()
      const past = new Date(now - 10000).toISOString()
      expect(formatCountdown(past, now)).toBe('now')
    })

    test('formats minutes under 1 hour', () => {
      const now = 1700000000000
      const reset = new Date(now + 45 * 60 * 1000).toISOString()
      expect(formatCountdown(reset, now)).toBe('45m')
    })

    test('formats hours and minutes between 1h and 10h', () => {
      const now = 1700000000000
      const reset = new Date(now + (4 * 60 + 30) * 60 * 1000).toISOString()
      expect(formatCountdown(reset, now)).toBe('4h30m')
    })

    test('formats whole hours between 10h and 24h', () => {
      const now = 1700000000000
      const reset = new Date(now + 18 * 60 * 60 * 1000).toISOString()
      expect(formatCountdown(reset, now)).toBe('18h')
    })

    test('formats days and hours over 24h', () => {
      const now = 1700000000000
      const reset = new Date(now + (2 * 24 + 5) * 60 * 60 * 1000).toISOString()
      expect(formatCountdown(reset, now)).toBe('2d5h')
    })
  })

  describe('barColor & figureColor & filledCells', () => {
    test('returns correct bar status color', () => {
      expect(barColor(10)).toBe('success')
      expect(barColor(59)).toBe('success')
      expect(barColor(60)).toBe('warning')
      expect(barColor(79)).toBe('warning')
      expect(barColor(80)).toBe('error')
      expect(barColor(95)).toBe('error')
    })

    test('returns figureColor for high usage only', () => {
      expect(figureColor(50)).toBeUndefined()
      expect(figureColor(65)).toBe('warning')
      expect(figureColor(85)).toBe('error')
    })

    test('calculates filled cells clamped accurately', () => {
      expect(filledCells(0, 10)).toBe(0)
      expect(filledCells(1, 10)).toBe(1) // Any usage at all fills at least 1 cell
      expect(filledCells(50, 10)).toBe(5)
      expect(filledCells(100, 10)).toBe(10)
      expect(filledCells(120, 10)).toBe(10)
    })
  })

  describe('calculateCompactLevel', () => {
    test('returns "now" when percentage >= 90 or turns remaining <= 2', () => {
      expect(calculateCompactLevel(92, 10)).toBe(COMPACT_LEVELS.NOW)
      expect(calculateCompactLevel(50, 1)).toBe(COMPACT_LEVELS.NOW)
    })

    test('returns "recommend" when percentage >= 75 or turns remaining <= 4', () => {
      expect(calculateCompactLevel(78, 10)).toBe(COMPACT_LEVELS.RECOMMEND)
      expect(calculateCompactLevel(50, 3)).toBe(COMPACT_LEVELS.RECOMMEND)
    })

    test('returns "soon" when percentage >= 60 or turns remaining <= 8', () => {
      expect(calculateCompactLevel(62, 12)).toBe(COMPACT_LEVELS.SOON)
      expect(calculateCompactLevel(45, 6)).toBe(COMPACT_LEVELS.SOON)
    })

    test('returns "none" under low usage with ample turns left', () => {
      expect(calculateCompactLevel(30, 20)).toBe(COMPACT_LEVELS.NONE)
      expect(calculateCompactLevel(40, null)).toBe(COMPACT_LEVELS.NONE)
    })
  })

  describe('getGuardStatusBadge', () => {
    test('returns ok status when blockedCount is 0', () => {
      const badge = getGuardStatusBadge(0)
      expect(badge.label).toBe(UI_MESSAGES.GUARD_STATUS_OK)
      expect(badge.isAlert).toBe(false)
    })

    test('returns alert status when blockedCount > 0', () => {
      const badge = getGuardStatusBadge(3)
      expect(badge.label).toBe(`${UI_MESSAGES.GUARD_STATUS_BLOCKED_PREFIX}3${UI_MESSAGES.GUARD_STATUS_BLOCKED_SUFFIX}`)
      expect(badge.isAlert).toBe(true)
    })

    test('returns paused status when isGuardEnabled is false regardless of blockedCount', () => {
      const badge = getGuardStatusBadge(5, false)
      expect(badge.label).toBe(UI_MESSAGES.GUARD_STATUS_PAUSED)
      expect(badge.isAlert).toBe(false)
    })
  })

  describe('filterActiveRateLimits', () => {
    test('prefers live rate limits when available', () => {
      const live = [{ kind: 'five_hour', percentUsed: 25 }]
      const saved = [{ kind: 'five_hour', percentUsed: 50 }]
      expect(filterActiveRateLimits(live, saved, Date.now())).toEqual(live)
    })

    test('falls back to non-expired saved limits when live is empty', () => {
      const now = 100000
      const saved = [
        { kind: 'five_hour', percentUsed: 50, resetsAt: new Date(200000).toISOString() },
        { kind: 'seven_day', percentUsed: 10, resetsAt: new Date(50000).toISOString() } // Expired
      ]
      const active = filterActiveRateLimits([], saved, now)
      expect(active).toHaveLength(1)
      expect(active[0]?.kind).toBe('five_hour')
    })
  })

  describe('TurnHistoryTracker', () => {
    test('records turn context sizes and resets on compaction decrease', () => {
      const tracker = new TurnHistoryTracker(6)
      tracker.recordTurn(10000)
      tracker.recordTurn(15000)
      tracker.recordTurn(20000)

      expect(tracker.getSamples()).toEqual([10000, 15000, 20000])
      expect(tracker.getAverageGrowth()).toBe(5000)

      // Compaction occurred (size dropped)
      tracker.recordTurn(8000)
      expect(tracker.getSamples()).toEqual([8000])
      expect(tracker.getAverageGrowth()).toBeNull()
    })

    test('estimates turns left until auto-compaction limit', () => {
      const tracker = new TurnHistoryTracker(6)
      tracker.recordTurn(10000)
      tracker.recordTurn(20000) // growth = 10000
      tracker.recordTurn(30000) // growth = 10000

      // current = 30000, limit = 80000, remaining = 50000, turns = 50000 / 10000 = 5
      const turns = tracker.estimateTurnsLeft(30000, 80000)
      expect(turns).toBe(5)
    })

    test('returns null when growth is zero or negative or not enough samples', () => {
      const tracker = new TurnHistoryTracker(6)
      tracker.recordTurn(10000)
      expect(tracker.estimateTurnsLeft(10000, 100000)).toBeNull()

      tracker.recordTurn(10000) // 0 growth
      expect(tracker.estimateTurnsLeft(10000, 100000)).toBeNull()
    })
  })
})
