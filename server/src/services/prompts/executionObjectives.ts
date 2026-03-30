export function buildExecutionObjectivesPrompt(
	projectName: string,
	projectType: string,
	projectDescription: string | null,
	scope: string | null
): string {
	return `Generate Execution phase objectives and tasks for the project "${projectName}".

Project: ${projectName}
Type: ${projectType}
${projectDescription ? `Description: ${projectDescription}` : ''}
${scope ? `\nProject Brief (high-level scope):\n${scope}` : ''}

Output ONLY a raw JSON array. No preamble, no explanation, no markdown code fences. Start with [ and end with ].

Execution is the build phase. Planning is complete. Each objective is a logical, self-contained chunk of the build — something that can be worked on and finished before moving to the next. Objectives should not be steps in a sequence but parallel or loosely ordered areas of work (e.g. backend, frontend, infrastructure, data layer). Tasks inside each objective are the actual things to build or implement.

Do not include planning, discovery, or review work — those belong to other phases. Focus entirely on what needs to be built and how the work is divided.

Infer the right objectives from the project name, type, description, and scope. For a web app this might be Backend, Frontend, and Infrastructure. For a data pipeline it might be Ingestion, Transformation, and Output. Adapt to the actual project.

Aim for 3–5 objectives. Each objective has 3–4 tasks. Tasks are specific and implementation-level — concrete things to build, not areas to explore.

Format:
[
  {
    "name": "Objective name",
    "tasks": ["task 1", "task 2", "task 3"]
  }
]`;
}
