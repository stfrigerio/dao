export function buildPlanningObjectivesPrompt(
	projectName: string,
	projectType: string,
	projectDescription: string | null,
	scope: string | null
): string {
	return `Generate Planning phase objectives and tasks for the project "${projectName}".

Project: ${projectName}
Type: ${projectType}
${projectDescription ? `Description: ${projectDescription}` : ''}
${scope ? `\nProject Brief (high-level scope):\n${scope}` : ''}

Output ONLY a raw JSON array. No preamble, no explanation, no markdown code fences. Start with [ and end with ].

Planning assumes Discovery is complete. The project knows what it is building. This phase figures out how: every requirement is written down, every technical decision is made, and the work is broken into buildable chunks before a single line of code is written.

Two objectives are always present:
1. Functional Requirements — tasks that produce a complete, unambiguous spec of every feature and behavior the system must have
2. Architecture — tasks that produce documented decisions on stack, system design, data model, and integrations

Beyond those two, add objectives only where they are actually needed for this project. Common additions: User Flows (if the product has a UI with non-trivial navigation), Timeline (if scheduling constraints exist), Linear Setup (if the team uses Linear for task tracking), API Design (if the system exposes or consumes APIs that need speccing). Do not include these by default — infer from the project context.

Aim for 3–5 objectives total. Each objective has 3–4 tasks. Tasks are specific, actionable, and each one produces a concrete written output or decision.

Format:
[
  {
    "name": "Functional Requirements",
    "tasks": ["task 1", "task 2", "task 3"]
  },
  {
    "name": "Architecture",
    "tasks": ["task 1", "task 2", "task 3"]
  }
]`;
}
