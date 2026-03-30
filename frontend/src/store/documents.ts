import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Document } from '../../../shared/types';
import { getAuthToken } from './authToken';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
export const FILE_BASE_URL = import.meta.env.VITE_API_URL
	? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
	: '';

const getHeaders = () => {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const token = getAuthToken();
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return headers;
};

const getAuthHeaders = () => {
	const headers: Record<string, string> = {};
	const token = getAuthToken();
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return headers;
};

interface DocumentState {
	documents: Record<string, Document[]>; // keyed by projectUuid
	loading: boolean;
	error: string | null;
	fetchDocuments: (projectUuid: string) => Promise<void>;
	createDocument: (
		projectUuid: string,
		data: { name: string; content?: string; type?: string; phaseId?: number }
	) => Promise<Document>;
	updateDocument: (docUuid: string, content: string, projectUuid: string) => Promise<void>;
	renameDocument: (docUuid: string, name: string, projectUuid: string) => Promise<void>;
	reviewDocument: (docUuid: string, projectUuid: string, reviewed: boolean) => Promise<void>;
	deleteDocument: (docUuid: string, projectUuid: string) => Promise<void>;
	uploadDocument: (projectUuid: string, file: File, phaseId?: number) => Promise<Document>;
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

			createDocument: async (projectUuid, data) => {
				const res = await fetch(`${API_BASE_URL}/projects/${projectUuid}/documents`, {
					method: 'POST',
					headers: getHeaders(),
					body: JSON.stringify(data),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const doc: Document = await res.json();
				set((state) => ({
					documents: {
						...state.documents,
						[projectUuid]: [...(state.documents[projectUuid] || []), doc],
					},
				}));
				return doc;
			},

			updateDocument: async (docUuid, content, projectUuid) => {
				const res = await fetch(`${API_BASE_URL}/documents/${docUuid}`, {
					method: 'PATCH',
					headers: getHeaders(),
					body: JSON.stringify({ content }),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const updated: Document = await res.json();
				set((state) => ({
					documents: {
						...state.documents,
						[projectUuid]: (state.documents[projectUuid] || []).map((d) =>
							d.uuid === docUuid ? updated : d
						),
					},
				}));
			},

			renameDocument: async (docUuid, name, projectUuid) => {
				const res = await fetch(`${API_BASE_URL}/documents/${docUuid}`, {
					method: 'PATCH',
					headers: getHeaders(),
					body: JSON.stringify({ name }),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const updated: Document = await res.json();
				set((state) => ({
					documents: {
						...state.documents,
						[projectUuid]: (state.documents[projectUuid] || []).map((d) =>
							d.uuid === docUuid ? updated : d
						),
					},
				}));
			},

			reviewDocument: async (docUuid, projectUuid, reviewed) => {
				const res = await fetch(`${API_BASE_URL}/documents/${docUuid}`, {
					method: 'PATCH',
					headers: getHeaders(),
					body: JSON.stringify({ humanReviewed: reviewed }),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const updated: Document = await res.json();
				set((state) => ({
					documents: {
						...state.documents,
						[projectUuid]: (state.documents[projectUuid] || []).map((d) =>
							d.uuid === docUuid ? updated : d
						),
					},
				}));
			},

			deleteDocument: async (docUuid, projectUuid) => {
				const res = await fetch(`${API_BASE_URL}/documents/${docUuid}`, {
					method: 'DELETE',
					headers: getHeaders(),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				set((state) => ({
					documents: {
						...state.documents,
						[projectUuid]: (state.documents[projectUuid] || []).filter(
							(d) => d.uuid !== docUuid
						),
					},
				}));
			},

			uploadDocument: async (projectUuid, file, phaseId) => {
				const formData = new FormData();
				formData.append('file', file);
				if (phaseId !== undefined) formData.append('phaseId', String(phaseId));
				const res = await fetch(`${API_BASE_URL}/projects/${projectUuid}/documents/upload`, {
					method: 'POST',
					headers: getAuthHeaders(),
					body: formData,
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const doc: Document = await res.json();
				set((state) => ({
					documents: {
						...state.documents,
						[projectUuid]: [...(state.documents[projectUuid] || []), doc],
					},
				}));
				return doc;
			},

			invalidate: (projectUuid) => {
				set((state) => ({ documents: { ...state.documents, [projectUuid]: [] } }));
			},
		}),
		{ name: 'DocumentStore' }
	)
);
