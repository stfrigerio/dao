import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import { objectives, tasks, phases, projects, documents } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { buildDiscoveryObjectivesPrompt } from './prompts/discoveryObjectives.js';
import { buildPlanningObjectivesPrompt } from './prompts/planningObjectives.js';
import { buildExecutionObjectivesPrompt } from './prompts/executionObjectives.js';
import { buildReviewObjectivesPrompt } from './prompts/reviewObjectives.js';
import { buildQuestionsPrompt } from './prompts/questions.js';
import { buildAnalysisPrompt } from './prompts/analysis.js';
import { buildProductionPrompt } from './prompts/production.js';

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

function selectObjectivesPrompt(
	phaseName: string,
	projectName: string,
	projectType: string,
	projectDescription: string | null,
	scope: string | null
): string {
	const name = phaseName.toLowerCase();
	if (name.includes('planning')) return buildPlanningObjectivesPrompt(projectName, projectType, projectDescription, scope);
	if (name.includes('execution')) return buildExecutionObjectivesPrompt(projectName, projectType, projectDescription, scope);
	if (name.includes('review')) return buildReviewObjectivesPrompt(projectName, projectType, projectDescription, scope);
	return buildDiscoveryObjectivesPrompt(projectName, projectType, projectDescription, scope);
}

export async function runPhaseObjectivesAgent(phaseUuid: string): Promise<string> {
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

			const prompt = selectObjectivesPrompt(
				phase.name,
				project.name,
				project.type,
				project.description,
				briefDoc?.content ?? null
			);
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

			// Auto-complete objective when all its tasks are done
			const siblingTasks = await db.select().from(tasks).where(eq(tasks.objectiveId, objective.id));
			const allDone = siblingTasks.every((t) => t.completed);
			if (allDone) {
				await db.update(objectives).set({ completed: true, updatedAt: new Date() }).where(eq(objectives.id, objective.id));
			}

			jobs.set(jobId, { id: jobId, status: 'done' });
		} catch (err) {
			jobs.set(jobId, { id: jobId, status: 'error', error: String(err) });
		}
	})();

	return jobId;
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
