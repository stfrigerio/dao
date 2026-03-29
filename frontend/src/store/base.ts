import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getAuthToken } from './authToken';

export interface BaseEntity {
	uuid?: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface BaseState<T extends BaseEntity> {
	items: T[];
	loading: boolean;
	operationLoading: Record<string, boolean>;
	error: string | null;
	lastFetch: number | null;

	fetchAll: () => Promise<void>;
	fetchByUuid: (uuid: string) => Promise<T | null>;
	upsert: (item: Partial<T>) => Promise<T | null>;
	deleteByUuid: (uuid: string) => Promise<void>;
	clearError: () => void;
	clearItems: () => void;
	invalidateCache: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getHeaders = (additionalHeaders?: Record<string, string>): Record<string, string> => {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...additionalHeaders,
	};
	const token = getAuthToken();
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}
	return headers;
};

export function createBaseStore<T extends BaseEntity>(endpoint: string, storeName: string) {
	return create<BaseState<T>>()(
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
						const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
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

				fetchByUuid: async (uuid: string) => {
					const opKey = `fetch_${uuid}`;
					set((state) => ({
						operationLoading: { ...state.operationLoading, [opKey]: true },
					}));
					try {
						const response = await fetch(`${API_BASE_URL}/${endpoint}/${uuid}`, {
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

				upsert: async (item: Partial<T>) => {
					const opKey = `upsert_${item.uuid || 'new'}`;
					set((state) => ({
						operationLoading: { ...state.operationLoading, [opKey]: true },
						error: null,
					}));
					try {
						const { updatedAt: _updatedAt, ...body } = item as any;
						const isNew = !item.uuid;
						const response = await fetch(
							`${API_BASE_URL}/${endpoint}${isNew ? '' : `/${item.uuid}`}`,
							{
								method: isNew ? 'POST' : 'PUT',
								headers: getHeaders(),
								body: JSON.stringify(body),
							}
						);
						if (!response.ok) throw new Error(`HTTP ${response.status}`);
						const saved = (await response.json()) as T;
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

				deleteByUuid: async (uuid: string) => {
					const opKey = `delete_${uuid}`;
					set((state) => ({
						operationLoading: { ...state.operationLoading, [opKey]: true },
						error: null,
					}));
					try {
						const response = await fetch(`${API_BASE_URL}/${endpoint}/${uuid}`, {
							method: 'DELETE',
							headers: getHeaders(),
						});
						if (!response.ok && response.status !== 404) {
							throw new Error(`HTTP ${response.status}`);
						}
						set((state) => ({
							items: state.items.filter((i) => i.uuid !== uuid),
							operationLoading: { ...state.operationLoading, [opKey]: false },
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
			}),
			{ name: `${storeName}-store` }
		)
	);
}
