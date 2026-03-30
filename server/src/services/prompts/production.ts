export function buildProductionPrompt(
	projectName: string,
	description: string | null,
	scope: string | null,
	objectiveName: string,
	taskName: string,
	questionsContent: string
): string {
	return `You are producing a project deliverable document based on answered discovery questions.

Project: ${projectName}
${description ? `Description: ${description}` : ''}
${scope ? `\nProject Brief:\n${scope}` : ''}

Objective: ${objectiveName}
Task: ${taskName}

Based on the following answered Q&A document, produce a complete, actionable deliverable for this task. Write the actual document — not a summary or analysis of it. Use markdown formatting.

Q&A Document:
${questionsContent}

Output ONLY the markdown document. No preamble. No explanation. Start directly with the content.`;
}
