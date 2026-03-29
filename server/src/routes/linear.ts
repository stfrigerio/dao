import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { projects } from '../db/schema';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { getTeams, getProjects, getIssues, createIssue } from '../services/linear';

const router = Router();

// GET /linear/teams
router.get('/linear/teams', requireAuth, async (_req, res) => {
	try {
		const teams = await getTeams();
		res.json(teams);
	} catch (err: any) {
		res.status(500).json({ error: err.message || 'Failed to fetch Linear teams' });
	}
});

// GET /linear/projects?teamId=
router.get('/linear/projects', requireAuth, async (req: AuthRequest, res) => {
	const teamId = req.query['teamId'] as string | undefined;
	if (!teamId) {
		res.status(400).json({ error: 'teamId required' });
		return;
	}
	try {
		const linearProjects = await getProjects(teamId);
		res.json(linearProjects);
	} catch (err: any) {
		res.status(500).json({ error: err.message || 'Failed to fetch Linear projects' });
	}
});

// GET /projects/:uuid/linear/issues
router.get('/projects/:uuid/linear/issues', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [project] = await db.select().from(projects).where(eq(projects.uuid, uuid));
	if (!project) {
		res.status(404).json({ error: 'Project not found' });
		return;
	}
	if (!project.linearTeamId) {
		res.status(400).json({ error: 'Project not linked to Linear' });
		return;
	}
	try {
		const issues = await getIssues(project.linearTeamId, project.linearProjectId ?? undefined);
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
	if (!project.linearTeamId) {
		res.status(400).json({ error: 'Project not linked to Linear' });
		return;
	}
	const { title, description } = req.body;
	if (!title) {
		res.status(400).json({ error: 'title required' });
		return;
	}
	try {
		const issue = await createIssue(
			project.linearTeamId,
			title,
			description,
			project.linearProjectId ?? undefined
		);
		res.status(201).json(issue);
	} catch (err: any) {
		res.status(500).json({ error: err.message || 'Failed to create Linear issue' });
	}
});

// POST /linear/webhook — handle Linear webhooks
router.post('/linear/webhook', async (req, res) => {
	const { type, action, data } = req.body;
	console.log(`Linear webhook: ${type} ${action}`, data?.id);
	res.json({ ok: true });
});

export default router;
