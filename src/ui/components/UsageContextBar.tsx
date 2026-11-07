/**
 * @fileoverview Pure presentational component for Enterprise Guard telemetry & usage context bar.
 * Upgraded context bar with unified security telemetry, guard badges,
 * dynamic responsive cell scaling, quota meters, and strict zero-emoji styling.
 */

import {
  COMPACT_LEVELS,
  SURFACES,
  TELEMETRY_SYMBOLS,
  THEME_STYLES,
  UI_IDENTIFIERS,
  UI_MESSAGES
} from '../../shared/constants.js'
import {
  barColor,
  figureColor,
  filledCells,
  formatCountdown,
  formatTokens,
  getGuardStatusBadge,
  type CompactLevel,
  type RateLimitSnapshot
} from '../../core/usage/telemetry.js'

export interface UsageContextBarProps {
  readonly blockedCount: number
  readonly isGuardEnabled?: boolean
  readonly onToggleGuard?: () => void
  readonly model: string
  readonly effort: string | null
  readonly cost: string | null
  readonly contextTokens: number
  readonly windowTokens: number
  readonly contextPercent: number
  readonly compactLevel: CompactLevel
  readonly turnsRemaining: number | null
  readonly rateLimits: readonly RateLimitSnapshot[]
  readonly columns: number
  readonly surface: string
}

type TextNodeBuilder = (props: {
  children?: any
  bold?: boolean
  dimColor?: boolean
  color?: string
}) => any

/**
 * Pure presentational component rendering the upgraded context and telemetry bar.
 *
 * @param {UsageContextBarProps} props - Telemetry and security props.
 * @param {Object} primitives - UI primitives resolved from engine ({ Box, Text }).
 * @returns {Object} Virtual render node.
 */
export function UsageContextBar(props: UsageContextBarProps, primitives: any): any {
  const { Box, Text, Button } = primitives
  const columns = props.columns || UI_IDENTIFIERS.COMPACT_COLUMN_THRESHOLD
  const isCompact = columns < UI_IDENTIFIERS.COMPACT_COLUMN_THRESHOLD || props.surface === SURFACES.MOBILE
  const isGuardActive = props.isGuardEnabled !== false
  const guardBadge = getGuardStatusBadge(props.blockedCount, isGuardActive)

  // 1. Narrow / Compact Viewport Fallback
  if (isCompact) {
    const badgeTextNode = Text({
      bold: guardBadge.isAlert || !isGuardActive,
      color: !isGuardActive
        ? THEME_STYLES.COLOR_GRAY
        : guardBadge.isAlert
        ? THEME_STYLES.COLOR_RED
        : THEME_STYLES.COLOR_CYAN,
      children: [guardBadge.label]
    })

    const badgeControl =
      Button && props.onToggleGuard
        ? Button({
            key: 'guard-badge-toggle-compact',
            plain: true,
            onPress: props.onToggleGuard,
            children: [badgeTextNode]
          })
        : badgeTextNode

    const compactChildren: any[] = [
      badgeControl,
      Text({
        children: [` ${UI_MESSAGES.BANNER_CTX_SHORT}${Math.round(props.contextPercent)}%`]
      })
    ]

    if (props.compactLevel === COMPACT_LEVELS.NOW) {
      compactChildren.push(
        Text({
          bold: true,
          color: THEME_STYLES.COLOR_RED,
          children: [UI_MESSAGES.COMPACT_HINT_NOW]
        })
      )
    } else if (props.compactLevel === COMPACT_LEVELS.RECOMMEND) {
      compactChildren.push(
        Text({
          color: THEME_STYLES.COLOR_YELLOW,
          children: [UI_MESSAGES.COMPACT_HINT_RECOMMEND]
        })
      )
    }

    const fiveHourLimit = props.rateLimits.find((r) => r.kind === 'five_hour')
    if (fiveHourLimit) {
      compactChildren.push(
        Text({
          dimColor: true,
          children: [` | 5h: ${Math.round(fiveHourLimit.percentUsed)}%`]
        })
      )
    }

    return Box({
      flexDirection: THEME_STYLES.DIRECTION_ROW,
      children: compactChildren
    })
  }

  // 2. Wide / Medium Viewport Responsive Layout
  const usable = Math.max(40, columns - UI_IDENTIFIERS.LEFT_MARGIN - UI_IDENTIFIERS.RIGHT_MARGIN)
  const now = Date.now()

  type DetailConfig = { tokens: boolean; effort: boolean; model: boolean; resets: boolean }
  const detailTiers: DetailConfig[] = [
    { tokens: columns >= UI_IDENTIFIERS.WIDE_COLUMN_THRESHOLD, effort: columns >= UI_IDENTIFIERS.MEDIUM_COLUMN_THRESHOLD, model: true, resets: true },
    { tokens: false, effort: columns >= UI_IDENTIFIERS.MEDIUM_COLUMN_THRESHOLD, model: true, resets: true },
    { tokens: false, effort: false, model: true, resets: true },
    { tokens: false, effort: false, model: false, resets: true },
    { tokens: false, effort: false, model: false, resets: false }
  ]

  const buildMeterNodes = (cells: number, detail: DetailConfig) => {
    let measuredWidth = 0
    const T: TextNodeBuilder = (p) => {
      if (typeof p.children === 'string') {
        measuredWidth += p.children.length
      } else if (Array.isArray(p.children)) {
        for (const c of p.children) {
          if (typeof c === 'string') measuredWidth += c.length
        }
      }
      return Text(p)
    }

    const renderBar = (percent: number, barCells: number) => {
      const filled = filledCells(percent, barCells)
      const color = barColor(percent)
      const barParts: any[] = []
      for (let i = 0; i < barCells; i++) {
        barParts.push(
          i < filled
            ? T({ color, children: TELEMETRY_SYMBOLS.BAR_FILLED })
            : T({ dimColor: true, children: TELEMETRY_SYMBOLS.BAR_EMPTY })
        )
      }
      return Text({ children: barParts })
    }

    const renderSingleMeter = (name: string, used: number, withBar = true): any[] => {
      const color = figureColor(used)
      return [
        T({ dimColor: true, children: name }),
        T({ children: ' ' }),
        ...(withBar ? [renderBar(used, cells)] : []),
        T({ children: withBar ? '  ' : '' }),
        T({
          bold: color !== undefined,
          color,
          dimColor: color === undefined,
          children: `${Math.round(used)}%`
        })
      ]
    }

    // Engine info on right
    let engineWidth = 0
    const engineParts: any[] = []
    if (props.model && detail.model) {
      engineParts.push(T({ bold: true, color: THEME_STYLES.COLOR_CYAN, children: props.model }))
      if (props.effort !== null && detail.effort) {
        engineParts.push(T({ dimColor: true, children: ` ${props.effort}` }))
      }
    }
    if (props.cost && detail.effort) {
      engineParts.push(
        T({
          dimColor: true,
          children: `${engineParts.length > 0 ? ' | ' : ''}${props.cost}`
        })
      )
    }
    engineWidth = measuredWidth
    measuredWidth = 0

    // Left security badge & meters
    type MeterRow = { parts: any[]; width: number; noBar?: boolean }
    const meterRows: MeterRow[] = []

    // 1. Guard Status Badge (Interactive toggle button if available)
    const badgeText = T({
      bold: guardBadge.isAlert || !isGuardActive,
      color: !isGuardActive
        ? THEME_STYLES.COLOR_GRAY
        : guardBadge.isAlert
        ? THEME_STYLES.COLOR_RED
        : THEME_STYLES.COLOR_CYAN,
      children: guardBadge.label
    })

    const guardParts = [
      Button && props.onToggleGuard
        ? Button({
            key: 'guard-badge-toggle',
            plain: true,
            onPress: props.onToggleGuard,
            children: [badgeText]
          })
        : badgeText
    ]
    meterRows.push({ parts: guardParts, width: measuredWidth })
    measuredWidth = 0

    // 2. Context meter with compact hints and turn forecasts
    const ctxParts = renderSingleMeter('ctx', props.contextPercent)
    if (props.compactLevel === COMPACT_LEVELS.SOON) {
      ctxParts.push(T({ dimColor: true, children: UI_MESSAGES.COMPACT_HINT_SOON }))
    } else if (props.compactLevel === COMPACT_LEVELS.RECOMMEND) {
      ctxParts.push(T({ color: THEME_STYLES.COLOR_YELLOW, children: UI_MESSAGES.COMPACT_HINT_RECOMMEND }))
    } else if (props.compactLevel === COMPACT_LEVELS.NOW) {
      ctxParts.push(T({ bold: true, color: THEME_STYLES.COLOR_RED, children: UI_MESSAGES.COMPACT_HINT_NOW }))
    }

    if (detail.tokens && props.windowTokens > 0) {
      ctxParts.push(
        T({
          dimColor: true,
          children: `  ${formatTokens(props.contextTokens)}/${formatTokens(props.windowTokens)}`
        })
      )
      if (props.compactLevel !== COMPACT_LEVELS.NONE && props.turnsRemaining !== null) {
        const turnLabel = props.turnsRemaining === 1 ? 'turn' : 'turns'
        ctxParts.push(T({ dimColor: true, children: ` ~${props.turnsRemaining} ${turnLabel}` }))
      }
    }
    meterRows.push({ parts: ctxParts, width: measuredWidth })
    measuredWidth = 0

    // 3. Rate limits (5h, 7d, spend)
    for (const [kind, name] of [
      ['five_hour', '5h'],
      ['seven_day', '7d']
    ] as const) {
      const limit = props.rateLimits.find((r) => r.kind === kind)
      if (!limit) continue
      const quotaParts = renderSingleMeter(name, Math.round(limit.percentUsed))
      const countdown = formatCountdown(limit.resetsAt, now)
      if (countdown && detail.resets) {
        quotaParts.push(
          T({
            dimColor: true,
            children: `  ${TELEMETRY_SYMBOLS.RESET_PREFIX}${countdown}`
          })
        )
      }
      meterRows.push({ parts: quotaParts, width: measuredWidth })
      measuredWidth = 0
    }

    const spendLimit = props.rateLimits.find((r) => r.kind === 'spend_limit')
    if (spendLimit) {
      const spendParts = renderSingleMeter('spend', Math.round(spendLimit.percentUsed), false)
      meterRows.push({ parts: spendParts, width: measuredWidth, noBar: true })
      measuredWidth = 0
    }

    return { engineParts, engineWidth, meterRows }
  }

  // Calculate leftover width available for dynamic bar cells
  const calculateAvailableCells = (detail: DetailConfig) => {
    const { engineWidth, meterRows } = buildMeterNodes(0, detail)
    const barCount = meterRows.filter((m) => !m.noBar).length
    const fixedContentWidth =
      meterRows.reduce((sum, m) => sum + m.width, 0) +
      TELEMETRY_SYMBOLS.SEPARATOR.length * (meterRows.length - 1) +
      engineWidth +
      (engineWidth > 0 ? 2 : 0)

    const freeWidth = Math.floor((usable - fixedContentWidth) / Math.max(1, barCount))
    return { free: freeWidth, barCount }
  }

  const selectedTier =
    detailTiers.find((d) => calculateAvailableCells(d).free >= UI_IDENTIFIERS.MIN_BAR_CELLS) ??
    detailTiers[detailTiers.length - 1]!

  const resolvedCells = Math.min(
    UI_IDENTIFIERS.MAX_BAR_CELLS,
    Math.max(UI_IDENTIFIERS.MIN_BAR_CELLS, calculateAvailableCells(selectedTier).free)
  )

  const { engineParts, meterRows } = buildMeterNodes(resolvedCells, selectedTier)

  const leftLayout: any[] = []
  meterRows.forEach((row, idx) => {
    if (idx > 0) {
      leftLayout.push(
        Text({
          dimColor: true,
          children: TELEMETRY_SYMBOLS.SEPARATOR
        })
      )
    }
    leftLayout.push(...row.parts)
  })

  return Box({
    flexDirection: THEME_STYLES.DIRECTION_ROW,
    justifyContent: THEME_STYLES.JUSTIFY_SPACE_BETWEEN,
    width: usable,
    marginLeft: UI_IDENTIFIERS.LEFT_MARGIN,
    children: [
      Box({ flexDirection: THEME_STYLES.DIRECTION_ROW, children: leftLayout }),
      Box({ flexDirection: THEME_STYLES.DIRECTION_ROW, children: engineParts })
    ]
  })
}
