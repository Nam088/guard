/**
 * @fileoverview Centralized string and numeric constants for Enterprise Guard.
 * Adheres to Clean Code practices: zero magic strings across the codebase.
 */

/**
 * Supported Claude Code lifecycle events.
 */
export const EVENT_NAMES = {
  UI_RENDER: 'ui.render',
  TOOL_CALL: 'tool.call',
  SESSION_START: 'session.start',
  COMMAND_RUN: 'command.run'
} as const

/**
 * Built-in official tool names recognized by Claude Code engine.
 */
export const TOOL_NAMES = {
  BASH: 'Bash',
  READ: 'Read',
  EDIT: 'Edit',
  WRITE: 'Write',
  GREP: 'Grep',
  GLOB: 'Glob'
} as const

/**
 * Official UI component render targets.
 */
export const RENDER_COMPONENTS = {
  ABOVE_PROMPT: 'AbovePrompt',
  PANE: 'Pane'
} as const

/**
 * Engine client surfaces.
 */
export const SURFACES = {
  TERMINAL: 'terminal',
  DESKTOP: 'desktop',
  VSCODE: 'vscode',
  MOBILE: 'mobile'
} as const

/**
 * UI Identifiers and layout metrics.
 */
export const UI_IDENTIFIERS = {
  PANE_REQUEST_ID: 'enterprise-guard-monitor-pane',
  PANE_TITLE: 'Enterprise Guard Dashboard',
  COMMAND_GUARD_PANEL: 'guard-panel',
  COMMAND_GUARD_PANEL_DESC: 'Open Enterprise Security & Context Dashboard',
  COMMAND_GUARD_TOGGLE: 'guard-toggle',
  COMMAND_GUARD_TOGGLE_DESC: 'Toggle Enterprise Guard protection between Active and Paused',
  COMMAND_GUARD_CONFIG: 'guard-config',
  COMMAND_GUARD_CONFIG_DESC: 'View, reload, or initialize Enterprise Guard configuration (.guardrc.json)',
  COMMAND_GUARD_SCAN: 'guard-scan',
  COMMAND_GUARD_SCAN_DESC: 'Scan staged git changes and commit diff for leaked secrets',
  COMPACT_COLUMN_THRESHOLD: 80,
  WIDE_COLUMN_THRESHOLD: 120,
  MEDIUM_COLUMN_THRESHOLD: 100,
  MAX_RECENT_VIOLATIONS_DISPLAY: 3,
  MAX_STORED_VIOLATIONS: 100,
  TURN_SAMPLES: 6,
  MIN_BAR_CELLS: 4,
  MAX_BAR_CELLS: 20,
  LEFT_MARGIN: 2,
  RIGHT_MARGIN: 5,
  DEFAULT_WINDOW_TOKENS: 200000
} as const

/**
 * Visual symbols and telemetry separators without emojis.
 */
export const TELEMETRY_SYMBOLS = {
  SEPARATOR: '  |  ',
  BAR_FILLED: '█',
  BAR_EMPTY: '░',
  ARROW_RIGHT: '->',
  ALERT_BADGE: '[!]',
  RESET_PREFIX: 'rst: '
} as const

/**
 * Compaction recommendation indicators.
 */
export const COMPACT_LEVELS = {
  NONE: 'none',
  SOON: 'soon',
  RECOMMEND: 'recommend',
  NOW: 'now'
} as const

/**
 * Human-readable user messages and banner text.
 */
export const UI_MESSAGES = {
  BANNER_PREFIX_COMPACT: '[GUARD] ',
  BANNER_TITLE_EXPANDED: 'ENTERPRISE GUARD: ACTIVE',
  BANNER_CONTEXT_LABEL: 'Context Window: ',
  BANNER_BLOCKED_LABEL: 'Blocked Violations: ',
  BANNER_CTX_SHORT: 'Ctx: ',
  BANNER_BLK_SHORT: '| Blk: ',
  GUARD_STATUS_OK: '[GUARD: OK]',
  GUARD_STATUS_PAUSED: '[GUARD: OFF]',
  GUARD_STATUS_BLOCKED_PREFIX: '[GUARD: ! ',
  GUARD_STATUS_BLOCKED_SUFFIX: ' BLOCKED]',
  COMPACT_HINT_SOON: ' compact soon',
  COMPACT_HINT_RECOMMEND: ' -> /compact',
  COMPACT_HINT_NOW: ' [!] /compact now',
  PANE_HEADER: '=== ENTERPRISE SECURITY DASHBOARD ===\n\n',
  PANE_CONFIG_TITLE: 'Active Configuration Policy:\n',
  PANE_STATUS_LABEL: 'Protection State: ',
  PANE_STATUS_ACTIVE: 'ACTIVE (Enforcing Security Policy)\n',
  PANE_STATUS_PAUSED: 'PAUSED (Pass-Through / Audit Mode)\n',
  PANE_BTN_TOGGLE_PAUSE: 'Pause Guard Protection',
  PANE_BTN_TOGGLE_RESUME: 'Activate Guard Protection',
  PANE_SURFACE_LABEL: 'Surface: ',
  PANE_CONTEXT_LABEL: 'Context Usage: ',
  PANE_TOTAL_BLOCKED: 'Total Intercepted Commands: ',
  PANE_RECENT_EVENTS_TITLE: 'Recent Security Events:\n',
  PANE_NO_VIOLATIONS: 'No violations recorded.\n',
  PANE_BTN_CLOSE_LABEL: 'Close Dashboard',
  PANE_CLOSED_FEEDBACK: 'Dashboard pane closed.',
  PANE_OPENED_FEEDBACK: 'Dashboard pane opened.',
  PANE_ERROR_FEEDBACK: 'Unable to toggle Enterprise Guard dashboard pane.',
  CONFIG_RELOAD_SUCCESS: 'Enterprise Guard configuration reloaded successfully from config files.',
  CONFIG_INIT_SUCCESS: 'Created default .guardrc.json in current workspace. You can now customize your security rules.',
  CONFIG_ALREADY_EXISTS: '.guardrc.json already exists in workspace.',
  TOAST_DESTRUCTIVE_COMMAND_BLOCKED: 'Enterprise Guard blocked a destructive shell command!',
  TOAST_ENV_ACCESS_BLOCKED: 'Enterprise Guard blocked an attempt to access sensitive environment files!',
  TOAST_GUARD_ENABLED: 'Enterprise Guard is now ACTIVE.',
  TOAST_GUARD_DISABLED: 'Enterprise Guard is now PAUSED (Pass-Through Mode).'
} as const

/**
 * Security policy violation denial messages.
 */
export const SECURITY_MESSAGES = {
  DESTRUCTIVE_COMMAND_REASON: 'Destructive system path deletion or raw block device manipulation is prohibited.',
  ENV_FILE_ACCESS_REASON: 'Access to sensitive environment secret files (.env) is blocked by Enterprise Security Policy.',
  ENV_SHELL_LEAK_REASON: 'Shell command references sensitive environment files (.env).',
  SENSITIVE_FILE_REASON: 'Access to private credentials, SSH keys, or cloud authentication files is blocked by Enterprise Security Policy.',
  SENSITIVE_SHELL_LEAK_REASON: 'Shell command references private credentials, SSH keys, or cloud authentication files.',
  GIT_STAGED_SECRET_CONTENT_REASON: 'Commit blocked: Plaintext secret or token detected in staged git diff.',
  GIT_STAGED_SENSITIVE_FILE_REASON: 'Commit blocked: Sensitive credentials or secret file is staged for commit.',
  PROTECTED_BRANCH_PUSH_REASON: 'Push blocked: Force push or branch deletion targeting protected branch is prohibited.',
  CUSTOM_BLOCKED_COMMAND_REASON: 'Command blocked by custom Enterprise Guard user configuration.',
  CUSTOM_BLOCKED_FILE_REASON: 'File access blocked by custom Enterprise Guard user configuration.',
  GREP_ENV_PROHIBITED: 'Grep searches inside .env files are prohibited.',
  INSPECTION_FAULT_PREFIX: 'Security inspection fault: '
} as const

/**
 * Regular expression pattern constants for security matching.
 */
export const CONFIG_FILES = {
  WORKSPACE_RC: '.guardrc.json',
  WORKSPACE_CONFIG: 'guard.config.json',
  USER_RC: '.guardrc.json'
} as const

export const SECURITY_PATTERNS = {
  ENV_FILE_REGEX: /(^|[\\/])\.env(\.[\w.-]+)?$/i,
  ENV_TEMPLATE_REGEX: /(^|[\\/])\.env\.(example|sample|template|dist|schema|defaults)$/i,
  BASH_ENV_LEAK_REGEX: /(^|[\s/'"=])\.env(\.[\w.-]+)?($|[\s/'";|&=])|\bdotenv\b|source\s+.*\.env|export\s+\$\(cat\s+.*\.env/i,
  SENSITIVE_FILE_PATTERNS: [
    // SSH keys and directory
    /(^|[\\/])\.ssh([\\/]|$)/i,
    /(^|[\\/])id_(rsa|ed25519|ecdsa|dsa)(\.[\w.-]+)?$/i,
    // Cloud credentials
    /(^|[\\/])\.(aws|azure|kube)([\\/]|$)/i,
    // Auth files and history
    /(^|[\\/])\.(git-credentials|netrc|npmrc|pypirc)$/i,
    /(^|[\\/])\.(bash_history|zsh_history|zhistory)$/i,
    // Infrastructure secrets
    /\.tfvars$/i,
    /\.tfstate(\.[\w.-]+)?$/i,
    // Private key certificates
    /(^|[\\/])[^\\/]+\.(key|pkcs12|pfx|p12|keystore)$/i
  ],
  BASH_SENSITIVE_LEAK_PATTERNS: [
    /(^|[\s/'"=])(~|\$HOME)?\/\.ssh\b/i,
    /(^|[\s/'"=])id_(rsa|ed25519|ecdsa|dsa)\b/i,
    /(^|[\s/'"=])(~|\$HOME)?\/\.(aws|azure|kube)\b/i,
    /(^|[\s/'"=])(~|\$HOME)?\/\.(git-credentials|netrc|npmrc|pypirc)\b/i,
    /(^|[\s/'"=])(~|\$HOME)?\/\.(bash_history|zsh_history|zhistory)\b/i,
    /\.tfvars\b/i,
    /\.tfstate\b/i
  ],
  DANGEROUS_GIT_PUSH_PATTERNS: [
    /\bgit\s+push\s+[^;&|]*(-f\b|--force\b|--force-with-lease\b)[^;&|]*\b(main|master|prod|production|release)\b/i,
    /\bgit\s+push\s+[^;&|]*\b(main|master|prod|production|release)\b[^;&|]*(-f\b|--force\b|--force-with-lease\b)/i,
    /\bgit\s+push\s+[^;&|]*\s+:(main|master|prod|production|release)\b/i,
    /\bgit\s+push\s+[^;&|]*--delete\s+(main|master|prod|production|release)\b/i
  ],
  DIFF_SECRET_PATTERNS: [
    { name: 'Private Key', regex: /-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----/ },
    { name: 'AWS Access Key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
    { name: 'GitHub Token', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[0-9a-zA-Z]{36}\b|\bgithub_pat_[0-9a-zA-Z_]{40,}\b/ },
    { name: 'Anthropic API Key', regex: /\bsk-ant-[0-9a-zA-Z_-]{20,}\b/ },
    { name: 'OpenAI API Key', regex: /\bsk-[0-9a-zA-Z]{20,}\b/ },
    { name: 'Google API Key', regex: /\bAIza[0-9A-Za-z-_]{35}\b/ },
    { name: 'Slack Token / Webhook', regex: /\bxox[baprs]-[0-9a-zA-Z]{10,}\b|https:\/\/hooks\.slack\.com\/services\/T[0-9a-zA-Z_]+\/B[0-9a-zA-Z_]+\/[0-9a-zA-Z_]+/ },
    { name: 'Stripe Secret Key', regex: /\bsk_live_[0-9a-zA-Z]{24}\b/ },
    { name: 'Generic Secret Assignment', regex: /(?:api[_-]?key|secret|password|auth[_-]?token|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_\-+/]{16,}["']/i }
  ],
  DESTRUCTIVE_BASH_PATTERNS: [
    // rm targeting root, home, or wildcards with recursive flag anywhere before target
    /\brm\b[^;&|]*(-[a-zA-Z0-9]*[rR][a-zA-Z0-9]*|--recursive)[^;&|]*\s+(['"]?)([\/~]|\$HOME\b|\$\{HOME\}|\/\*)([^\s'"]*)\2/i,
    // rm with root target before recursive flag
    /\brm\b[^;&|]*\s+(['"]?)([\/~]|\$HOME\b|\$\{HOME\}|\/\*)([^\s'"]*)\1[^;&|]*(-[a-zA-Z0-9]*[rR][a-zA-Z0-9]*|--recursive)/i,
    // rm targeting root with --no-preserve-root
    /\brm\b[^;&|]*--no-preserve-root/i,
    // Filesystem creation
    /\bmkfs(\.[\w]+)?\b/i,
    // Raw disk writes via dd (of= at any position, including macOS rdisk)
    /\bdd\b[^;&|]*\bof=\/dev\/(r?disk[0-9]|sd[a-z]|nvme[0-9]|loop[0-9]|mapper\/)/i,
    // Direct shell redirection to raw block device
    />\s*\/dev\/(r?disk[0-9]|sd[a-z]|nvme[0-9]|loop[0-9]|mapper\/)/i,
    // Fork bombs
    /:\(\)\s*\{\s*:\|:&\s*\};\s*:/
  ]
} as const

/**
 * State storage keys and versioning tags.
 */
export const STATE_CONSTANTS = {
  SECURITY_STATE_ATOM_KEY: 'enterprise_guard:state',
  SECURITY_STATE_CURRENT_VERSION: 2,
  VIOLATION_ID_PREFIX: 'violation-'
} as const

/**
 * UI Theme colors and border styles.
 */
export const THEME_STYLES = {
  COLOR_CYAN: 'cyan',
  COLOR_RED: 'red',
  COLOR_GREEN: 'green',
  COLOR_GRAY: 'gray',
  COLOR_YELLOW: 'yellow',
  COLOR_MAGENTA: 'magenta',
  COLOR_BLUE: 'blue',
  BORDER_SINGLE: 'single',
  BORDER_ROUND: 'round',
  WEIGHT_BOLD: 'bold',
  WEIGHT_NORMAL: 'normal',
  DIRECTION_ROW: 'row',
  DIRECTION_COLUMN: 'column',
  JUSTIFY_SPACE_BETWEEN: 'space-between'
} as const
