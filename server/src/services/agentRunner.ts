import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import { objectives, tasks, phases, projects, documents } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface AgentJob {
	id: string;
	status: 'running' | 'done' | 'error';
	error?: string;
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

			const prompt = buildObjectivesPrompt(project.name, project.type, project.description);
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

			const prompt = buildQuestionsPrompt(project.name, project.description, objective.name, objTasks.map(t => t.name));
			const content = await runClaude(prompt);

			await db.insert(documents).values({
				projectId: project.id,
				phaseId: phase.id,
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

function buildQuestionsPrompt(projectName: string, description: string | null, objectiveName: string, taskNames: string[]): string {
	return `Generate a questionnaire for the objective "${objectiveName}" of the project "${projectName}".

Project: ${projectName}
${description ? `Description: ${description}` : ''}

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

function buildObjectivesPrompt(name: string, type: string, description: string | null): string {
	return `Generate Discovery phase objectives and tasks for the project "${name}".

Project: ${name}
Type: ${type}
${description ? `Description: ${description}` : ''}

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
