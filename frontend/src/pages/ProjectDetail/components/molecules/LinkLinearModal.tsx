import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Project } from '../../../../../../shared/types';
import { useLinearStore } from '@/store/linear';
import { useProjectStore } from '@/store/projects';
import { useToastStore } from '@/store/toast';
import styles from './LinkLinearModal.module.css';

interface LinkLinearModalProps {
	project: Project;
	onClose: () => void;
}

export function LinkLinearModal({ project, onClose }: LinkLinearModalProps) {
	const { teams, projects, loading, fetchTeams, fetchProjects } = useLinearStore();
	const { linkLinear } = useProjectStore();
	const toast = useToastStore();
	const [selectedTeam, setSelectedTeam] = useState('');
	const [selectedProject, setSelectedProject] = useState('');
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		fetchTeams();
	}, [fetchTeams]);

	useEffect(() => {
		if (selectedTeam) fetchProjects(selectedTeam);
	}, [selectedTeam, fetchProjects]);

	const teamProjects = selectedTeam ? projects[selectedTeam] || [] : [];

	const handleSave = async () => {
		if (!selectedTeam || !selectedProject) return;
		setSaving(true);
		const ok = await linkLinear(project.uuid, selectedTeam, selectedProject);
		setSaving(false);
		if (ok) {
			toast.success('Linear project linked');
			onClose();
		} else {
			toast.error('Failed to link Linear project');
		}
	};

	return (
		<div className={styles.backdrop} onClick={onClose}>
			<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
				<div className={styles.header}>
					<h2 className={styles.title}>Link Linear Project</h2>
					<button className={styles.closeButton} onClick={onClose}>
						<X size={18} />
					</button>
				</div>

				<div className={styles.body}>
					<div className={styles.field}>
						<label className={styles.label}>Team</label>
						<select
							className={styles.select}
							value={selectedTeam}
							onChange={(e) => {
								setSelectedTeam(e.target.value);
								setSelectedProject('');
							}}
						>
							<option value="">Select a team...</option>
							{teams.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
						</select>
					</div>

					{selectedTeam && (
						<div className={styles.field}>
							<label className={styles.label}>Project</label>
							<select
								className={styles.select}
								value={selectedProject}
								onChange={(e) => setSelectedProject(e.target.value)}
								disabled={loading}
							>
								<option value="">Select a project...</option>
								{teamProjects.map((p) => (
									<option key={p.id} value={p.id}>
										{p.name}
									</option>
								))}
							</select>
						</div>
					)}

					<div className={styles.actions}>
						<button className={styles.cancelButton} onClick={onClose}>
							Cancel
						</button>
						<button
							className={styles.saveButton}
							onClick={handleSave}
							disabled={!selectedTeam || !selectedProject || saving}
						>
							{saving ? 'Linking...' : 'Link Project'}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
