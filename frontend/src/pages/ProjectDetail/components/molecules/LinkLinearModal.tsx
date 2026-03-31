import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Project } from '../../../../../../shared/types';
import { useProjectStore } from '@/store/projects';
import { useToastStore } from '@/store/toast';
import styles from './LinkLinearModal.module.css';

interface LinkLinearModalProps {
	project: Project;
	onClose: () => void;
}

export function LinkLinearModal({ project, onClose }: LinkLinearModalProps) {
	const { linkLinear } = useProjectStore();
	const toast = useToastStore();
	const [apiKey, setApiKey] = useState('');
	const [saving, setSaving] = useState(false);

	const handleSave = async () => {
		if (!apiKey.trim()) return;
		setSaving(true);
		const ok = await linkLinear(project.uuid, apiKey.trim());
		setSaving(false);
		if (ok) {
			toast.success('Linear workspace linked');
			onClose();
		} else {
			toast.error('Invalid API key');
		}
	};

	return (
		<div className={styles.backdrop} onClick={onClose}>
			<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
				<div className={styles.header}>
					<h2 className={styles.title}>Link Linear Workspace</h2>
					<button className={styles.closeButton} onClick={onClose}>
						<X size={18} />
					</button>
				</div>

				<div className={styles.body}>
					<div className={styles.field}>
						<label className={styles.label}>API Key</label>
						<input
							className={styles.input}
							type="password"
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
							placeholder="lin_api_..."
							autoFocus
						/>
					</div>

					<div className={styles.actions}>
						<button className={styles.cancelButton} onClick={onClose}>
							Cancel
						</button>
						<button
							className={styles.saveButton}
							onClick={handleSave}
							disabled={!apiKey.trim() || saving}
						>
							{saving ? 'Linking...' : 'Link Workspace'}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
