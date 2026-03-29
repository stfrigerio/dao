import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getAuthToken } from './authToken';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const getHeaders = () => {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const token = getAuthToken();
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return headers;
};

export interface LinearTeam {
	id: string;
	name: string;
	key: string;
}

export interface LinearProject {
	id: string;
	name: string;
	description: string | null;
}

export interface LinearIssue {
	id: string;
	identifier: string;
	title: string;
	description: string | null;
	state: { name: string; color: string; type: string };
	priority: number;
	assignee: { name: string } | null;
	url: string;
}

interface LinearState {
	teams: LinearTeam[];
	projects: Record<string, LinearProject[]>; // keyed by teamId
	issues: Record<string, LinearIssue[]>; // keyed by projectUuid
	loading: boolean;
	error: string | null;

	fetchTeams: () => Promise<void>;
	fetchProjects: (teamId: string) => Promise<void>;
	fetchIssues: (projectUuid: string) => Promise<void>;
	clearError: () => void;
}

export const useLinearStore = create<LinearState>()(
	devtools(
		(set) => ({
			teams: [],
			projects: {},
			issues: {},
			loading: false,
			error: null,

			fetchTeams: async () => {
				set({ loading: true, error: null });
				try {
					const response = await fetch(`${API_BASE_URL}/linear/teams`, {
						headers: getHeaders(),
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const data = await response.json();
					set({ teams: data, loading: false });
				} catch (error) {
					set({
						loading: false,
						error: error instanceof Error ? error.message : 'Unknown error',
					});
				}
			},

			fetchProjects: async (teamId) => {
				set({ loading: true, error: null });
				try {
					const response = await fetch(
						`${API_BASE_URL}/linear/projects?teamId=${teamId}`,
						{ headers: getHeaders() }
					);
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const data = await response.json();
					set((state) => ({
						projects: { ...state.projects, [teamId]: data },
						loading: false,
					}));
				} catch (error) {
					set({
						loading: false,
						error: error instanceof Error ? error.message : 'Unknown error',
					});
				}
			},

			fetchIssues: async (projectUuid) => {
				set({ loading: true, error: null });
				try {
					const response = await fetch(
						`${API_BASE_URL}/projects/${projectUuid}/linear/issues`,
						{ headers: getHeaders() }
					);
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const data = await response.json();
					set((state) => ({
						issues: { ...state.issues, [projectUuid]: data },
						loading: false,
					}));
				} catch (error) {
					set({
						loading: false,
						error: error instanceof Error ? error.message : 'Unknown error',
					});
				}
			},

			clearError: () => set({ error: null }),
		}),
		{ name: 'LinearStore' }
	)
);
