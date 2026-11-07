/**
 * @fileoverview Unit tests for UsageContextBar presentational component (TDD).
 * Tests layout responsiveness, meter bar rendering, guard status badges,
 * compact level hints, and rate limit displays across wide, medium, and narrow viewports.
 */

import { describe, expect, test } from 'claude-code/testing'
import { UsageContextBar } from '../../src/ui/components/UsageContextBar.js'
import { COMPACT_LEVELS, TELEMETRY_SYMBOLS, UI_MESSAGES } from '../../src/shared/constants.js'

describe('UsageContextBar Presentational Component (TDD)', () => {
  const mockPrimitives = {
    Box: (props: any) => ({ type: 'Box', ...props }),
    Text: (props: any) => ({ type: 'Text', ...props })
  }

  test('renders wide desktop layout with guard badge, context bar, quotas, model and cost', () => {
    const tree = UsageContextBar(
      {
        blockedCount: 0,
        model: 'Opus 5.5',
        effort: 'high',
        cost: '$1.45',
        contextTokens: 82000,
        windowTokens: 200000,
        contextPercent: 41,
        compactLevel: COMPACT_LEVELS.NONE,
        turnsRemaining: 12,
        rateLimits: [
          { kind: 'five_hour', percentUsed: 15, resetsAt: new Date(Date.now() + 3600000).toISOString() },
          { kind: 'seven_day', percentUsed: 20, resetsAt: new Date(Date.now() + 86400000).toISOString() }
        ],
        columns: 140,
        surface: 'terminal'
      },
      mockPrimitives
    )

    expect(tree.type).toBe('Box')
    expect(tree.flexDirection).toBe('row')
    expect(tree.children).toHaveLength(2) // Left meters box and Right engine box
  })

  test('renders guard alert badge when blockedCount > 0', () => {
    const tree = UsageContextBar(
      {
        blockedCount: 3,
        model: 'Sonnet 4.5',
        effort: null,
        cost: null,
        contextTokens: 50000,
        windowTokens: 200000,
        contextPercent: 25,
        compactLevel: COMPACT_LEVELS.NONE,
        turnsRemaining: null,
        rateLimits: [],
        columns: 120,
        surface: 'terminal'
      },
      mockPrimitives
    )

    expect(tree.type).toBe('Box')
    const leftBox = tree.children[0]
    expect(leftBox).toBeDefined()
    // First element in leftBox should be guard badge
    const badgeNode = leftBox.children[0]
    expect(badgeNode.color).toBe('red')
    expect(badgeNode.bold).toBe(true)
    expect(badgeNode.children).toContain(`${UI_MESSAGES.GUARD_STATUS_BLOCKED_PREFIX}3${UI_MESSAGES.GUARD_STATUS_BLOCKED_SUFFIX}`)
  })

  test('renders compact urgency warning when compactLevel is "now" or "recommend"', () => {
    const tree = UsageContextBar(
      {
        blockedCount: 0,
        model: 'Opus 5.5',
        effort: 'medium',
        cost: '$3.50',
        contextTokens: 185000,
        windowTokens: 200000,
        contextPercent: 92,
        compactLevel: COMPACT_LEVELS.NOW,
        turnsRemaining: 1,
        rateLimits: [],
        columns: 120,
        surface: 'terminal'
      },
      mockPrimitives
    )

    const leftBox = tree.children[0]
    const renderedText = JSON.stringify(leftBox)
    expect(renderedText).toContain(UI_MESSAGES.COMPACT_HINT_NOW)
  })

  test('renders compact single-row layout when columns < 80', () => {
    const tree = UsageContextBar(
      {
        blockedCount: 0,
        model: 'Opus 5.5',
        effort: null,
        cost: '$0.50',
        contextTokens: 40000,
        windowTokens: 200000,
        contextPercent: 20,
        compactLevel: COMPACT_LEVELS.NONE,
        turnsRemaining: null,
        rateLimits: [{ kind: 'five_hour', percentUsed: 10 }],
        columns: 70,
        surface: 'terminal'
      },
      mockPrimitives
    )

    expect(tree.type).toBe('Box')
    expect(tree.flexDirection).toBe('row')
  })

  test('gracefully handles missing or zero rateLimits and contextTokens without crashing', () => {
    const tree = UsageContextBar(
      {
        blockedCount: 0,
        model: '',
        effort: null,
        cost: null,
        contextTokens: 0,
        windowTokens: 200000,
        contextPercent: 0,
        compactLevel: COMPACT_LEVELS.NONE,
        turnsRemaining: null,
        rateLimits: [],
        columns: 100,
        surface: 'desktop'
      },
      mockPrimitives
    )

    expect(tree).toBeDefined()
    expect(tree.type).toBe('Box')
  })

  test('renders interactive guard badge button and triggers onToggleGuard when pressed', () => {
    let toggled = false
    const tree = UsageContextBar(
      {
        blockedCount: 0,
        isGuardEnabled: true,
        onToggleGuard: () => {
          toggled = true
        },
        model: 'Opus 5.5',
        effort: null,
        cost: null,
        contextTokens: 10000,
        windowTokens: 200000,
        contextPercent: 5,
        compactLevel: COMPACT_LEVELS.NONE,
        turnsRemaining: null,
        rateLimits: [],
        columns: 120,
        surface: 'terminal'
      },
      {
        ...mockPrimitives,
        Button: (props: any) => ({ type: 'Button', ...props })
      }
    )

    const leftBox = tree.children[0]
    expect(leftBox).toBeDefined()
    const guardButton = leftBox.children.find((c: any) => c.type === 'Button' && c.key === 'guard-badge-toggle')
    expect(guardButton).toBeDefined()
    guardButton.onPress()
    expect(toggled).toBe(true)
  })

  test('renders paused status badge [GUARD: OFF] when isGuardEnabled is false', () => {
    const tree = UsageContextBar(
      {
        blockedCount: 2,
        isGuardEnabled: false,
        model: 'Opus 5.5',
        effort: null,
        cost: null,
        contextTokens: 10000,
        windowTokens: 200000,
        contextPercent: 5,
        compactLevel: COMPACT_LEVELS.NONE,
        turnsRemaining: null,
        rateLimits: [],
        columns: 120,
        surface: 'terminal'
      },
      mockPrimitives
    )

    const renderedText = JSON.stringify(tree)
    expect(renderedText).toContain(UI_MESSAGES.GUARD_STATUS_PAUSED)
  })
})
