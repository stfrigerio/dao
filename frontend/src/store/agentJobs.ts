import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getAuthToken, authFetch } from './authToken';
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

export interface AnalysisResult {
	completable: Array<{ taskUuid: string; taskName: string }>;
	incomplete: Array<{ taskName: string; reason: string }>;
}

export interface AgentJob {
	jobId: string;
	status: 'running' | 'done' | 'error';
	error?: string;
	result?: AnalysisResult;
	progress?: { current: number; total: number };
}

interface AgentJobState {
	jobs: Record<string, AgentJob>; // keyed by phaseUuid
	objectiveJobs: Record<string, AgentJob>; // keyed by objectiveUuid
	analysisJobs: Record<string, AgentJob>; // keyed by objectiveUuid
	productionJobs: Record<string, AgentJob>; // keyed by objectiveUuid
	startPhaseObjectives: (phaseUuid: string, documentUuids?: string[]) => Promise<void>;
	startObjectiveQuestions: (objectiveUuid: string, projectUuid: string) => Promise<void>;
	startDocumentationAnalysis: (objectiveUuid: string) => Promise<void>;
	startDocumentationProduction: (
		objectiveUuid: string,
		taskUuids: string[],
		projectUuid: string,
		phaseUuid: string
	) => Promise<void>;
	getJobForPhase: (phaseUuid: string) => AgentJob | undefined;
	getJobForObjective: (objectiveUuid: string) => AgentJob | undefined;
	clearAnalysisJob: (objectiveUuid: string) => void;
	getAnalysisJob: (objectiveUuid: string) => AgentJob | undefined;
	getProductionJob: (objectiveUuid: string) => AgentJob | undefined;
}

export const useAgentJobStore = create<AgentJobState>()(
	devtools(
		(set, get) => ({
			jobs: {},
			objectiveJobs: {},
			analysisJobs: {},
			productionJobs: {},

			startPhaseObjectives: async (phaseUuid, documentUuids) => {
				if (get().jobs[phaseUuid]?.status === 'running') return;

				try {
					const res = await authFetch(`${API_BASE_URL}/phases/${phaseUuid}/generate-objectives`, {
						method: 'POST',
						headers: getHeaders(),
						body: JSON.stringify(documentUuids ? { documentUuids } : {}),
					});
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const { jobId } = await res.json();

					set((state) => ({
						jobs: { ...state.jobs, [phaseUuid]: { jobId, status: 'running' } },
					}));

					let lostCount = 0;
					const recover = () => {
						set((state) => ({
							jobs: { ...state.jobs, [phaseUuid]: { jobId, status: 'done' } },
						}));
						useObjectiveStore.getState().fetchObjectives(phaseUuid);
						useToastStore.getState().success('Objectives and tasks generated.', 'Agent done');
					};
					const poll = async () => {
						try {
							const pollRes = await authFetch(`${API_BASE_URL}/jobs/${jobId}`, {
								headers: getHeaders(),
							});
							if (!pollRes.ok) {
								lostCount++;
								if (pollRes.status === 404 && lostCount >= 3) { recover(); return; }
								setTimeout(poll, 3000);
								return;
							}
							lostCount = 0;
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
							lostCount++;
							if (lostCount >= 3) { recover(); return; }
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
					const res = await authFetch(
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

					let lostCount = 0;
					const recover = () => {
						set((state) => ({
							objectiveJobs: {
								...state.objectiveJobs,
								[objectiveUuid]: { jobId, status: 'done' },
							},
						}));
						useDocumentStore.getState().fetchDocuments(projectUuid);
						useToastStore.getState().success('Questions document ready.', 'Agent done');
					};
					const poll = async () => {
						try {
							const pollRes = await authFetch(`${API_BASE_URL}/jobs/${jobId}`, {
								headers: getHeaders(),
							});
							if (!pollRes.ok) {
								lostCount++;
								if (pollRes.status === 404 && lostCount >= 3) { recover(); return; }
								setTimeout(poll, 3000);
								return;
							}
							lostCount = 0;
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
							lostCount++;
							if (lostCount >= 3) { recover(); return; }
							setTimeout(poll, 3000);
						}
					};

					setTimeout(poll, 2000);
				} catch {
					useToastStore.getState().error('Failed to start questions agent.');
				}
			},

			startDocumentationAnalysis: async (objectiveUuid) => {
				if (get().analysisJobs[objectiveUuid]?.status === 'running') return;
				try {
					const res = await authFetch(
						`${API_BASE_URL}/objectives/${objectiveUuid}/analyze-documentation`,
						{ method: 'POST', headers: getHeaders() }
					);
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const { jobId } = await res.json();
					set((state) => ({
						analysisJobs: {
							...state.analysisJobs,
							[objectiveUuid]: { jobId, status: 'running' },
						},
					}));
					let lostCount = 0;
					const recoverLost = () => {
						// Analysis result is transient — can't recover, must retry
						set((state) => ({
							analysisJobs: {
								...state.analysisJobs,
								[objectiveUuid]: { jobId, status: 'error', error: 'Job lost' },
							},
						}));
						useToastStore.getState().error('Analysis interrupted — please try again.', 'Agent error');
					};
					const poll = async () => {
						try {
							const pollRes = await authFetch(`${API_BASE_URL}/jobs/${jobId}`, {
								headers: getHeaders(),
							});
							if (!pollRes.ok) {
								lostCount++;
								if (pollRes.status === 404 && lostCount >= 3) { recoverLost(); return; }
								setTimeout(poll, 3000);
								return;
							}
							lostCount = 0;
							const job = await pollRes.json();
							if (job.status === 'done') {
								set((state) => ({
									analysisJobs: {
										...state.analysisJobs,
										[objectiveUuid]: {
											jobId,
											status: 'done',
											result: job.result,
										},
									},
								}));
							} else if (job.status === 'error') {
								set((state) => ({
									analysisJobs: {
										...state.analysisJobs,
										[objectiveUuid]: {
											jobId,
											status: 'error',
											error: job.error,
										},
									},
								}));
								useToastStore.getState().error('Analysis failed.', 'Agent error');
							} else {
								setTimeout(poll, 2000);
							}
						} catch {
							lostCount++;
							if (lostCount >= 3) { recoverLost(); return; }
							setTimeout(poll, 3000);
						}
					};
					setTimeout(poll, 2000);
				} catch {
					useToastStore.getState().error('Failed to start analysis.');
				}
			},

			startDocumentationProduction: async (
				objectiveUuid,
				taskUuids,
				projectUuid,
				phaseUuid
			) => {
				if (get().productionJobs[objectiveUuid]?.status === 'running') return;
				// Clear analysis result immediately so the modal doesn't re-open
				set((state) => ({
					analysisJobs: {
						...state.analysisJobs,
						[objectiveUuid]: { jobId: '', status: 'done' },
					},
				}));
				try {
					const res = await authFetch(
						`${API_BASE_URL}/objectives/${objectiveUuid}/produce-documentation`,
						{
							method: 'POST',
							headers: getHeaders(),
							body: JSON.stringify({ taskUuids }),
						}
					);
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const { jobId } = await res.json();
					set((state) => ({
						productionJobs: {
							...state.productionJobs,
							[objectiveUuid]: { jobId, status: 'running' },
						},
						// Clear analysis job so the modal closes
						analysisJobs: {
							...state.analysisJobs,
							[objectiveUuid]: { jobId: '', status: 'done' },
						},
					}));
					let lostCount = 0;
					const recover = () => {
						set((state) => ({
							productionJobs: {
								...state.productionJobs,
								[objectiveUuid]: { jobId, status: 'done' },
							},
						}));
						useObjectiveStore.getState().fetchObjectives(phaseUuid);
						useDocumentStore.getState().fetchDocuments(projectUuid);
						useToastStore
							.getState()
							.success('Documents produced and tasks completed.', 'Done');
					};
					const poll = async () => {
						try {
							const pollRes = await authFetch(`${API_BASE_URL}/jobs/${jobId}`, {
								headers: getHeaders(),
							});
							if (!pollRes.ok) {
								lostCount++;
								if (pollRes.status === 404 && lostCount >= 3) { recover(); return; }
								setTimeout(poll, 3000);
								return;
							}
							lostCount = 0;
							const job = await pollRes.json();
							if (job.status === 'done') {
								set((state) => ({
									productionJobs: {
										...state.productionJobs,
										[objectiveUuid]: { jobId, status: 'done' },
									},
								}));
								useToastStore
									.getState()
									.success('Documents produced and tasks completed.', 'Done');
								useObjectiveStore.getState().fetchObjectives(phaseUuid);
								useDocumentStore.getState().fetchDocuments(projectUuid);
							} else if (job.status === 'error') {
								set((state) => ({
									productionJobs: {
										...state.productionJobs,
										[objectiveUuid]: {
											jobId,
											status: 'error',
											error: job.error,
										},
									},
								}));
								useToastStore.getState().error('Production failed.', 'Agent error');
							} else {
								set((state) => ({
									productionJobs: {
										...state.productionJobs,
										[objectiveUuid]: {
											jobId,
											status: 'running',
											progress: job.progress,
										},
									},
								}));
								setTimeout(poll, 2000);
							}
						} catch {
							lostCount++;
							if (lostCount >= 3) { recover(); return; }
							setTimeout(poll, 3000);
						}
					};
					setTimeout(poll, 2000);
				} catch {
					useToastStore.getState().error('Failed to start production.');
				}
			},

			clearAnalysisJob: (objectiveUuid) => {
				set((state) => {
					const next = { ...state.analysisJobs };
					delete next[objectiveUuid];
					return { analysisJobs: next };
				});
			},

			getJobForPhase: (phaseUuid) => get().jobs[phaseUuid],
			getJobForObjective: (objectiveUuid) => get().objectiveJobs[objectiveUuid],
			getAnalysisJob: (objectiveUuid) => get().analysisJobs[objectiveUuid],
			getProductionJob: (objectiveUuid) => get().productionJobs[objectiveUuid],
		}),
		{ name: 'AgentJobStore' }
	)
);
