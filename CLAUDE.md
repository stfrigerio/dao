# 道

Project management tool: projects → phases → Claude agent sessions + Linear integration.

`frontend/` Vite + React + Zustand + CSS Modules | `server/` Express + Drizzle + PostgreSQL | `shared/` TS types only

## Rules

**Frontend**
- `fetch()` only in `src/store/**` — never in components or pages (`// allow-fetch` to bypass)
- One `.module.css` per component, no cross-component class sharing
- Atomic structure: `atoms/` `molecules/` `organisms/`
- Run `npm run check` before committing (api-usage + css-modules + prettier + lint + typecheck)
- **Animations** — use `framer-motion` (`AnimatePresence` + `motion.div`) for expand/collapse and enter/exit transitions. No CSS `transition` on height.
- **Componentization** — any UI pattern used in 2+ places belongs in `src/components/`. Page-specific one-offs stay in `pages/<Page>/components/`. Before building inline, check if a shared atom/molecule already exists.

**Shared atoms** (import from `@/components/atoms/<Name>/<Name>`):
| Component | Use for |
|---|---|
| `Badge` | Progress counters, role labels, type chips — variants: `default` `primary` `success` `warning` `error` `accent` |
| `EmptyState` | Empty list states — accepts `icon` (ReactNode) and `message` (string) |

**Server**
- All routes require `requireAuth`; admin routes use `requireAdmin`
- Drizzle schema (`server/src/db/schema.ts`) is the source of truth — `npm run db:generate` after changes
- Error responses: `{ error: 'message' }` with appropriate HTTP status

**Shared**
- `shared/types.ts` — pure TS types, zero runtime imports

## Dev

Postgres runs natively (system service). DB: `postgresql://postgres@localhost:5432/dao`

```bash
psql -U postgres -c "CREATE DATABASE dao"
cp server/.env.example server/.env
cd server && npm run db:migrate && npm run seed   # admin@dao.local / admin123
npm run dev                                       # frontend :5173  backend :3001
```

**Reset DB:**
```bash
psql -U postgres -c "DROP DATABASE dao"
psql -U postgres -c "CREATE DATABASE dao"
cd server && npm run db:migrate && npm run seed
```


## Claude Code Agents

Custom agents live in `.claude/agents/`. Keep this list up to date when adding or removing agents.

| Agent | File | Use when |
|---|---|---|
| `test-writer` | `.claude/agents/test-writer.md` | Writing E2E tests for a page or flow — reads the implementation before writing assertions |
| `discovery` | `.claude/agents/discovery.md` | Facilitates a Discovery phase session — asks focused questions and outputs concrete objectives + tasks |

