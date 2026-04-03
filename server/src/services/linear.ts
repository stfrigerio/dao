import { LinearClient } from '@linear/sdk';

function getClient(apiKey: string): LinearClient {
	return new LinearClient({ apiKey });
}

// ── Queries ─────────────────────────────────────────────────────────────

export async function getIssues(apiKey: string) {
	const client = getClient(apiKey);
	const issues = await client.issues();
	return issues.nodes.map((i) => ({
		id: i.id,
		identifier: i.identifier,
		title: i.title,
		description: i.description,
		priority: i.priority,
		url: i.url,
	}));
}

export async function getIssuesByIds(apiKey: string, issueIds: string[]): Promise<Array<{ id: string }>> {
	const client = getClient(apiKey);
	const result: Array<{ id: string }> = [];
	for (let i = 0; i < issueIds.length; i += 50) {
		const batch = issueIds.slice(i, i + 50);
		const issues = await client.issues({ filter: { id: { in: batch } }, first: 50 });
		result.push(...issues.nodes.map((n) => ({ id: n.id })));
	}
	return result;
}

export async function getIssueStates(apiKey: string, issueIds: string[]): Promise<Record<string, { completed: boolean; stateName: string }>> {
	const client = getClient(apiKey);
	const result: Record<string, { completed: boolean; stateName: string }> = {};
	for (let i = 0; i < issueIds.length; i += 50) {
		const batch = issueIds.slice(i, i + 50);
		const issues = await client.issues({ filter: { id: { in: batch } }, first: 50 });
		for (const issue of issues.nodes) {
			const state = await issue.state;
			if (state) {
				result[issue.id] = { completed: state.type === 'completed', stateName: state.name };
			}
		}
	}
	return result;
}

export async function getLinearProjects(apiKey: string) {
	const client = getClient(apiKey);
	const projects = await client.projects();
	return projects.nodes.map((p) => ({
		id: p.id,
		name: p.name,
		color: p.color,
		url: p.url,
	}));
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
	try {
		const client = getClient(apiKey);
		await client.viewer;
		return true;
	} catch {
		return false;
	}
}

// ── Project (one per DAO project) ───────────────────────────────────────

// Icon keyword matching for Linear projects
const ICON_KEYWORDS: Array<[string[], string]> = [
	[['auth', 'login', 'password', 'jwt', 'token'], 'Lock'],
	[['user', 'member', 'team', 'people'], 'Users'],
	[['server', 'backend', 'api', 'endpoint', 'route', 'crud'], 'Server'],
	[['frontend', 'ui', 'component', 'page', 'view', 'panel', 'shell'], 'Compass'],
	[['database', 'schema', 'migration', 'data', 'model'], 'Box'],
	[['agent', 'claude', 'ai', 'pipeline', 'prompt'], 'Terminal'],
	[['linear', 'sync', 'integration', 'webhook'], 'Link'],
	[['doc', 'document', 'file', 'upload', 'content'], 'Bookmark'],
	[['deploy', 'infrastructure', 'docker', 'ci', 'production'], 'Cloud'],
	[['phase', 'lifecycle', 'workflow', 'objective', 'task'], 'Folder'],
	[['setting', 'config', 'env'], 'Wrench'],
	[['project', 'manage'], 'Briefcase'],
	[['security', 'permission', 'role', 'admin'], 'Shield'],
];

function pickIcon(name: string): string {
	const lower = name.toLowerCase();
	for (const [keywords, icon] of ICON_KEYWORDS) {
		if (keywords.some((k) => lower.includes(k))) return icon;
	}
	return 'Briefcase';
}

export async function createProject(apiKey: string, name: string, description?: string, color?: string) {
	const icon = pickIcon(name);
	const client = getClient(apiKey);
	const teams = await client.teams();
	const team = teams.nodes[0];
	if (!team) throw new Error('No team found in Linear workspace');
	const payload = await client.createProject({
		teamIds: [team.id],
		name,
		description,
		icon,
		...(color && { color }),
	});
	const project = await payload.project;
	if (!project) throw new Error('Failed to create Linear project');
	return { id: project.id, name: project.name, url: project.url };
}

// ── Milestones (one per DAO objective) ──────────────────────────────────

const MILESTONE_COLORS = [
	'#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
	'#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
	'#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2',
	'#2563eb', '#7c3aed', '#db2777', '#0d9488', '#9ca3af',
];

export function getMilestoneColor(index: number): string {
	return MILESTONE_COLORS[index % MILESTONE_COLORS.length];
}

export async function createMilestone(apiKey: string, projectId: string, name: string, sortOrder?: number) {
	const client = getClient(apiKey);
	const payload = await client.createProjectMilestone({
		projectId,
		name,
		...(sortOrder !== undefined && { sortOrder }),
	});
	const milestone = await payload.projectMilestone;
	if (!milestone) throw new Error('Failed to create milestone');
	return { id: milestone.id, name: milestone.name };
}

// ── Issues (one per DAO task) ───────────────────────────────────────────

export async function createIssue(apiKey: string, title: string, description?: string) {
	const client = getClient(apiKey);
	const teams = await client.teams();
	const team = teams.nodes[0];
	if (!team) throw new Error('No team found in Linear workspace');
	const payload = await client.createIssue({ teamId: team.id, title, description });
	const issue = await payload.issue;
	if (!issue) throw new Error('Failed to create issue');
	return { id: issue.id, identifier: issue.identifier, title: issue.title, url: issue.url };
}

export async function createIssueInProject(
	apiKey: string,
	projectId: string,
	title: string,
	description?: string,
	completed?: boolean,
	parentId?: string,
	milestoneId?: string
) {
	const client = getClient(apiKey);
	const teams = await client.teams();
	const team = teams.nodes[0];
	if (!team) throw new Error('No team found in Linear workspace');

	let stateId: string | undefined;
	if (completed) {
		const states = await team.states();
		const doneState = states.nodes.find((s) => s.type === 'completed');
		if (doneState) stateId = doneState.id;
	}

	const payload = await client.createIssue({
		teamId: team.id,
		projectId,
		title,
		description,
		...(stateId && { stateId }),
		...(parentId && { parentId }),
		...(milestoneId && { projectMilestoneId: milestoneId }),
	});
	const issue = await payload.issue;
	if (!issue) throw new Error('Failed to create issue');
	return { id: issue.id, identifier: issue.identifier, title: issue.title, url: issue.url };
}

export async function updateIssueState(apiKey: string, issueId: string, completed: boolean) {
	const client = getClient(apiKey);
	const issue = await client.issue(issueId);
	const team = await issue.team;
	if (!team) throw new Error('No team found for issue');
	const states = await team.states();
	const targetType = completed ? 'completed' : 'unstarted';
	const targetState = states.nodes.find((s) => s.type === targetType);
	if (!targetState) throw new Error(`No ${targetType} state found`);
	await client.updateIssue(issueId, { stateId: targetState.id });
}

export async function deleteIssue(apiKey: string, issueId: string): Promise<boolean> {
	try {
		const client = getClient(apiKey);
		await client.deleteIssue(issueId);
		return true;
	} catch {
		return false;
	}
}
