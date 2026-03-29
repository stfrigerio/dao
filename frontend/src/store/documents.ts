import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Document } from '../../../shared/types';
import { getAuthToken } from './authToken';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const getHeaders = () => {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const token = getAuthToken();
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return headers;
};

interface DocumentState {
	documents: Record<string, Document[]>; // keyed by projectUuid
	loading: boolean;
	error: string | null;
	fetchDocuments: (projectUuid: string) => Promise<void>;
	invalidate: (projectUuid: string) => void;
}

export const useDocumentStore = create<DocumentState>()(
	devtools(
		(set) => ({
			documents: {},
			loading: false,
			error: null,

			fetchDocuments: async (projectUuid) => {
				set({ loading: true, error: null });
				try {
					const res = await fetch(`${API_BASE_URL}/projects/${projectUuid}/documents`, {
						headers: getHeaders(),
					});
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const data: Document[] = await res.json();
					set((state) => ({
						documents: { ...state.documents, [projectUuid]: data },
						loading: false,
					}));
				} catch (error) {
					set({
						loading: false,
						error: error instanceof Error ? error.message : 'Unknown error',
					});
				}
			},

			invalidate: (projectUuid) => {
				set((state) => ({ documents: { ...state.documents, [projectUuid]: [] } }));
			},
		}),
		{ name: 'DocumentStore' }
	)
);
