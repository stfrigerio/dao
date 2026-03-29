# Hub — Agent Workflow Tasks

Use this file to track ongoing agent-driven work. Each task should reference a phase UUID and describe the output expected.

## Template

```
## [Project Name] — [Phase Name]
- Phase UUID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Session UUID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (if resuming)
- Goal: [what the agent should produce]
- Status: pending | in_progress | done
```

## Spawn command

```bash
npx tsx server/scripts/spawn-agent.ts --phase <phase-uuid>
# Resume:
npx tsx server/scripts/spawn-agent.ts --phase <phase-uuid> --session <session-uuid>
```

---

*(No active agent tasks — add entries here as work begins)*
