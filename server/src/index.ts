import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
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

app.use(cors({
	origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
	credentials: true,
}));
app.use(express.json());
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(cookieParser() as any);

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/projects', projectsRouter);
app.use('/api', phasesRouter);
app.use('/api', documentsRouter);
app.use('/api', linearRouter);
app.use('/api', objectivesRouter);
app.use('/api', agentJobsRouter);

app.use(errorHandler);

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
