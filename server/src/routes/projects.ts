import { Router } from 'express';
import { eq, and, lt } from 'drizzle-orm';
import { db } from '../db';
import { projects, projectMembers, users, phases, objectives, documents } from '../db/schema';
import { requireAuth, type AuthRequest } from '../middleware/auth';


const router = Router();

// GET /projects
router.get('/', requireAuth, async (req: AuthRequest, res) => {
	try {
		const all = await db
			.select({
				id: projects.id,
				uuid: projects.uuid,
				name: projects.name,
				description: projects.description,
				type: projects.type,
				status: projects.status,
				ownerId: projects.ownerId,
				linearApiKey: projects.linearApiKey,
				currentPhaseUuid: phases.uuid,
				createdAt: projects.createdAt,
				updatedAt: projects.updatedAt,
			})
			.from(projects)
			.leftJoin(phases, eq(projects.currentPhaseId, phases.id))
			.orderBy(projects.updatedAt);
		res.json(all);
	} catch {
		res.status(500).json({ error: 'Failed to fetch projects' });
	}
});

// GET /projects/:uuid
router.get('/:uuid', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	try {
		const [row] = await db
			.select({
				id: projects.id,
				uuid: projects.uuid,
				name: projects.name,
				description: projects.description,
				type: projects.type,
				status: projects.status,
				ownerId: projects.ownerId,
				linearApiKey: projects.linearApiKey,
				currentPhaseUuid: phases.uuid,
				createdAt: projects.createdAt,
				updatedAt: projects.updatedAt,
			})
			.from(projects)
			.leftJoin(phases, eq(projects.currentPhaseId, phases.id))
			.where(eq(projects.uuid, uuid));
		if (!row) {
			res.status(404).json({ error: 'Project not found' });
			return;
		}
		const project = row;

		// Fetch members with user details
		const members = await db
			.select({
				projectId: projectMembers.projectId,
				userId: projectMembers.userId,
				role: projectMembers.role,
				user: {
					id: users.id,
					uuid: users.uuid,
					name: users.name,
					email: users.email,
					role: users.role,
					createdAt: users.createdAt,
				},
			})
			.from(projectMembers)
			.leftJoin(users, eq(projectMembers.userId, users.id))
			.where(eq(projectMembers.projectId, project.id));

		res.json({ ...project, members });
	} catch {
		res.status(500).json({ error: 'Failed to fetch project' });
	}
});

// POST /projects
router.post('/', requireAuth, async (req: AuthRequest, res) => {
	const { name, description, type = 'professional' } = req.body;
	if (!name) {
		res.status(400).json({ error: 'Name required' });
		return;
	}
	try {
		const [project] = await db
			.insert(projects)
			.values({ name, description, type, ownerId: req.user!.userId })
			.returning();

		// Add owner as member
		await db.insert(projectMembers).values({
			projectId: project.id,
			userId: req.user!.userId,
			role: 'owner',
		});

		res.status(201).json(project);
	} catch {
		res.status(500).json({ error: 'Failed to create project' });
	}
});

// PUT /projects/:uuid
router.put('/:uuid', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const { name, description, type, status, currentPhaseUuid } = req.body;
	const updates: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
	if (name !== undefined) updates.name = name;
	if (description !== undefined) updates.description = description;
	if (type !== undefined) updates.type = type;
	if (status !== undefined) updates.status = status;
	if (currentPhaseUuid !== undefined) {
		if (currentPhaseUuid === null) {
			updates.currentPhaseId = null;
		} else {
			const [project] = await db.select().from(projects).where(eq(projects.uuid, uuid));
			if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

			const [targetPhase] = await db.select().from(phases).where(eq(phases.uuid, currentPhaseUuid));
			if (!targetPhase) {
				res.status(404).json({ error: 'Phase not found' });
				return;
			}

			// Gate check: advancing forward requires prior phases to be clean
			const currentPhase = project.currentPhaseId
				? (await db.select().from(phases).where(eq(phases.id, project.currentPhaseId)))[0]
				: null;

			const advancing = !currentPhase || targetPhase.orderIndex > currentPhase.orderIndex;

			if (advancing) {
				const priorPhases = await db
					.select()
					.from(phases)
					.where(and(eq(phases.projectId, project.id), lt(phases.orderIndex, targetPhase.orderIndex)));

				for (const prior of priorPhases) {
					const incomplete = await db
						.select()
						.from(objectives)
						.where(and(eq(objectives.phaseId, prior.id), eq(objectives.completed, false)));
					if (incomplete.length > 0) {
						res.status(422).json({
							error: `Phase "${prior.name}" has ${incomplete.length} incomplete objective${incomplete.length > 1 ? 's' : ''}`,
						});
						return;
					}

					const unreviewed = await db
						.select()
						.from(documents)
						.where(and(eq(documents.phaseId, prior.id), eq(documents.humanReviewed, false)));
					if (unreviewed.length > 0) {
						res.status(422).json({
							error: `Phase "${prior.name}" has ${unreviewed.length} unreviewed document${unreviewed.length > 1 ? 's' : ''}`,
						});
						return;
					}
				}
			}

			updates.currentPhaseId = targetPhase.id;
		}
	}

	const [updated] = await db.update(projects).set(updates).where(eq(projects.uuid, uuid)).returning();
	if (!updated) {
		res.status(404).json({ error: 'Project not found' });
		return;
	}
	const [row] = await db
		.select({
			id: projects.id,
			uuid: projects.uuid,
			name: projects.name,
			description: projects.description,
			type: projects.type,
			status: projects.status,
			ownerId: projects.ownerId,
			linearApiKey: projects.linearApiKey,
			currentPhaseUuid: phases.uuid,
			createdAt: projects.createdAt,
			updatedAt: projects.updatedAt,
		})
		.from(projects)
		.leftJoin(phases, eq(projects.currentPhaseId, phases.id))
		.where(eq(projects.uuid, uuid));
	res.json(row);
});

// DELETE /projects/:uuid
router.delete('/:uuid', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [project] = await db
		.delete(projects)
		.where(eq(projects.uuid, uuid))
		.returning();
	if (!project) {
		res.status(404).json({ error: 'Project not found' });
		return;
	}
	res.json({ ok: true });
});

// GET /projects/:uuid/members
router.get('/:uuid/members', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [project] = await db.select().from(projects).where(eq(projects.uuid, uuid));
	if (!project) {
		res.status(404).json({ error: 'Project not found' });
		return;
	}
	const members = await db
		.select({
			projectId: projectMembers.projectId,
			userId: projectMembers.userId,
			role: projectMembers.role,
			user: {
				id: users.id,
				uuid: users.uuid,
				name: users.name,
				email: users.email,
			},
		})
		.from(projectMembers)
		.leftJoin(users, eq(projectMembers.userId, users.id))
		.where(eq(projectMembers.projectId, project.id));
	res.json(members);
});

// POST /projects/:uuid/members
router.post('/:uuid/members', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const { userId, role = 'member' } = req.body;
	const [project] = await db.select().from(projects).where(eq(projects.uuid, uuid));
	if (!project) {
		res.status(404).json({ error: 'Project not found' });
		return;
	}
	await db
		.insert(projectMembers)
		.values({ projectId: project.id, userId, role })
		.onConflictDoUpdate({
			target: [projectMembers.projectId, projectMembers.userId],
			set: { role },
		});
	res.status(201).json({ ok: true });
});

// DELETE /projects/:uuid/members/:userId
router.delete('/:uuid/members/:userId', requireAuth, async (req: AuthRequest, res) => {
	const uuid = req.params['uuid'] as string;
	const [project] = await db.select().from(projects).where(eq(projects.uuid, uuid));
	if (!project) {
		res.status(404).json({ error: 'Project not found' });
		return;
	}
	await db
		.delete(projectMembers)
		.where(
			and(
				eq(projectMembers.projectId, project.id),
				eq(projectMembers.userId, parseInt(req.params['userId'] as string))
			)
		);
	res.json({ ok: true });
});

export default router;
