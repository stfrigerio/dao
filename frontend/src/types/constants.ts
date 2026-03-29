export const PHASE_STATUSES = {
	todo: 'todo',
	in_progress: 'in_progress',
	done: 'done',
} as const;

export type PhaseStatusKey = keyof typeof PHASE_STATUSES;

export const PROJECT_TYPES = {
	professional: 'professional',
	personal: 'personal',
} as const;

export type ProjectTypeKey = keyof typeof PROJECT_TYPES;

export const PROJECT_STATUSES = {
	active: 'active',
	archived: 'archived',
} as const;

export const USER_ROLES = {
	admin: 'admin',
	member: 'member',
} as const;

export const MEMBER_ROLES = {
	owner: 'owner',
	member: 'member',
	viewer: 'viewer',
} as const;

export const DEFAULT_PHASE_NAMES = ['Discovery', 'Planning', 'Execution', 'Review', 'Done'];
