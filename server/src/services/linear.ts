import { LinearClient } from '@linear/sdk';

function getClient(apiKey?: string): LinearClient {
	const key = apiKey || process.env.LINEAR_API_KEY;
	if (!key) throw new Error('LINEAR_API_KEY not configured');
	return new LinearClient({ apiKey: key });
}

export async function getTeams(apiKey?: string) {
	const client = getClient(apiKey);
	const teams = await client.teams();
	return teams.nodes.map((t) => ({ id: t.id, name: t.name, key: t.key }));
}

export async function getProjects(teamId: string, apiKey?: string) {
	const client = getClient(apiKey);
	const team = await client.team(teamId);
	const projects = await team.projects();
	return projects.nodes.map((p) => ({ id: p.id, name: p.name, description: p.description }));
}

export async function getIssues(teamId: string, projectId?: string, apiKey?: string) {
	const client = getClient(apiKey);

	const filter: Record<string, unknown> = { team: { id: { eq: teamId } } };
	if (projectId) filter.project = { id: { eq: projectId } };

	const issues = await client.issues({ filter });
	return issues.nodes.map((i) => ({
		id: i.id,
		identifier: i.identifier,
		title: i.title,
		description: i.description,
		priority: i.priority,
		url: i.url,
	}));
}

export async function createIssue(
	teamId: string,
	title: string,
	description?: string,
	projectId?: string,
	apiKey?: string
) {
	const client = getClient(apiKey);
	const payload = await client.createIssue({
		teamId,
		title,
		description,
		projectId,
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
