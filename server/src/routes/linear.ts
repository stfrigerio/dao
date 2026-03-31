import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { projects, objectives, tasks } from '../db/schema';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { getIssues, createIssue, createProject, createIssueInProject } from '../services/linear';

const router = Router();

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

// POST /projects/:uuid/objectives/:objUuid/sync-linear — sync objective + tasks to Linear
router.post('/projects/:uuid/objectives/:objUuid/sync-linear', requireAuth, async (req: AuthRequest, res) => {
	const projectUuid = req.params['uuid'] as string;
	const objUuid = req.params['objUuid'] as string;
	const [project] = await db.select().from(projects).where(eq(projects.uuid, projectUuid));
	if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
	if (!project.linearApiKey) { res.status(400).json({ error: 'Project not linked to Linear' }); return; }
	const [objective] = await db.select().from(objectives).where(eq(objectives.uuid, objUuid));
	if (!objective) { res.status(404).json({ error: 'Objective not found' }); return; }

	try {
		const linearProject = await createProject(
			project.linearApiKey,
			objective.name,
			objective.description ?? undefined
		);

		const objTasks = await db.select().from(tasks).where(eq(tasks.objectiveId, objective.id)).orderBy(tasks.orderIndex);
		const createdIssues = [];
		for (const task of objTasks) {
			const issue = await createIssueInProject(
				project.linearApiKey,
				linearProject.id,
				task.name,
				task.description ?? undefined,
				task.completed
			);
			createdIssues.push(issue);
		}

		res.status(201).json({
			project: linearProject,
			issues: createdIssues,
		});
	} catch (err: any) {
		res.status(500).json({ error: err.message || 'Failed to sync to Linear' });
	}
});

// POST /linear/webhook — handle Linear webhooks
router.post('/linear/webhook', async (req, res) => {
	const { type, action, data } = req.body;
	console.log(`Linear webhook: ${type} ${action}`, data?.id);
	res.json({ ok: true });
});

export default router;
