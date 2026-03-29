import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import { objectives, tasks, phases, projects, documents } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';

export interface AnalysisResult {
	completable: Array<{ taskUuid: string; taskName: string }>;
	incomplete: Array<{ taskName: string; reason: string }>;
}

export interface AgentJob {
	id: string;
	status: 'running' | 'done' | 'error';
	error?: string;
	result?: AnalysisResult;
}

const jobs = new Map<string, AgentJob>();

export function getJob(id: string): AgentJob | undefined {
	return jobs.get(id);
}

export async function runDiscoveryAgent(phaseUuid: string): Promise<string> {
	const jobId = randomUUID();
	jobs.set(jobId, { id: jobId, status: 'running' });

	(async () => {
		try {
			const [phase] = await db.select().from(phases).where(eq(phases.uuid, phaseUuid));
			if (!phase) throw new Error('Phase not found');

			const [project] = await db.select().from(projects).where(eq(projects.id, phase.projectId));
			if (!project) throw new Error('Project not found');

			const [briefDoc] = await db
				.select()
				.from(documents)
				.where(
					and(
						eq(documents.projectId, project.id),
						eq(documents.name, 'Project Brief'),
						isNull(documents.objectiveId)
					)
				);

			const prompt = buildObjectivesPrompt(project.name, project.type, project.description, briefDoc?.content ?? null);
			const raw = await runClaude(prompt);

			// Strip markdown code fences if present
			const json = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
			const objectivesData: Array<{ name: string; tasks: string[] }> = JSON.parse(json);

			for (let i = 0; i < objectivesData.length; i++) {
				const obj = objectivesData[i];
				const [objective] = await db
					.insert(objectives)
					.values({ phaseId: phase.id, name: obj.name, orderIndex: i })
					.returning();

				for (let j = 0; j < obj.tasks.length; j++) {
					await db.insert(tasks).values({
						objectiveId: objective.id,
						name: obj.tasks[j],
						orderIndex: j,
					});
				}
			}

			jobs.set(jobId, { id: jobId, status: 'done' });
		} catch (err) {
			jobs.set(jobId, { id: jobId, status: 'error', error: String(err) });
		}
	})();

	return jobId;
}

export async function runObjectiveQuestionsAgent(objectiveUuid: string, userId: number): Promise<string> {
	const jobId = randomUUID();
	jobs.set(jobId, { id: jobId, status: 'running' });

	(async () => {
		try {
			const [objective] = await db.select().from(objectives).where(eq(objectives.uuid, objectiveUuid));
			if (!objective) throw new Error('Objective not found');

			const objTasks = await db.select().from(tasks).where(eq(tasks.objectiveId, objective.id));
			const [phase] = await db.select().from(phases).where(eq(phases.id, objective.phaseId));
			if (!phase) throw new Error('Phase not found');

			const [project] = await db.select().from(projects).where(eq(projects.id, phase.projectId));
			if (!project) throw new Error('Project not found');

			const [briefDoc] = await db
				.select()
				.from(documents)
				.where(
					and(
						eq(documents.projectId, project.id),
						eq(documents.name, 'Project Brief'),
						isNull(documents.objectiveId)
					)
				);

			const prompt = buildQuestionsPrompt(project.name, project.description, briefDoc?.content ?? null, objective.name, objTasks.map(t => t.name));
			const content = await runClaude(prompt);

			await db.insert(documents).values({
				projectId: project.id,
				phaseId: phase.id,
				objectiveId: objective.id,
				name: `Questions: ${objective.name}`,
				content,
				type: 'note',
				createdBy: userId,
			});

			jobs.set(jobId, { id: jobId, status: 'done' });
		} catch (err) {
			jobs.set(jobId, { id: jobId, status: 'error', error: String(err) });
		}
	})();

	return jobId;
}

export async function runDocumentationAnalysisAgent(objectiveUuid: string): Promise<string> {
	const jobId = randomUUID();
	jobs.set(jobId, { id: jobId, status: 'running' });

	(async () => {
		try {
			const [objective] = await db.select().from(objectives).where(eq(objectives.uuid, objectiveUuid));
			if (!objective) throw new Error('Objective not found');

			const objTasks = await db.select().from(tasks).where(eq(tasks.objectiveId, objective.id));
			const [phase] = await db.select().from(phases).where(eq(phases.id, objective.phaseId));
			if (!phase) throw new Error('Phase not found');

			const [project] = await db.select().from(projects).where(eq(projects.id, phase.projectId));
			if (!project) throw new Error('Project not found');

			const [briefDoc] = await db.select().from(documents).where(
				and(eq(documents.projectId, project.id), eq(documents.name, 'Project Brief'), isNull(documents.objectiveId))
			);

			const [questionsDoc] = await db.select().from(documents).where(eq(documents.objectiveId, objective.id));
			if (!questionsDoc?.content) throw new Error('No questions document found for this objective');

			const prompt = buildAnalysisPrompt(
				project.name, project.description, briefDoc?.content ?? null,
				objective.name, objTasks, questionsDoc.content
			);

			const raw = await runClaude(prompt);
			const json = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
			const result: AnalysisResult = JSON.parse(json);

			jobs.set(jobId, { id: jobId, status: 'done', result });
		} catch (err) {
			jobs.set(jobId, { id: jobId, status: 'error', error: String(err) });
		}
	})();

	return jobId;
}

export async function runDocumentationProductionAgent(
	objectiveUuid: string,
	userId: number,
	taskUuids: string[]
): Promise<string> {
	const jobId = randomUUID();
	jobs.set(jobId, { id: jobId, status: 'running' });

	(async () => {
		try {
			const [objective] = await db.select().from(objectives).where(eq(objectives.uuid, objectiveUuid));
			if (!objective) throw new Error('Objective not found');

			const [phase] = await db.select().from(phases).where(eq(phases.id, objective.phaseId));
			if (!phase) throw new Error('Phase not found');

			const [project] = await db.select().from(projects).where(eq(projects.id, phase.projectId));
			if (!project) throw new Error('Project not found');

			const [briefDoc] = await db.select().from(documents).where(
				and(eq(documents.projectId, project.id), eq(documents.name, 'Project Brief'), isNull(documents.objectiveId))
			);

			const [questionsDoc] = await db.select().from(documents).where(eq(documents.objectiveId, objective.id));
			if (!questionsDoc?.content) throw new Error('No questions document found');

			for (const taskUuid of taskUuids) {
				const [task] = await db.select().from(tasks).where(eq(tasks.uuid, taskUuid));
				if (!task) continue;

				const prompt = buildProductionPrompt(
					project.name, project.description, briefDoc?.content ?? null,
					objective.name, task.name, questionsDoc.content
				);

				const content = await runClaude(prompt);

				const h1Match = content.match(/^#\s+(.+)$/m);
				const docName = h1Match ? h1Match[1].trim() : task.name;

				await db.insert(documents).values({
					projectId: project.id,
					phaseId: phase.id,
					objectiveId: objective.id,
					name: docName,
					content,
					type: 'note',
					createdBy: userId,
				});

				await db.update(tasks).set({ completed: true }).where(eq(tasks.uuid, taskUuid));
			}

			jobs.set(jobId, { id: jobId, status: 'done' });
		} catch (err) {
			jobs.set(jobId, { id: jobId, status: 'error', error: String(err) });
		}
	})();

	return jobId;
}

function buildQuestionsPrompt(projectName: string, description: string | null, scope: string | null, objectiveName: string, taskNames: string[]): string {
	return `Generate a questionnaire for the objective "${objectiveName}" of the project "${projectName}".

Project: ${projectName}
${description ? `Description: ${description}` : ''}
${scope ? `\nProject Brief (high-level scope):\n${scope}` : ''}

This objective has the following tasks:
${taskNames.map((t, i) => `${i + 1}. ${t}`).join('\n')}

For each task, write 3–5 focused questions. When fully answered, the answers must provide all the information needed to complete that task — nothing else should need to be asked.

Output ONLY the markdown document. No preamble. No explanation. Start directly with the title.

# Questions: ${objectiveName}
## Project: ${projectName}

---

${taskNames.map(t => `## ${t}

**Q1:**

> _answer here_

**Q2:**

> _answer here_

**Q3:**

> _answer here_

`).join('\n')}`;
}

function buildObjectivesPrompt(name: string, type: string, description: string | null, scope: string | null): string {
	return `Generate Discovery phase objectives and tasks for the project "${name}".

Project: ${name}
Type: ${type}
${description ? `Description: ${description}` : ''}
${scope ? `\nProject Brief (high-level scope):\n${scope}` : ''}

Output ONLY a raw JSON array. No preamble, no explanation, no markdown code fences. Start with [ and end with ].

The array must have exactly 3 objectives — these are the standard Discovery phase objectives:
1. Problem Definition — tasks that produce a written problem statement, definition of success, and constraint inventory
2. Scope — tasks that produce an MVP definition, a non-goals list, and a risk register
3. Users — tasks that produce user type definitions and 3-5 concrete usage scenarios

Each objective has 3-4 tasks. Tasks are specific, actionable, and tailored to this project's context.

Format:
[
  {
    "name": "Problem Definition",
    "tasks": ["task 1", "task 2", "task 3"]
  },
  {
    "name": "Scope",
    "tasks": ["task 1", "task 2", "task 3"]
  },
  {
    "name": "Users",
    "tasks": ["task 1", "task 2"]
  }
]`;
}

function buildAnalysisPrompt(
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

function buildProductionPrompt(
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

function runClaude(prompt: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const claudePath = process.env.CLAUDE_PATH || 'claude';
		const proc = spawn(claudePath, ['--print'], {
			env: { ...process.env },
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		let stdout = '';
		let stderr = '';

		proc.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
		proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()));

		proc.on('close', (code: number | null) => {
			if (code === 0) resolve(stdout.trim());
			else reject(new Error(`claude exited ${code}: ${stderr.slice(0, 300)}`));
		});

		proc.on('error', reject);

		proc.stdin.write(prompt);
		proc.stdin.end();
	});
}
