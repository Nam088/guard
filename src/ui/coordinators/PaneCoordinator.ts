/**
 * @fileoverview Render coordinator for docked Dashboard Pane.
 * Connects domain state with presentational DashboardPane component.
 */

import type { EnterpriseGuardState } from '../../core/state/store.js'
import type { GuardUserConfig } from '../../core/config/ConfigManager.js'
import { UI_IDENTIFIERS } from '../../shared/constants.js'
import { DashboardPane } from '../components/DashboardPane.js'

/**
 * Builds the Dashboard Pane virtual tree.
 * @param {EnterpriseGuardState} state - Current security telemetry state.
 * @param {number} contextPercent - Percentage of context window used.
 * @param {Object} primitives - Resolved UI primitives.
 * @param {string} surface - Host surface name.
 * @param {string | undefined} requestId - Render request ID.
 * @param {function(): void} onClose - Callback invoked when close is clicked.
 * @param {function(): void} [onToggleGuard] - Callback to toggle protection.
 * @param {GuardUserConfig} [config] - Active configuration.
 * @returns {any} Virtual render element.
 */
export function buildPaneTree(
  state: EnterpriseGuardState,
  contextPercent: number,
  primitives: any,
  surface: string,
  requestId: string | undefined,
  onClose: () => void,
  onToggleGuard?: () => void,
  config?: GuardUserConfig
): any {
  if (requestId !== UI_IDENTIFIERS.PANE_REQUEST_ID) {
    return null
  }

  return DashboardPane(
    {
      blockedCount: state.blockedCount,
      contextPercent,
      violations: state.violations,
      surface,
      isGuardEnabled: state.isGuardEnabled,
      onToggleGuard,
      config,
      onClose
    },
    primitives
  )
}
