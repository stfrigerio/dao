import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Project } from '../../../shared/types';
import { getAuthToken, authFetch } from './authToken';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const CACHE_TTL = 5 * 60 * 1000;

const getHeaders = () => {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const token = getAuthToken();
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return headers;
};

interface ProjectState {
	items: Project[];
	loading: boolean;
	operationLoading: Record<string, boolean>;
	error: string | null;
	lastFetch: number | null;

	fetchAll: () => Promise<void>;
	fetchByUuid: (uuid: string) => Promise<Project | null>;
	upsert: (item: Partial<Project>) => Promise<Project | null>;
	deleteByUuid: (uuid: string) => Promise<void>;
	clearError: () => void;
	clearItems: () => void;
	invalidateCache: () => void;

	setCurrentPhase: (projectUuid: string, phaseUuid: string | null) => Promise<boolean>;
	fetchMembers: (projectUuid: string) => Promise<void>;
	addMember: (projectUuid: string, userId: number, role: string) => Promise<boolean>;
	removeMember: (projectUuid: string, userId: number) => Promise<boolean>;
	linkLinear: (projectUuid: string, apiKey: string) => Promise<boolean>;
}

export const useProjectStore = create<ProjectState>()(
	devtools(
		(set, get) => ({
			items: [],
			loading: false,
			operationLoading: {},
			error: null,
			lastFetch: null,

			fetchAll: async () => {
				const state = get();
				if (state.lastFetch && Date.now() - state.lastFetch < CACHE_TTL) return;

				set({ loading: true, error: null });
				try {
					const response = await authFetch(`${API_BASE_URL}/projects`, {
						headers: getHeaders(),
					});
					if (response.status === 401) {
						set({ loading: false, error: 'Unauthorized' });
						return;
					}
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const data = await response.json();
					set({ items: data, loading: false, lastFetch: Date.now() });
				} catch (error) {
					set({
						loading: false,
						error: error instanceof Error ? error.message : 'Unknown error',
					});
				}
			},

			fetchByUuid: async (uuid) => {
				const opKey = `fetch_${uuid}`;
				set((state) => ({
					operationLoading: { ...state.operationLoading, [opKey]: true },
				}));
				try {
					const response = await authFetch(`${API_BASE_URL}/projects/${uuid}`, {
						headers: getHeaders(),
					});
					if (!response.ok) {
						if (response.status === 404) return null;
						throw new Error(`HTTP ${response.status}`);
					}
					const item = await response.json();
					set((state) => {
						const idx = state.items.findIndex((i) => i.uuid === uuid);
						const updated =
							idx >= 0
								? state.items.map((i, j) => (j === idx ? item : i))
								: [...state.items, item];
						return {
							items: updated,
							operationLoading: { ...state.operationLoading, [opKey]: false },
						};
					});
					return item;
				} catch (error) {
					set((state) => ({
						operationLoading: { ...state.operationLoading, [opKey]: false },
						error: error instanceof Error ? error.message : 'Unknown error',
					}));
					return null;
				}
			},

			upsert: async (item) => {
				const opKey = `upsert_${item.uuid || 'new'}`;
				set((state) => ({
					operationLoading: { ...state.operationLoading, [opKey]: true },
					error: null,
				}));
				try {
					const { updatedAt: _updatedAt, ...body } = item as Project & {
						updatedAt?: string;
					};
					const isNew = !item.uuid;
					const response = await authFetch(
						`${API_BASE_URL}/projects${isNew ? '' : `/${item.uuid}`}`,
						{
							method: isNew ? 'POST' : 'PUT',
							headers: getHeaders(),
							body: JSON.stringify(body),
						}
					);
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const saved: Project = await response.json();
					set((state) => {
						const idx = state.items.findIndex((i) => i.uuid === saved.uuid);
						const updated =
							idx >= 0
								? state.items.map((i, j) => (j === idx ? saved : i))
								: [...state.items, saved];
						return {
							items: updated,
							operationLoading: { ...state.operationLoading, [opKey]: false },
						};
					});
					return saved;
				} catch (error) {
					set((state) => ({
						operationLoading: { ...state.operationLoading, [opKey]: false },
						error: error instanceof Error ? error.message : 'Unknown error',
					}));
					return null;
				}
			},

			deleteByUuid: async (uuid) => {
				const opKey = `delete_${uuid}`;
				set((state) => ({
					operationLoading: { ...state.operationLoading, [opKey]: true },
					error: null,
				}));
				try {
					const response = await authFetch(`${API_BASE_URL}/projects/${uuid}`, {
						method: 'DELETE',
						headers: getHeaders(),
					});
					if (!response.ok && response.status !== 404) {
						throw new Error(`HTTP ${response.status}`);
					}
					set((state) => ({
						items: state.items.filter((i) => i.uuid !== uuid),
						operationLoading: { ...state.operationLoading, [opKey]: false },
						lastFetch: null,
					}));
				} catch (error) {
					set((state) => ({
						operationLoading: { ...state.operationLoading, [opKey]: false },
						error: error instanceof Error ? error.message : 'Unknown error',
					}));
					throw error;
				}
			},

			clearError: () => set({ error: null }),
			clearItems: () => set({ items: [], lastFetch: null }),
			invalidateCache: () => set({ lastFetch: null }),

			setCurrentPhase: async (projectUuid, phaseUuid) => {
				const response = await authFetch(`${API_BASE_URL}/projects/${projectUuid}`, {
					method: 'PUT',
					headers: getHeaders(),
					body: JSON.stringify({ currentPhaseUuid: phaseUuid }),
				});
				if (!response.ok) {
					const body = await response.json().catch(() => ({}));
					const msg = body?.error ?? 'Failed to update phase';
					set({ error: msg });
					return false;
				}
				const updated: Project = await response.json();
				set((state) => ({
					items: state.items.map((p) =>
						p.uuid === projectUuid ? { ...p, ...updated } : p
					),
				}));
				return true;
			},

			fetchMembers: async (projectUuid) => {
				const response = await authFetch(`${API_BASE_URL}/projects/${projectUuid}/members`, {
					headers: getHeaders(),
				});
				if (!response.ok) return;
				const members = await response.json();
				set((state) => ({
					items: state.items.map((p) => (p.uuid === projectUuid ? { ...p, members } : p)),
				}));
			},

			addMember: async (projectUuid, userId, role) => {
				const response = await authFetch(`${API_BASE_URL}/projects/${projectUuid}/members`, {
					method: 'POST',
					headers: getHeaders(),
					body: JSON.stringify({ userId, role }),
				});
				return response.ok;
			},

			removeMember: async (projectUuid, userId) => {
				const response = await authFetch(
					`${API_BASE_URL}/projects/${projectUuid}/members/${userId}`,
					{ method: 'DELETE', headers: getHeaders() }
				);
				return response.ok;
			},

			linkLinear: async (projectUuid, apiKey) => {
				const response = await authFetch(`${API_BASE_URL}/projects/${projectUuid}/linear`, {
					method: 'POST',
					headers: getHeaders(),
					body: JSON.stringify({ apiKey }),
				});
				if (!response.ok) return false;
				const updated = await response.json();
				set((state) => ({
					items: state.items.map((p) => (p.uuid === projectUuid ? updated : p)),
				}));
				return true;
			},
		}),
		{ name: 'ProjectStore' }
	)
);
