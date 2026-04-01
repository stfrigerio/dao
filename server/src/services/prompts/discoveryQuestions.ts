export function buildDiscoveryQuestionsPrompt(
	projectName: string,
	description: string | null,
	scope: string | null,
	objectiveName: string,
	taskNames: string[]
): string {
	return `Generate an investigation questionnaire for the Discovery objective "${objectiveName}" of the project "${projectName}".

Project: ${projectName}
${description ? `Description: ${description}` : ''}
${scope ? `\nProject Brief (high-level scope):\n${scope}` : ''}

This objective has the following tasks:
${taskNames.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Discovery is pure investigation. Questions should uncover facts, map what exists, and understand the current reality. They sound like:
- "What happens today when X occurs?"
- "Who is involved in Y and what do they do?"
- "How does Z currently work, step by step?"

Questions should NOT be about decisions, solutions, or design:
- NOT "How should we implement X?"
- NOT "What technology should we use for Y?"

For each task, write 3–5 focused questions. When fully answered, the answers must provide all the information needed to complete that task — nothing else should need to be asked.

For each question, also provide 2–3 short option suggestions the user can pick from as a quick answer. Options should be realistic, distinct, and cover the most common cases — not exhaustive. The user can always ignore them and type a free answer.

Output ONLY the markdown document. No preamble. No explanation. Start directly with the title.

Format for each question:

**Q1:** [question text]

[opt: First option | Second option | Third option]

> _answer here_

# Questions: ${objectiveName}
## Project: ${projectName}

---

${taskNames
	.map(
		(t) => `## ${t}

**Q1:**

[opt: option A | option B | option C]

> _answer here_

**Q2:**

[opt: option A | option B]

> _answer here_

**Q3:**

[opt: option A | option B | option C]

> _answer here_

`
	)
	.join('\n')}`;
}
