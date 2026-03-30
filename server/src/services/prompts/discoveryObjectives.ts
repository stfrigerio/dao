export function buildDiscoveryObjectivesPrompt(
	projectName: string,
	_projectType: string,
	projectDescription: string | null,
	scope: string | null
): string {
	const context = [
		`Project: ${projectName}`,
		projectDescription ? `Description: ${projectDescription}` : '',
		scope ? `Brief:\n${scope}` : '',
	]
		.filter(Boolean)
		.join('\n');

	return `You are generating Discovery phase objectives for "${projectName}".

${context}

Discovery maps the problem space. It is pure investigation — understand what exists, who is involved, how things work today, and where the pain is. Discovery does NOT produce decisions, plans, solutions, constraints, priorities, or scope. It ends when someone unfamiliar with the domain could read the output and understand the problem and its context.

Every discovery has two mandatory objectives:

1. Problem Definition — understand what the problem actually is, who experiences it, how they experience it, and what "better" looks like from their perspective.

2. Domain Map — identify the key concepts, actors, workflows, and relationships that make up the problem space. This is a map of the territory, not a plan for building in it.

Add 1-3 more objectives ONLY if the project has distinct areas that need separate investigation. Draw these from the project description — do not invent generic objectives. If the description is thin, stick with just the two mandatory ones.

Task rules:
- Every task must reference something specific to this project. No generic discovery boilerplate.
- Tasks are investigations, not deliverables. They sound like "find out X" or "map how Y works", not "produce a document" or "define the requirements."

Good tasks (for a school homework platform):
- "Find out how teachers currently assign, collect, and grade homework without the tool"
- "Map what happens when a student misses a deadline — who notices, what do they do"

Bad tasks:
- "Identify key stakeholders and their roles"
- "Define success criteria for the project"
- "Produce a comprehensive domain model"

Output ONLY a raw JSON array. No preamble, no markdown fences, no explanation.

[
  {
    "name": "Problem Definition",
    "tasks": ["task 1", "task 2", "task 3"]
  },
  {
    "name": "Domain Map",
    "tasks": ["task 1", "task 2", "task 3"]
  }
]`;
}
