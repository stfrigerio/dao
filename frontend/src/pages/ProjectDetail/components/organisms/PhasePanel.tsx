import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
	Plus,
	Trash2,
	CheckSquare,
	Square,
	ChevronDown,
	ChevronRight,
	Sparkles,
	Loader2,
	FileQuestion,
	FileText,
	MapPin,
	Maximize2,
	Pencil,
	ExternalLink,
} from 'lucide-react';
import type { Project, Phase, Objective, Document } from '../../../../../../shared/types';
import { useObjectiveStore } from '@/store/objectives';
import { useAgentJobStore, type AnalysisResult } from '@/store/agentJobs';
import { useDocumentStore } from '@/store/documents';
import { useLinearStore } from '@/store/linear';
import { useProjectStore } from '@/store/projects';
import { useToastStore } from '@/store/toast';
import { Badge } from '@/components/atoms/Badge/Badge';
import { EmptyState } from '@/components/atoms/EmptyState/EmptyState';
import { Modal } from '@/components/atoms/Modal/Modal';
import { Callout } from '@/components/atoms/Callout/Callout';
import { DocEditor } from '@/components/molecules/DocEditor/DocEditor';
import { QuestionFocusMode } from './QuestionFocusMode';
import styles from './PhasePanel.module.css';

interface PhasePanelProps {
	phase: Phase;
	project: Project;
}

export function PhasePanel({ phase, project }: PhasePanelProps) {
	const {
		objectives,
		fetchObjectives,
		createObjective,
		toggleObjective,
		deleteObjective,
		createTask,
		updateTask,
		toggleTask,
		deleteTask,
	} = useObjectiveStore();
	const {
		startPhaseObjectives,
		getJobForPhase,
		startObjectiveQuestions,
		getJobForObjective,
		startDocumentationAnalysis,
		startDocumentationProduction,
		clearAnalysisJob,
		getAnalysisJob,
		getProductionJob,
		analysisJobs,
	} = useAgentJobStore();
	const { documents, fetchDocuments, createDocument, updateDocument } = useDocumentStore();
	const { syncObjective } = useLinearStore();
	const { setCurrentPhase, error: projectError, clearError } = useProjectStore();
	const toast = useToastStore();
	const [syncingObjective, setSyncingObjective] = useState<string | null>(null);

	const isDiscoveryPhase = phase.orderIndex === 0;
	const isCurrentPhase = project.currentPhaseUuid === phase.uuid;
	const agentJob = getJobForPhase(phase.uuid);
	const agentRunning = agentJob?.status === 'running';

	const phaseObjectives = objectives[phase.uuid] || [];
	const projectDocs = documents[project.uuid] || [];

	const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
	const [activeQuestionsDoc, setActiveQuestionsDoc] = useState<Document | null>(null);
	const [focusModeDoc, setFocusModeDoc] = useState<Document | null>(null);
	const [analysisTarget, setAnalysisTarget] = useState<{
		obj: Objective;
		result: AnalysisResult;
	} | null>(null);
	const dismissAnalysis = () => {
		if (analysisTarget) clearAnalysisJob(analysisTarget.obj.uuid);
		setAnalysisTarget(null);
	};
	const [editingTask, setEditingTask] = useState<{ uuid: string; objUuid: string; name: string } | null>(null);
	const editInputRef = useRef<HTMLInputElement>(null);
	const [newObjectiveName, setNewObjectiveName] = useState('');
	const [showNewObjective, setShowNewObjective] = useState(false);
	const [newTaskNames, setNewTaskNames] = useState<Record<string, string>>({});
	const [showNewTask, setShowNewTask] = useState<Record<string, boolean>>({});

	useEffect(() => {
		fetchObjectives(phase.uuid);
	}, [phase.uuid, fetchObjectives]);

	useEffect(() => {
		fetchDocuments(project.uuid);
	}, [project.uuid, fetchDocuments]);

	// When an analysis job completes, open the confirmation modal for that objective
	useEffect(() => {
		for (const obj of phaseObjectives) {
			const job = getAnalysisJob(obj.uuid);
			if (job?.status === 'done' && job.result && !analysisTarget) {
				setAnalysisTarget({ obj, result: job.result });
				break;
			}
		}
	}, [phaseObjectives, analysisJobs, analysisTarget, getAnalysisJob]);

	// Keep activeQuestionsDoc in sync with the store so DocEditor sees updated content after save
	useEffect(() => {
		if (!activeQuestionsDoc) return;
		const updated = projectDocs.find((d) => d.uuid === activeQuestionsDoc.uuid);
		if (updated && updated.content !== activeQuestionsDoc.content) {
			setActiveQuestionsDoc(updated);
		}
	}, [projectDocs]);

	const toggleExpanded = (uuid: string) => {
		setExpandedObjectives((prev) => {
			const next = new Set(prev);
			next.has(uuid) ? next.delete(uuid) : next.add(uuid);
			return next;
		});
	};

	const handleAddObjective = async () => {
		if (!newObjectiveName.trim()) return;
		await createObjective(phase.uuid, newObjectiveName.trim());
		setNewObjectiveName('');
		setShowNewObjective(false);
	};

	const handleAddTask = async (obj: Objective) => {
		const name = newTaskNames[obj.uuid]?.trim();
		if (!name) return;
		await createTask(obj.uuid, phase.uuid, name);
		setNewTaskNames((prev) => ({ ...prev, [obj.uuid]: '' }));
		setShowNewTask((prev) => ({ ...prev, [obj.uuid]: false }));
	};

	const briefDoc = isDiscoveryPhase
		? projectDocs.find((d) => d.name === 'Project Brief' && d.objectiveId === null)
		: undefined;
	const briefHasContent = !!briefDoc?.content?.trim();

	const handleBriefSave = async (content: string) => {
		if (briefDoc) {
			await updateDocument(briefDoc.uuid, content, project.uuid);
		} else {
			await createDocument(project.uuid, {
				name: 'Project Brief',
				content,
				type: 'note',
				phaseId: phase.id,
			});
		}
	};

	const totalTasks = phaseObjectives.reduce((n, o) => n + (o.tasks?.length || 0), 0);
	const doneTasks = phaseObjectives.reduce(
		(n, o) => n + (o.tasks?.filter((t) => t.completed).length || 0),
		0
	);
	const doneObjectives = phaseObjectives.filter((o) => o.completed).length;

	// Phase exit criteria — qualitative milestones per phase
	const phaseDocs = projectDocs.filter((d) => d.phaseId === phase.id);
	const questionDocs = phaseDocs.filter((d) => d.name.startsWith('Questions: '));
	const questionsAllAnswered = questionDocs.length > 0 && questionDocs.every((d) => d.content && !d.content.includes('_answer here_'));
	const producedDocs = phaseDocs.filter((d) => !d.name.startsWith('Questions: ') && d.objectiveId !== null);
	const allReviewed = phaseDocs.length > 0 && phaseDocs.every((d) => d.humanReviewed);

	const discoveryCriteria = [
		{ label: 'Brief written', done: briefHasContent },
		{ label: 'Objectives defined', done: phaseObjectives.length > 0 },
		{ label: 'Questions answered', done: questionsAllAnswered },
		{ label: 'Docs produced', done: producedDocs.length > 0 },
		{ label: 'Human reviewed', done: allReviewed },
	];

	const defaultCriteria = [
		{ label: 'Objectives defined', done: phaseObjectives.length > 0 },
		{ label: 'Tasks completed', done: totalTasks > 0 && doneTasks === totalTasks },
		{ label: 'Human reviewed', done: allReviewed },
	];

	const criteria = isDiscoveryPhase ? discoveryCriteria : defaultCriteria;

	return (
		<div className={styles.panel}>
			<div className={styles.panelHeader}>
				<h3 className={styles.panelTitle}>{phase.name}</h3>
				<div className={styles.panelActions}>
					<button
						className={`${styles.pinButton} ${isCurrentPhase ? styles.pinButtonActive : ''}`}
						onClick={async () => {
							const ok = await setCurrentPhase(
								project.uuid,
								isCurrentPhase ? null : phase.uuid
							);
							if (!ok) {
								const msg =
									useProjectStore.getState().error ?? 'Cannot advance phase';
								toast.error(msg);
								clearError();
							}
						}}
						aria-label={isCurrentPhase ? 'unset current phase' : 'set as current phase'}
					>
						<MapPin size={12} />
						{isCurrentPhase ? 'CURRENT' : 'SET AS CURRENT'}
					</button>
					{isDiscoveryPhase && (
						<button
							className={styles.agentButton}
							onClick={() => startPhaseObjectives(phase.uuid)}
							disabled={agentRunning || !briefHasContent}
							title={!briefHasContent ? 'Write a Project Brief first' : undefined}
							aria-label="run discovery agent"
						>
							{agentRunning ? (
								<>
									<Loader2 size={12} className={styles.spin} /> GENERATING…
								</>
							) : (
								<>
									<Sparkles size={12} /> GENERATE OBJECTIVES
								</>
							)}
						</button>
					)}
				</div>
			</div>

			<div className={styles.criteriaBar}>
				{criteria.map((c, i) => {
					const prevDone = i > 0 && criteria[i - 1].done;
					return (
						<React.Fragment key={i}>
							{i > 0 && (
								<div className={`${styles.criteriaLine} ${prevDone && c.done ? styles.criteriaLineDone : ''}`} />
							)}
							<div className={`${styles.criteriaStep} ${c.done ? styles.criteriaStepDone : ''}`}>
								<span className={styles.criteriaStepDot} />
								<span className={styles.criteriaLabel}>{c.label}</span>
							</div>
						</React.Fragment>
					);
				})}
			</div>

			<div className={styles.panelBody}>
				{isDiscoveryPhase && (
					<Callout
						type="abstract"
						title="Project Brief"
						defaultOpen={false}
						>
						<p className={styles.briefHint}>
							Describe the high-level scope and goals. This is used to generate
							accurate questions and objectives.
						</p>
						<DocEditor
							content={briefDoc?.content ?? null}
							onSave={handleBriefSave}
						/>
					</Callout>
				)}

				<div className={styles.section}>
					<div className={styles.sectionHeaderRow}>
						<label className={styles.sectionLabel}>
							Objectives
							{phaseObjectives.length > 0 && (
								<Badge variant="default">
									{doneObjectives}/{phaseObjectives.length}
								</Badge>
							)}
						</label>
						<button
							className={styles.addButton}
							onClick={() => setShowNewObjective(true)}
						>
							<Plus size={13} />
							Add
						</button>
					</div>

					{phaseObjectives.length === 0 && !showNewObjective && (
						<EmptyState message="No objectives yet." />
					)}

					<div className={styles.objectiveList}>
						{phaseObjectives.map((obj) => {
							const expanded = expandedObjectives.has(obj.uuid);
							const taskCount = obj.tasks?.length || 0;
							const doneTaskCount = obj.tasks?.filter((t) => t.completed).length || 0;

							const questionsDoc =
								projectDocs.find((d) => d.objectiveId === obj.id) ??
								projectDocs.find((d) => d.name === `Questions: ${obj.name}`);
							const questionsLinked = !!questionsDoc && questionsDoc.objectiveId === obj.id;
							const questionsAnswered =
								questionsLinked &&
								!!questionsDoc?.content &&
								!questionsDoc.content.includes('_answer here_');

							return (
								<div
									key={obj.uuid}
									className={`${styles.objectiveItem} ${obj.completed ? styles.objectiveDone : ''}`}
								>
									<div
										className={styles.objectiveRow}
										onClick={() => toggleExpanded(obj.uuid)}
									>
										<button
											className={styles.checkButton}
											onClick={(e) => {
												e.stopPropagation();
												toggleObjective(
													obj.uuid,
													phase.uuid,
													!obj.completed
												);
											}}
											aria-label={
												obj.completed ? 'mark incomplete' : 'mark complete'
											}
										>
											{obj.completed ? (
												<CheckSquare
													size={16}
													className={styles.checkDone}
												/>
											) : (
												<Square size={16} className={styles.checkTodo} />
											)}
										</button>
										<span className={styles.objectiveName}>{obj.name}</span>
										{isDiscoveryPhase &&
											(() => {
												const qJob = getJobForObjective(obj.uuid);
												const qRunning = qJob?.status === 'running';
												if (questionsDoc) {
													const analysisJob = getAnalysisJob(obj.uuid);
													const productionJob = getProductionJob(
														obj.uuid
													);
													const isAnalysing =
														analysisJob?.status === 'running';
													const isProducing =
														productionJob?.status === 'running';
													return (
														<>
															<button
																className={`${styles.viewQuestionsButton} ${questionsAnswered ? styles.viewQuestionsAnswered : ''}`}
																onClick={(e) => {
																	e.stopPropagation();
																	setActiveQuestionsDoc(
																		questionsDoc
																	);
																}}
																aria-label="view questions document"
															>
																{questionsAnswered ? (
																	<>
																		<CheckSquare size="1em" />{' '}
																		ANSWERED
																	</>
																) : (
																	<>
																		<FileText size="1em" />{' '}
																		QUESTIONS
																	</>
																)}
															</button>
															{questionsAnswered && (
																<button
																	className={styles.produceButton}
																	disabled={
																		isAnalysing || isProducing
																	}
																	onClick={(e) => {
																		e.stopPropagation();
																		startDocumentationAnalysis(
																			obj.uuid
																		);
																	}}
																	aria-label="produce documentation"
																>
																	{isAnalysing || isProducing ? (
																		<>
																			<Loader2
																				size="1em"
																				className={
																					styles.spin
																				}
																			/>{' '}
																			{isProducing
																				? 'PRODUCING…'
																				: 'ANALYSING…'}
																		</>
																	) : (
																		<>
																			<Sparkles size="1em" />{' '}
																			PRODUCE DOCS
																		</>
																	)}
																</button>
															)}
														</>
													);
												}
												return (
													<button
														className={styles.questionsButton}
														onClick={(e) => {
															e.stopPropagation();
															startObjectiveQuestions(
																obj.uuid,
																project.uuid
															);
														}}
														disabled={qRunning}
														aria-label="generate questions"
													>
														{qRunning ? (
															<>
																<Loader2
																	size="1em"
																	className={styles.spin}
																/>{' '}
																GENERATING…
															</>
														) : (
															<>
																<FileQuestion size="1em" />{' '}
																QUESTIONS
															</>
														)}
													</button>
												);
											})()}
										<div className={styles.objectiveMeta}>
											{taskCount > 0 && (
												<Badge variant="default">
													{doneTaskCount}/{taskCount}
												</Badge>
											)}
											{expanded ? (
												<ChevronDown size={14} className={styles.chevron} />
											) : (
												<ChevronRight size={14} className={styles.chevron} />
											)}
										</div>
										{project.linearApiKey && (
											<button
												className={styles.syncButton}
												disabled={syncingObjective === obj.uuid}
												onClick={async (e) => {
													e.stopPropagation();
													setSyncingObjective(obj.uuid);
													const ok = await syncObjective(project.uuid, obj.uuid);
													setSyncingObjective(null);
													if (ok) toast.success(`"${obj.name}" synced to Linear.`);
													else toast.error('Failed to sync to Linear.');
												}}
												aria-label="sync to linear"
											>
												{syncingObjective === obj.uuid ? (
													<Loader2 size={13} className={styles.spin} />
												) : (
													<ExternalLink size={13} />
												)}
											</button>
										)}
										<button
											className={styles.deleteButton}
											onClick={(e) => {
												e.stopPropagation();
												deleteObjective(obj.uuid, phase.uuid);
											}}
											aria-label="delete objective"
										>
											<Trash2 size={13} />
										</button>
									</div>

									<AnimatePresence initial={false}>
										{expanded && (
											<motion.div
												key="tasks"
												initial={{ height: 0, opacity: 0 }}
												animate={{ height: 'auto', opacity: 1 }}
												exit={{ height: 0, opacity: 0 }}
												transition={{ duration: 0.18, ease: 'easeInOut' }}
												style={{ overflow: 'hidden' }}
											>
												<div className={styles.taskList}>
													{(obj.tasks || []).map((task) => {
														const isEditing = editingTask?.uuid === task.uuid;
														return (
															<div
																key={task.uuid}
																className={`${styles.taskRow} ${task.completed ? styles.taskDone : ''}`}
																onClick={() => {
																	if (!isEditing) toggleTask(task.uuid, obj.uuid, phase.uuid, !task.completed);
																}}
																style={{ cursor: isEditing ? 'default' : 'pointer' }}
															>
																<span className={styles.checkIcon}>
																	{task.completed ? (
																		<CheckSquare size={18} className={styles.checkDone} />
																	) : (
																		<Square size={18} className={styles.checkTodo} />
																	)}
																</span>
																{isEditing ? (
																	<input
																		ref={editInputRef}
																		className={styles.editTaskInput}
																		value={editingTask.name}
																		onChange={(e) => setEditingTask({ ...editingTask, name: e.target.value })}
																		onClick={(e) => e.stopPropagation()}
																		onKeyDown={(e) => {
																			if (e.key === 'Enter') {
																				const name = editingTask.name.trim();
																				if (name && name !== task.name) {
																					updateTask(task.uuid, obj.uuid, phase.uuid, { name });
																				}
																				setEditingTask(null);
																			}
																			if (e.key === 'Escape') setEditingTask(null);
																		}}
																		onBlur={() => {
																			const name = editingTask.name.trim();
																			if (name && name !== task.name) {
																				updateTask(task.uuid, obj.uuid, phase.uuid, { name });
																			}
																			setEditingTask(null);
																		}}
																		autoFocus
																	/>
																) : (
																	<span className={styles.taskName}>
																		{task.name}
																	</span>
																)}
																<button
																	className={styles.editButton}
																	onClick={(e) => {
																		e.stopPropagation();
																		setEditingTask({ uuid: task.uuid, objUuid: obj.uuid, name: task.name });
																	}}
																	aria-label="edit task"
																>
																	<Pencil size={12} />
																</button>
																<button
																	className={styles.deleteButton}
																	onClick={(e) => {
																		e.stopPropagation();
																		deleteTask(task.uuid, obj.uuid, phase.uuid);
																	}}
																	aria-label="delete task"
																>
																	<Trash2 size={12} />
																</button>
															</div>
														);
													})}

													{showNewTask[obj.uuid] ? (
														<div className={styles.newRow}>
															<input
																className={styles.newInput}
																placeholder="Task name"
																value={newTaskNames[obj.uuid] || ''}
																onChange={(e) =>
																	setNewTaskNames((prev) => ({
																		...prev,
																		[obj.uuid]: e.target.value,
																	}))
																}
																onKeyDown={(e) => {
																	if (e.key === 'Enter')
																		handleAddTask(obj);
																	if (e.key === 'Escape')
																		setShowNewTask((p) => ({
																			...p,
																			[obj.uuid]: false,
																		}));
																}}
																autoFocus
															/>
															<button
																className={styles.saveButton}
																onClick={() => handleAddTask(obj)}
															>
																Add
															</button>
														</div>
													) : (
														<button
															className={styles.addTaskButton}
															onClick={() => {
																setShowNewTask((p) => ({
																	...p,
																	[obj.uuid]: true,
																}));
																setExpandedObjectives(
																	(p) => new Set([...p, obj.uuid])
																);
															}}
														>
															<Plus size={12} /> Add task
														</button>
													)}
												</div>
											</motion.div>
										)}
									</AnimatePresence>
								</div>
							);
						})}
					</div>

					{showNewObjective && (
						<div className={styles.newRow}>
							<input
								className={styles.newInput}
								placeholder="Objective name"
								value={newObjectiveName}
								onChange={(e) => setNewObjectiveName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') handleAddObjective();
									if (e.key === 'Escape') setShowNewObjective(false);
								}}
								autoFocus
							/>
							<button className={styles.saveButton} onClick={handleAddObjective}>
								Add
							</button>
						</div>
					)}

					{totalTasks > 0 && (
						<p className={styles.taskSummary}>
							{doneTasks} of {totalTasks} tasks done
						</p>
					)}
				</div>
			</div>

			<Modal
				open={activeQuestionsDoc !== null}
				title={activeQuestionsDoc?.name ?? ''}
				onClose={() => setActiveQuestionsDoc(null)}
				actions={
					<button
						className={styles.iconBtn}
						onClick={() => {
							setFocusModeDoc(activeQuestionsDoc);
							setActiveQuestionsDoc(null);
						}}
						title="Focus mode"
					>
						<Maximize2 size={13} />
					</button>
				}
			>
				{activeQuestionsDoc && (
					<DocEditor
						content={activeQuestionsDoc.content}
						onSave={(content) =>
							updateDocument(activeQuestionsDoc.uuid, content, project.uuid)
						}
					/>
				)}
			</Modal>

			{focusModeDoc && (
				<QuestionFocusMode
					title={focusModeDoc.name}
					content={focusModeDoc.content ?? ''}
					onSave={(content) => updateDocument(focusModeDoc.uuid, content, project.uuid)}
					onClose={() => setFocusModeDoc(null)}
				/>
			)}

			<Modal
				open={analysisTarget !== null}
				title={`Produce docs — ${analysisTarget?.obj.name ?? ''}`}
				onClose={dismissAnalysis}
				size="compact"
			>
				{analysisTarget && (
					<div className={styles.analysisBody}>
						{analysisTarget.result.completable.length > 0 && (
							<div className={styles.analysisSection}>
								<p className={styles.analysisSectionLabel}>
									<CheckSquare size={13} /> Can be completed
								</p>
								<ul className={styles.analysisList}>
									{analysisTarget.result.completable.map((t) => (
										<li key={t.taskUuid} className={styles.analysisItemDone}>
											{t.taskName}
										</li>
									))}
								</ul>
							</div>
						)}
						{analysisTarget.result.incomplete.length > 0 && (
							<div className={styles.analysisSection}>
								<p className={styles.analysisSectionLabel}>
									<FileQuestion size={13} /> Missing information
								</p>
								<ul className={styles.analysisList}>
									{analysisTarget.result.incomplete.map((t, i) => (
										<li key={i} className={styles.analysisItemMissing}>
											<span className={styles.analysisTaskName}>
												{t.taskName}
											</span>
											<span className={styles.analysisReason}>
												{t.reason}
											</span>
										</li>
									))}
								</ul>
							</div>
						)}
						<div className={styles.analysisActions}>
							<button
								className={styles.analysisCancelBtn}
								onClick={dismissAnalysis}
							>
								Cancel
							</button>
							{analysisTarget.result.completable.length > 0 && (
								<button
									className={styles.analysisConfirmBtn}
									onClick={() => {
										startDocumentationProduction(
											analysisTarget.obj.uuid,
											analysisTarget.result.completable.map(
												(t) => t.taskUuid
											),
											project.uuid,
											phase.uuid
										);
										dismissAnalysis();
									}}
								>
									{analysisTarget.result.incomplete.length > 0
										? `Complete ${analysisTarget.result.completable.length} task${analysisTarget.result.completable.length > 1 ? 's' : ''} anyway`
										: `Complete ${analysisTarget.result.completable.length} task${analysisTarget.result.completable.length > 1 ? 's' : ''}`}
								</button>
							)}
						</div>
					</div>
				)}
			</Modal>
		</div>
	);
}
