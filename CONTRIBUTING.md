# Contributing to Guard (`guard@claude`)

Thank you for your interest in contributing to **Guard**! This document outlines the development workflow, coding standards, architectural guidelines, and submission process to ensure the highest standards of code quality and security.

---

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Project Architecture & Directory Layout](#project-architecture--directory-layout)
3. [Coding Guidelines & Architectural Constraints](#coding-guidelines--architectural-constraints)
4. [How to Add a New Security Rule](#how-to-add-a-new-security-rule)
5. [Testing & Quality Assurance Gates](#testing--quality-assurance-gates)
6. [Git Workflow & Commit Conventions](#git-workflow--commit-conventions)
7. [Submitting a Pull Request](#submitting-a-pull-request)

---

## Development Environment Setup

### Prerequisites

- **Node.js**: Version `>= 22.0.0`
- **npm**: Version `>= 10.0.0`
- **Claude Code CLI**: `@anthropic-ai/claude-code >= 2.1.319`
- **Git**: Modern git client with SSH/HTTPS configured

### Initial Installation

```bash
# 1. Clone the repository
git clone https://github.com/Nam088/guard.git
cd guard

# 2. Install dev dependencies
npm install

# 3. Verify complete check suite
npm run check
```

---

## Project Architecture & Directory Layout

Guard follows a clean modular separation of concerns designed for in-process Claude Code mods:

```text
guard/
├── .claude-plugin/              # Claude Code Plugin metadata & assets
│   ├── icon.png                 # Minimalist 512x512 monochrome plugin icon
│   ├── marketplace.json         # Marketplace distribution manifest ("claude")
│   └── plugin.json              # Official plugin manifest
├── .github/                     # GitHub workflows and issue/PR templates
│   ├── workflows/               # CI and automated release pipelines
│   └── pull_request_template.md # Standard PR checklist
├── hooks/                       # Claude Code in-process Mod entry point
│   ├── hooks.json               # Declares registered module (./register.ts)
│   └── register.ts              # Event listener registrations (session, tools, UI)
├── scripts/                     # Operational automation scripts
│   └── release.mjs              # Semantic release automation script
├── src/                         # Pure domain and presentational logic
│   ├── core/                    # Core business logic
│   │   ├── config/              # Hierarchical configuration manager (.guardrc.json)
│   │   ├── security/            # Security rules, composite scanner, git diff analyzer
│   │   ├── state/               # Schema-versioned atomic state & audit store
│   │   └── usage/               # Context telemetry, rate-limit meters, turn tracker
│   ├── shared/                  # Immutable constants, theme tokens, messages
│   └── ui/                      # Presentational UI components & render coordinators
│       ├── components/          # Pure UI components (DashboardPane, UsageContextBar)
│       └── coordinators/        # Surface render coordinators
├── tests/                       # Unit and integration test suites (108 tests)
│   ├── core/                    # Security rules, config, state, and telemetry tests
│   ├── hooks/                   # Hook registration & coordinator integration tests
│   └── ui/                      # Presentational UI component tests
├── types/                       # TypeScript declaration bindings
│   └── claude-code.d.ts         # Claude Code Mod interface types
├── CONTRIBUTING.md              # Contributor guidelines (this document)
├── LICENSE                      # MIT License
├── package.json                 # Node package configuration and scripts
├── README.md                    # Public documentation and usage guide
└── tsconfig.json                # Strict TypeScript compiler options
```

---

## Coding Guidelines & Architectural Constraints

### 1. Engine Sandbox Integrity (Critical)

Modules executing inside Claude Code hooks (`hooks/` and `src/`) operate within an isolated runtime environment:
- **Zero Node Built-in Imports**: Absolutely **no** imports of `node:fs`, `node:child_process`, `node:os`, `node:path`, or `node:crypto` inside runtime code. All filesystem and environment interactions must use the engine interface `$` (`$.fs.read`, `$.fs.exists`, `$.env.get`).
- **No Passing `$` as an Argument**: The Claude Code AST parser enforces that `$` cannot be passed into helper functions or assigned to intermediate variables. Call methods directly on `$` within the hook body.
- **Literal Strings for Hooks**: Event names and matchers in `on('event.name', ...)` must be literal strings.
- **Fail-Closed Semantics**: Every gating hook (such as `tool.call`) must implement `.catch()` fallback logic that returns `{ deny: ... }` when an unexpected error occurs.

### 2. Strict No-Emoji Standard

This project enforces a **Strict No-Emoji Standard** across all assets:
- **Never** use emojis in source code, comments, documentation, UI components, commit messages, PR titles, or logs.
- Use clean typography, standard ASCII punctuation, or SVG icons instead.

### 3. Pure Presentational UI Architecture

- UI components in `src/ui/components/` must be pure functions that take `(props, primitives)` and return virtual element trees.
- They must contain zero side effects, zero direct disk access, and zero state mutations.
- Use subtle, understated styling: prefer `THEME_STYLES.COLOR_GRAY` frames and clean monochrome layouts over bright saturated colors.

---

## How to Add a New Security Rule

Guard uses the **Strategy Pattern** for extensible security checks. To add a new security rule:

1. Create a class implementing `SecurityRule` in [src/core/security/rules.ts](src/core/security/rules.ts):

   ```typescript
   export class CustomSecurityRule implements SecurityRule {
     public inspect(payload: ToolInspectionPayload): SecurityInspectionResult {
       // Perform pattern matching, AST analysis, or path verification
       if (isViolationDetected(payload)) {
         return {
           allowed: false,
           reason: 'Clear explanation of why this action violates policy.',
           ruleName: 'CustomSecurityRule'
         }
       }
       return { allowed: true }
     }
   }
   ```

2. Register your rule in `SecurityScanner.defaultRules()`.
3. Add adversarial unit tests in [tests/core/security-rules.test.ts](tests/core/security-rules.test.ts) covering:
   - Positive detection of target attack vectors.
   - Evasion attempts (path traversal, split flags, quoting, uppercase variations).
   - False positive prevention on benign developer inputs.

---

## Testing & Quality Assurance Gates

All pull requests must pass the comprehensive QA suite before merging:

```bash
# 1. Typecheck: Verify strict TypeScript compilation (0 errors)
npm run typecheck

# 2. Strict Plugin Validation: Verify Claude Code engine AST and sandbox rules
npm run validate

# 3. Unit Test Suite: Run all 108 tests
npm run test

# 4. Distribution Bundle Build: Verify esbuild flattened bundle
npm run build

# 5. Full Pipeline Check: Runs all of the above
npm run check
```

---

## Git Workflow & Commit Conventions

### Conventional Commits

We follow the Conventional Commits specification. Commit messages must be structured as:

```text
<type>(<scope>): <short description>
```

- **Types**:
  - `feat`: A new user-facing feature or security rule.
  - `fix`: A bug fix or false-positive correction.
  - `refactor`: Code change that neither fixes a bug nor adds a feature.
  - `docs`: Documentation updates.
  - `test`: Adding or refactoring tests.
  - `chore`: Maintenance tasks, dependency updates, release bumps.
- **Scope** (optional): `security`, `ui`, `config`, `telemetry`, `git`, `release`.
- **Example**: `feat(security): intercept unauthorized local web server spawning`

---

## Submitting a Pull Request

1. Fork the repository and create a descriptive feature branch:
   ```bash
   git checkout -b feat/enhance-ssh-key-matching
   ```
2. Implement your changes following the coding standards.
3. Ensure all tests pass (`npm run check`).
4. Write clear, evidence-based commit messages (zero emojis).
5. Push your branch to GitHub and open a Pull Request targeting `main`.
6. Fill out the Pull Request template completely. CI will automatically run typecheck, strict validation, and test suites.

Thank you for helping keep developers and enterprises secure while building with Claude Code!
