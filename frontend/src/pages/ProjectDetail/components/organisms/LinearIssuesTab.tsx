import React, { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { Project } from '../../../../../../shared/types';
import { useLinearStore } from '@/store/linear';
import { LinkLinearModal } from '../molecules/LinkLinearModal';
import styles from './LinearIssuesTab.module.css';

interface LinearIssuesTabProps {
	project: Project;
}

export function LinearIssuesTab({ project }: LinearIssuesTabProps) {
	const { issues, loading, fetchIssues } = useLinearStore();
	const [showLinkModal, setShowLinkModal] = useState(false);
	const projectIssues = issues[project.uuid] || [];

	useEffect(() => {
		if (project.linearProjectId) {
			fetchIssues(project.uuid);
		}
	}, [project.uuid, project.linearProjectId, fetchIssues]);

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
			<div className={styles.header}>
				<h3 className={styles.title}>Linear Issues</h3>
				<button
					className={styles.refreshButton}
					onClick={() => fetchIssues(project.uuid)}
					disabled={loading}
				>
					<RefreshCw size={14} />
					Refresh
				</button>
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
								<span className={styles.state} style={{ color: issue.state.color }}>
									{issue.state.name}
								</span>
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
