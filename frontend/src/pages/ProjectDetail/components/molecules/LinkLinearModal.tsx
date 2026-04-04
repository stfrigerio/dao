import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Project } from '../../../../../../shared/types';
import { useProjectStore } from '@/store/projects';
import { useToastStore } from '@/store/toast';
import { getAuthToken } from '@/store/authToken';
import styles from './LinkLinearModal.module.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface LinearProject {
	id: string;
	name: string;
	color: string;
	url: string;
}

interface LinkLinearModalProps {
	project: Project;
	onClose: () => void;
}

export function LinkLinearModal({ project, onClose }: LinkLinearModalProps) {
	const { linkLinear } = useProjectStore();
	const toast = useToastStore();
	const [linearProjects, setLinearProjects] = useState<LinearProject[]>([]);
	const [selectedId, setSelectedId] = useState('');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		(async () => {
			try {
				const headers: Record<string, string> = { 'Content-Type': 'application/json' };
				const token = getAuthToken();
				if (token) headers['Authorization'] = `Bearer ${token}`;
				const res = await fetch(`${API_BASE_URL}/settings/linear/projects`, { headers }); // allow-fetch
				if (!res.ok) {
					toast.error('Failed to load Linear projects. Is the workspace connected in Settings?');
					onClose();
					return;
				}
				const data: LinearProject[] = await res.json();
				setLinearProjects(data);
			} catch {
				toast.error('Failed to load Linear projects');
				onClose();
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	const handleSave = async () => {
		if (!selectedId) return;
		setSaving(true);
		const ok = await linkLinear(project.uuid, selectedId);
		setSaving(false);
		if (ok) {
			toast.success('Linear project linked');
			onClose();
		} else {
			toast.error('Failed to link project');
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
					{loading ? (
						<p className={styles.loadingText}>Loading projects...</p>
					) : linearProjects.length === 0 ? (
						<p className={styles.loadingText}>No projects found in workspace.</p>
					) : (
						<div className={styles.field}>
							<label className={styles.label}>Select a Linear project</label>
							<select
								className={styles.input}
								value={selectedId}
								onChange={(e) => setSelectedId(e.target.value)}
								autoFocus
							>
								<option value="">— Choose project —</option>
								{linearProjects.map((lp) => (
									<option key={lp.id} value={lp.id}>
										{lp.name}
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
							disabled={!selectedId || saving}
						>
							{saving ? 'Linking...' : 'Link Project'}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
