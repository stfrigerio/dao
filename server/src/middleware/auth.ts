import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/auth';

export interface AuthRequest extends Request {
	user?: { userId: number; role: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
	const authHeader = req.headers.authorization;
	if (!authHeader?.startsWith('Bearer ')) {
		res.status(401).json({ error: 'Unauthorized' });
		return;
	}
	const token = authHeader.slice(7);
	try {
		req.user = verifyAccessToken(token);
		next();
	} catch {
		res.status(401).json({ error: 'Invalid or expired token' });
	}
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
	requireAuth(req, res, () => {
		if (req.user?.role !== 'admin') {
			res.status(403).json({ error: 'Forbidden' });
			return;
		}
		next();
	});
}
