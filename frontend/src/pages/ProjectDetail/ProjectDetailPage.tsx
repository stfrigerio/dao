import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Link2, Users, Trash2, FileText } from 'lucide-react';
import { useProjectStore } from '@/store/projects';
import { usePhaseStore } from '@/store/phases';
import { useLinearStore } from '@/store/linear';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { PhaseBoard } from './components/organisms/PhaseBoard';
import { LinearIssuesTab } from './components/organisms/LinearIssuesTab';
import { MembersTab } from './components/organisms/MembersTab';
import { DocumentsTab } from './components/organisms/DocumentsTab';
import styles from './ProjectDetailPage.module.css';

type Tab = 'phases' | 'linear' | 'members' | 'documents';

export function ProjectDetailPage() {
	const { uuid } = useParams<{ uuid: string }>();
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState<Tab>('phases');
	const { items: projects, fetchByUuid, deleteByUuid } = useProjectStore();
	const { phases, fetchPhases } = usePhaseStore();
	const { pullStatus } = useLinearStore();

	const project = projects.find((p) => p.uuid === uuid);
	const projectPhases = uuid ? phases[uuid] || [] : [];

	useBreadcrumb([
		{ label: 'Dashboard', to: '/dashboard' },
		{ label: 'Projects', to: '/projects' },
		{ label: project?.name ?? '…' },
	]);

	useEffect(() => {
		if (uuid) {
			fetchByUuid(uuid);
			fetchPhases(uuid);
		}
	}, [uuid, fetchByUuid, fetchPhases]);

	// Pull task statuses from Linear on load
	useEffect(() => {
		if (project?.linearProjectId && uuid) {
			pullStatus(uuid);
		}
	}, [project?.linearProjectId, uuid, pullStatus]);

	const handleDelete = async () => {
		if (!confirm(`Delete project "${project?.name}"?`)) return;
		await deleteByUuid(uuid!);
		navigate('/projects');
	};

	if (!project) {
		return (
			<div className={styles.loading}>
				<p>Loading project...</p>
			</div>
		);
	}

	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<div>
					<div className={styles.titleRow}>
						<h1 className={styles.title}>{project.name}</h1>
						<span className={`${styles.typeBadge} ${styles[`type-${project.type}`]}`}>
							{project.type}
						</span>
					</div>
				</div>
				<button
					className={styles.deleteButton}
					onClick={handleDelete}
					aria-label="delete project"
				>
					<Trash2 size={15} />
					Delete
				</button>
			</div>

			<div className={styles.tabs}>
				<button
					className={`${styles.tab} ${activeTab === 'phases' ? styles.tabActive : ''}`}
					onClick={() => setActiveTab('phases')}
				>
					Phases
				</button>
				<button
					className={`${styles.tab} ${activeTab === 'documents' ? styles.tabActive : ''}`}
					onClick={() => setActiveTab('documents')}
				>
					<FileText size={14} />
					Documents
				</button>
				<button
					className={`${styles.tab} ${activeTab === 'linear' ? styles.tabActive : ''}`}
					onClick={() => setActiveTab('linear')}
				>
					<Link2 size={14} />
					Linear
				</button>
				<button
					className={`${styles.tab} ${activeTab === 'members' ? styles.tabActive : ''}`}
					onClick={() => setActiveTab('members')}
				>
					<Users size={14} />
					Members
				</button>
			</div>

			<div className={styles.tabContent}>
				{activeTab === 'phases' && <PhaseBoard project={project} phases={projectPhases} />}
				{activeTab === 'linear' && <LinearIssuesTab project={project} />}
				{activeTab === 'members' && <MembersTab project={project} />}
				{activeTab === 'documents' && <DocumentsTab project={project} />}
			</div>
		</div>
	);
}
