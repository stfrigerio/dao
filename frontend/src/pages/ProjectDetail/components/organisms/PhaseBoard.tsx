import React, { useState, useEffect } from 'react';
import { ChevronRight, Circle, CircleDot } from 'lucide-react';
import type { Project, Phase } from '../../../../../../shared/types';
import { PhasePanel } from './PhasePanel';
import styles from './PhaseBoard.module.css';

interface PhaseBoardProps {
	project: Project;
	phases: Phase[];
}

export function PhaseBoard({ project, phases }: PhaseBoardProps) {
	const sorted = [...phases].sort((a, b) => a.orderIndex - b.orderIndex);

	const [selectedPhase, setSelectedPhase] = useState<Phase | null>(() => {
		if (!sorted.length) return null;
		return sorted.find((p) => p.uuid === project.currentPhaseUuid) ?? sorted[0];
	});

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

	return (
		<div className={styles.wrapper}>
			<div className={styles.board}>
				{sorted.map((phase, idx) => (
					<React.Fragment key={phase.uuid}>
						<div
							className={`${styles.phaseCard} ${selectedPhase?.uuid === phase.uuid ? styles.phaseCardActive : ''}`}
							onClick={() =>
								setSelectedPhase((prev) =>
									prev?.uuid === phase.uuid ? null : phase
								)
							}
						>
							<div className={styles.phaseHeader}>
								{phase.uuid === project.currentPhaseUuid ? (
									<CircleDot size={16} className={styles.phaseIconCurrent} />
								) : (
									<Circle size={16} className={styles.phaseIcon} />
								)}
								<span className={styles.phaseName}>{phase.name}</span>
							</div>
							{phase.description && (
								<p className={styles.phaseDescription}>{phase.description}</p>
							)}
						</div>
						{idx < sorted.length - 1 && (
							<ChevronRight size={20} className={styles.arrow} />
						)}
					</React.Fragment>
				))}
			</div>

			{selectedPhase && <PhasePanel phase={selectedPhase} project={project} />}
		</div>
	);
}
