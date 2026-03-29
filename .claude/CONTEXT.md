# Hub — Agent Context

## Purpose

Hub is Stefano's team project management tool. It tracks professional and personal projects through structured phases, with Claude agents assigned to each phase to build context and drive work forward.

## Phase lifecycle

Each project has these fixed phases (in order):

| Index | Name | Purpose |
|---|---|---|
| 0 | Discovery | Define problem, gather requirements, research |
| 1 | Planning | Architecture, task breakdown, timeline |
| 2 | Execution | Build, implement, iterate |
| 3 | Review | Testing, feedback, refinements |
| 4 | Done | Handoff, documentation, post-mortem |

Phases have statuses: `todo` → `in_progress` → `done`

## Agent behavior

When spawned for a phase, agents receive a system prompt with:
- Project name, type, description
- Current phase name, status, description
- List of previously completed phases

Agents should: ask clarifying questions, produce structured outputs (lists, decisions, summaries), and help the team move to the next phase.

## Multi-user access

Users have roles: `admin` or `member`. Project members have roles: `owner`, `member`, or `viewer`. Only admins can manage users.

## Linear integration

Projects can be linked to a Linear team + project. Issues are fetched live from the Linear API. The webhook endpoint at `/api/linear/webhook` can receive real-time updates.
