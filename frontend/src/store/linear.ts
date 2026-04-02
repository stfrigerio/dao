import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getAuthToken, authFetch } from './authToken';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const getHeaders = () => {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const token = getAuthToken();
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return headers;
};

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
	issues: Record<string, LinearIssue[]>; // keyed by projectUuid
	loading: boolean;
	error: string | null;

	fetchIssues: (projectUuid: string) => Promise<void>;
	syncObjective: (projectUuid: string, objectiveUuid: string) => Promise<boolean>;
	syncExecutionToLinear: (projectUuid: string) => Promise<boolean>;
	reconcile: (projectUuid: string) => Promise<number>;
	pullStatus: (projectUuid: string) => Promise<void>;
	clearError: () => void;
}

export const useLinearStore = create<LinearState>()(
	devtools(
		(set) => ({
			issues: {},
			loading: false,
			error: null,

			fetchIssues: async (projectUuid) => {
				set({ loading: true, error: null });
				try {
					const response = await authFetch(
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

			syncObjective: async (projectUuid, objectiveUuid) => {
				try {
					const res = await authFetch(
						`${API_BASE_URL}/projects/${projectUuid}/objectives/${objectiveUuid}/sync-linear`,
						{ method: 'POST', headers: getHeaders() }
					);
					if (!res.ok) {
						const body = await res.json().catch(() => ({}));
						throw new Error(body.error || `HTTP ${res.status}`);
					}
					return true;
				} catch (error) {
					set({ error: error instanceof Error ? error.message : 'Unknown error' });
					return false;
				}
			},

			syncExecutionToLinear: async (projectUuid) => {
				try {
					const res = await authFetch(
						`${API_BASE_URL}/projects/${projectUuid}/sync-execution-to-linear`,
						{ method: 'POST', headers: getHeaders() }
					);
					if (!res.ok) {
						const body = await res.json().catch(() => ({}));
						throw new Error(body.error || `HTTP ${res.status}`);
					}
					return true;
				} catch (error) {
					set({ error: error instanceof Error ? error.message : 'Unknown error' });
					return false;
				}
			},

			reconcile: async (projectUuid) => {
				try {
					const res = await authFetch(
						`${API_BASE_URL}/projects/${projectUuid}/linear/reconcile`,
						{ method: 'POST', headers: getHeaders() }
					);
					if (!res.ok) return 0;
					const { cleared } = await res.json();
					return cleared as number;
				} catch {
					return 0;
				}
			},

			pullStatus: async (projectUuid) => {
				try {
					await authFetch(
						`${API_BASE_URL}/projects/${projectUuid}/linear/pull-status`,
						{ method: 'POST', headers: getHeaders() }
					);
				} catch {
					// silent — best-effort sync
				}
			},

			clearError: () => set({ error: null }),
		}),
		{ name: 'LinearStore' }
	)
);
