/**
 * @fileoverview Pure presentational component for docked Dashboard Pane.
 * Designed with modern card layout, KPI telemetry tiles, multi-column grid,
 * Code syntax blocks, and executive console aesthetic adhering strictly to Clean Code and zero-emoji standards.
 */

import type { SecurityViolationRecord } from '../../core/state/store.js'
import type { GuardUserConfig } from '../../core/config/ConfigManager.js'
import {
  SURFACES,
  THEME_STYLES,
  UI_IDENTIFIERS,
  UI_MESSAGES
} from '../../shared/constants.js'

/**
 * Properties for rendering DashboardPane.
 */
export interface DashboardPaneProps {
  readonly blockedCount: number
  readonly contextPercent: number
  readonly violations?: readonly SecurityViolationRecord[]
  readonly config?: GuardUserConfig
  readonly surface?: string
  readonly isGuardEnabled?: boolean
  readonly onToggleGuard?: () => void
  readonly onClose: () => void
}

/**
 * Pure presentational component rendering the executive security dashboard pane.
 *
 * @param {DashboardPaneProps} props - Component properties.
 * @param {Object} primitives - Engine UI primitives ({ Box, Text, Button, Code }).
 * @returns {Object} Rendered virtual node.
 */
export function DashboardPane(props: DashboardPaneProps, primitives: any): any {
  const { Box, Text, Button, Code } = primitives

  const violationsList = props.violations || []
  const recentViolations = violationsList.slice(-UI_IDENTIFIERS.MAX_RECENT_VIOLATIONS_DISPLAY)

  const violationNodes = recentViolations.map((v) => {
    const safeCommand = (v.command || 'unknown').slice(0, 50)
    const timeString = v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : '--:--:--'

    if (Code && v.command) {
      return Box({
        key: v.id,
        flexDirection: THEME_STYLES.DIRECTION_COLUMN,
        marginBottom: 1,
        children: [
          Text({
            children: [
              Text({ dimColor: true, children: [`  [${timeString}] `] }),
              Text({ color: THEME_STYLES.COLOR_RED, children: ['BLOCKED: '] }),
              v.reason
            ]
          }),
          Code({
            source: v.command,
            language: 'bash',
            wrap: 'truncate-end'
          })
        ]
      })
    }

    return Text({
      key: v.id,
      children: [
        `  - [${timeString}] `,
        safeCommand,
        `: `,
        v.reason,
        '\n'
      ]
    })
  })

  const surfaceDisplay = (props.surface || SURFACES.TERMINAL).toUpperCase()
  const isGuardActive = props.isGuardEnabled !== false

  // 1. Minimalist Header Box with Subtitle and Clean Status Badge
  const headerRow = Box({
    flexDirection: THEME_STYLES.DIRECTION_ROW,
    justifyContent: THEME_STYLES.JUSTIFY_SPACE_BETWEEN,
    marginBottom: 1,
    children: [
      Box({
        flexDirection: THEME_STYLES.DIRECTION_COLUMN,
        children: [
          Text({
            weight: THEME_STYLES.WEIGHT_BOLD,
            children: [UI_MESSAGES.PANE_HEADER]
          }),
          Text({
            dimColor: true,
            children: ['Claude Code In-Process Security Mod • v1.0.0']
          })
        ]
      }),
      Text({
        color: isGuardActive ? THEME_STYLES.COLOR_GREEN : THEME_STYLES.COLOR_GRAY,
        weight: THEME_STYLES.WEIGHT_BOLD,
        children: [
          UI_MESSAGES.PANE_STATUS_LABEL,
          isGuardActive ? UI_MESSAGES.PANE_STATUS_ACTIVE : UI_MESSAGES.PANE_STATUS_PAUSED
        ]
      })
    ]
  })

  // 2. Multi-column Metric Tiles (Clean Subtle Gray Frames, No Rainbow)
  const isStrict = props.config?.strict_mode ?? true
  const kpiRow = Box({
    flexDirection: THEME_STYLES.DIRECTION_ROW,
    gap: 1,
    marginBottom: 1,
    children: [
      Box({
        borderStyle: THEME_STYLES.BORDER_ROUND,
        borderColor: THEME_STYLES.COLOR_GRAY,
        paddingX: 1,
        flexDirection: THEME_STYLES.DIRECTION_COLUMN,
        children: [
          Text({ dimColor: true, children: ['THREATS BLOCKED'] }),
          Text({
            weight: THEME_STYLES.WEIGHT_BOLD,
            color: props.blockedCount > 0 ? THEME_STYLES.COLOR_RED : undefined,
            children: [`${UI_MESSAGES.PANE_TOTAL_BLOCKED}${props.blockedCount || 0}`]
          })
        ]
      }),
      Box({
        borderStyle: THEME_STYLES.BORDER_ROUND,
        borderColor: THEME_STYLES.COLOR_GRAY,
        paddingX: 1,
        flexDirection: THEME_STYLES.DIRECTION_COLUMN,
        children: [
          Text({ dimColor: true, children: ['CONTEXT USAGE'] }),
          Text({
            weight: THEME_STYLES.WEIGHT_BOLD,
            children: [`${UI_MESSAGES.PANE_CONTEXT_LABEL}${(props.contextPercent || 0).toFixed(1)}%`]
          })
        ]
      }),
      Box({
        borderStyle: THEME_STYLES.BORDER_ROUND,
        borderColor: THEME_STYLES.COLOR_GRAY,
        paddingX: 1,
        flexDirection: THEME_STYLES.DIRECTION_COLUMN,
        children: [
          Text({ dimColor: true, children: ['POLICY MODE'] }),
          Text({
            weight: THEME_STYLES.WEIGHT_BOLD,
            children: [isStrict ? 'Strict [ON]' : 'Audit [OFF]']
          })
        ]
      }),
      Box({
        borderStyle: THEME_STYLES.BORDER_ROUND,
        borderColor: THEME_STYLES.COLOR_GRAY,
        paddingX: 1,
        flexDirection: THEME_STYLES.DIRECTION_COLUMN,
        children: [
          Text({ dimColor: true, children: ['SURFACE'] }),
          Text({
            weight: THEME_STYLES.WEIGHT_BOLD,
            children: [`${UI_MESSAGES.PANE_SURFACE_LABEL}${surfaceDisplay}`]
          })
        ]
      })
    ]
  })

  // 3. Active Policy Governance Box (Clean Monochrome)
  const configBox = props.config
    ? Box({
        borderStyle: THEME_STYLES.BORDER_ROUND,
        borderColor: THEME_STYLES.COLOR_GRAY,
        paddingX: 1,
        flexDirection: THEME_STYLES.DIRECTION_COLUMN,
        marginBottom: 1,
        children: [
          Text({
            weight: THEME_STYLES.WEIGHT_BOLD,
            children: [UI_MESSAGES.PANE_CONFIG_TITLE]
          }),
          Text({
            children: [
              `  - Enforcement Mode   : Strict [${props.config.strict_mode ? 'ON' : 'OFF'}] | Git Scan [${props.config.enable_git_scan ? 'ON' : 'OFF'}]\n`,
              `  - Protected Branches : [${props.config.protected_branches.join(', ')}]\n`,
              `  - Custom Whitelists  : ${props.config.allowed_patterns.length} files, ${props.config.allowed_commands.length} commands\n`,
              `  - Custom Blocklists  : ${props.config.custom_blocked_files.length} files, ${props.config.custom_blocked_commands.length} commands`
            ]
          })
        ]
      })
    : null

  // 4. Recent Security Audit Log Box
  const auditBox = Box({
    borderStyle: THEME_STYLES.BORDER_ROUND,
    borderColor: THEME_STYLES.COLOR_GRAY,
    paddingX: 1,
    flexDirection: THEME_STYLES.DIRECTION_COLUMN,
    marginBottom: 1,
    children: [
      Text({
        weight: THEME_STYLES.WEIGHT_BOLD,
        children: [UI_MESSAGES.PANE_RECENT_EVENTS_TITLE]
      }),
      ...(violationNodes.length > 0
        ? violationNodes
        : [
            Text({
              dimColor: true,
              children: [UI_MESSAGES.PANE_NO_VIOLATIONS]
            })
          ])
    ]
  })

  // 5. Interactive Action Toolbar
  const actionRow = Box({
    flexDirection: THEME_STYLES.DIRECTION_ROW,
    children: [
      ...(props.onToggleGuard
        ? [
            Button({
              key: 'btn-toggle-guard',
              label: isGuardActive
                ? UI_MESSAGES.PANE_BTN_TOGGLE_PAUSE
                : UI_MESSAGES.PANE_BTN_TOGGLE_RESUME,
              variant: 'secondary',
              onPress: props.onToggleGuard
            }),
            Text({ children: ['   '] })
          ]
        : []),
      Button({
        key: 'btn-close-pane',
        label: UI_MESSAGES.PANE_BTN_CLOSE_LABEL,
        variant: 'secondary',
        role: 'dismiss',
        onPress: props.onClose
      }),
      Text({
        dimColor: true,
        children: ['    /guard-config | /guard-scan']
      })
    ]
  })

  return Box({
    borderStyle: THEME_STYLES.BORDER_ROUND,
    borderColor: THEME_STYLES.COLOR_GRAY,
    padding: 1,
    flexDirection: THEME_STYLES.DIRECTION_COLUMN,
    children: [
      headerRow,
      kpiRow,
      ...(configBox ? [configBox] : []),
      auditBox,
      Text({ children: ['\n'] }),
      actionRow
    ]
  })
}
