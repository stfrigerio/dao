import { pgTable, serial, uuid, text, integer, timestamp, primaryKey, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	uuid: uuid('uuid').default(sql`gen_random_uuid()`).unique().notNull(),
	email: text('email').unique().notNull(),
	name: text('name').notNull(),
	passwordHash: text('password_hash').notNull(),
	role: text('role').notNull().default('member'), // 'admin' | 'member'
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const projects = pgTable('projects', {
	id: serial('id').primaryKey(),
	uuid: uuid('uuid').default(sql`gen_random_uuid()`).unique().notNull(),
	name: text('name').notNull(),
	description: text('description'),
	type: text('type').notNull().default('professional'), // 'professional' | 'personal'
	status: text('status').notNull().default('active'), // 'active' | 'archived'
	ownerId: integer('owner_id').references(() => users.id),
	linearApiKey: text('linear_api_key'),
	currentPhaseId: integer('current_phase_id'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const projectMembers = pgTable(
	'project_members',
	{
		projectId: integer('project_id')
			.references(() => projects.id, { onDelete: 'cascade' })
			.notNull(),
		userId: integer('user_id')
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull(),
		role: text('role').notNull().default('member'), // 'owner' | 'member' | 'viewer'
	},
	(t) => ({ pk: primaryKey({ columns: [t.projectId, t.userId] }) })
);

export const phases = pgTable('phases', {
	id: serial('id').primaryKey(),
	uuid: uuid('uuid').default(sql`gen_random_uuid()`).unique().notNull(),
	projectId: integer('project_id')
		.references(() => projects.id, { onDelete: 'cascade' })
		.notNull(),
	name: text('name').notNull(),
	orderIndex: integer('order_index').notNull(),
	description: text('description'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const objectives = pgTable('objectives', {
	id: serial('id').primaryKey(),
	uuid: uuid('uuid').default(sql`gen_random_uuid()`).unique().notNull(),
	phaseId: integer('phase_id')
		.references(() => phases.id, { onDelete: 'cascade' })
		.notNull(),
	name: text('name').notNull(),
	description: text('description'),
	orderIndex: integer('order_index').notNull().default(0),
	completed: boolean('completed').notNull().default(false),
	linearProjectId: text('linear_project_id'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const tasks = pgTable('tasks', {
	id: serial('id').primaryKey(),
	uuid: uuid('uuid').default(sql`gen_random_uuid()`).unique().notNull(),
	objectiveId: integer('objective_id')
		.references(() => objectives.id, { onDelete: 'cascade' })
		.notNull(),
	parentTaskId: integer('parent_task_id'),
	name: text('name').notNull(),
	description: text('description'),
	completed: boolean('completed').notNull().default(false),
	linearIssueId: text('linear_issue_id'),
	orderIndex: integer('order_index').notNull().default(0),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const documents = pgTable('documents', {
	id: serial('id').primaryKey(),
	uuid: uuid('uuid').default(sql`gen_random_uuid()`).unique().notNull(),
	projectId: integer('project_id')
		.references(() => projects.id, { onDelete: 'cascade' })
		.notNull(),
	phaseId: integer('phase_id').references(() => phases.id),
	objectiveId: integer('objective_id').references(() => objectives.id, { onDelete: 'set null' }),
	name: text('name').notNull(),
	content: text('content'),
	type: text('type').notNull().default('note'), // 'note' | 'file' | 'link'
	url: text('url'),
	createdBy: integer('created_by').references(() => users.id),
	humanReviewed: boolean('human_reviewed').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
