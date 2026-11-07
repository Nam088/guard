/**
 * @fileoverview Concrete domain state store for Enterprise Guard.
 * Manages in-memory state cleanly with monotonic sequencing and FIFO memory retention caps.
 */

import { STATE_CONSTANTS, UI_IDENTIFIERS } from '../../shared/constants.js'

/**
 * Record representing an intercepted security violation.
 * @typedef {Object} SecurityViolationRecord
 * @property {string} id - Unique identifier for the violation event.
 * @property {number} timestamp - Epoch timestamp in milliseconds.
 * @property {string} command - Intercepted command or file target.
 * @property {string} reason - Security policy reason for denial.
 */
export interface SecurityViolationRecord {
  readonly id: string
  readonly timestamp: number
  readonly command: string
  readonly reason: string
}

/**
 * Shape of the Enterprise Guard state store.
 * @typedef {Object} EnterpriseGuardState
 * @property {number} blockedCount - Total number of blocked actions.
 * @property {readonly SecurityViolationRecord[]} violations - History of violations.
 * @property {boolean} isPaneOpen - Whether the dashboard pane is currently visible.
 * @property {boolean} isGuardEnabled - Whether security protection is actively enforcing.
 */
export interface EnterpriseGuardState {
  readonly blockedCount: number
  readonly violations: readonly SecurityViolationRecord[]
  readonly isPaneOpen: boolean
  readonly isGuardEnabled: boolean
}

/**
 * State store class encapsulating mutations and state queries.
 */
export class SecurityStateStore {
  private sequence = 0
  private state: EnterpriseGuardState = {
    blockedCount: 0,
    violations: [],
    isPaneOpen: false,
    isGuardEnabled: true
  }

  /**
   * Returns current snapshot of state.
   * @returns {EnterpriseGuardState} Current state snapshot.
   */
  public getState(): EnterpriseGuardState {
    return this.state
  }

  /**
   * Sets whether active protection is enabled.
   * @param {boolean} isEnabled - True to enforce policies, false to pause.
   * @returns {EnterpriseGuardState} New state.
   */
  public setGuardEnabled(isEnabled: boolean): EnterpriseGuardState {
    this.state = {
      ...this.state,
      isGuardEnabled: isEnabled
    }
    return this.state
  }

  /**
   * Toggles protection state between active and paused.
   * @returns {EnterpriseGuardState} New state.
   */
  public toggleGuardEnabled(): EnterpriseGuardState {
    this.state = {
      ...this.state,
      isGuardEnabled: !this.state.isGuardEnabled
    }
    return this.state
  }

  /**
   * Records a security violation and increments blocked counter.
   * Employs monotonic sequence counter to guarantee key uniqueness under concurrent calls.
   * Caps violations array to prevent memory leaks.
   * @param {string} [command='unknown'] - Target command or file path.
   * @param {string} [reason='Security Policy Violation'] - Reason for security denial.
   * @returns {EnterpriseGuardState} New state.
   */
  public recordViolation(command: string = 'unknown', reason: string = 'Security Policy Violation'): EnterpriseGuardState {
    this.sequence += 1
    const newRecord: SecurityViolationRecord = {
      id: `${STATE_CONSTANTS.VIOLATION_ID_PREFIX}${Date.now()}-${this.sequence}`,
      timestamp: Date.now(),
      command: command || 'unknown',
      reason
    }

    const updatedViolations = [...this.state.violations, newRecord].slice(
      -UI_IDENTIFIERS.MAX_STORED_VIOLATIONS
    )

    this.state = {
      ...this.state,
      blockedCount: this.state.blockedCount + 1,
      violations: updatedViolations
    }
    return this.state
  }

  /**
   * Sets whether the dashboard pane is open.
   * @param {boolean} isOpen - New open state.
   * @returns {EnterpriseGuardState} New state.
   */
  public setPaneOpen(isOpen: boolean): EnterpriseGuardState {
    this.state = {
      ...this.state,
      isPaneOpen: isOpen
    }
    return this.state
  }

  /**
   * Resets store (useful for test isolation).
   */
  public reset(): void {
    this.sequence = 0
    this.state = {
      blockedCount: 0,
      violations: [],
      isPaneOpen: false,
      isGuardEnabled: true
    }
  }
}

/**
 * Shared singleton instance of the security state store.
 */
export const sharedSecurityStore = new SecurityStateStore()
