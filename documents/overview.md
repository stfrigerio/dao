# 道 — What Was Built

道 is a full-stack project management tool for Stefano and friends to manage professional and personal projects. It runs on a Raspberry Pi and integrates Claude AI agents and Linear for task management.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vite 7 + React 18 + TypeScript + Zustand + CSS Modules |
| Backend | Express 4 + TypeScript + Drizzle ORM + PostgreSQL |
| Auth | JWT — 15min access token + 7-day httpOnly refresh cookie |
| AI | Anthropic Claude via `@anthropic-ai/sdk` |
| Tasks | Linear via `@linear/sdk` |
| Dev DB | Docker Compose (postgres:16) |

---

## What's in the repo

### Frontend (`frontend/`)

- **Login** — email/password form, JWT stored in Zustand + localStorage
- **Dashboard** — stats (active/professional/personal project counts) + recent projects grid
- **Projects list** — search, type and status filters, create new project (auto-creates 5 default phases)
- **Project detail** — three tabs:
  - *Phases* — horizontal timeline (Discovery → Planning → Execution → Review → Done), click to open phase panel with agent sessions and status controls
  - *Linear* — live issue list from the linked Linear project
  - *Members* — manage who has access
- **Agent chat** — fullscreen chat UI with SSE streaming, blinking cursor while Claude responds
- **Settings** — profile card + admin user management

Frontend follows losito conventions: CSS Modules 1:1 rule, fetch() only in stores, design tokens, atomic component structure. Validation scripts enforce all of this on every build.

### Backend (`server/`)

- **Auth routes** — login, refresh, logout, `/me`
- **Projects CRUD** — create/read/update/delete, member management, Linear linking
- **Phases CRUD** — per-project phases with status (`todo` / `in_progress` / `done`)
- **Agent sessions** — create sessions per phase, stream Claude responses over SSE, persist all messages to DB
- **Documents** — attach notes/files/links to projects or phases
- **Linear routes** — fetch teams/projects/issues from Linear API, create issues
- **User management** — admin-only CRUD

### AI agents (`server/src/services/claude.ts`, `server/scripts/spawn-agent.ts`)

Each agent session is scoped to a phase. The system prompt is built automatically from the project name, description, current phase, and a list of previously completed phases. Agents can be started from the web UI (streaming over SSE) or from the CLI:

```bash
npx tsx server/scripts/spawn-agent.ts --phase <phase-uuid>
```

CLI mode is interactive when run in a TTY (streams output) and pipe-friendly when stdin is not a TTY. Sessions created from the CLI show up in the web UI immediately.

### Database

Seven tables via Drizzle ORM (schema-as-code, migrations committed as SQL files):

`users` → `projects` → `project_members`, `phases` → `agent_sessions` → `agent_messages`, `documents`

---

## Getting started

```bash
docker compose up -d
cp server/.env.example server/.env   # fill in JWT secrets + API keys
npm install
npm run seed                          # creates admin@dao.local / admin123
npm run dev                           # frontend :5173, backend :3001
```
