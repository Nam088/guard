/**
 * @fileoverview Pure presentational component for AbovePrompt status band.
 * Adheres to Clean Code: pure function, zero side effects, no magic strings.
 */

import {
  SURFACES,
  THEME_STYLES,
  UI_MESSAGES
} from '../../shared/constants.js'

/**
 * Properties for rendering the SecurityBanner.
 * @typedef {Object} SecurityBannerProps
 * @property {number} blockedCount - Total count of blocked actions.
 * @property {number} contextPercent - Percentage of context window used.
 * @property {boolean} isCompact - Whether viewport demands compact display.
 * @property {string} surface - Host surface name ('terminal', 'desktop', etc.).
 */
export interface SecurityBannerProps {
  readonly blockedCount: number
  readonly contextPercent: number
  readonly isCompact: boolean
  readonly surface: string
}

/**
 * Pure presentational component rendering the security status banner.
 * @param {SecurityBannerProps} props - Component properties.
 * @param {Object} primitives - Engine UI primitives ({ Box, Text }).
 * @returns {Object} Rendered virtual node.
 */
export function SecurityBanner(props: SecurityBannerProps, primitives: any): any {
  const { Box, Text } = primitives

  if (props.isCompact || props.surface === SURFACES.MOBILE) {
    return Box({
      flexDirection: THEME_STYLES.DIRECTION_ROW,
      children: [
        Text({
          weight: THEME_STYLES.WEIGHT_BOLD,
          color: THEME_STYLES.COLOR_CYAN,
          children: [UI_MESSAGES.BANNER_PREFIX_COMPACT]
        }),
        Text({
          children: [`${UI_MESSAGES.BANNER_CTX_SHORT}${props.contextPercent.toFixed(0)}% `]
        }),
        Text({
          color: props.blockedCount > 0 ? THEME_STYLES.COLOR_RED : THEME_STYLES.COLOR_GRAY,
          children: [`${UI_MESSAGES.BANNER_BLK_SHORT}${props.blockedCount}`]
        })
      ]
    })
  }

  const borderColor =
    props.blockedCount > 0 ? THEME_STYLES.COLOR_RED : THEME_STYLES.COLOR_GRAY

  return Box({
    borderStyle: THEME_STYLES.BORDER_SINGLE,
    borderColor,
    paddingLeft: 1,
    paddingRight: 1,
    flexDirection: THEME_STYLES.DIRECTION_ROW,
    justifyContent: THEME_STYLES.JUSTIFY_SPACE_BETWEEN,
    children: [
      Text({
        weight: THEME_STYLES.WEIGHT_BOLD,
        color: THEME_STYLES.COLOR_CYAN,
        children: [UI_MESSAGES.BANNER_TITLE_EXPANDED]
      }),
      Text({
        children: [`${UI_MESSAGES.BANNER_CONTEXT_LABEL}${props.contextPercent.toFixed(1)}%`]
      }),
      Text({
        weight: props.blockedCount > 0 ? THEME_STYLES.WEIGHT_BOLD : THEME_STYLES.WEIGHT_NORMAL,
        color: props.blockedCount > 0 ? THEME_STYLES.COLOR_RED : THEME_STYLES.COLOR_GREEN,
        children: [`${UI_MESSAGES.BANNER_BLOCKED_LABEL}${props.blockedCount}`]
      })
    ]
  })
}
