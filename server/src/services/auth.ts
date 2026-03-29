import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me';

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, 12);

export const comparePassword = (password: string, hash: string): Promise<boolean> =>
	bcrypt.compare(password, hash);

export const signAccessToken = (payload: { userId: number; role: string }): string =>
	jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });

export const signRefreshToken = (payload: { userId: number }): string =>
	jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

export const verifyAccessToken = (token: string): { userId: number; role: string } => {
	return jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
};

export const verifyRefreshToken = (token: string): { userId: number } => {
	return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: number };
};
