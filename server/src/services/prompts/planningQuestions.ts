export function buildPlanningQuestionsPrompt(
	projectName: string,
	description: string | null,
	scope: string | null,
	objectiveName: string,
	taskNames: string[],
	discoveryContext: string | null
): string {
	return `Generate a design-decision questionnaire for the Planning objective "${objectiveName}" of the project "${projectName}".

Project: ${projectName}
${description ? `Description: ${description}` : ''}
${scope ? `\nProject Brief (high-level scope):\n${scope}` : ''}
${discoveryContext ? `\nDiscovery outputs (completed investigation):\n${discoveryContext}` : ''}

This objective has the following tasks:
${taskNames.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Planning is about design decisions. Discovery already mapped the problem — now we decide how to solve it. Questions should force concrete choices:
- "How should X behave when Y happens?"
- "What data does Z need to store, and in what shape?"
- "Which approach for X: option A (tradeoff) or option B (tradeoff)?"
- "What is the exact flow when a user does X?"

Questions should NOT be investigative (that was Discovery):
- NOT "What is X?"
- NOT "Who uses Y?"
- NOT "How does Z currently work?"

For each task, write 3–5 focused questions. When fully answered, the answers must provide all the information needed to write a concrete specification for that task — every behavior defined, every edge case covered, every technical choice made.

For each question, provide 2–3 option suggestions that represent realistic design choices with different tradeoffs. The user can always ignore them and write their own answer.

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
