# Project Phases

Phases are fixed and sequential. Every project goes through all five in order. A phase can go backwards if something's broken. Moving forward requires the exit criteria to be met — no skipping.

Agents are thinking tools. They help you produce documents, ask the right questions, and make decisions. They don't drive the actual work.

---

## 1. Discovery

You have an idea. This phase turns it into something concrete enough to plan.

**What you do:**
- Define the problem you're actually solving
- Decide what the smallest useful version looks like
- Map out who's using it and what they need
- Identify what questions must be answered before you can plan anything

**Agents help with:**
- Asking the questions you haven't thought of yet
- Challenging assumptions
- Drafting and refining the documents below

**Required before moving on:**
- `problem-statement.md` — what's broken, why it matters, what success looks like
- `mvp.md` — what's in, what's explicitly out, what the minimum is that makes it worth building
- `user-stories.md` — who uses it and what they need to do, written as plain scenarios

---

## 2. Planning

You know what you're building. This phase figures out how.

**What you do:**
- Write out every functional requirement
- Make the technical decisions: stack, architecture, integrations
- Map out how users move through the product
- Break the work into objectives and set up Linear
- Put a realistic timeline on it

**Agents help with:**
- Drafting functional specs
- Thinking through architecture trade-offs
- Spotting missing requirements or edge cases

**Required before moving on:**
- `functional-spec.md` — full list of features and behaviors, no ambiguity
- `architecture.md` — stack decisions, system design, integrations, data model
- `user-flows.md` — how users navigate the product, what triggers what
- Linear fully set up: objectives created as Linear projects, tasks under each one, timeline set

---

## 3. Execution

Build it. This phase is owned entirely by the team.

**What you do:**
- Work through Linear tasks objective by objective
- Each objective is a logical chunk of the build (e.g. "frontend", "backend", "API spec")
- Tasks inside an objective are the actual things to build

**Agents help with:**
- Unblocking specific decisions when asked
- Answering implementation questions on demand
- They're available but not in charge

**Required before moving on:**
- All Linear tasks closed or explicitly deferred with a reason
- The thing works

---

## 4. Review

Make sure it actually works before calling it done.

**What you do:**
- Test every flow end to end
- Write unit tests and integration tests for anything untested
- Stress test where it matters
- Build and validate the production setup

**Agents help with:**
- Reviewing test coverage
- Identifying flows that haven't been tested

**Required before moving on:**
- All critical flows covered by tests
- Production infrastructure in place and verified
- No known blockers

---

## 5. Done

It's done. Archive the project when you're ready.
