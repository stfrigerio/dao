export function buildDiscoveryProductionPrompt(
	projectName: string,
	description: string | null,
	scope: string | null,
	objectiveName: string,
	taskName: string,
	questionsContent: string,
	siblingTasks?: string[]
): string {
	const siblingBlock =
		siblingTasks && siblingTasks.length > 0
			? `\nOther tasks under this objective (covered by separate documents — do NOT duplicate their content):\n${siblingTasks.map((t) => `- ${t}`).join('\n')}\n\nYour document must focus exclusively on the angle described by YOUR task. Reference the other documents where relevant ("see Domain Map — Tools & Channels" etc.) but do not cover their ground.`
			: '';

	return `You are producing a Discovery document based on answered investigation questions.

Project: ${projectName}
${description ? `Description: ${description}` : ''}
${scope ? `\nProject Brief:\n${scope}` : ''}

Objective: ${objectiveName}
Task: ${taskName}
${siblingBlock}

Discovery documents describe the current reality — what exists, how it works, who is involved, where the problems are. They are factual accounts, not recommendations or plans.

A good Discovery document:
- States facts, not opinions
- Describes what IS, not what SHOULD BE
- Names specific actors, workflows, and pain points
- Can be read by someone unfamiliar with the domain and understood

A bad Discovery document:
- Proposes solutions or makes recommendations
- Uses vague language ("stakeholders", "as needed", "appropriate")
- Summarizes without specifics

Based on the following answered Q&A document, produce a complete investigative document for this task. Write the actual document — not a summary or analysis of it. Use markdown formatting.

Q&A Document:
${questionsContent}

Output ONLY the markdown document. No preamble. No explanation. Start directly with the content.`;
}
