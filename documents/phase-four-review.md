# Phase Four: Review

_Living document — updated as the methodology evolves._

---

## What Review is

Review verifies that what was built actually works. It ends when every critical flow has been tested — both by automated scripts and by a human walking through the app — and no blocking issues remain.

Discovery answered _what_. Planning answered _how_. Execution answered _is it built_. Review answers _does it work_.

---

## How it works

Same structure as previous phases: objectives made of tasks, completed when all checked off. But the outputs are different — instead of documents describing the problem or specifications, Review produces:

1. **UAT documents** — step-by-step human walkthrough scenarios. A person follows the script, verifies each step, marks pass/fail.
2. **Automated E2E tests** — Playwright scripts that run the same critical flows programmatically. These live in the codebase and can be re-run at any time.

UAT comes first. You write the scenarios, walk through them manually, find bugs, fix them. Once the UAT passes cleanly, automate the critical paths with Playwright so regressions are caught automatically.

### Input

The agent reads all Execution phase tasks (what was built) and Planning phase specs (what it should do) to generate UAT scenarios. Every scenario traces back to a specced feature.

### The workflow for Review

**Step 1 — Generate UAT objectives and scenarios**
The agent produces objectives grouped by functional area (same grouping as Execution). Each task is a UAT scenario: a numbered sequence of steps with expected outcomes.

**Step 2 — Walk through UAT manually**
A human follows each scenario. Each step has a clear expected result. Mark pass or fail. File bugs for failures, fix them, re-test.

**Step 3 — Automate critical paths**
Once UAT passes, the test-writer agent (`.claude/agents/test-writer.md`) converts the most important scenarios into Playwright E2E tests.

---

## What a UAT scenario looks like

A UAT scenario is not a vague description. It is a script. Each step tells the tester exactly what to do and exactly what they should see.

**Good:**
```
Scenario: Create a new project
1. Navigate to /projects
2. Click "New Project" button
   → Modal opens with name, description, and type fields
3. Enter name "Test Project", select type "professional", click Create
   → Modal closes, redirected to /projects/[uuid]
   → Project header shows "Test Project" with "professional" badge
   → Phase bar shows Discovery, Planning, Execution, Review, Done
   → Discovery phase is highlighted as current
4. Click "Phases" tab
   → Discovery phase panel is visible with empty objectives
```

**Bad:**
```
- Verify project creation works
- Check that phases are created correctly
```

---

## Objectives for Review

### Objective 1 — Core Workflow UAT
The end-to-end flow that every user will follow: create project, run discovery, answer questions, produce docs, advance through phases.

### Objective 2 — Feature-specific UAT
Individual features tested in isolation: document editor, task management, Linear sync, auth flows, etc.

### Additional objectives — project-specific
- **Edge Cases & Error Handling** — what happens when things go wrong: invalid inputs, network errors, empty states, permission violations
- **E2E Test Automation** — converting passed UAT scenarios into Playwright scripts

---

## Exit criteria

1. All UAT scenarios written and walked through
2. All critical paths pass manually
3. No blocking bugs remain open
4. Key flows have automated E2E tests

The test: can you demo the app to someone, following the UAT script, without hitting a single bug? If not, keep fixing.

---

## Relationship to Execution

Review does not add features. If a UAT scenario reveals a missing feature, that's a gap in Planning or Execution — go back and add it there. Review only verifies what was specced and built.

If Review finds a bug, the fix happens in the codebase, but the tracking happens in Review (mark the scenario as failed, fix, re-test, mark as passed).
