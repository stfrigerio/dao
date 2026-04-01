export function buildDiscoveryAnalysisPrompt(
	projectName: string,
	description: string | null,
	scope: string | null,
	objectiveName: string,
	objTasks: Array<{ uuid: string; name: string }>,
	questionsContent: string
): string {
	return `You are analyzing a completed Discovery questionnaire to determine which investigation tasks can be fully completed from the answers provided.

Project: ${projectName}
${description ? `Description: ${description}` : ''}
${scope ? `\nProject Brief:\n${scope}` : ''}

Objective: ${objectiveName}

Tasks to evaluate:
${objTasks.map((t, i) => `${i + 1}. [UUID: ${t.uuid}] ${t.name}`).join('\n')}

Q&A Document:
${questionsContent}

Discovery tasks are investigations. A task is completable when the answers provide enough factual, specific information to write a clear account of the current reality — who is involved, what happens, how it works, where the pain is. Vague or one-word answers are not sufficient.

For each task, determine: do the answers provide sufficient, specific information to produce a complete investigative document for that task?

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
