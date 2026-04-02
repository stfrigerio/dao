import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { ProjectType } from '../../../../../shared/types';
import styles from './NewProjectModal.module.css';

interface NewProjectModalProps {
	onClose: () => void;
	onCreate: (data: { name: string; description: string; type: ProjectType }) => Promise<void>;
}

export function NewProjectModal({ onClose, onCreate }: NewProjectModalProps) {
	const [name, setName] = useState('');
	const [type, setType] = useState<ProjectType>('professional');
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;
		setLoading(true);
		await onCreate({ name: name.trim(), description: '', type });
		setLoading(false);
	};

	return (
		<div className={styles.backdrop} onClick={onClose}>
			<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
				<div className={styles.modalHeader}>
					<h2 className={styles.modalTitle}>New Project</h2>
					<button className={styles.closeButton} onClick={onClose}>
						<X size={18} />
					</button>
				</div>

				<form className={styles.form} onSubmit={handleSubmit}>
					<div className={styles.field}>
						<label className={styles.label}>Name</label>
						<input
							className={styles.input}
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Project name"
							autoFocus
							required
						/>
					</div>

					<div className={styles.field}>
						<label className={styles.label}>Description</label>
						<textarea
							className={styles.textarea}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="What is this project about?"
							rows={3}
						/>
					</div>

					<div className={styles.field}>
						<label className={styles.label}>Type</label>
						<div className={styles.typeToggle}>
							<button
								type="button"
								className={`${styles.typeButton} ${type === 'professional' ? styles.typeButtonActive : ''}`}
								onClick={() => setType('professional')}
							>
								Professional
							</button>
							<button
								type="button"
								className={`${styles.typeButton} ${type === 'personal' ? styles.typeButtonActive : ''}`}
								onClick={() => setType('personal')}
							>
								Personal
							</button>
						</div>
					</div>

					<div className={styles.actions}>
						<button type="button" className={styles.cancelButton} onClick={onClose}>
							Cancel
						</button>
						<button
							type="submit"
							className={styles.createButton}
							disabled={loading || !name.trim()}
						>
							{loading ? 'Creating...' : 'Create Project'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
