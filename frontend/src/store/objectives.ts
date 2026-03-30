import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Objective, Task } from '../../../shared/types';
import { getAuthToken } from './authToken';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const getHeaders = () => {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const token = getAuthToken();
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return headers;
};

interface ObjectiveState {
	objectives: Record<string, Objective[]>; // keyed by phaseUuid
	loading: boolean;
	error: string | null;

	fetchObjectives: (phaseUuid: string) => Promise<void>;
	createObjective: (
		phaseUuid: string,
		name: string,
		description?: string
	) => Promise<Objective | null>;
	updateObjective: (uuid: string, data: { name?: string; description?: string }) => Promise<void>;
	toggleObjective: (uuid: string, phaseUuid: string, completed: boolean) => Promise<void>;
	deleteObjective: (uuid: string, phaseUuid: string) => Promise<void>;

	createTask: (
		objectiveUuid: string,
		phaseUuid: string,
		name: string,
		description?: string
	) => Promise<Task | null>;
	updateTask: (
		uuid: string,
		objectiveUuid: string,
		phaseUuid: string,
		data: { name?: string; description?: string }
	) => Promise<void>;
	toggleTask: (
		uuid: string,
		objectiveUuid: string,
		phaseUuid: string,
		completed: boolean
	) => Promise<void>;
	deleteTask: (uuid: string, objectiveUuid: string, phaseUuid: string) => Promise<void>;
}

export const useObjectiveStore = create<ObjectiveState>()(
	devtools(
		(set, get) => ({
			objectives: {},
			loading: false,
			error: null,

			fetchObjectives: async (phaseUuid) => {
				set({ loading: true, error: null });
				try {
					const res = await fetch(`${API_BASE_URL}/phases/${phaseUuid}/objectives`, {
						headers: getHeaders(),
					});
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const data: Objective[] = await res.json();
					set((state) => ({
						objectives: { ...state.objectives, [phaseUuid]: data },
						loading: false,
					}));
				} catch (error) {
					set({
						loading: false,
						error: error instanceof Error ? error.message : 'Unknown error',
					});
				}
			},

			createObjective: async (phaseUuid, name, description) => {
				try {
					const res = await fetch(`${API_BASE_URL}/phases/${phaseUuid}/objectives`, {
						method: 'POST',
						headers: getHeaders(),
						body: JSON.stringify({
							name,
							description,
							orderIndex: (get().objectives[phaseUuid] || []).length,
						}),
					});
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const obj: Objective = await res.json();
					set((state) => ({
						objectives: {
							...state.objectives,
							[phaseUuid]: [...(state.objectives[phaseUuid] || []), obj],
						},
					}));
					return obj;
				} catch (error) {
					set({ error: error instanceof Error ? error.message : 'Unknown error' });
					return null;
				}
			},

			updateObjective: async (uuid, data) => {
				try {
					const res = await fetch(`${API_BASE_URL}/objectives/${uuid}`, {
						method: 'PUT',
						headers: getHeaders(),
						body: JSON.stringify(data),
					});
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const updated: Objective = await res.json();
					set((state) => {
						const newObjs = { ...state.objectives };
						for (const key of Object.keys(newObjs)) {
							newObjs[key] = newObjs[key].map((o) =>
								o.uuid === uuid ? { ...updated, tasks: o.tasks } : o
							);
						}
						return { objectives: newObjs };
					});
				} catch (error) {
					set({ error: error instanceof Error ? error.message : 'Unknown error' });
				}
			},

			toggleObjective: async (uuid, phaseUuid, completed) => {
				// Optimistic
				set((state) => ({
					objectives: {
						...state.objectives,
						[phaseUuid]: (state.objectives[phaseUuid] || []).map((o) =>
							o.uuid === uuid ? { ...o, completed } : o
						),
					},
				}));
				try {
					const res = await fetch(`${API_BASE_URL}/objectives/${uuid}/complete`, {
						method: 'PATCH',
						headers: getHeaders(),
						body: JSON.stringify({ completed }),
					});
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
				} catch (error) {
					// Revert
					set((state) => ({
						objectives: {
							...state.objectives,
							[phaseUuid]: (state.objectives[phaseUuid] || []).map((o) =>
								o.uuid === uuid ? { ...o, completed: !completed } : o
							),
						},
					}));
				}
			},

			deleteObjective: async (uuid, phaseUuid) => {
				const res = await fetch(`${API_BASE_URL}/objectives/${uuid}`, {
					method: 'DELETE',
					headers: getHeaders(),
				});
				if (!res.ok) return;
				set((state) => ({
					objectives: {
						...state.objectives,
						[phaseUuid]: (state.objectives[phaseUuid] || []).filter(
							(o) => o.uuid !== uuid
						),
					},
				}));
			},

			createTask: async (objectiveUuid, phaseUuid, name, description) => {
				const objective = (get().objectives[phaseUuid] || []).find(
					(o) => o.uuid === objectiveUuid
				);
				const orderIndex = (objective?.tasks || []).length;
				try {
					const res = await fetch(`${API_BASE_URL}/objectives/${objectiveUuid}/tasks`, {
						method: 'POST',
						headers: getHeaders(),
						body: JSON.stringify({ name, description, orderIndex }),
					});
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const task: Task = await res.json();
					set((state) => ({
						objectives: {
							...state.objectives,
							[phaseUuid]: (state.objectives[phaseUuid] || []).map((o) =>
								o.uuid === objectiveUuid
									? { ...o, tasks: [...(o.tasks || []), task] }
									: o
							),
						},
					}));
					return task;
				} catch (error) {
					set({ error: error instanceof Error ? error.message : 'Unknown error' });
					return null;
				}
			},

			updateTask: async (uuid, objectiveUuid, phaseUuid, data) => {
				try {
					const res = await fetch(`${API_BASE_URL}/tasks/${uuid}`, {
						method: 'PUT',
						headers: getHeaders(),
						body: JSON.stringify(data),
					});
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const updated: Task = await res.json();
					set((state) => ({
						objectives: {
							...state.objectives,
							[phaseUuid]: (state.objectives[phaseUuid] || []).map((o) =>
								o.uuid === objectiveUuid
									? {
											...o,
											tasks: (o.tasks || []).map((t) =>
												t.uuid === uuid ? updated : t
											),
										}
									: o
							),
						},
					}));
				} catch (error) {
					set({ error: error instanceof Error ? error.message : 'Unknown error' });
				}
			},

			toggleTask: async (uuid, objectiveUuid, phaseUuid, completed) => {
				// Optimistic
				set((state) => ({
					objectives: {
						...state.objectives,
						[phaseUuid]: (state.objectives[phaseUuid] || []).map((o) =>
							o.uuid === objectiveUuid
								? {
										...o,
										tasks: (o.tasks || []).map((t) =>
											t.uuid === uuid ? { ...t, completed } : t
										),
									}
								: o
						),
					},
				}));
				try {
					const res = await fetch(`${API_BASE_URL}/tasks/${uuid}/complete`, {
						method: 'PATCH',
						headers: getHeaders(),
						body: JSON.stringify({ completed }),
					});
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
				} catch (err) {
					console.error('toggleTask failed:', err);
					// Revert
					set((state) => ({
						objectives: {
							...state.objectives,
							[phaseUuid]: (state.objectives[phaseUuid] || []).map((o) =>
								o.uuid === objectiveUuid
									? {
											...o,
											tasks: (o.tasks || []).map((t) =>
												t.uuid === uuid
													? { ...t, completed: !completed }
													: t
											),
										}
									: o
							),
						},
					}));
				}
			},

			deleteTask: async (uuid, objectiveUuid, phaseUuid) => {
				const res = await fetch(`${API_BASE_URL}/tasks/${uuid}`, {
					method: 'DELETE',
					headers: getHeaders(),
				});
				if (!res.ok) return;
				set((state) => ({
					objectives: {
						...state.objectives,
						[phaseUuid]: (state.objectives[phaseUuid] || []).map((o) =>
							o.uuid === objectiveUuid
								? { ...o, tasks: (o.tasks || []).filter((t) => t.uuid !== uuid) }
								: o
						),
					},
				}));
			},
		}),
		{ name: 'ObjectiveStore' }
	)
);
