export function buildAnalysisPrompt(
	projectName: string,
	description: string | null,
	scope: string | null,
	objectiveName: string,
	objTasks: Array<{ uuid: string; name: string }>,
	questionsContent: string
): string {
	return `You are analyzing a completed Q&A questionnaire to determine which project tasks can be fully completed from the answers provided.

Project: ${projectName}
${description ? `Description: ${description}` : ''}
${scope ? `\nProject Brief:\n${scope}` : ''}

Objective: ${objectiveName}

Tasks to evaluate:
${objTasks.map((t, i) => `${i + 1}. [UUID: ${t.uuid}] ${t.name}`).join('\n')}

Q&A Document:
${questionsContent}

For each task, determine: do the answers provide sufficient, specific information to produce a complete and actionable deliverable for that task?

Output ONLY a raw JSON object. No preamble, no explanation, no markdown code fences. Start with { and end with }.

{
  "completable": [
    { "taskUuid": "...", "taskName": "..." }
  ],
  "incomplete": [
    { "taskName": "...", "reason": "specific information that is missing or too vague" }
  ]
}`;
}
