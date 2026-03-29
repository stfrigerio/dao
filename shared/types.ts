// Shared types between frontend and server (no runtime imports)

export type UserRole = 'admin' | 'member';
export type ProjectType = 'professional' | 'personal';
export type ProjectStatus = 'active' | 'archived';
export type MemberRole = 'owner' | 'member' | 'viewer';
export type DocumentType = 'note' | 'file' | 'link';

export interface User {
	id: number;
	uuid: string;
	email: string;
	name: string;
	role: UserRole;
	createdAt: string;
}

export interface Project {
	id: number;
	uuid: string;
	name: string;
	description: string | null;
	type: ProjectType;
	status: ProjectStatus;
	ownerId: number | null;
	linearTeamId: string | null;
	linearProjectId: string | null;
	currentPhaseUuid: string | null;
	createdAt: string;
	updatedAt: string;
	// Computed
	members?: ProjectMember[];
	phases?: Phase[];
}

export interface ProjectMember {
	projectId: number;
	userId: number;
	role: MemberRole;
	user?: User;
}

export interface Phase {
	id: number;
	uuid: string;
	projectId: number;
	name: string;
	orderIndex: number;
	description: string | null;
	createdAt: string;
	updatedAt: string;
	// Computed
	objectives?: Objective[];
}

export interface Objective {
	id: number;
	uuid: string;
	phaseId: number;
	name: string;
	description: string | null;
	orderIndex: number;
	completed: boolean;
	createdAt: string;
	updatedAt: string;
	// Computed
	tasks?: Task[];
}

export interface Task {
	id: number;
	uuid: string;
	objectiveId: number;
	name: string;
	description: string | null;
	completed: boolean;
	orderIndex: number;
	createdAt: string;
	updatedAt: string;
}

export interface Document {
	id: number;
	uuid: string;
	projectId: number;
	phaseId: number | null;
	objectiveId: number | null;
	name: string;
	content: string | null;
	type: DocumentType;
	url: string | null;
	createdBy: number | null;
	humanReviewed: boolean;
	createdAt: string;
}

export interface AuthTokens {
	accessToken: string;
}

export const DEFAULT_PHASES: Array<{ name: string; orderIndex: number }> = [
	{ name: 'Discovery', orderIndex: 0 },
	{ name: 'Planning', orderIndex: 1 },
	{ name: 'Execution', orderIndex: 2 },
	{ name: 'Review', orderIndex: 3 },
	{ name: 'Done', orderIndex: 4 },
];
