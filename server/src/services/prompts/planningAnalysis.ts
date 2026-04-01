export function buildPlanningAnalysisPrompt(
	projectName: string,
	description: string | null,
	scope: string | null,
	objectiveName: string,
	objTasks: Array<{ uuid: string; name: string }>,
	questionsContent: string,
	discoveryContext: string | null
): string {
	return `You are analyzing a completed Planning questionnaire to determine which specification tasks can be fully completed from the answers provided.

Project: ${projectName}
${description ? `Description: ${description}` : ''}
${scope ? `\nProject Brief:\n${scope}` : ''}
${discoveryContext ? `\nDiscovery outputs (for reference):\n${discoveryContext}` : ''}

Objective: ${objectiveName}

Tasks to evaluate:
${objTasks.map((t, i) => `${i + 1}. [UUID: ${t.uuid}] ${t.name}`).join('\n')}

Q&A Document:
${questionsContent}

Planning tasks produce specifications. A task is completable when the answers provide enough concrete design decisions to write an unambiguous spec. Check for:
- Specific behaviors defined (not "it should handle errors" but "on 401, redirect to /login")
- Edge cases addressed (not just the happy path)
- Data shapes described (not "stores user info" but "users table with email, hashed_password, role enum")
- Technical choices made (not "use a suitable database" but "PostgreSQL because X")

Vague answers like "whatever makes sense", "standard approach", or "TBD" mean the task is NOT completable.

For each task, determine: do the answers provide sufficient, specific information to produce a complete specification document for that task?

Output ONLY a raw JSON object. No preamble, no explanation, no markdown code fences. Start with { and end with }.

{
  "completable": [
    { "taskUuid": "...", "taskName": "..." }
  ],
  "incomplete": [
    { "taskName": "...", "reason": "specific decision or detail that is missing or too vague" }
  ]
}`;
}
