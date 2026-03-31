import { LinearClient } from '@linear/sdk';

function getClient(apiKey: string): LinearClient {
	return new LinearClient({ apiKey });
}

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

export async function createIssue(apiKey: string, title: string, description?: string) {
	const client = getClient(apiKey);
	const teams = await client.teams();
	const team = teams.nodes[0];
	if (!team) throw new Error('No team found in Linear workspace');
	const payload = await client.createIssue({
		teamId: team.id,
		title,
		description,
	});
	const issue = await payload.issue;
	if (!issue) throw new Error('Failed to create issue');
	return {
		id: issue.id,
		identifier: issue.identifier,
		title: issue.title,
		url: issue.url,
	};
}

export async function createProject(apiKey: string, name: string, description?: string) {
	const client = getClient(apiKey);
	const teams = await client.teams();
	const team = teams.nodes[0];
	if (!team) throw new Error('No team found in Linear workspace');
	const payload = await client.createProject({
		teamIds: [team.id],
		name,
		description,
	});
	const project = await payload.project;
	if (!project) throw new Error('Failed to create Linear project');
	return { id: project.id, name: project.name, url: project.url };
}

export async function createIssueInProject(
	apiKey: string,
	projectId: string,
	title: string,
	description?: string,
	completed?: boolean
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
	});
	const issue = await payload.issue;
	if (!issue) throw new Error('Failed to create issue');
	return { id: issue.id, identifier: issue.identifier, title: issue.title, url: issue.url };
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
