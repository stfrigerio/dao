import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useProjectStore } from '@/store/projects';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
	const { user } = useAuthStore();
	const { items: projects, loading, fetchAll } = useProjectStore();

	useBreadcrumb([{ label: 'Dashboard' }]);

	useEffect(() => {
		fetchAll();
	}, [fetchAll]);

	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<div>
					<h1 className={styles.greeting}>Welcome back, {user?.name?.split(' ')[0]}</h1>
					<p className={styles.subheading}>
						Here's what's happening across your projects.
					</p>
				</div>
				<Link to="/projects" className={styles.newProjectButton}>
					<Plus size={16} />
					New Project
				</Link>
			</div>

			<section className={styles.section}>
				<h2 className={styles.sectionTitle}>Recent Projects</h2>
				{loading ? (
					<p className={styles.emptyText}>Loading...</p>
				) : projects.length === 0 ? (
					<div className={styles.emptyState}>
						<p className={styles.emptyText}>No projects yet.</p>
						<Link to="/projects" className={styles.emptyLink}>
							Create your first project →
						</Link>
					</div>
				) : (
					<div className={styles.projectList}>
						{projects.slice(0, 6).map((project) => (
							<Link
								key={project.uuid}
								to={`/projects/${project.uuid}`}
								className={styles.projectCard}
							>
								<div className={styles.projectCardHeader}>
									<span className={styles.projectName}>{project.name}</span>
									<span
										className={`${styles.badge} ${styles[`badge-${project.type}`]}`}
									>
										{project.type}
									</span>
								</div>
								{project.description && (
									<p className={styles.projectDescription}>
										{project.description}
									</p>
								)}
							</Link>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
