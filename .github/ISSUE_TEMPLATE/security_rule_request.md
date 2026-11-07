---
name: Security Rule Proposal
about: Propose a new security rule or attack vector detection pattern
title: "[SECURITY RULE] "
labels: ["enhancement", "security"]
assignees: []
---

## Attack Vector / Threat Model

Describe the specific risk, exploit, or destructive action this rule will detect and prevent.

---

## Example Attack Payload

Provide concrete shell commands, file paths, or tool call parameters that should be intercepted:

```bash
# Example dangerous command or access pattern
```

---

## Proposed Detection Logic

Explain how this should be detected (e.g. regex pattern, path traversal check, git diff analysis):

```typescript
// Proposed regex or detection logic
```

---

## False Positive Considerations

Are there common benign developer workflows that look similar? How should they be permitted or whitelisted?

---

## Additional Context

Add any references, CVEs, or organizational security standards related to this request.
