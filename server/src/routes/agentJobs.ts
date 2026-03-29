import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { phases } from '../db/schema.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { runDiscoveryAgent, runObjectiveQuestionsAgent, getJob } from '../services/agentRunner.js';

const router = Router();

// POST /phases/:uuid/run-discovery
router.post('/phases/:uuid/run-discovery', requireAuth, async (req: AuthRequest, res, next) => {
	try {
		const phaseUuid = req.params['uuid'] as string;
		const [phase] = await db.select().from(phases).where(eq(phases.uuid, phaseUuid));
		if (!phase) {
			res.status(404).json({ error: 'Phase not found' });
			return;
		}
		const jobId = await runDiscoveryAgent(phaseUuid);
		res.json({ jobId });
	} catch (err) {
		next(err);
	}
});

// POST /objectives/:uuid/generate-questions
router.post('/objectives/:uuid/generate-questions', requireAuth, async (req: AuthRequest, res, next) => {
	try {
		const objectiveUuid = req.params['uuid'] as string;
		const jobId = await runObjectiveQuestionsAgent(objectiveUuid, req.user!.userId);
		res.json({ jobId });
	} catch (err) {
		next(err);
	}
});

// GET /jobs/:jobId
router.get('/jobs/:jobId', requireAuth, (req: AuthRequest, res) => {
	const job = getJob(req.params['jobId'] as string);
	if (!job) {
		res.status(404).json({ error: 'Job not found' });
		return;
	}
	res.json(job);
});

export default router;
