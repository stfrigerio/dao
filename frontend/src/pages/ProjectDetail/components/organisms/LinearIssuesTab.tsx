import React, { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Unlink } from 'lucide-react';
import type { Project } from '../../../../../../shared/types';
import { useLinearStore } from '@/store/linear';
import { useObjectiveStore } from '@/store/objectives';
import { usePhaseStore } from '@/store/phases';
import { useProjectStore } from '@/store/projects';
import { useToastStore } from '@/store/toast';
import { getAuthToken } from '@/store/authToken';
import { LinkLinearModal } from '../molecules/LinkLinearModal';
import styles from './LinearIssuesTab.module.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface LinearProject {
	id: string;
	name: string;
	color: string;
	url: string;
}

interface LinearIssuesTabProps {
	project: Project;
}

export function LinearIssuesTab({ project }: LinearIssuesTabProps) {
	const { reconcile } = useLinearStore();
	const { phases } = usePhaseStore();
	const { fetchObjectives } = useObjectiveStore();
	const { fetchByUuid } = useProjectStore();
	const toast = useToastStore();
	const [showLinkModal, setShowLinkModal] = useState(false);
	const [reconciling, setReconciling] = useState(false);
	const [linkedProject, setLinkedProject] = useState<LinearProject | null>(null);
	const [unlinking, setUnlinking] = useState(false);

	useEffect(() => {
		if (!project.linearProjectId) { setLinkedProject(null); return; }
		(async () => {
			try {
				const headers: Record<string, string> = { 'Content-Type': 'application/json' };
				const token = getAuthToken();
				if (token) headers['Authorization'] = `Bearer ${token}`;
				const res = await fetch(`${API_BASE_URL}/settings/linear/projects`, { headers }); // allow-fetch
				if (!res.ok) return;
				const data: LinearProject[] = await res.json();
				setLinkedProject(data.find((p) => p.id === project.linearProjectId) ?? null);
			} catch {}
		})();
	}, [project.linearProjectId]);

	const handleUnlink = async () => {
		setUnlinking(true);
		try {
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			const token = getAuthToken();
			if (token) headers['Authorization'] = `Bearer ${token}`;
			const res = await fetch(`${API_BASE_URL}/projects/${project.uuid}/linear/unlink`, { // allow-fetch
				method: 'POST',
				headers,
			});
			if (res.ok) {
				toast.success('Linear project unlinked');
				setLinkedProject(null);
				fetchByUuid(project.uuid);
			} else {
				toast.error('Failed to unlink');
			}
		} catch {
			toast.error('Failed to unlink');
		} finally {
			setUnlinking(false);
		}
	};

	if (!project.linearProjectId) {
		return (
			<div className={styles.emptyState}>
				<p className={styles.emptyText}>No Linear project linked yet.</p>
				<button className={styles.linkButton} onClick={() => setShowLinkModal(true)}>
					Link Linear Project
				</button>
				{showLinkModal && (
					<LinkLinearModal project={project} onClose={() => setShowLinkModal(false)} />
				)}
			</div>
		);
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.linkedCard}>
				<div className={styles.linkedInfo}>
					{linkedProject && (
						<span
							className={styles.projectDot}
							style={{ backgroundColor: linkedProject.color }}
						/>
					)}
					<span className={styles.projectName}>
						{linkedProject?.name ?? 'Linear Project'}
					</span>
					{linkedProject && (
						<a
							href={linkedProject.url}
							target="_blank"
							rel="noopener noreferrer"
							className={styles.externalLink}
						>
							<ExternalLink size={13} />
						</a>
					)}
				</div>
				<div className={styles.actions}>
					<button
						className={styles.actionButton}
						onClick={async () => {
							setReconciling(true);
							const cleared = await reconcile(project.uuid);
							setReconciling(false);
							if (cleared > 0) {
								toast.success(`Cleared ${cleared} stale sync mappings.`);
								(phases[project.uuid] || []).forEach((p) => fetchObjectives(p.uuid));
							} else {
								toast.success('Everything in sync.');
							}
						}}
						disabled={reconciling}
						title="Clean up stale sync mappings"
					>
						{reconciling ? <RefreshCw size={14} className={styles.spin} /> : <Unlink size={14} />}
						Reconcile
					</button>
					<button
						className={styles.unlinkButton}
						onClick={handleUnlink}
						disabled={unlinking}
						title="Unlink this Linear project"
					>
						Unlink
					</button>
				</div>
			</div>
		</div>
	);
}
