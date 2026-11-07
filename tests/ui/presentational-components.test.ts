/**
 * @fileoverview Unit tests for Presentational UI Components using TDD.
 * Includes defensive fallback resilience tests against undefined surface/command/timestamp props.
 */

import { describe, expect, test } from 'claude-code/testing'
import { SecurityBanner } from '../../src/ui/components/SecurityBanner.js'
import { DashboardPane } from '../../src/ui/components/DashboardPane.js'
import {
  SURFACES,
  THEME_STYLES,
  UI_MESSAGES
} from '../../src/shared/constants.js'

describe('Presentational UI Components (TDD)', () => {
  const mockPrimitives = {
    Box: (props: any) => ({ type: 'Box', ...props }),
    Text: (props: any) => ({ type: 'Text', ...props }),
    Button: (props: any) => ({ type: 'Button', ...props })
  }

  describe('SecurityBanner Component', () => {
    test('renders expanded border and labels on wide desktop and terminal surfaces', () => {
      const tree = SecurityBanner(
        {
          blockedCount: 4,
          contextPercent: 65.5,
          isCompact: false,
          surface: SURFACES.TERMINAL
        },
        mockPrimitives
      )

      expect(tree.type).toBe('Box')
      expect(tree.borderColor).toBe(THEME_STYLES.COLOR_RED)
      expect(tree.children).toHaveLength(3)
      expect(tree.children[0].children[0]).toBe(UI_MESSAGES.BANNER_TITLE_EXPANDED)
      expect(tree.children[2].children[0]).toContain(UI_MESSAGES.BANNER_BLOCKED_LABEL)
      expect(tree.children[2].children[0]).toContain('4')
    })

    test('renders compact layout when isCompact is true', () => {
      const tree = SecurityBanner(
        {
          blockedCount: 0,
          contextPercent: 40.0,
          isCompact: true,
          surface: SURFACES.TERMINAL
        },
        mockPrimitives
      )

      expect(tree.type).toBe('Box')
      expect(tree.flexDirection).toBe(THEME_STYLES.DIRECTION_ROW)
      expect(tree.children[0].children[0]).toBe(UI_MESSAGES.BANNER_PREFIX_COMPACT)
      expect(tree.children[1].children[0]).toContain(UI_MESSAGES.BANNER_CTX_SHORT)
      expect(tree.children[2].children[0]).toContain(UI_MESSAGES.BANNER_BLK_SHORT)
    })

    test('always renders compact layout on mobile surface regardless of isCompact flag', () => {
      const tree = SecurityBanner(
        {
          blockedCount: 1,
          contextPercent: 90.0,
          isCompact: false,
          surface: SURFACES.MOBILE
        },
        mockPrimitives
      )

      expect(tree.children[0].children[0]).toBe(UI_MESSAGES.BANNER_PREFIX_COMPACT)
    })
  })

  describe('DashboardPane Component', () => {
    test('renders recent violations when present', () => {
      let closed = false
      const tree = DashboardPane(
        {
          blockedCount: 1,
          contextPercent: 50.0,
          violations: [
            {
              id: 'v-1',
              timestamp: Date.now(),
              command: 'rm -rf /root',
              reason: 'Destructive command'
            }
          ],
          surface: SURFACES.DESKTOP,
          onClose: () => {
            closed = true
          }
        },
        mockPrimitives
      )

      expect(tree.type).toBe('Box')
      expect(tree.borderStyle).toBe(THEME_STYLES.BORDER_ROUND)
      expect(JSON.stringify(tree)).toContain('ENTERPRISE SECURITY DASHBOARD')
      
      // Check close button callback inside button container
      const buttonBox = tree.children.find((c: any) => c.type === 'Box' && c.children && c.children.some((child: any) => child.type === 'Button'))
      expect(buttonBox).toBeDefined()
      const button = buttonBox.children.find((c: any) => c.type === 'Button' && c.label === UI_MESSAGES.PANE_BTN_CLOSE_LABEL)
      expect(button).toBeDefined()
      button.onPress()
      expect(closed).toBe(true)
    })

    test('renders interactive guard toggle button when onToggleGuard callback is provided', () => {
      let toggled = false
      const tree = DashboardPane(
        {
          blockedCount: 0,
          contextPercent: 20.0,
          violations: [],
          isGuardEnabled: true,
          surface: SURFACES.TERMINAL,
          onToggleGuard: () => {
            toggled = true
          },
          onClose: () => {}
        },
        mockPrimitives
      )

      const buttonBox = tree.children.find((c: any) => c.type === 'Box' && c.children && c.children.some((child: any) => child.type === 'Button'))
      expect(buttonBox).toBeDefined()
      const toggleBtn = buttonBox.children.find((c: any) => c.type === 'Button' && c.key === 'btn-toggle-guard')
      expect(toggleBtn).toBeDefined()
      expect(toggleBtn.label).toBe(UI_MESSAGES.PANE_BTN_TOGGLE_PAUSE)
      toggleBtn.onPress()
      expect(toggled).toBe(true)
    })

    test('renders fallback text when violations list is empty', () => {
      const tree = DashboardPane(
        {
          blockedCount: 0,
          contextPercent: 12.0,
          violations: [],
          surface: SURFACES.TERMINAL,
          onClose: () => {}
        },
        mockPrimitives
      )

      expect(JSON.stringify(tree)).toContain('No violations recorded')
    })

    test('gracefully handles undefined surface and commands without crashing', () => {
      expect(() => {
        DashboardPane(
          {
            blockedCount: 2,
            contextPercent: 15.0,
            violations: [
              {
                id: 'v-undefined-cmd',
                timestamp: undefined as any,
                command: undefined as any,
                reason: 'Undefined command test'
              }
            ],
            surface: undefined as any,
            onClose: () => {}
          },
          mockPrimitives
        )
      }).not.toThrow()
    })
  })
})
