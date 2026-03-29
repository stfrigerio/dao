import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { phases, projects } from '../db/schema';
import { requireAuth, type AuthRequest } from '../middleware/auth';

const router = Router();

// GET /projects/:uuid/phases
router.get('/projects/:uuid/phases', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [project] = await db.select().from(projects).where(eq(projects.uuid, uuid));
	if (!project) {
		res.status(404).json({ error: 'Project not found' });
		return;
	}
	const result = await db
		.select()
		.from(phases)
		.where(eq(phases.projectId, project.id))
		.orderBy(phases.orderIndex);
	res.json(result);
});

// POST /projects/:uuid/phases
router.post('/projects/:uuid/phases', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [project] = await db.select().from(projects).where(eq(projects.uuid, uuid));
	if (!project) {
		res.status(404).json({ error: 'Project not found' });
		return;
	}
	const { name, orderIndex, description } = req.body;
	if (name === undefined || orderIndex === undefined) {
		res.status(400).json({ error: 'name and orderIndex required' });
		return;
	}
	const [phase] = await db
		.insert(phases)
		.values({ projectId: project.id, name, orderIndex, description })
		.returning();
	res.status(201).json(phase);
});

// PUT /phases/:uuid
router.put('/phases/:uuid', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const { name, description, orderIndex } = req.body;
	const updates: Partial<typeof phases.$inferInsert> = { updatedAt: new Date() };
	if (name !== undefined) updates.name = name;
	if (description !== undefined) updates.description = description;
	if (orderIndex !== undefined) updates.orderIndex = orderIndex;

	const [phase] = await db
		.update(phases)
		.set(updates)
		.where(eq(phases.uuid, uuid))
		.returning();
	if (!phase) {
		res.status(404).json({ error: 'Phase not found' });
		return;
	}
	res.json(phase);
});

// DELETE /phases/:uuid
router.delete('/phases/:uuid', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [phase] = await db
		.delete(phases)
		.where(eq(phases.uuid, uuid))
		.returning();
	if (!phase) {
		res.status(404).json({ error: 'Phase not found' });
		return;
	}
	res.json({ ok: true });
});

export default router;
