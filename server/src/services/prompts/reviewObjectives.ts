export function buildReviewObjectivesPrompt(
	projectName: string,
	projectType: string,
	projectDescription: string | null,
	scope: string | null,
	priorContext: string | null
): string {
	return `You are generating Review phase UAT (User Acceptance Testing) objectives for "${projectName}".

Project: ${projectName}
Type: ${projectType}
${projectDescription ? `Description: ${projectDescription}` : ''}
${scope ? `\nProject Brief:\n${scope}` : ''}
${priorContext ? `\nPlanning specs and Execution tasks (what was built):\n${priorContext}` : ''}

## Your job

Read the Planning specs and Execution tasks above. Produce UAT objectives and scenarios that verify everything works.

## Structure

**Objective** = a functional area to test. Match the same groupings from Execution ("Auth System", "Project CRUD", "Agent Pipeline", etc.) so coverage maps 1:1 to what was built.

**Task** = a UAT scenario. Each scenario is a scripted walkthrough that a human follows step by step. The task name should describe the flow being tested.

## Task naming rules

Each task name should describe a concrete user flow:
- "Login with valid credentials and verify dashboard redirect"
- "Create project, verify 5 phases auto-created with Discovery as current"
- "Generate discovery objectives from project brief"
- "Answer all questions, produce docs, verify documents appear in Documents tab"
- "Toggle task completion and verify objective auto-completes when all tasks done"
- "Sync execution objectives to Linear and verify projects/issues created"

NOT:
- "Test authentication" (too vague)
- "Verify project management works" (not a scenario)

## Rules

1. Every specced feature must have at least one UAT scenario covering it.
2. Include happy paths AND error paths (invalid login, empty states, missing required fields).
3. Task names describe the full flow: what the user does AND what they should see.
4. Generate as many objectives and tasks as needed for full coverage. Do not compress.
5. Order scenarios within each objective from basic setup flows to complex interactions.

## Output format

Output ONLY a raw JSON array. No preamble, no explanation, no markdown fences.

[
  {
    "name": "Auth & Session UAT",
    "tasks": [
      "Login with valid admin credentials — verify redirect to /dashboard, user name in sidebar",
      "Login with wrong password — verify 401 error message, no redirect",
      "Session expiry — wait 15min, perform action, verify token refresh happens transparently",
      "Logout — verify redirect to /login, protected routes inaccessible"
    ]
  }
]`;
}
