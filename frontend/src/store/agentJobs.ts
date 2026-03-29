import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getAuthToken } from './authToken';
import { useToastStore } from './toast';
import { useObjectiveStore } from './objectives';
import { useDocumentStore } from './documents';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const getHeaders = () => {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const token = getAuthToken();
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return headers;
};

export interface AgentJob {
	jobId: string;
	status: 'running' | 'done' | 'error';
	error?: string;
}

interface AgentJobState {
	jobs: Record<string, AgentJob>; // keyed by phaseUuid
	objectiveJobs: Record<string, AgentJob>; // keyed by objectiveUuid
	startDiscovery: (phaseUuid: string) => Promise<void>;
	startObjectiveQuestions: (objectiveUuid: string, projectUuid: string) => Promise<void>;
	getJobForPhase: (phaseUuid: string) => AgentJob | undefined;
	getJobForObjective: (objectiveUuid: string) => AgentJob | undefined;
}

export const useAgentJobStore = create<AgentJobState>()(
	devtools(
		(set, get) => ({
			jobs: {},
			objectiveJobs: {},

			startDiscovery: async (phaseUuid) => {
				if (get().jobs[phaseUuid]?.status === 'running') return;

				try {
					const res = await fetch(`${API_BASE_URL}/phases/${phaseUuid}/run-discovery`, {
						method: 'POST',
						headers: getHeaders(),
					});
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const { jobId } = await res.json();

					set((state) => ({
						jobs: { ...state.jobs, [phaseUuid]: { jobId, status: 'running' } },
					}));

					const poll = async () => {
						try {
							const pollRes = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
								headers: getHeaders(),
							});
							if (!pollRes.ok) {
								setTimeout(poll, 3000);
								return;
							}
							const job = await pollRes.json();

							if (job.status === 'done') {
								set((state) => ({
									jobs: { ...state.jobs, [phaseUuid]: { jobId, status: 'done' } },
								}));
								useToastStore
									.getState()
									.success('Objectives and tasks generated.', 'Agent done');
								useObjectiveStore.getState().fetchObjectives(phaseUuid);
							} else if (job.status === 'error') {
								set((state) => ({
									jobs: {
										...state.jobs,
										[phaseUuid]: { jobId, status: 'error', error: job.error },
									},
								}));
								useToastStore
									.getState()
									.error('Discovery agent failed.', 'Agent error');
							} else {
								setTimeout(poll, 2000);
							}
						} catch {
							setTimeout(poll, 3000);
						}
					};

					setTimeout(poll, 2000);
				} catch {
					useToastStore.getState().error('Failed to start discovery agent.');
				}
			},

			startObjectiveQuestions: async (objectiveUuid, projectUuid) => {
				if (get().objectiveJobs[objectiveUuid]?.status === 'running') return;

				try {
					const res = await fetch(
						`${API_BASE_URL}/objectives/${objectiveUuid}/generate-questions`,
						{
							method: 'POST',
							headers: getHeaders(),
						}
					);
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const { jobId } = await res.json();

					set((state) => ({
						objectiveJobs: {
							...state.objectiveJobs,
							[objectiveUuid]: { jobId, status: 'running' },
						},
					}));

					const poll = async () => {
						try {
							const pollRes = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
								headers: getHeaders(),
							});
							if (!pollRes.ok) {
								setTimeout(poll, 3000);
								return;
							}
							const job = await pollRes.json();

							if (job.status === 'done') {
								set((state) => ({
									objectiveJobs: {
										...state.objectiveJobs,
										[objectiveUuid]: { jobId, status: 'done' },
									},
								}));
								useToastStore
									.getState()
									.success('Questions document ready.', 'Agent done');
								useDocumentStore.getState().fetchDocuments(projectUuid);
							} else if (job.status === 'error') {
								set((state) => ({
									objectiveJobs: {
										...state.objectiveJobs,
										[objectiveUuid]: {
											jobId,
											status: 'error',
											error: job.error,
										},
									},
								}));
								useToastStore
									.getState()
									.error('Failed to generate questions.', 'Agent error');
							} else {
								setTimeout(poll, 2000);
							}
						} catch {
							setTimeout(poll, 3000);
						}
					};

					setTimeout(poll, 2000);
				} catch {
					useToastStore.getState().error('Failed to start questions agent.');
				}
			},

			getJobForPhase: (phaseUuid) => get().jobs[phaseUuid],
			getJobForObjective: (objectiveUuid) => get().objectiveJobs[objectiveUuid],
		}),
		{ name: 'AgentJobStore' }
	)
);
