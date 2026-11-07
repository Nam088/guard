## Description

Please provide a concise description of the changes introduced in this pull request and the motivation behind them.

---

## Type of Change

- [ ] Security Rule (New threat detection pattern or security hardening)
- [ ] Bug Fix (Non-breaking change resolving an issue or false positive)
- [ ] Feature (Non-breaking addition to telemetry, UI, or configuration)
- [ ] Refactor (Code improvement with no change to behavior)
- [ ] Documentation (Updates to README, guides, or specifications)
- [ ] CI/CD & Build (Changes to workflows, packaging, or release scripts)

---

## Evidence & Verification

Describe the concrete evidence, tests, or reproduction steps verifying these changes:

```bash
# Paste verification output or test summary here
npm run check
```

---

## Quality Checklist

- [ ] My code adheres to the project coding standards in `CONTRIBUTING.md`.
- [ ] I have strictly adhered to the **Zero-Emoji Rule** across code, comments, documentation, and commits.
- [ ] I have maintained engine sandbox integrity (zero `node:*` imports in runtime hooks).
- [ ] `npm run typecheck` passes with 0 errors.
- [ ] `npm run validate` passes strict Claude Code plugin validation with 0 warnings.
- [ ] `npm run test` passes across all test suites (including newly added tests).
- [ ] `npm run build` generates the standalone bundle without errors.
- [ ] Any new or modified security rules follow the fail-closed pattern with adversarial tests.
