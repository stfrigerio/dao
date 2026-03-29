import React from 'react';
import styles from './Badge.module.css';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'accent';

interface BadgeProps {
	children: React.ReactNode;
	variant?: BadgeVariant;
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
	return <span className={`${styles.badge} ${styles[variant]}`}>{children}</span>;
}
