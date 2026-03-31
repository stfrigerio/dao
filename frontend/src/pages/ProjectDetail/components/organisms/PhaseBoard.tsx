import React, { useState, useEffect } from 'react';
import { ChevronRight, Circle, CircleDot } from 'lucide-react';
import type { Project, Phase } from '../../../../../../shared/types';
import { useObjectiveStore } from '@/store/objectives';
import { PhasePanel } from './PhasePanel';
import styles from './PhaseBoard.module.css';

const PHASE_HAN: Record<string, string> = {
	Discovery: '探索',
	Planning: '规划',
	Execution: '执行',
	Review: '审查',
	Done: '完成',
};

interface PhaseBoardProps {
	project: Project;
	phases: Phase[];
}

export function PhaseBoard({ project, phases }: PhaseBoardProps) {
	const sorted = [...phases].sort((a, b) => a.orderIndex - b.orderIndex);
	const { objectives, fetchObjectives } = useObjectiveStore();

	const [selectedPhase, setSelectedPhase] = useState<Phase | null>(() => {
		if (!sorted.length) return null;
		return sorted.find((p) => p.uuid === project.currentPhaseUuid) ?? sorted[0];
	});

	const phaseUuids = sorted.map((p) => p.uuid).join(',');
	useEffect(() => {
		sorted.forEach((p) => fetchObjectives(p.uuid));
	}, [phaseUuids]);

	// Re-sync when phases or currentPhaseUuid changes (e.g. after fetch or update)
	useEffect(() => {
		if (!sorted.length) return;
		setSelectedPhase((prev) => {
			if (prev) {
				const still = sorted.find((p) => p.uuid === prev.uuid);
				if (still) return still;
			}
			return sorted.find((p) => p.uuid === project.currentPhaseUuid) ?? sorted[0];
		});
	}, [phases, project.currentPhaseUuid]);

	const getPhaseCompletion = (phase: Phase): number => {
		const objs = objectives[phase.uuid] || [];
		if (objs.length === 0) return 0;
		const totalTasks = objs.reduce((n, o) => n + (o.tasks?.length || 0), 0);
		if (totalTasks > 0) {
			const doneTasks = objs.reduce(
				(n, o) => n + (o.tasks?.filter((t) => t.completed).length || 0),
				0
			);
			return Math.round((doneTasks / totalTasks) * 100);
		}
		const doneObjs = objs.filter((o) => o.completed).length;
		return Math.round((doneObjs / objs.length) * 100);
	};

	return (
		<div className={styles.wrapper}>
			<div className={styles.board}>
				{sorted.map((phase, idx) => {
					const fill = getPhaseCompletion(phase);
					return (
						<React.Fragment key={phase.uuid}>
							<div
								className={`${styles.phaseCard} ${selectedPhase?.uuid === phase.uuid ? styles.phaseCardActive : ''}`}
								data-testid={`phase-card-${phase.name}`}
								onClick={() =>
									setSelectedPhase((prev) =>
										prev?.uuid === phase.uuid ? null : phase
									)
								}
							>
								{fill > 0 && (
									<div
										className={styles.liquid}
										style={{ height: `${fill}%` }}
									/>
								)}
								<div className={styles.phaseHeader}>
									{phase.uuid === project.currentPhaseUuid ? (
										<CircleDot
											size={16}
											className={styles.phaseIconCurrent}
										/>
									) : (
										<Circle size={16} className={styles.phaseIcon} />
									)}
									<span className={styles.phaseName}>
										{phase.name}
										{PHASE_HAN[phase.name] && (
											<span className="han">
												{PHASE_HAN[phase.name]}
											</span>
										)}
									</span>
								</div>
								{phase.description && (
									<p className={styles.phaseDescription}>
										{phase.description}
									</p>
								)}
							</div>
							{idx < sorted.length - 1 && (
								<ChevronRight size={20} className={styles.arrow} />
							)}
						</React.Fragment>
					);
				})}
			</div>

			{selectedPhase && <PhasePanel phase={selectedPhase} project={project} />}
		</div>
	);
}
