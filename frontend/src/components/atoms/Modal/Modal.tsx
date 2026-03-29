import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

interface ModalProps {
	open: boolean;
	title: string;
	onClose: () => void;
	children: React.ReactNode;
	size?: 'default' | 'compact';
	actions?: React.ReactNode;
}

export function Modal({ open, title, onClose, children, size = 'default', actions }: ModalProps) {
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [open, onClose]);

	return createPortal(
		<AnimatePresence>
			{open && (
				<motion.div
					className={styles.backdrop}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.15 }}
					onClick={onClose}
				>
					<motion.div
						className={`${styles.dialog} ${size === 'compact' ? styles.dialogCompact : ''}`}
						initial={{ opacity: 0, scale: 0.96, y: 8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 8 }}
						transition={{ duration: 0.15, ease: 'easeOut' }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className={styles.header}>
							<span className={styles.title}>{title}</span>
							{actions && <div className={styles.headerActions}>{actions}</div>}
							<button
								className={styles.closeButton}
								onClick={onClose}
								aria-label="close"
							>
								<X size={16} />
							</button>
						</div>
						<div className={styles.body}>{children}</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>,
		document.body
	);
}
