import React from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
	icon?: React.ReactNode;
	message: string;
}

export function EmptyState({ icon, message }: EmptyStateProps) {
	return (
		<div className={styles.wrapper}>
			{icon && <div className={styles.icon}>{icon}</div>}
			<p className={styles.message}>{message}</p>
		</div>
	);
}
