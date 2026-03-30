# Phase One: Discovery

_Living document — updated as the methodology evolves._

---

## What Discovery is

Discovery turns a raw idea into something concrete enough to plan. It ends when you can answer three questions without hesitation:

1. What problem are we actually solving, and for whom?
2. What is the smallest version of the solution that is worth building?
3. What must be true before we can start planning?

If any of those are still fuzzy, you are not done with Discovery.

---

## How it works

A phase is a container. It has no status of its own. It is made up of **objectives**, each of which is made up of **tasks**. A phase is ready to move forward when every objective is complete. An objective is complete when every task is checked off.

Agents are thinking tools. They ask questions you haven't thought of, challenge assumptions, and produce the output documents. They do not drive the work — you do.

### The agent workflow for Discovery

The `discovery` agent follows a two-step pattern:

**Step 1 — Generate questions**
The agent writes `documents/discovery/problem_definition_questions.md` — a document with every question it needs answered to produce the full Discovery outputs. Questions are exhaustive by design: if you answer all of them, the agent writes all output documents without asking anything further.

**Step 2 — Produce outputs**
Once you fill in the answers, re-invoke the agent. It reads the file and writes:
- `documents/discovery/problem_statement.md`
- `documents/discovery/mvp.md`
- `documents/discovery/user_scenarios.md`

These three documents are the exit criteria for Discovery. When they exist and are complete, the phase is done.

---

## Objectives for Discovery

Two objectives are transversal — they apply to every project:

### Objective 1 — Problem Definition
Every task in this objective produces a clear, written answer. No vague answers allowed.

**Tasks (adapt to project):**
- Write the problem statement: what exists today, what is broken, why it matters
- Define success: what does "this is solved" look like concretely?
- Identify the constraints: environment, resources, time, dependencies

### Objective 2 — Scope
Scope is not a feature list. It is a decision about what is in and what is explicitly out.

**Tasks (adapt to project):**
- Define the MVP: the minimum that makes the thing worth building over any alternative
- Write the non-goals: what this will never do, and why that boundary exists
- List open risks and unknowns that must be resolved before Planning

### Additional objectives — project-specific

Beyond Problem Definition and Scope, objectives are inferred from the project context. Common ones:

- **Users** — relevant when there are distinct human actors with different relationships to the tool. Produces user type definitions and concrete usage scenarios.
- **Technical Architecture** — relevant when key technical decisions must be made before scope can be locked.
- **Integrations** — relevant when the project depends on or connects to external systems.
- **Data Model** — relevant when the shape of the data is a core design question.

These are examples, not a checklist. The agent generates what actually applies to the project.

---

## Exit constraint

All objectives must be fully tasked and all tasks completed before moving to Planning. The test: can you hand someone the outputs of Discovery and have them write a planning document without asking you a single clarifying question? If not, keep going.

---

## Notes on running Discovery for dao specifically

_(Updated 2026-03-28)_

The dao project is a project management tool for a small trusted group (Stefano + collaborators) running self-hosted on a Raspberry Pi. The core problem it solves is the gap between high-level project thinking (phases, context, goals) and execution tooling (Linear tasks). Claude agents bridge that gap by living inside the phases.

Discovery for dao should produce:
- A clear statement of why existing tools (Notion, standalone Linear, spreadsheets) fall short for this use case
- An MVP boundary that is honest about what a v1 on a Pi actually needs vs. what would be nice to have later
- A concrete description of the two user types: the admin/owner who runs the tool, and the collaborator who participates in projects
