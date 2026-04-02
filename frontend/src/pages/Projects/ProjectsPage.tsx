import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import { useProjectStore } from '@/store/projects';
import { useToastStore } from '@/store/toast';
import type { ProjectType, ProjectStatus } from '../../../../shared/types';
import { DEFAULT_PHASES } from '../../../../shared/types';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { NewProjectModal } from './components/NewProjectModal';
import styles from './ProjectsPage.module.css';

export function ProjectsPage() {
	const { items: projects, loading, fetchAll, upsert, invalidateCache } = useProjectStore();
	const toast = useToastStore();

	useBreadcrumb([{ label: 'Dashboard', to: '/dashboard' }, { label: 'Projects' }]);
	const [showNewModal, setShowNewModal] = useState(false);
	const [search, setSearch] = useState('');
	const [typeFilter, setTypeFilter] = useState<ProjectType | 'all'>('all');
	const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('active');

	useEffect(() => {
		fetchAll();
	}, [fetchAll]);

	const filtered = projects.filter((p) => {
		const matchSearch =
			!search ||
			p.name.toLowerCase().includes(search.toLowerCase()) ||
			(p.description || '').toLowerCase().includes(search.toLowerCase());
		const matchType = typeFilter === 'all' || p.type === typeFilter;
		const matchStatus = statusFilter === 'all' || p.status === statusFilter;
		return matchSearch && matchType && matchStatus;
	});

	const handleCreate = async (data: { name: string; description: string; type: ProjectType }) => {
		const project = await upsert(data);
		if (!project) {
			toast.error('Failed to create project');
			return;
		}
		// Create default phases
		const apiUrl = import.meta.env.VITE_API_URL || '/api';
		await Promise.all(
			DEFAULT_PHASES.map((phase: { name: string; orderIndex: number }) =>
				fetch(`${apiUrl}/projects/${project.uuid}/phases`, {
					// allow-fetch
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${localStorage.getItem('dao-auth') ? JSON.parse(localStorage.getItem('dao-auth')!).state?.token : ''}`,
					},
					body: JSON.stringify({ name: phase.name, orderIndex: phase.orderIndex }),
				})
			)
		);
		invalidateCache();
		setShowNewModal(false);
		toast.success(`Project "${data.name}" created`);
	};

	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<div>
					<h1 className={styles.title}>Projects <span className="han">项目</span></h1>
					<p className={styles.subtitle}>
						{projects.length} total project{projects.length !== 1 ? 's' : ''}
					</p>
				</div>
				<button className={styles.newButton} onClick={() => setShowNewModal(true)}>
					<Plus size={16} />
					New Project
				</button>
			</div>

			<div className={styles.toolbar}>
				<div className={styles.searchWrapper}>
					<Search size={15} className={styles.searchIcon} />
					<input
						className={styles.searchInput}
						type="text"
						placeholder="Search projects..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>
				<div className={styles.filters}>
					<Filter size={15} className={styles.filterIcon} />
					<select
						className={styles.select}
						value={typeFilter}
						onChange={(e) => setTypeFilter(e.target.value as ProjectType | 'all')}
					>
						<option value="all">All types</option>
						<option value="professional">Professional</option>
						<option value="personal">Personal</option>
					</select>
					<select
						className={styles.select}
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
					>
						<option value="all">All statuses</option>
						<option value="active">Active</option>
						<option value="archived">Archived</option>
					</select>
				</div>
			</div>

			{loading ? (
				<p className={styles.loading}>Loading...</p>
			) : filtered.length === 0 ? (
				<div className={styles.emptyState}>
					<p>No projects found.</p>
					<button className={styles.emptyButton} onClick={() => setShowNewModal(true)}>
						Create your first project
					</button>
				</div>
			) : (
				<div className={styles.grid}>
					{filtered.map((project) => (
						<Link
							key={project.uuid}
							to={`/projects/${project.uuid}`}
							className={styles.card}
						>
							<div className={styles.cardHeader}>
								<span className={styles.cardName}>{project.name}</span>
								<span
									className={`${styles.typeBadge} ${styles[`type-${project.type}`]}`}
								>
									{project.type}
								</span>
							</div>
							<div className={styles.cardFooter}>
								<span className={styles.cardDate}>
									{new Date(project.updatedAt).toLocaleDateString()}
								</span>
								{project.status === 'archived' && (
									<span className={styles.archivedBadge}>archived</span>
								)}
							</div>
						</Link>
					))}
				</div>
			)}

			{showNewModal && (
				<NewProjectModal onClose={() => setShowNewModal(false)} onCreate={handleCreate} />
			)}
		</div>
	);
}
