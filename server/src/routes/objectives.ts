import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { objectives, tasks, phases } from '../db/schema';
import { requireAuth, type AuthRequest } from '../middleware/auth';

const router = Router();

// GET /phases/:uuid/objectives  (includes tasks)
router.get('/phases/:uuid/objectives', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [phase] = await db.select().from(phases).where(eq(phases.uuid, uuid));
	if (!phase) {
		res.status(404).json({ error: 'Phase not found' });
		return;
	}
	const objs = await db
		.select()
		.from(objectives)
		.where(eq(objectives.phaseId, phase.id))
		.orderBy(objectives.orderIndex);

	const result = await Promise.all(
		objs.map(async (obj) => {
			const objTasks = await db
				.select()
				.from(tasks)
				.where(eq(tasks.objectiveId, obj.id))
				.orderBy(tasks.orderIndex);
			return { ...obj, tasks: objTasks };
		})
	);
	res.json(result);
});

// POST /phases/:uuid/objectives
router.post('/phases/:uuid/objectives', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [phase] = await db.select().from(phases).where(eq(phases.uuid, uuid));
	if (!phase) {
		res.status(404).json({ error: 'Phase not found' });
		return;
	}
	const { name, description, orderIndex = 0 } = req.body;
	if (!name) {
		res.status(400).json({ error: 'name required' });
		return;
	}
	const [obj] = await db
		.insert(objectives)
		.values({ phaseId: phase.id, name, description, orderIndex })
		.returning();
	res.status(201).json({ ...obj, tasks: [] });
});

// PUT /objectives/:uuid
router.put('/objectives/:uuid', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const { name, description } = req.body;
	const updates: Partial<typeof objectives.$inferInsert> = { updatedAt: new Date() };
	if (name !== undefined) updates.name = name;
	if (description !== undefined) updates.description = description;

	const [obj] = await db
		.update(objectives)
		.set(updates)
		.where(eq(objectives.uuid, uuid))
		.returning();
	if (!obj) {
		res.status(404).json({ error: 'Objective not found' });
		return;
	}
	res.json(obj);
});

// PATCH /objectives/:uuid/complete
router.patch('/objectives/:uuid/complete', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const { completed } = req.body;
	const [obj] = await db
		.update(objectives)
		.set({ completed: Boolean(completed), updatedAt: new Date() })
		.where(eq(objectives.uuid, uuid))
		.returning();
	if (!obj) {
		res.status(404).json({ error: 'Objective not found' });
		return;
	}
	res.json(obj);
});

// DELETE /objectives/:uuid
router.delete('/objectives/:uuid', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [obj] = await db.delete(objectives).where(eq(objectives.uuid, uuid)).returning();
	if (!obj) {
		res.status(404).json({ error: 'Objective not found' });
		return;
	}
	res.json({ ok: true });
});

// POST /objectives/:uuid/tasks
router.post('/objectives/:uuid/tasks', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [obj] = await db.select().from(objectives).where(eq(objectives.uuid, uuid));
	if (!obj) {
		res.status(404).json({ error: 'Objective not found' });
		return;
	}
	const { name, description, orderIndex = 0 } = req.body;
	if (!name) {
		res.status(400).json({ error: 'name required' });
		return;
	}
	const [task] = await db
		.insert(tasks)
		.values({ objectiveId: obj.id, name, description, orderIndex })
		.returning();
	res.status(201).json(task);
});

// PATCH /tasks/:uuid/complete
router.patch('/tasks/:uuid/complete', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const { completed } = req.body;
	const [task] = await db
		.update(tasks)
		.set({ completed: Boolean(completed), updatedAt: new Date() })
		.where(eq(tasks.uuid, uuid))
		.returning();
	if (!task) {
		res.status(404).json({ error: 'Task not found' });
		return;
	}

	res.json(task);

	// Auto-complete objective when all its tasks are done (fire-and-forget after response)
	(async () => {
		const siblingTasks = await db.select().from(tasks).where(eq(tasks.objectiveId, task.objectiveId));
		const allDone = siblingTasks.every((t) => t.completed);
		await db.update(objectives).set({ completed: allDone, updatedAt: new Date() }).where(eq(objectives.id, task.objectiveId));
	})().catch(() => {});
});

// PUT /tasks/:uuid
router.put('/tasks/:uuid', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const { name, description } = req.body;
	const updates: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
	if (name !== undefined) updates.name = name;
	if (description !== undefined) updates.description = description;

	const [task] = await db
		.update(tasks)
		.set(updates)
		.where(eq(tasks.uuid, uuid))
		.returning();
	if (!task) {
		res.status(404).json({ error: 'Task not found' });
		return;
	}
	res.json(task);
});

// DELETE /tasks/:uuid
router.delete('/tasks/:uuid', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [task] = await db.delete(tasks).where(eq(tasks.uuid, uuid)).returning();
	if (!task) {
		res.status(404).json({ error: 'Task not found' });
		return;
	}
	res.json({ ok: true });
});

export default router;
