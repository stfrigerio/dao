import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import { objectives, tasks, phases, projects, documents } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { buildDiscoveryObjectivesPrompt } from './prompts/discoveryObjectives.js';
import { buildDiscoveryQuestionsPrompt } from './prompts/discoveryQuestions.js';
import { buildDiscoveryAnalysisPrompt } from './prompts/discoveryAnalysis.js';
import { buildDiscoveryProductionPrompt } from './prompts/discoveryProduction.js';
import { buildPlanningObjectivesPrompt } from './prompts/planningObjectives.js';
import { buildPlanningQuestionsPrompt } from './prompts/planningQuestions.js';
import { buildPlanningAnalysisPrompt } from './prompts/planningAnalysis.js';
import { buildPlanningProductionPrompt } from './prompts/planningProduction.js';
import { buildExecutionObjectivesPrompt } from './prompts/executionObjectives.js';
import { buildReviewObjectivesPrompt } from './prompts/reviewObjectives.js';


export interface AnalysisResult {
	completable: Array<{ taskUuid: string; taskName: string }>;
	incomplete: Array<{ taskName: string; reason: string }>;
}

export interface AgentJob {
	id: string;
	status: 'running' | 'done' | 'error';
	error?: string;
	result?: AnalysisResult;
	progress?: { current: number; total: number };
}

const jobs = new Map<string, AgentJob>();

export function getJob(id: string): AgentJob | undefined {
	return jobs.get(id);
}

type PhaseType = 'discovery' | 'planning' | 'execution' | 'review';

function detectPhaseType(phaseName: string): PhaseType {
	const name = phaseName.toLowerCase();
	if (name.includes('planning')) return 'planning';
	if (name.includes('execution')) return 'execution';
	if (name.includes('review')) return 'review';
	return 'discovery';
}

/** Gather all produced documents from earlier phases as context for later phases. */
async function getPriorPhaseContext(projectId: number, currentPhaseOrderIndex: number): Promise<string | null> {
	const priorPhases = await db.select().from(phases)
		.where(eq(phases.projectId, projectId));
	const earlier = priorPhases.filter((p) => p.orderIndex < currentPhaseOrderIndex);
	if (earlier.length === 0) return null;

	const priorPhaseIds = earlier.map((p) => p.id);
	const allDocs = await db.select().from(documents)
		.where(eq(documents.projectId, projectId));
	const priorDocs = allDocs.filter(
		(d) => d.phaseId !== null && priorPhaseIds.includes(d.phaseId) && !d.name.startsWith('Questions: ')
	);
	if (priorDocs.length === 0) return null;

	return priorDocs.map((d) => `### ${d.name}\n\n${d.content}`).join('\n\n---\n\n');
}

function selectObjectivesPrompt(
	phaseName: string,
	projectName: string,
	projectType: string,
	projectDescription: string | null,
	scope: string | null,
	priorContext: string | null
): string {
	const type = detectPhaseType(phaseName);
	if (type === 'planning') return buildPlanningObjectivesPrompt(projectName, projectType, projectDescription, scope);
	if (type === 'execution') return buildExecutionObjectivesPrompt(projectName, projectType, projectDescription, scope, priorContext);
	if (type === 'review') return buildReviewObjectivesPrompt(projectName, projectType, projectDescription, scope, priorContext);
	return buildDiscoveryObjectivesPrompt(projectName, projectType, projectDescription, scope);
}

export async function runPhaseObjectivesAgent(phaseUuid: string, documentUuids?: string[]): Promise<string> {
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

			let priorContext: string | null;
			if (documentUuids && documentUuids.length > 0) {
				// Use only the selected documents as context
				const allDocs = await db.select().from(documents).where(eq(documents.projectId, project.id));
				const selected = allDocs.filter((d) => documentUuids.includes(d.uuid));
				priorContext = selected.length > 0
					? selected.map((d) => `### ${d.name}\n\n${d.content}`).join('\n\n---\n\n')
					: null;
			} else {
				priorContext = await getPriorPhaseContext(project.id, phase.orderIndex);
			}
			const prompt = selectObjectivesPrompt(
				phase.name,
				project.name,
				project.type,
				project.description,
				briefDoc?.content ?? null,
				priorContext
			);
			const raw = await runClaude(prompt);

			// Strip markdown code fences if present
			const json = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
			type TaskEntry = string | { name: string; subtasks?: string[] };
			const objectivesData: Array<{ name: string; tasks: TaskEntry[] }> = JSON.parse(json);

			for (let i = 0; i < objectivesData.length; i++) {
				const obj = objectivesData[i];
				const [objective] = await db
					.insert(objectives)
					.values({ phaseId: phase.id, name: obj.name, orderIndex: i })
					.returning();

				for (let j = 0; j < obj.tasks.length; j++) {
					const entry = obj.tasks[j];
					const taskName = typeof entry === 'string' ? entry : entry.name;
					const subtaskNames = typeof entry === 'string' ? [] : (entry.subtasks || []);

					const [task] = await db.insert(tasks).values({
						objectiveId: objective.id,
						name: taskName,
						orderIndex: j,
					}).returning();

					for (let k = 0; k < subtaskNames.length; k++) {
						await db.insert(tasks).values({
							objectiveId: objective.id,
							parentTaskId: task.id,
							name: subtaskNames[k],
							orderIndex: k,
						});
					}
				}
			}

			jobs.set(jobId, { id: jobId, status: 'done' });
		} catch (err) {
			console.error(`[agent-job ${jobId}] failed:`, err);
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

			const phaseType = detectPhaseType(phase.name);
			let prompt: string;
			if (phaseType === 'planning') {
				const priorContext = await getPriorPhaseContext(project.id, phase.orderIndex);
				prompt = buildPlanningQuestionsPrompt(project.name, project.description, briefDoc?.content ?? null, objective.name, objTasks.map(t => t.name), priorContext);
			} else {
				prompt = buildDiscoveryQuestionsPrompt(project.name, project.description, briefDoc?.content ?? null, objective.name, objTasks.map(t => t.name));
			}
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
			console.error(`[agent-job ${jobId}] failed:`, err);
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

			const phaseType = detectPhaseType(phase.name);
			let prompt: string;
			if (phaseType === 'planning') {
				const priorContext = await getPriorPhaseContext(project.id, phase.orderIndex);
				prompt = buildPlanningAnalysisPrompt(project.name, project.description, briefDoc?.content ?? null, objective.name, objTasks, questionsDoc.content, priorContext);
			} else {
				prompt = buildDiscoveryAnalysisPrompt(project.name, project.description, briefDoc?.content ?? null, objective.name, objTasks, questionsDoc.content);
			}

			const raw = await runClaude(prompt);
			const json = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
			const result: AnalysisResult = JSON.parse(json);

			jobs.set(jobId, { id: jobId, status: 'done', result });
		} catch (err) {
			console.error(`[agent-job ${jobId}] failed:`, err);
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
	const total = taskUuids.length;
	jobs.set(jobId, { id: jobId, status: 'running', progress: { current: 0, total } });

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

			// Resolve all task names upfront so each prompt knows its siblings
			const allTasks = await Promise.all(
				taskUuids.map(async (uuid) => {
					const [t] = await db.select().from(tasks).where(eq(tasks.uuid, uuid));
					return t;
				})
			);
			const allTaskNames = allTasks.filter(Boolean).map((t) => t.name);

			let completed = 0;
			for (const taskUuid of taskUuids) {
				const task = allTasks.find((t) => t?.uuid === taskUuid);
				if (!task) continue;
				jobs.set(jobId, { id: jobId, status: 'running', progress: { current: completed + 1, total } });

				const siblingTasks = allTaskNames.filter((n) => n !== task.name);
				const phaseType = detectPhaseType(phase.name);
				let prompt: string;
				if (phaseType === 'planning') {
					const priorContext = await getPriorPhaseContext(project.id, phase.orderIndex);
					prompt = buildPlanningProductionPrompt(project.name, project.description, briefDoc?.content ?? null, objective.name, task.name, questionsDoc.content, priorContext, siblingTasks);
				} else {
					prompt = buildDiscoveryProductionPrompt(project.name, project.description, briefDoc?.content ?? null, objective.name, task.name, questionsDoc.content, siblingTasks);
				}

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
				completed++;
			}

			// Auto-complete objective when all its tasks are done
			const siblingTasks = await db.select().from(tasks).where(eq(tasks.objectiveId, objective.id));
			const allDone = siblingTasks.every((t) => t.completed);
			if (allDone) {
				await db.update(objectives).set({ completed: true, updatedAt: new Date() }).where(eq(objectives.id, objective.id));
			}

			jobs.set(jobId, { id: jobId, status: 'done' });
		} catch (err) {
			console.error(`[agent-job ${jobId}] failed:`, err);
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
