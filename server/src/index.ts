import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import 'dotenv/config';

import authRouter from './routes/auth';
import usersRouter from './routes/users';
import projectsRouter from './routes/projects';
import phasesRouter from './routes/phases';
import documentsRouter from './routes/documents';
import linearRouter from './routes/linear';
import objectivesRouter from './routes/objectives';
import agentJobsRouter from './routes/agentJobs';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:10000,https://dao.stefanofrigerio.dev').split(',');
const isPrivateOrigin = (origin: string) => /^https?:\/\/(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(origin);
app.use(cors({
	origin: (origin, callback) => {
		if (!origin || allowedOrigins.includes(origin) || isPrivateOrigin(origin)) callback(null, true);
		else callback(new Error(`CORS: origin ${origin} not allowed`));
	},
	credentials: true,
}));
app.use(express.json());
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(cookieParser() as any);
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/projects', projectsRouter);
app.use('/api', phasesRouter);
app.use('/api', documentsRouter);
app.use('/api', linearRouter);
app.use('/api', objectivesRouter);
app.use('/api', agentJobsRouter);

app.use(errorHandler);

// Serve frontend build in production
const frontendBuild = path.join(__dirname, '../../frontend/build');
app.use(express.static(frontendBuild));
app.get('*', (_req, res) => {
	res.sendFile(path.join(frontendBuild, 'index.html'));
});

app.listen(Number(PORT), '0.0.0.0', () => {
	console.log(`Server running on http://0.0.0.0:${PORT}`);
});

export default app;
