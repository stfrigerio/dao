export function buildPlanningProductionPrompt(
	projectName: string,
	description: string | null,
	scope: string | null,
	objectiveName: string,
	taskName: string,
	questionsContent: string,
	discoveryContext: string | null,
	siblingTasks?: string[]
): string {
	const siblingBlock =
		siblingTasks && siblingTasks.length > 0
			? `\nOther tasks under this objective (covered by separate documents — do NOT duplicate their content):\n${siblingTasks.map((t) => `- ${t}`).join('\n')}\n\nYour document must focus exclusively on the angle described by YOUR task. Reference the other documents where relevant but do not cover their ground.`
			: '';

	return `You are producing a Planning specification document based on answered design-decision questions.

Project: ${projectName}
${description ? `Description: ${description}` : ''}
${scope ? `\nProject Brief:\n${scope}` : ''}
${discoveryContext ? `\nDiscovery outputs (for reference):\n${discoveryContext}` : ''}

Objective: ${objectiveName}
Task: ${taskName}
${siblingBlock}

Planning documents are specifications — concrete, unambiguous, implementable. An engineer reads this and builds without asking questions.

A good Planning document:
- Uses "does", "returns", "stores", "rejects" — not "should", "could", "might"
- Defines exact behaviors: inputs, outputs, error cases
- Specifies data shapes: field names, types, constraints
- Names concrete technologies, endpoints, table schemas
- Covers edge cases explicitly

A bad Planning document:
- Uses vague language ("handles errors appropriately", "stores relevant data")
- Describes intent instead of behavior ("the system should be fast")
- Leaves decisions for implementation ("use a suitable approach")
- Only covers the happy path

Based on the following answered Q&A document, produce a complete specification for this task. Write the actual spec — not a summary. Use markdown formatting.

Q&A Document:
${questionsContent}

Output ONLY the markdown document. No preamble. No explanation. Start directly with the content.`;
}
