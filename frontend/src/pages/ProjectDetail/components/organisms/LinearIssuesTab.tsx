import React, { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Unlink } from 'lucide-react';
import type { Project } from '../../../../../../shared/types';
import { useLinearStore } from '@/store/linear';
import { useObjectiveStore } from '@/store/objectives';
import { usePhaseStore } from '@/store/phases';
import { useToastStore } from '@/store/toast';
import { LinkLinearModal } from '../molecules/LinkLinearModal';
import styles from './LinearIssuesTab.module.css';

interface LinearIssuesTabProps {
	project: Project;
}

export function LinearIssuesTab({ project }: LinearIssuesTabProps) {
	const { issues, loading, fetchIssues, reconcile } = useLinearStore();
	const { phases } = usePhaseStore();
	const { fetchObjectives } = useObjectiveStore();
	const toast = useToastStore();
	const [showLinkModal, setShowLinkModal] = useState(false);
	const [reconciling, setReconciling] = useState(false);
	const projectIssues = issues[project.uuid] || [];

	const isLinked = project.linearApiKey && project.linearProjectId;

	useEffect(() => {
		if (isLinked) {
			fetchIssues(project.uuid);
		}
	}, [project.uuid, isLinked, fetchIssues]);

	if (!isLinked) {
		return (
			<div className={styles.emptyState}>
				{!project.linearApiKey ? (
					<p className={styles.emptyText}>Connect a Linear workspace in Settings first.</p>
				) : (
					<>
						<p className={styles.emptyText}>No Linear project linked yet.</p>
						<button className={styles.linkButton} onClick={() => setShowLinkModal(true)}>
							Link Linear Project
						</button>
					</>
				)}
				{showLinkModal && (
					<LinkLinearModal project={project} onClose={() => setShowLinkModal(false)} />
				)}
			</div>
		);
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<h3 className={styles.title}>Linear Issues</h3>
				<div style={{ display: 'flex', gap: '8px' }}>
					<button
						className={styles.refreshButton}
						onClick={async () => {
							setReconciling(true);
							const cleared = await reconcile(project.uuid);
							setReconciling(false);
							if (cleared > 0) {
								toast.success(`Cleared ${cleared} stale sync mappings.`);
								(phases[project.uuid] || []).forEach((p) => fetchObjectives(p.uuid));
							}
							fetchIssues(project.uuid);
						}}
						disabled={reconciling}
						title="Refresh issues and clear stale sync mappings"
					>
						{reconciling ? <RefreshCw size={14} className={styles.spin} /> : <Unlink size={14} />}
						Reconcile
					</button>
					<button
						className={styles.refreshButton}
						onClick={() => fetchIssues(project.uuid)}
						disabled={loading}
					>
						<RefreshCw size={14} />
						Refresh
					</button>
				</div>
			</div>

			{loading ? (
				<p className={styles.loading}>Loading issues...</p>
			) : projectIssues.length === 0 ? (
				<p className={styles.emptyText}>No issues found.</p>
			) : (
				<div className={styles.issueList}>
					{projectIssues.map((issue) => (
						<div key={issue.id} className={styles.issue}>
							<div className={styles.issueHeader}>
								<span className={styles.identifier}>{issue.identifier}</span>
								{issue.state && (
								<span className={styles.state} style={{ color: issue.state.color }}>
									{issue.state.name}
								</span>
							)}
							</div>
							<p className={styles.issueTitle}>{issue.title}</p>
							{issue.assignee && (
								<span className={styles.assignee}>{issue.assignee.name}</span>
							)}
							<a
								href={issue.url}
								target="_blank"
								rel="noopener noreferrer"
								className={styles.externalLink}
								onClick={(e) => e.stopPropagation()}
							>
								<ExternalLink size={12} />
							</a>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
