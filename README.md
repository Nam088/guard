# Enterprise Guard Plugin for Claude Code

Enterprise Guard is a high-performance in-process security guardrail and multi-surface monitoring dashboard for Claude Code. It intercepts sensitive environment file reads, prevents destructive system shell commands, tracks context window utilization in real time, and renders interactive status bands and docked dashboards across terminal and desktop surfaces.

## Features

- Environment Secrets Protection: Prevents tools from reading or writing `.env` and related secret files.
- Destructive Command Interception: Blocks dangerous system operations such as `rm -rf /` and raw block device manipulation.
- Multi-Surface Dashboard: Renders responsive `AbovePrompt` status bars and docked `Pane` views that adapt to viewport dimensions.
- Atomic Reactive State: Employs schema-versioned state atoms that persist safely across hot reloads.

## Installation and Validation

To install directly into Claude Code:

```bash
/plugin install enterprise-guard --marketplace Nam088/guard
```

To validate and test locally:

```bash
npm run typecheck
npm run validate
npm run test
```
