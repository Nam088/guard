/**
 * @fileoverview Render coordinator for AbovePrompt status & telemetry band.
 * Coordinates domain security state, live session telemetry, turn forecasting,
 * and rate limits, feeding the upgraded UsageContextBar presentational component.
 */

import { UI_IDENTIFIERS } from '../../shared/constants.js'
import { UsageContextBar } from '../components/UsageContextBar.js'
import {
  calculateCompactLevel,
  formatModel,
  formatUsd,
  sharedTurnTracker,
  type RateLimitSnapshot
} from '../../core/usage/telemetry.js'
import type { EnterpriseGuardState } from '../../core/state/store.js'

export interface AbovePromptTelemetryPayload {
  readonly contextTokens?: number
  readonly windowTokens?: number
  readonly contextPercent?: number
  readonly compactAt?: number
  readonly costUsd?: number
  readonly rateLimits?: readonly RateLimitSnapshot[]
  readonly model?: string
  readonly effort?: string | null
}

/**
 * Handles rendering the AbovePrompt status band with upgraded usage metrics & security badge.
 * Supports both legacy numeric contextPercent and rich AbovePromptTelemetryPayload.
 *
 * @param {EnterpriseGuardState} state - Current security telemetry state.
 * @param {number | AbovePromptTelemetryPayload} contextPercentOrTelemetry - Telemetry payload or context percent.
 * @param {Object} primitives - Resolved UI primitives.
 * @param {string} surface - Host surface name.
 * @param {number} columns - Viewport columns count.
 * @returns {any} Virtual render element.
 */
export function buildAbovePromptTree(
  state: EnterpriseGuardState,
  contextPercentOrTelemetry: number | AbovePromptTelemetryPayload,
  primitives: any,
  surface: string,
  columns: number,
  onToggleGuard?: () => void
): any {
  const telemetry: AbovePromptTelemetryPayload =
    typeof contextPercentOrTelemetry === 'number'
      ? { contextPercent: contextPercentOrTelemetry }
      : (contextPercentOrTelemetry ?? {})

  const contextTokens = telemetry.contextTokens ?? 0
  const windowTokens = telemetry.windowTokens ?? UI_IDENTIFIERS.DEFAULT_WINDOW_TOKENS
  const contextPercent =
    telemetry.contextPercent ??
    (windowTokens > 0 ? (contextTokens / windowTokens) * 100 : 0)

  const compactAt = telemetry.compactAt ?? windowTokens
  const turnsRemaining = sharedTurnTracker.estimateTurnsLeft(contextTokens, compactAt)
  const compactLevel = calculateCompactLevel(contextPercent, turnsRemaining)

  const cost = telemetry.costUsd !== undefined ? formatUsd(telemetry.costUsd) : null
  const model = formatModel(telemetry.model ?? '')
  const effort = telemetry.effort ?? null
  const rateLimits = telemetry.rateLimits ?? []

  return UsageContextBar(
    {
      blockedCount: state.blockedCount,
      isGuardEnabled: state.isGuardEnabled,
      onToggleGuard,
      model,
      effort,
      cost,
      contextTokens,
      windowTokens,
      contextPercent,
      compactLevel,
      turnsRemaining,
      rateLimits,
      columns,
      surface
    },
    primitives
  )
}
