import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { projects, objectives, tasks, phases } from '../db/schema';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { getIssues, createIssue, createProject, createIssueInProject, updateIssueState, getProjectColor, getLinearProjects, getIssueStates } from '../services/linear';
import { isNotNull } from 'drizzle-orm';

const router = Router();

// ── Shared sync helper ──────────────────────────────────────────────────

async function syncObjectiveToLinear(apiKey: string, objective: typeof objectives.$inferSelect, colorIndex?: number) {
	// Create or reuse Linear project
	let linearProjectId = objective.linearProjectId;
	let linearProject: { id: string; name: string; url: string } | null = null;
	if (!linearProjectId) {
		const color = colorIndex !== undefined ? getProjectColor(colorIndex) : undefined;
		linearProject = await createProject(apiKey, objective.name, objective.description ?? undefined, color);
		linearProjectId = linearProject.id;
		await db.update(objectives).set({ linearProjectId }).where(eq(objectives.id, objective.id));
	}

	const objTasks = await db.select().from(tasks).where(eq(tasks.objectiveId, objective.id)).orderBy(tasks.orderIndex);
	const topLevel = objTasks.filter((t) => t.parentTaskId === null);

	// Map task.id → linearIssueId (pre-populate from already-synced)
	const issueIdMap: Record<number, string> = {};
	for (const t of objTasks) {
		if (t.linearIssueId) issueIdMap[t.id] = t.linearIssueId;
	}

	// Split "title — details" into separate title and markdown description
	const splitTaskName = (name: string): { title: string; description: string | undefined } => {
		const sep = name.indexOf(' — ');
		if (sep === -1) return { title: name, description: undefined };
		return { title: name.slice(0, sep).trim(), description: name.slice(sep + 3).trim() };
	};

	// Process tasks in batches of BATCH_SIZE concurrently
	const BATCH_SIZE = 5;
	async function processBatch<T>(items: T[], fn: (item: T) => Promise<void>) {
		for (let i = 0; i < items.length; i += BATCH_SIZE) {
			await Promise.all(items.slice(i, i + BATCH_SIZE).map(fn));
		}
	}

	// Sync top-level tasks (batched)
	const unsyncedTopLevel = topLevel.filter((t) => !t.linearIssueId);
	await processBatch(unsyncedTopLevel, async (task) => {
		const { title, description } = splitTaskName(task.name);
		const desc = [description, task.description].filter(Boolean).join('\n\n');
		const issue = await createIssueInProject(apiKey, linearProjectId, title, desc || undefined, task.completed);
		await db.update(tasks).set({ linearIssueId: issue.id }).where(eq(tasks.id, task.id));
		issueIdMap[task.id] = issue.id;
	});

	// Sync subtasks (batched, after parents are done)
	const subtasks = objTasks.filter((t) => t.parentTaskId !== null);
	const unsyncedSubs = subtasks.filter((t) => !t.linearIssueId);
	await processBatch(unsyncedSubs, async (sub) => {
		const parentLinearId = issueIdMap[sub.parentTaskId!];
		if (!parentLinearId) return;
		const { title, description } = splitTaskName(sub.name);
		const desc = [description, sub.description].filter(Boolean).join('\n\n');
		const issue = await createIssueInProject(apiKey, linearProjectId, title, desc || undefined, sub.completed, parentLinearId);
		await db.update(tasks).set({ linearIssueId: issue.id }).where(eq(tasks.id, sub.id));
	});

	return { linearProjectId, tasksSynced: objTasks.filter((t) => !t.linearIssueId).length };
}

// ── Routes ──────────────────────────────────────────────────────────────

// GET /projects/:uuid/linear/issues
router.get('/projects/:uuid/linear/issues', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [project] = await db.select().from(projects).where(eq(projects.uuid, uuid));
	if (!project) {
		res.status(404).json({ error: 'Project not found' });
		return;
	}
	if (!project.linearApiKey) {
		res.status(400).json({ error: 'Project not linked to Linear' });
		return;
	}
	try {
		const issues = await getIssues(project.linearApiKey);
		res.json(issues);
	} catch (err: any) {
		res.status(500).json({ error: err.message || 'Failed to fetch Linear issues' });
	}
});

// POST /projects/:uuid/linear/issues — create issue in Linear
router.post('/projects/:uuid/linear/issues', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [project] = await db.select().from(projects).where(eq(projects.uuid, uuid));
	if (!project) {
		res.status(404).json({ error: 'Project not found' });
		return;
	}
	if (!project.linearApiKey) {
		res.status(400).json({ error: 'Project not linked to Linear' });
		return;
	}
	const { title, description } = req.body;
	if (!title) {
		res.status(400).json({ error: 'title required' });
		return;
	}
	try {
		const issue = await createIssue(project.linearApiKey, title, description);
		res.status(201).json(issue);
	} catch (err: any) {
		res.status(500).json({ error: err.message || 'Failed to create Linear issue' });
	}
});

// POST /projects/:uuid/objectives/:objUuid/sync-linear — sync single objective
router.post('/projects/:uuid/objectives/:objUuid/sync-linear', requireAuth, async (req: AuthRequest, res) => {
	const projectUuid = req.params['uuid'] as string;
	const objUuid = req.params['objUuid'] as string;
	const [project] = await db.select().from(projects).where(eq(projects.uuid, projectUuid));
	if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
	if (!project.linearApiKey) { res.status(400).json({ error: 'Project not linked to Linear' }); return; }
	const [objective] = await db.select().from(objectives).where(eq(objectives.uuid, objUuid));
	if (!objective) { res.status(404).json({ error: 'Objective not found' }); return; }

	try {
		const result = await syncObjectiveToLinear(project.linearApiKey, objective);
		res.status(201).json(result);
	} catch (err: any) {
		res.status(500).json({ error: err.message || 'Failed to sync to Linear' });
	}
});

// POST /projects/:uuid/sync-execution-to-linear — bulk sync all execution objectives
router.post('/projects/:uuid/sync-execution-to-linear', requireAuth, async (req: AuthRequest, res) => {
	const projectUuid = req.params['uuid'] as string;
	const [project] = await db.select().from(projects).where(eq(projects.uuid, projectUuid));
	if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
	if (!project.linearApiKey) { res.status(400).json({ error: 'Project not linked to Linear' }); return; }

	const projectPhases = await db.select().from(phases).where(eq(phases.projectId, project.id));
	const executionPhase = projectPhases.find((p) => p.name.toLowerCase().includes('execution'));
	if (!executionPhase) { res.status(404).json({ error: 'Execution phase not found' }); return; }

	const objs = await db.select().from(objectives).where(eq(objectives.phaseId, executionPhase.id)).orderBy(objectives.orderIndex);

	const results = [];
	const errors = [];
	for (let i = 0; i < objs.length; i++) {
		try {
			const result = await syncObjectiveToLinear(project.linearApiKey, objs[i], i);
			results.push({ objective: objs[i].name, ...result });
		} catch (err: any) {
			errors.push({ objective: objs[i].name, error: err.message });
		}
	}
	res.status(errors.length === objs.length ? 500 : 201).json({
		synced: results.length,
		failed: errors.length,
		objectives: results,
		...(errors.length > 0 && { errors }),
	});
});

// POST /projects/:uuid/linear/pull-status — pull issue states from Linear and update dao tasks
router.post('/projects/:uuid/linear/pull-status', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [project] = await db.select().from(projects).where(eq(projects.uuid, uuid));
	if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
	if (!project.linearApiKey) { res.status(400).json({ error: 'Project not linked to Linear' }); return; }

	try {
		const projectPhases = await db.select().from(phases).where(eq(phases.projectId, project.id));
		const phaseIds = projectPhases.map((p) => p.id);

		// Get all objectives for this project that have synced tasks
		const allObjs = await db.select().from(objectives).where(isNotNull(objectives.linearProjectId));
		const projectObjs = allObjs.filter((o) => phaseIds.includes(o.phaseId));

		// Get all synced tasks
		const syncedTasks = [];
		for (const obj of projectObjs) {
			const objTasks = await db.select().from(tasks).where(eq(tasks.objectiveId, obj.id));
			syncedTasks.push(...objTasks.filter((t) => t.linearIssueId));
		}

		if (syncedTasks.length === 0) { res.json({ updated: 0 }); return; }

		const issueIds = syncedTasks.map((t) => t.linearIssueId!);
		const states = await getIssueStates(project.linearApiKey, issueIds);

		let updated = 0;
		for (const task of syncedTasks) {
			const state = states[task.linearIssueId!];
			if (!state) continue;
			if (task.completed !== state.completed) {
				await db.update(tasks).set({ completed: state.completed, updatedAt: new Date() }).where(eq(tasks.id, task.id));
				updated++;
			}
		}

		// Update objective completion based on child tasks
		for (const obj of projectObjs) {
			const objTasks = await db.select().from(tasks).where(eq(tasks.objectiveId, obj.id));
			const allDone = objTasks.length > 0 && objTasks.every((t) => t.completed);
			if (obj.completed !== allDone) {
				await db.update(objectives).set({ completed: allDone, updatedAt: new Date() }).where(eq(objectives.id, obj.id));
			}
		}

		res.json({ updated, total: syncedTasks.length });
	} catch (err: any) {
		res.status(500).json({ error: err.message || 'Failed to pull status' });
	}
});

// POST /linear/webhook — handle Linear webhooks (bidirectional sync)
router.post('/linear/webhook', async (req, res) => {
	const { type, action, data, updatedFrom } = req.body;

	try {
		// Project deleted → clear linearProjectId + all linearIssueIds for that project's objectives
		if (type === 'Project' && action === 'remove' && data?.id) {
			const affectedObjs = await db.select().from(objectives).where(eq(objectives.linearProjectId, data.id));
			for (const obj of affectedObjs) {
				await db.update(objectives).set({ linearProjectId: null, updatedAt: new Date() }).where(eq(objectives.id, obj.id));
				await db.update(tasks).set({ linearIssueId: null, updatedAt: new Date() }).where(eq(tasks.objectiveId, obj.id));
			}
			res.json({ ok: true });
			return;
		}

		// Issue updates
		if (type === 'Issue' && action === 'update' && data?.id) {
			const [task] = await db.select().from(tasks).where(eq(tasks.linearIssueId, data.id));
			if (!task) { res.json({ ok: true }); return; }

			// State change
			if (updatedFrom?.stateId !== undefined && data.state) {
				// Cancelled in Linear → delete task in dao
				if (data.state.type === 'canceled') {
					const objId = task.objectiveId;
					await db.delete(tasks).where(eq(tasks.id, task.id));
					// Also delete subtasks
					await db.delete(tasks).where(eq(tasks.parentTaskId, task.id));
					// Recalculate objective completion
					const remaining = await db.select().from(tasks).where(eq(tasks.objectiveId, objId));
					if (remaining.length === 0) {
						await db.delete(objectives).where(eq(objectives.id, objId));
					} else {
						const allDone = remaining.filter((t) => t.parentTaskId === null).every((t) => t.completed);
						await db.update(objectives).set({ completed: allDone, updatedAt: new Date() }).where(eq(objectives.id, objId));
					}
				} else {
					// Other state changes → update completion
					const completed = data.state.type === 'completed';
					if (task.completed !== completed) {
						await db.update(tasks).set({ completed, updatedAt: new Date() }).where(eq(tasks.id, task.id));
						const siblingTasks = await db.select().from(tasks).where(eq(tasks.objectiveId, task.objectiveId));
						const allDone = siblingTasks.every((t) => (t.id === task.id ? completed : t.completed));
						await db.update(objectives).set({ completed: allDone, updatedAt: new Date() }).where(eq(objectives.id, task.objectiveId));
					}
				}
			}

			// Title change → update task name
			if (updatedFrom?.title !== undefined && data.title && task.name !== data.title) {
				await db.update(tasks).set({ name: data.title, updatedAt: new Date() }).where(eq(tasks.id, task.id));
			}
		}

		// Issue deleted/removed in Linear → delete task in dao
		if (type === 'Issue' && action === 'remove' && data?.id) {
			const [task] = await db.select().from(tasks).where(eq(tasks.linearIssueId, data.id));
			if (task) {
				const objId = task.objectiveId;
				await db.delete(tasks).where(eq(tasks.id, task.id));
				await db.delete(tasks).where(eq(tasks.parentTaskId, task.id));
				const remaining = await db.select().from(tasks).where(eq(tasks.objectiveId, objId));
				if (remaining.length === 0) {
					await db.delete(objectives).where(eq(objectives.id, objId));
				}
			}
		}

		res.json({ ok: true });
	} catch (err) {
		console.error('Linear webhook error:', err);
		res.json({ ok: true });
	}
});

// POST /projects/:uuid/linear/reconcile — clear stale sync mappings for deleted Linear projects
router.post('/projects/:uuid/linear/reconcile', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [project] = await db.select().from(projects).where(eq(projects.uuid, uuid));
	if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
	if (!project.linearApiKey) { res.status(400).json({ error: 'Project not linked to Linear' }); return; }

	try {
		const linearProjects = await getLinearProjects(project.linearApiKey);
		const liveProjectIds = new Set(linearProjects.map((p) => p.id));

		const projectPhases = await db.select().from(phases).where(eq(phases.projectId, project.id));
		const phaseIds = projectPhases.map((p) => p.id);

		// 1. Clear objectives whose Linear project no longer exists
		const allObjs = await db.select().from(objectives).where(isNotNull(objectives.linearProjectId));
		const staleObjs = allObjs.filter((o) => phaseIds.includes(o.phaseId) && !liveProjectIds.has(o.linearProjectId!));
		let clearedObjs = 0;
		for (const obj of staleObjs) {
			await db.update(objectives).set({ linearProjectId: null, updatedAt: new Date() }).where(eq(objectives.id, obj.id));
			await db.update(tasks).set({ linearIssueId: null, updatedAt: new Date() }).where(eq(tasks.objectiveId, obj.id));
			clearedObjs++;
		}

		// 2. Fetch all live Linear issue IDs and delete DAO tasks whose linearIssueId is gone
		const { getIssuesByIds } = await import('../services/linear');
		const projectObjIds = allObjs.filter((o) => phaseIds.includes(o.phaseId)).map((o) => o.id);
		const allTasks = await db.select().from(tasks).where(isNotNull(tasks.linearIssueId));
		const syncedTasks = allTasks.filter((t) => projectObjIds.includes(t.objectiveId));

		let deletedTasks = 0;
		if (syncedTasks.length > 0) {
			// Batch check which issue IDs still exist in Linear
			const liveIssues = await getIssuesByIds(project.linearApiKey, syncedTasks.map((t) => t.linearIssueId!));
			const liveIssueIds = new Set(liveIssues.map((i) => i.id));

			const staleTasks = syncedTasks.filter((t) => !liveIssueIds.has(t.linearIssueId!));
			for (const task of staleTasks) {
				const objId = task.objectiveId;
				await db.delete(tasks).where(eq(tasks.parentTaskId, task.id));
				await db.delete(tasks).where(eq(tasks.id, task.id));
				deletedTasks++;

				// Delete objective if empty
				const remaining = await db.select().from(tasks).where(eq(tasks.objectiveId, objId));
				if (remaining.length === 0) {
					await db.delete(objectives).where(eq(objectives.id, objId));
				}
			}
		}

		res.json({ clearedObjs, deletedTasks, staleObjectives: staleObjs.map((o) => o.name) });
	} catch (err: any) {
		res.status(500).json({ error: err.message || 'Failed to reconcile' });
	}
});

// POST /projects/:uuid/linear — link Linear API key
router.post('/projects/:uuid/linear', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const { apiKey } = req.body;
	if (!apiKey) { res.status(400).json({ error: 'apiKey required' }); return; }

	const { validateApiKey } = await import('../services/linear');
	const valid = await validateApiKey(apiKey);
	if (!valid) { res.status(400).json({ error: 'Invalid Linear API key' }); return; }

	await db.update(projects).set({ linearApiKey: apiKey, updatedAt: new Date() }).where(eq(projects.uuid, uuid));
	res.json({ ok: true });
});

export default router;
