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
- **Componentization** — self-contained visual units (buttons, cards, form rows, modals, editors) belong in `src/components/` from the start. Pure layout/composition that is specific to one page stays in `pages/<Page>/components/`. **Before creating any new component, check whether an existing atom/molecule already covers the use case — extend it with a prop or variant rather than duplicating it.** The goal is one authoritative implementation per UI pattern, not 10 button variants living in different files.

**Shared atoms** (import from `@/components/atoms/<Name>/<Name>`):
| Component | Use for |
|---|---|
| `Badge` | Progress counters, role labels, type chips — variants: `default` `primary` `success` `warning` `error` `accent` |
| `Breadcrumb` | Page breadcrumb trail — accepts `items: Crumb[]`; use `useBreadcrumb(items)` in each page to set it |
| `Callout` | Obsidian-style admonition block — `type`: `note` `info` `tip` `success` `warning` `danger` `question` `abstract`; optional `title` override |
| `EmptyState` | Empty list states — accepts `icon` (ReactNode) and `message` (string) |
| `Modal` | Overlay dialog with title + close — wraps any content; body is zero-padded for flush children |

**Shared molecules** (import from `@/components/molecules/<Name>/<Name>`):
| Component | Use for |
|---|---|
| `DocEditor` | WYSIWYG markdown editor — accepts `content` and `onSave`; renders formatted markdown inline with no separate preview mode; bubble menu for formatting; TOC sidebar with per-section delete; exposes `save()` via `forwardRef` handle — callers must trigger it (e.g. on modal close) to persist changes; no internal save button |

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

