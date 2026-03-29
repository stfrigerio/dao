import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { hashPassword } from '../services/auth';
import { requireAdmin, type AuthRequest } from '../middleware/auth';

const router = Router();

const safeUser = (u: typeof users.$inferSelect) => ({
	id: u.id,
	uuid: u.uuid,
	email: u.email,
	name: u.name,
	role: u.role,
	createdAt: u.createdAt,
});

// GET /users — admin only
router.get('/', requireAdmin, async (_req, res) => {
	const all = await db.select().from(users).orderBy(users.createdAt);
	res.json(all.map(safeUser));
});

// POST /users — admin only
router.post('/', requireAdmin, async (req, res) => {
	const { email, name, password, role = 'member' } = req.body;
	if (!email || !name || !password) {
		res.status(400).json({ error: 'email, name, and password required' });
		return;
	}
	try {
		const passwordHash = await hashPassword(password);
		const [user] = await db
			.insert(users)
			.values({ email, name, passwordHash, role })
			.returning();
		res.status(201).json(safeUser(user));
	} catch (err: any) {
		if (err.code === '23505') {
			res.status(409).json({ error: 'Email already in use' });
			return;
		}
		res.status(500).json({ error: 'Failed to create user' });
	}
});

// PUT /users/:uuid
router.put('/:uuid', requireAdmin, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const { name, email, role } = req.body;
	const updates: Partial<typeof users.$inferInsert> = {};
	if (name) updates.name = name;
	if (email) updates.email = email;
	if (role) updates.role = role;

	const [user] = await db
		.update(users)
		.set(updates)
		.where(eq(users.uuid, uuid))
		.returning();
	if (!user) {
		res.status(404).json({ error: 'User not found' });
		return;
	}
	res.json(safeUser(user));
});

// DELETE /users/:uuid — admin only
router.delete('/:uuid', requireAdmin, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	// Prevent admin from deleting themselves
	const [target] = await db.select().from(users).where(eq(users.uuid, uuid));
	if (!target) {
		res.status(404).json({ error: 'User not found' });
		return;
	}
	if (target.id === req.user!.userId) {
		res.status(400).json({ error: 'Cannot delete your own account' });
		return;
	}
	await db.delete(users).where(eq(users.uuid, uuid));
	res.json({ ok: true });
});

export default router;
