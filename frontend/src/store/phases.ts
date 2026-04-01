import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Phase } from '../../../shared/types';
import { getAuthToken, authFetch } from './authToken';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const getHeaders = () => {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const token = getAuthToken();
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return headers;
};

interface PhaseState {
	phases: Record<string, Phase[]>; // keyed by projectUuid
	loading: boolean;
	error: string | null;

	fetchPhases: (projectUuid: string) => Promise<void>;
	createPhase: (projectUuid: string, data: Partial<Phase>) => Promise<Phase | null>;
	updatePhase: (phaseUuid: string, data: Partial<Phase>) => Promise<Phase | null>;
	deletePhase: (phaseUuid: string, projectUuid: string) => Promise<boolean>;
	clearError: () => void;
}

export const usePhaseStore = create<PhaseState>()(
	devtools(
		(set, get) => ({
			phases: {},
			loading: false,
			error: null,

			fetchPhases: async (projectUuid) => {
				set({ loading: true, error: null });
				try {
					const response = await authFetch(`${API_BASE_URL}/projects/${projectUuid}/phases`, {
						headers: getHeaders(),
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const data: Phase[] = await response.json();
					set((state) => ({
						phases: { ...state.phases, [projectUuid]: data },
						loading: false,
					}));
				} catch (error) {
					set({
						loading: false,
						error: error instanceof Error ? error.message : 'Unknown error',
					});
				}
			},

			createPhase: async (projectUuid, data) => {
				try {
					const response = await authFetch(`${API_BASE_URL}/projects/${projectUuid}/phases`, {
						method: 'POST',
						headers: getHeaders(),
						body: JSON.stringify(data),
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const phase: Phase = await response.json();
					set((state) => ({
						phases: {
							...state.phases,
							[projectUuid]: [...(state.phases[projectUuid] || []), phase].sort(
								(a, b) => a.orderIndex - b.orderIndex
							),
						},
					}));
					return phase;
				} catch (error) {
					set({ error: error instanceof Error ? error.message : 'Unknown error' });
					return null;
				}
			},

			updatePhase: async (phaseUuid, data) => {
				try {
					const response = await authFetch(`${API_BASE_URL}/phases/${phaseUuid}`, {
						method: 'PUT',
						headers: getHeaders(),
						body: JSON.stringify(data),
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const updated: Phase = await response.json();
					set((state) => {
						const newPhases = { ...state.phases };
						for (const key of Object.keys(newPhases)) {
							newPhases[key] = newPhases[key].map((p) =>
								p.uuid === phaseUuid ? updated : p
							);
						}
						return { phases: newPhases };
					});
					return updated;
				} catch (error) {
					set({ error: error instanceof Error ? error.message : 'Unknown error' });
					return null;
				}
			},

			deletePhase: async (phaseUuid, projectUuid) => {
				const response = await authFetch(`${API_BASE_URL}/phases/${phaseUuid}`, {
					method: 'DELETE',
					headers: getHeaders(),
				});
				if (!response.ok) return false;
				set((state) => ({
					phases: {
						...state.phases,
						[projectUuid]: (state.phases[projectUuid] || []).filter(
							(p) => p.uuid !== phaseUuid
						),
					},
				}));
				return true;
			},

			clearError: () => set({ error: null }),
		}),
		{ name: 'PhaseStore' }
	)
);
