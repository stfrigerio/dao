import { Router } from 'express';
import { eq, isNotNull } from 'drizzle-orm';
import { db } from '../db';
import { projects, objectives, tasks, phases } from '../db/schema';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import {
	getIssues, createIssue, createMilestone, getMilestoneColor,
	createIssueInProject, updateIssueState, getLinearProjects, getIssuesByIds, getIssueStates,
} from '../services/linear';

const router = Router();

// ── Helpers ─────────────────────────────────────────────────────────────

/** Get the workspace-level Linear API key (stored on any project). */
async function getWorkspaceApiKey(): Promise<string | null> {
	const allProjects = await db.select({ linearApiKey: projects.linearApiKey }).from(projects);
	return allProjects.find((p) => p.linearApiKey)?.linearApiKey ?? null;
}

const splitTaskName = (name: string): { title: string; description: string | undefined } => {
	const sep = name.indexOf(' — ');
	if (sep === -1) return { title: name, description: undefined };
	return { title: name.slice(0, sep).trim(), description: name.slice(sep + 3).trim() };
};

/** Sync one objective: create milestone + issues for its tasks. */
async function syncObjectiveToLinear(
	apiKey: string,
	linearProjectId: string,
	objective: typeof objectives.$inferSelect,
	milestoneIndex: number
) {
	// Create or reuse milestone
	let milestoneId = objective.linearMilestoneId;
	if (!milestoneId) {
		const milestone = await createMilestone(apiKey, linearProjectId, objective.name, milestoneIndex);
		milestoneId = milestone.id;
		await db.update(objectives).set({ linearMilestoneId: milestoneId, updatedAt: new Date() }).where(eq(objectives.id, objective.id));
	}

	const objTasks = await db.select().from(tasks).where(eq(tasks.objectiveId, objective.id)).orderBy(tasks.orderIndex);
	const topLevel = objTasks.filter((t) => t.parentTaskId === null);

	// Map task.id → linearIssueId
	const issueIdMap: Record<number, string> = {};
	for (const t of objTasks) {
		if (t.linearIssueId) issueIdMap[t.id] = t.linearIssueId;
	}

	// Batch helper
	const BATCH_SIZE = 5;
	async function processBatch<T>(items: T[], fn: (item: T) => Promise<void>) {
		for (let i = 0; i < items.length; i += BATCH_SIZE) {
			await Promise.all(items.slice(i, i + BATCH_SIZE).map(fn));
		}
	}

	// Sync top-level tasks
	await processBatch(topLevel.filter((t) => !t.linearIssueId), async (task) => {
		const { title, description } = splitTaskName(task.name);
		const desc = [description, task.description].filter(Boolean).join('\n\n');
		const issue = await createIssueInProject(apiKey, linearProjectId, title, desc || undefined, task.completed, undefined, milestoneId!);
		await db.update(tasks).set({ linearIssueId: issue.id }).where(eq(tasks.id, task.id));
		issueIdMap[task.id] = issue.id;
	});

	// Sync subtasks
	await processBatch(objTasks.filter((t) => t.parentTaskId !== null && !t.linearIssueId), async (sub) => {
		const parentLinearId = issueIdMap[sub.parentTaskId!];
		if (!parentLinearId) return;
		const { title, description } = splitTaskName(sub.name);
		const desc = [description, sub.description].filter(Boolean).join('\n\n');
		const issue = await createIssueInProject(apiKey, linearProjectId, title, desc || undefined, sub.completed, parentLinearId, milestoneId!);
		await db.update(tasks).set({ linearIssueId: issue.id }).where(eq(tasks.id, sub.id));
	});

	return { milestoneId };
}

// ── Routes ──────────────────────────────────────────────────────────────

// GET /projects/:uuid/linear/issues
router.get('/projects/:uuid/linear/issues', requireAuth, async (req: AuthRequest, res) => {
	const [project] = await db.select().from(projects).where(eq(projects.uuid, req.params['uuid'] as string));
	if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
	const apiKey = await getWorkspaceApiKey();
	if (!apiKey) { res.status(400).json({ error: 'No Linear workspace connected' }); return; }
	try {
		res.json(await getIssues(apiKey));
	} catch (err: any) {
		res.status(500).json({ error: err.message || 'Failed to fetch issues' });
	}
});

// POST /projects/:uuid/linear/issues
router.post('/projects/:uuid/linear/issues', requireAuth, async (req: AuthRequest, res) => {
	const [project] = await db.select().from(projects).where(eq(projects.uuid, req.params['uuid'] as string));
	if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
	const apiKey = await getWorkspaceApiKey();
	if (!apiKey) { res.status(400).json({ error: 'No Linear workspace connected' }); return; }
	const { title, description } = req.body;
	if (!title) { res.status(400).json({ error: 'title required' }); return; }
	try {
		res.status(201).json(await createIssue(apiKey, title, description));
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

// POST /projects/:uuid/objectives/:objUuid/sync-linear — sync single objective
router.post('/projects/:uuid/objectives/:objUuid/sync-linear', requireAuth, async (req: AuthRequest, res) => {
	const [project] = await db.select().from(projects).where(eq(projects.uuid, req.params['uuid'] as string));
	if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
	const apiKey = await getWorkspaceApiKey();
	if (!apiKey) { res.status(400).json({ error: 'No Linear workspace connected' }); return; }
	if (!project.linearProjectId) { res.status(400).json({ error: 'Project not linked to a Linear project. Link one first.' }); return; }
	const [objective] = await db.select().from(objectives).where(eq(objectives.uuid, req.params['objUuid'] as string));
	if (!objective) { res.status(404).json({ error: 'Objective not found' }); return; }

	try {
		const result = await syncObjectiveToLinear(apiKey, project.linearProjectId, objective, objective.orderIndex);
		res.status(201).json(result);
	} catch (err: any) {
		res.status(500).json({ error: err.message || 'Failed to sync' });
	}
});

// POST /projects/:uuid/sync-execution-to-linear — bulk sync all execution objectives
router.post('/projects/:uuid/sync-execution-to-linear', requireAuth, async (req: AuthRequest, res) => {
	const [project] = await db.select().from(projects).where(eq(projects.uuid, req.params['uuid'] as string));
	if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
	const apiKey = await getWorkspaceApiKey();
	if (!apiKey) { res.status(400).json({ error: 'No Linear workspace connected' }); return; }
	if (!project.linearProjectId) { res.status(400).json({ error: 'Project not linked to a Linear project. Link one first.' }); return; }

	const projectPhases = await db.select().from(phases).where(eq(phases.projectId, project.id));
	const executionPhase = projectPhases.find((p) => p.name.toLowerCase().includes('execution'));
	if (!executionPhase) { res.status(404).json({ error: 'Execution phase not found' }); return; }

	const objs = await db.select().from(objectives).where(eq(objectives.phaseId, executionPhase.id)).orderBy(objectives.orderIndex);

	try {
		const results = [];
		const errors = [];
		for (let i = 0; i < objs.length; i++) {
			try {
				const result = await syncObjectiveToLinear(apiKey, project.linearProjectId, objs[i], i);
				results.push({ objective: objs[i].name, ...result });
			} catch (err: any) {
				errors.push({ objective: objs[i].name, error: err.message });
			}
		}
		res.status(errors.length === objs.length ? 500 : 201).json({
			synced: results.length, failed: errors.length, objectives: results,
			...(errors.length > 0 && { errors }),
		});
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

// POST /projects/:uuid/linear/pull-status
router.post('/projects/:uuid/linear/pull-status', requireAuth, async (req: AuthRequest, res) => {
	const [project] = await db.select().from(projects).where(eq(projects.uuid, req.params['uuid'] as string));
	if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
	const apiKey = await getWorkspaceApiKey();
	if (!apiKey) { res.status(400).json({ error: 'No Linear workspace connected' }); return; }

	try {
		const projectPhases = await db.select().from(phases).where(eq(phases.projectId, project.id));
		const phaseIds = projectPhases.map((p) => p.id);
		const allObjs = await db.select().from(objectives).where(isNotNull(objectives.linearMilestoneId));
		const projectObjs = allObjs.filter((o) => phaseIds.includes(o.phaseId));

		const syncedTasks = [];
		for (const obj of projectObjs) {
			const objTasks = await db.select().from(tasks).where(eq(tasks.objectiveId, obj.id));
			syncedTasks.push(...objTasks.filter((t) => t.linearIssueId));
		}
		if (syncedTasks.length === 0) { res.json({ updated: 0 }); return; }

		const states = await getIssueStates(apiKey, syncedTasks.map((t) => t.linearIssueId!));
		let updated = 0;
		for (const task of syncedTasks) {
			const state = states[task.linearIssueId!];
			if (!state) continue;
			if (task.completed !== state.completed) {
				await db.update(tasks).set({ completed: state.completed, updatedAt: new Date() }).where(eq(tasks.id, task.id));
				updated++;
			}
		}
		for (const obj of projectObjs) {
			const objTasks = await db.select().from(tasks).where(eq(tasks.objectiveId, obj.id));
			const allDone = objTasks.length > 0 && objTasks.every((t) => t.completed);
			if (obj.completed !== allDone) {
				await db.update(objectives).set({ completed: allDone, updatedAt: new Date() }).where(eq(objectives.id, obj.id));
			}
		}
		res.json({ updated, total: syncedTasks.length });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

// POST /linear/webhook — bidirectional sync
router.post('/linear/webhook', async (req, res) => {
	const { type, action, data, updatedFrom } = req.body;

	try {
		// Linear project deleted → clear DAO project mapping
		if (type === 'Project' && action === 'remove' && data?.id) {
			await db.update(projects).set({ linearProjectId: null, updatedAt: new Date() }).where(eq(projects.linearProjectId, data.id));
			// Also clear milestones and issues under that project
			const affectedObjs = await db.select().from(objectives).where(isNotNull(objectives.linearMilestoneId));
			// We can't easily filter by Linear project here, so just ack
			res.json({ ok: true });
			return;
		}

		// Issue state/title changes
		if (type === 'Issue' && action === 'update' && data?.id) {
			const [task] = await db.select().from(tasks).where(eq(tasks.linearIssueId, data.id));
			if (!task) { res.json({ ok: true }); return; }

			if (updatedFrom?.stateId !== undefined && data.state) {
				if (data.state.type === 'canceled') {
					const objId = task.objectiveId;
					await db.delete(tasks).where(eq(tasks.parentTaskId, task.id));
					await db.delete(tasks).where(eq(tasks.id, task.id));
					const remaining = await db.select().from(tasks).where(eq(tasks.objectiveId, objId));
					if (remaining.length === 0) {
						await db.delete(objectives).where(eq(objectives.id, objId));
					} else {
						const allDone = remaining.filter((t) => t.parentTaskId === null).every((t) => t.completed);
						await db.update(objectives).set({ completed: allDone, updatedAt: new Date() }).where(eq(objectives.id, objId));
					}
				} else {
					const completed = data.state.type === 'completed';
					if (task.completed !== completed) {
						await db.update(tasks).set({ completed, updatedAt: new Date() }).where(eq(tasks.id, task.id));
						const siblingTasks = await db.select().from(tasks).where(eq(tasks.objectiveId, task.objectiveId));
						const allDone = siblingTasks.every((t) => (t.id === task.id ? completed : t.completed));
						await db.update(objectives).set({ completed: allDone, updatedAt: new Date() }).where(eq(objectives.id, task.objectiveId));
					}
				}
			}

			if (updatedFrom?.title !== undefined && data.title && task.name !== data.title) {
				await db.update(tasks).set({ name: data.title, updatedAt: new Date() }).where(eq(tasks.id, task.id));
			}
		}

		// Issue deleted → delete DAO task
		if (type === 'Issue' && action === 'remove' && data?.id) {
			const [task] = await db.select().from(tasks).where(eq(tasks.linearIssueId, data.id));
			if (task) {
				const objId = task.objectiveId;
				await db.delete(tasks).where(eq(tasks.parentTaskId, task.id));
				await db.delete(tasks).where(eq(tasks.id, task.id));
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

// POST /projects/:uuid/linear/reconcile
router.post('/projects/:uuid/linear/reconcile', requireAuth, async (req: AuthRequest, res) => {
	const [project] = await db.select().from(projects).where(eq(projects.uuid, req.params['uuid'] as string));
	if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
	const apiKey = await getWorkspaceApiKey();
	if (!apiKey) { res.status(400).json({ error: 'No Linear workspace connected' }); return; }

	try {
		const projectPhases = await db.select().from(phases).where(eq(phases.projectId, project.id));
		const phaseIds = projectPhases.map((p) => p.id);

		// Check if Linear project still exists
		const linearProjects = await getLinearProjects(apiKey);
		const liveProjectIds = new Set(linearProjects.map((p) => p.id));
		if (project.linearProjectId && !liveProjectIds.has(project.linearProjectId)) {
			await db.update(projects).set({ linearProjectId: null, updatedAt: new Date() }).where(eq(projects.id, project.id));
		}

		// Check stale milestone mappings + issue mappings
		const allObjs = await db.select().from(objectives).where(isNotNull(objectives.linearMilestoneId));
		const projectObjs = allObjs.filter((o) => phaseIds.includes(o.phaseId));

		// Collect all synced tasks
		const allSyncedTasks = [];
		for (const obj of projectObjs) {
			const objTasks = await db.select().from(tasks).where(eq(tasks.objectiveId, obj.id));
			allSyncedTasks.push(...objTasks.filter((t) => t.linearIssueId));
		}

		let deletedTasks = 0;
		if (allSyncedTasks.length > 0) {
			const liveIssues = await getIssuesByIds(apiKey, allSyncedTasks.map((t) => t.linearIssueId!));
			const liveIssueIds = new Set(liveIssues.map((i) => i.id));

			for (const task of allSyncedTasks.filter((t) => !liveIssueIds.has(t.linearIssueId!))) {
				await db.delete(tasks).where(eq(tasks.parentTaskId, task.id));
				await db.delete(tasks).where(eq(tasks.id, task.id));
				deletedTasks++;
				const remaining = await db.select().from(tasks).where(eq(tasks.objectiveId, task.objectiveId));
				if (remaining.length === 0) {
					await db.delete(objectives).where(eq(objectives.id, task.objectiveId));
				}
			}
		}

		res.json({ deletedTasks });
	} catch (err: any) {
		res.status(500).json({ error: err.message || 'Failed to reconcile' });
	}
});

// POST /projects/:uuid/linear/unlink — unlink project from Linear project
router.post('/projects/:uuid/linear/unlink', requireAuth, async (req: AuthRequest, res) => {
	const [project] = await db.select().from(projects).where(eq(projects.uuid, req.params['uuid'] as string));
	if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
	await db.update(projects).set({ linearProjectId: null, updatedAt: new Date() }).where(eq(projects.id, project.id));
	// Clear sync mappings for this project's objectives/tasks
	const projectPhases = await db.select().from(phases).where(eq(phases.projectId, project.id));
	for (const phase of projectPhases) {
		const objs = await db.select().from(objectives).where(eq(objectives.phaseId, phase.id));
		for (const obj of objs) {
			await db.update(tasks).set({ linearIssueId: null, updatedAt: new Date() }).where(eq(tasks.objectiveId, obj.id));
		}
		await db.update(objectives).set({ linearMilestoneId: null, updatedAt: new Date() }).where(eq(objectives.phaseId, phase.id));
	}
	res.json({ ok: true });
});

// POST /projects/:uuid/linear — link project to a Linear project
router.post('/projects/:uuid/linear', requireAuth, async (req: AuthRequest, res) => {
	const { linearProjectId } = req.body;
	if (!linearProjectId) { res.status(400).json({ error: 'linearProjectId required' }); return; }
	const apiKey = await getWorkspaceApiKey();
	if (!apiKey) { res.status(400).json({ error: 'No Linear workspace connected. Configure in Settings first.' }); return; }
	const [project] = await db.select().from(projects).where(eq(projects.uuid, req.params['uuid'] as string));
	if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
	await db.update(projects).set({ linearProjectId, updatedAt: new Date() }).where(eq(projects.id, project.id));
	res.json({ ok: true });
});

// GET /settings/linear/projects — list Linear projects from workspace
router.get('/settings/linear/projects', requireAuth, async (_req: AuthRequest, res) => {
	const apiKey = await getWorkspaceApiKey();
	if (!apiKey) { res.status(400).json({ error: 'No Linear workspace connected' }); return; }
	try {
		res.json(await getLinearProjects(apiKey));
	} catch (err: any) {
		res.status(500).json({ error: err.message || 'Failed to fetch projects' });
	}
});

// GET /settings/linear — check Linear connection status
router.get('/settings/linear', requireAuth, async (_req: AuthRequest, res) => {
	const apiKey = await getWorkspaceApiKey();
	if (!apiKey) { res.json({ connected: false }); return; }
	try {
		const { LinearClient } = await import('@linear/sdk');
		const client = new LinearClient({ apiKey });
		const org = await client.organization;
		res.json({
			connected: true,
			workspace: { name: org.name, url: `https://linear.app/${org.urlKey}` },
		});
	} catch {
		res.json({ connected: true, workspace: null });
	}
});

// POST /settings/linear — set Linear API key globally
router.post('/settings/linear', requireAuth, async (req: AuthRequest, res) => {
	const { apiKey } = req.body;
	if (!apiKey) { res.status(400).json({ error: 'apiKey required' }); return; }
	const { validateApiKey } = await import('../services/linear');
	const valid = await validateApiKey(apiKey);
	if (!valid) { res.status(400).json({ error: 'Invalid Linear API key' }); return; }
	await db.update(projects).set({ linearApiKey: apiKey, updatedAt: new Date() });
	// Return workspace info
	try {
		const { LinearClient } = await import('@linear/sdk');
		const client = new LinearClient({ apiKey });
		const org = await client.organization;
		res.json({ ok: true, workspace: { name: org.name, url: `https://linear.app/${org.urlKey}` } });
	} catch {
		res.json({ ok: true, workspace: null });
	}
});

// DELETE /settings/linear — unlink Linear from all projects
router.delete('/settings/linear', requireAuth, async (_req: AuthRequest, res) => {
	await db.update(projects).set({ linearApiKey: null, linearProjectId: null, updatedAt: new Date() });
	await db.update(objectives).set({ linearMilestoneId: null, updatedAt: new Date() }).where(isNotNull(objectives.linearMilestoneId));
	await db.update(tasks).set({ linearIssueId: null, updatedAt: new Date() }).where(isNotNull(tasks.linearIssueId));
	res.json({ ok: true });
});

export default router;
