import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import type { Project, Phase, Objective } from '../../../../../../shared/types';
import { useObjectiveStore } from '@/store/objectives';
import { useAgentJobStore } from '@/store/agentJobs';
import { Badge } from '@/components/atoms/Badge/Badge';
import { EmptyState } from '@/components/atoms/EmptyState/EmptyState';
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
		toggleTask,
		deleteTask,
	} = useObjectiveStore();
	const { startDiscovery, getJobForPhase, startObjectiveQuestions, getJobForObjective } =
		useAgentJobStore();

	const isDiscoveryPhase = phase.orderIndex === 0;
	const agentJob = getJobForPhase(phase.uuid);
	const agentRunning = agentJob?.status === 'running';

	const phaseObjectives = objectives[phase.uuid] || [];

	const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
	const [newObjectiveName, setNewObjectiveName] = useState('');
	const [showNewObjective, setShowNewObjective] = useState(false);
	const [newTaskNames, setNewTaskNames] = useState<Record<string, string>>({});
	const [showNewTask, setShowNewTask] = useState<Record<string, boolean>>({});

	useEffect(() => {
		fetchObjectives(phase.uuid);
	}, [phase.uuid, fetchObjectives]);

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

	const totalTasks = phaseObjectives.reduce((n, o) => n + (o.tasks?.length || 0), 0);
	const doneTasks = phaseObjectives.reduce(
		(n, o) => n + (o.tasks?.filter((t) => t.completed).length || 0),
		0
	);
	const doneObjectives = phaseObjectives.filter((o) => o.completed).length;

	return (
		<div className={styles.panel}>
			<div className={styles.panelHeader}>
				<h3 className={styles.panelTitle}>{phase.name}</h3>
				{isDiscoveryPhase && (
					<button
						className={styles.agentButton}
						onClick={() => startDiscovery(phase.uuid)}
						disabled={agentRunning}
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

			<div className={styles.panelBody}>
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
										{isDiscoveryPhase &&
											(() => {
												const qJob = getJobForObjective(obj.uuid);
												const qRunning = qJob?.status === 'running';
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
																	size={11}
																	className={styles.spin}
																/>{' '}
																GENERATING…
															</>
														) : (
															<>
																<FileQuestion size={11} /> QUESTIONS
															</>
														)}
													</button>
												);
											})()}
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
													{(obj.tasks || []).map((task) => (
														<div
															key={task.uuid}
															className={`${styles.taskRow} ${task.completed ? styles.taskDone : ''}`}
														>
															<button
																className={styles.checkButton}
																onClick={() =>
																	toggleTask(
																		task.uuid,
																		obj.uuid,
																		phase.uuid,
																		!task.completed
																	)
																}
																aria-label={
																	task.completed
																		? 'mark incomplete'
																		: 'mark complete'
																}
															>
																{task.completed ? (
																	<CheckSquare
																		size={14}
																		className={styles.checkDone}
																	/>
																) : (
																	<Square
																		size={14}
																		className={styles.checkTodo}
																	/>
																)}
															</button>
															<span className={styles.taskName}>
																{task.name}
															</span>
															<button
																className={styles.deleteButton}
																onClick={() =>
																	deleteTask(
																		task.uuid,
																		obj.uuid,
																		phase.uuid
																	)
																}
																aria-label="delete task"
															>
																<Trash2 size={12} />
															</button>
														</div>
													))}

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
		</div>
	);
}
