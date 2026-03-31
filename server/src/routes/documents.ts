import { Router } from 'express';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { db } from '../db';
import { documents, projects } from '../db/schema';
import { requireAuth, type AuthRequest } from '../middleware/auth';

const uploadsDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
	destination: uploadsDir,
	filename: (_req, file, cb) => {
		const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		cb(null, `${unique}-${file.originalname}`);
	},
});
const upload = multer({ storage });

const router = Router();

// GET /projects/:uuid/documents
router.get('/projects/:uuid/documents', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [project] = await db.select().from(projects).where(eq(projects.uuid, uuid));
	if (!project) {
		res.status(404).json({ error: 'Project not found' });
		return;
	}
	const docs = await db
		.select()
		.from(documents)
		.where(eq(documents.projectId, project.id))
		.orderBy(documents.createdAt);
	res.json(docs);
});

// POST /projects/:uuid/documents
router.post('/projects/:uuid/documents', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [project] = await db.select().from(projects).where(eq(projects.uuid, uuid));
	if (!project) {
		res.status(404).json({ error: 'Project not found' });
		return;
	}
	const { name, content, type = 'note', url, phaseId } = req.body;
	if (!name) {
		res.status(400).json({ error: 'name required' });
		return;
	}
	const [doc] = await db
		.insert(documents)
		.values({
			projectId: project.id,
			phaseId,
			name,
			content,
			type,
			url,
			createdBy: req.user!.userId,
		})
		.returning();
	res.status(201).json(doc);
});

// POST /projects/:uuid/documents/upload
router.post('/projects/:uuid/documents/upload', requireAuth, upload.single('file'), async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [project] = await db.select().from(projects).where(eq(projects.uuid, uuid));
	if (!project) {
		res.status(404).json({ error: 'Project not found' });
		return;
	}
	if (!req.file) {
		res.status(400).json({ error: 'file required' });
		return;
	}
	const { phaseId } = req.body;
	const [doc] = await db
		.insert(documents)
		.values({
			projectId: project.id,
			phaseId: phaseId ? Number(phaseId) : undefined,
			name: req.file.originalname,
			type: 'file',
			url: `/uploads/${req.file.filename}`,
			createdBy: req.user!.userId,
		})
		.returning();
	res.status(201).json(doc);
});

// PATCH /documents/:uuid
router.patch('/documents/:uuid', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const { content, humanReviewed, name } = req.body;
	if (content === undefined && humanReviewed === undefined && name === undefined) {
		res.status(400).json({ error: 'content, humanReviewed, or name required' });
		return;
	}
	const update: Record<string, unknown> = {};
	if (content !== undefined) update.content = content;
	if (humanReviewed !== undefined) update.humanReviewed = humanReviewed;
	if (name !== undefined) update.name = name;

	// Auto-mark questions docs as reviewed when all answers are filled in
	if (content !== undefined && humanReviewed === undefined) {
		const [existing] = await db.select({ name: documents.name }).from(documents).where(eq(documents.uuid, uuid));
		if (existing?.name.startsWith('Questions: ')) {
			const allAnswered = !content.includes('_answer here_');
			update.humanReviewed = allAnswered;
		}
	}

	const [doc] = await db
		.update(documents)
		.set(update)
		.where(eq(documents.uuid, uuid))
		.returning();
	if (!doc) {
		res.status(404).json({ error: 'Document not found' });
		return;
	}
	res.json(doc);
});

// DELETE /documents/:uuid
router.delete('/documents/:uuid', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [doc] = await db
		.delete(documents)
		.where(eq(documents.uuid, uuid))
		.returning();
	if (!doc) {
		res.status(404).json({ error: 'Document not found' });
		return;
	}
	res.json({ ok: true });
});

export default router;
