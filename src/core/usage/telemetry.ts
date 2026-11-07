/**
 * @fileoverview Pure telemetry and usage analytics calculation engine.
 * Computes model display names, token quantities, cost figures, rate-limit reset countdowns,
 * compaction turn forecasting, and Enterprise Guard status badges.
 * Pure logic adhering strictly to the engine sandbox (zero node built-in dependencies).
 */

import {
  COMPACT_LEVELS,
  TELEMETRY_SYMBOLS,
  UI_IDENTIFIERS,
  UI_MESSAGES
} from '../../shared/constants.js'

/**
 * Formats a model identifier into a clean, human-readable name.
 * e.g., 'claude-opus-5-5' -> 'Opus 5.5', 'claude-sonnet-4-5-20250929' -> 'Sonnet 4.5'.
 * Non-matching or third-party model IDs are returned unchanged.
 *
 * @param {string} id - Raw model identifier.
 * @returns {string} Human-readable model title.
 */
export function formatModel(id: string): string {
  if (!id) {
    return ''
  }

  const match = /^claude-([a-z]+)((?:-\d{1,2})+)(?:-\d{8})?(?:\[[^\]]*\])?$/.exec(id)
  if (match === null) {
    return id
  }

  const family = match[1] ?? ''
  const version = (match[2] ?? '').slice(1).split('-').join('.')
  const capitalizedFamily = family.charAt(0).toUpperCase() + family.slice(1)
  return `${capitalizedFamily} ${version}`
}

/**
 * Formats token counts into concise readable metrics ('850', '82.1k', '100k', '1.5M').
 *
 * @param {number} n - Token count.
 * @returns {string} Formatted token representation.
 */
export function formatTokens(n: number): string {
  const trimTrailingZero = (s: string): string => s.replace(/\.0$/, '')

  if (n >= 1_000_000) {
    return `${trimTrailingZero((n / 1_000_000).toFixed(1))}M`
  }
  if (n >= 100_000) {
    return `${Math.round(n / 1000)}k`
  }
  if (n >= 1000) {
    return `${trimTrailingZero((n / 1000).toFixed(1))}k`
  }
  return `${n}`
}

/**
 * Formats a dollar amount into standard USD notation.
 * Shows whole cents for costs from $1.00 up, or 3 decimal places for small fractions.
 *
 * @param {number} usd - Currency value in USD.
 * @returns {string} Formatted USD string.
 */
export function formatUsd(usd: number): string {
  const s = usd.toFixed(3)
  return usd >= 1 || s.endsWith('0') ? `$${usd.toFixed(2)}` : `$${s}`
}

/**
 * Formats the time remaining until rate-limit window resets.
 * e.g., 'now', '45m', '4h30m', '18h', '2d5h'.
 *
 * @param {string | undefined} resetsAt - ISO date string of reset target.
 * @param {number} now - Current UNIX epoch timestamp in milliseconds.
 * @returns {string} Formatted countdown string.
 */
export function formatCountdown(resetsAt: string | undefined, now: number): string {
  if (!resetsAt) {
    return ''
  }

  const diffMs = new Date(resetsAt).getTime() - now
  if (diffMs <= 0) {
    return 'now'
  }

  const totalMins = Math.round(diffMs / 60000)
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60

  if (hours >= 24) {
    return `${Math.floor(hours / 24)}d${hours % 24}h`
  }
  if (hours >= 10) {
    return `${hours}h`
  }
  if (hours > 0) {
    return `${hours}h${mins}m`
  }
  return `${mins}m`
}

/**
 * Resolves progress bar color based on percentage used.
 *
 * @param {number} percent - Percentage value (0-100).
 * @returns {'success' | 'warning' | 'error'} Color state identifier.
 */
export function barColor(percent: number): 'success' | 'warning' | 'error' {
  if (percent >= 80) return 'error'
  if (percent >= 60) return 'warning'
  return 'success'
}

/**
 * Resolves figure label highlight color for elevated percentages.
 *
 * @param {number} percent - Percentage value (0-100).
 * @returns {'warning' | 'error' | undefined} Accent color or undefined if normal.
 */
export function figureColor(percent: number): 'warning' | 'error' | undefined {
  if (percent >= 80) return 'error'
  if (percent >= 60) return 'warning'
  return undefined
}

/**
 * Calculates how many cells of a meter should be filled.
 * Any non-zero percentage fills at least one cell.
 *
 * @param {number} percent - Utilization percentage (0-100).
 * @param {number} cells - Total cell capacity of the meter.
 * @returns {number} Count of filled cells.
 */
export function filledCells(percent: number, cells: number): number {
  const used = Math.min(100, Math.max(0, percent))
  if (used <= 0) return 0
  return Math.min(cells, Math.max(1, Math.round((used / 100) * cells)))
}

export type CompactLevel = 'none' | 'soon' | 'recommend' | 'now'

/**
 * Evaluates the urgency level for suggesting /compact based on percentage and turns remaining.
 *
 * @param {number} percent - Percentage of context used.
 * @param {number | null} turnsRemaining - Estimated turns remaining before auto-compaction.
 * @returns {CompactLevel} Evaluated compact level.
 */
export function calculateCompactLevel(percent: number, turnsRemaining: number | null): CompactLevel {
  if (percent >= 90 || (turnsRemaining !== null && turnsRemaining <= 2)) {
    return COMPACT_LEVELS.NOW
  }
  if (percent >= 75 || (turnsRemaining !== null && turnsRemaining <= 4)) {
    return COMPACT_LEVELS.RECOMMEND
  }
  if (percent >= 60 || (turnsRemaining !== null && turnsRemaining <= 8)) {
    return COMPACT_LEVELS.SOON
  }
  return COMPACT_LEVELS.NONE
}

export interface GuardStatusBadge {
  readonly label: string
  readonly isAlert: boolean
}

/**
 * Returns Enterprise Guard operational status badge.
 *
 * @param {number} blockedCount - Count of blocked violations.
 * @param {boolean} [isGuardEnabled=true] - Whether protection is currently active.
 * @returns {GuardStatusBadge} Badge label and alert flag.
 */
export function getGuardStatusBadge(blockedCount: number, isGuardEnabled: boolean = true): GuardStatusBadge {
  if (!isGuardEnabled) {
    return {
      label: UI_MESSAGES.GUARD_STATUS_PAUSED,
      isAlert: false
    }
  }
  if (blockedCount <= 0) {
    return {
      label: UI_MESSAGES.GUARD_STATUS_OK,
      isAlert: false
    }
  }
  return {
    label: `${UI_MESSAGES.GUARD_STATUS_BLOCKED_PREFIX}${blockedCount}${UI_MESSAGES.GUARD_STATUS_BLOCKED_SUFFIX}`,
    isAlert: true
  }
}

export interface RateLimitSnapshot {
  readonly kind: string
  readonly percentUsed: number
  readonly resetsAt?: string
}

/**
 * Selects active rate limit windows, preferring live measurements or valid non-expired historical records.
 *
 * @param {readonly RateLimitSnapshot[] | undefined} live - Current session live rate limits.
 * @param {readonly RateLimitSnapshot[]} saved - Historical persisted rate limits.
 * @param {number} now - Current timestamp in milliseconds.
 * @returns {readonly RateLimitSnapshot[]} List of active rate limits.
 */
export function filterActiveRateLimits(
  live: readonly RateLimitSnapshot[] | undefined,
  saved: readonly RateLimitSnapshot[],
  now: number
): readonly RateLimitSnapshot[] {
  if (live && live.length > 0) {
    return live
  }
  return saved.filter(
    (limit) => limit.resetsAt === undefined || new Date(limit.resetsAt).getTime() > now
  )
}

/**
 * Rolling turn history tracker for context growth analysis and turn forecasting.
 */
export class TurnHistoryTracker {
  private samples: number[] = []
  private readonly maxSamples: number

  constructor(maxSamples: number = UI_IDENTIFIERS.TURN_SAMPLES) {
    this.maxSamples = maxSamples
  }

  /**
   * Records a new turn token measurement.
   * If the token count drops below previous measurement, resets history (compaction or clear).
   *
   * @param {number} tokens - Context token count at turn end.
   */
  public recordTurn(tokens: number): void {
    if (tokens <= 0) {
      return
    }

    const last = this.samples[this.samples.length - 1]
    if (last !== undefined && tokens < last) {
      this.samples = []
    }

    this.samples = [...this.samples, tokens].slice(-this.maxSamples)
  }

  /**
   * Calculates average token growth per turn across recorded samples.
   *
   * @returns {number | null} Average token growth, or null if insufficient samples or non-positive growth.
   */
  public getAverageGrowth(): number | null {
    if (this.samples.length < 2) {
      return null
    }

    const first = this.samples[0] ?? 0
    const last = this.samples[this.samples.length - 1] ?? 0
    const growth = (last - first) / (this.samples.length - 1)

    return growth > 0 ? growth : null
  }

  /**
   * Estimates remaining turns before reaching target token limit.
   *
   * @param {number} current - Current context token count.
   * @param {number} limit - Target threshold token limit.
   * @returns {number | null} Estimated turns remaining or null if growth cannot be determined.
   */
  public estimateTurnsLeft(current: number, limit: number): number | null {
    const growth = this.getAverageGrowth()
    if (growth === null || growth <= 0) {
      return null
    }

    return Math.max(0, Math.floor((limit - current) / growth))
  }

  /**
   * Returns current rolling samples.
   *
   * @returns {readonly number[]} Array of token counts.
   */
  public getSamples(): readonly number[] {
    return this.samples
  }

  /**
   * Resets all recorded samples.
   */
  public reset(): void {
    this.samples = []
  }
}

/**
 * Shared singleton instance for in-process session tracking.
 */
export const sharedTurnTracker = new TurnHistoryTracker()
