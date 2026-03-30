export function buildReviewObjectivesPrompt(
	projectName: string,
	projectType: string,
	projectDescription: string | null,
	scope: string | null
): string {
	return `Generate Review phase objectives and tasks for the project "${projectName}".

Project: ${projectName}
Type: ${projectType}
${projectDescription ? `Description: ${projectDescription}` : ''}
${scope ? `\nProject Brief (high-level scope):\n${scope}` : ''}

Output ONLY a raw JSON array. No preamble, no explanation, no markdown code fences. Start with [ and end with ].

Review comes after Execution. The thing is built. This phase makes sure it actually works before calling it done. Every flow is tested, production is validated, and there are no known blockers.

Two objectives are always present:
1. Test Coverage — tasks that ensure every critical flow is tested end to end, edge cases are handled, and no untested paths remain
2. Production Readiness — tasks that validate the production environment, deployment process, configuration, and monitoring

Beyond those two, add objectives only where they are actually needed. Examples: Performance (if load or latency is a concern), Security (if the system handles sensitive data or exposes a public surface), Documentation (if the project requires user or operator docs before shipping). Do not include these by default — infer from the project.

Aim for 3–5 objectives. Each objective has 3–4 tasks. Tasks are specific and verifiable — each one has a clear pass/fail outcome.

Format:
[
  {
    "name": "Test Coverage",
    "tasks": ["task 1", "task 2", "task 3"]
  },
  {
    "name": "Production Readiness",
    "tasks": ["task 1", "task 2", "task 3"]
  }
]`;
}
