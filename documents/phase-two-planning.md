# Phase Two: Planning

_Living document — updated as the methodology evolves._

---

## What Planning is

Planning turns Discovery outputs into a buildable specification. It ends when you can hand the outputs to a developer (or an agent) and they can start building without making design decisions on the fly.

Discovery answered _what_ and _for whom_. Planning answers _how_, _in what order_, and _with what boundaries_.

If you find yourself making new discoveries during Planning — new user types, new problem dimensions, undefined terminology — you are not done with Discovery. Go back.

---

## How it works

Same structure as Discovery: a phase made of **objectives**, each made of **tasks**. Same agent workflow: generate objectives, generate questions per objective, answer them, produce output documents.

The critical difference: Planning consumes Discovery's outputs as input. Every planning decision must trace back to something established in Discovery. If it doesn't, it's either a gap in Discovery or scope creep.

### Input

The agent reads all documents produced during Discovery (problem statement, domain map, MVP definition, user scenarios, etc.) plus the Project Brief. These form the context for every planning question and every produced document.

### The agent workflow for Planning

Identical to Discovery's two-step pattern, run per objective:

**Step 1 — Generate questions**
The agent writes a questions document scoped to the objective. Questions are about design decisions, not investigation. They sound like "how should X work?" and "what happens when Y?", not "what is X?" or "who does Y?"

**Step 2 — Produce outputs**
Once you answer the questions, the agent analyzes completeness and produces specification documents per task. These are concrete specs, not summaries — detailed enough that implementation can begin from them.

---

## Objectives for Planning

Two objectives are always present:

### Objective 1 — Functional Requirements

Turn every Discovery finding into a specific, unambiguous requirement. No hand-waving. Every feature has defined behavior, edge cases, and acceptance criteria.

**Tasks (adapt to project):**
- Spec each feature's happy path: what the user does, what the system does, what the result is
- Spec the edge cases and error states: what happens when things go wrong or inputs are unexpected
- Define the data each feature needs: what is stored, what is computed, what is transient

### Objective 2 — Architecture

Make every technical decision that affects how the system is built. Stack, structure, data model, integrations. No decisions left for implementation time.

**Tasks (adapt to project):**
- Choose and justify the stack: language, framework, database, hosting — with reasoning tied to project constraints from Discovery
- Design the data model: entities, relationships, cardinality — derived from the domain map
- Define system boundaries: what talks to what, what is internal vs. external, where the API surfaces are

### Additional objectives — project-specific

Beyond Functional Requirements and Architecture, objectives are inferred from the project context. Common ones:

- **User Flows** — relevant when the product has a UI with non-trivial navigation. Produces screen-by-screen flows with transitions and states.
- **API Design** — relevant when the system exposes or consumes APIs. Produces endpoint specs with request/response shapes.
- **Work Breakdown** — relevant when the project is large enough to need explicit sequencing. Produces ordered build phases with dependencies.
- **Infrastructure** — relevant when deployment, CI/CD, or environment setup needs decisions before coding starts.

These are examples, not a checklist. The agent generates what actually applies.

---

## What good Planning output looks like

A Planning document is a specification, not a description. The test:

- **Bad:** "The system should support user authentication"
- **Good:** "Login: user submits email + password via POST /api/auth/login. Server validates against bcrypt hash in users table. On success, returns JWT with 24h expiry containing { userId, role }. On failure, returns 401 with generic 'Invalid credentials' message (no distinction between wrong email and wrong password)."

If the document uses words like "should", "could", "appropriate", or "as needed" — it is not done. Planning outputs use "does", "returns", "stores", "rejects".

---

## Exit criteria

All objectives fully tasked, all tasks completed, all output documents produced. The test: can an engineer read the Planning outputs and build the system without messaging you to ask how something should work? If not, keep speccing.

Specifically:
1. Every feature has a written spec with behavior, edge cases, and data requirements
2. Every technical decision is documented with its rationale
3. The data model is complete — every entity, relationship, and field is defined
4. The build order is clear — what gets built first and what depends on what

---

## Relationship to Discovery

Planning must not contradict Discovery. If a Planning decision conflicts with a Discovery finding, one of two things is true:
1. The Discovery finding was wrong or incomplete — go back and fix it, then resume Planning
2. The Planning decision is wrong — revise it to align with Discovery

The Discovery documents are not suggestions. They are the agreed-upon reality of the project. Planning operates within that reality.
