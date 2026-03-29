import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import {
	comparePassword,
	signAccessToken,
	signRefreshToken,
	verifyRefreshToken,
} from '../services/auth';
import { requireAuth, type AuthRequest } from '../middleware/auth';

const router = Router();

// POST /auth/login
router.post('/login', async (req, res) => {
	const { email, password } = req.body;
	if (!email || !password) {
		res.status(400).json({ error: 'Email and password required' });
		return;
	}
	try {
		const [user] = await db.select().from(users).where(eq(users.email, email));
		if (!user) {
			res.status(401).json({ error: 'Invalid credentials' });
			return;
		}
		const valid = await comparePassword(password, user.passwordHash);
		if (!valid) {
			res.status(401).json({ error: 'Invalid credentials' });
			return;
		}
		const accessToken = signAccessToken({ userId: user.id, role: user.role });
		const refreshToken = signRefreshToken({ userId: user.id });

		res.cookie('refreshToken', refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});

		res.json({
			accessToken,
			user: {
				id: user.id,
				uuid: user.uuid,
				email: user.email,
				name: user.name,
				role: user.role,
				createdAt: user.createdAt,
			},
		});
	} catch {
		res.status(500).json({ error: 'Login failed' });
	}
});

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
	const token = req.cookies?.refreshToken;
	if (!token) {
		res.status(401).json({ error: 'No refresh token' });
		return;
	}
	try {
		const { userId } = verifyRefreshToken(token);
		const [user] = await db.select().from(users).where(eq(users.id, userId));
		if (!user) {
			res.status(401).json({ error: 'User not found' });
			return;
		}
		const accessToken = signAccessToken({ userId: user.id, role: user.role });
		res.json({ accessToken });
	} catch {
		res.status(401).json({ error: 'Invalid refresh token' });
	}
});

// POST /auth/logout
router.post('/logout', (_req, res) => {
	res.clearCookie('refreshToken');
	res.json({ ok: true });
});

// GET /auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
	try {
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, req.user!.userId));
		if (!user) {
			res.status(404).json({ error: 'User not found' });
			return;
		}
		res.json({
			id: user.id,
			uuid: user.uuid,
			email: user.email,
			name: user.name,
			role: user.role,
			createdAt: user.createdAt,
		});
	} catch {
		res.status(500).json({ error: 'Failed to fetch user' });
	}
});

export default router;
