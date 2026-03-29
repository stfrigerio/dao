import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import styles from './Toast.module.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
	id: string;
	type: ToastType;
	title?: string;
	message: string;
	duration?: number;
}

interface ToastProps {
	toasts: ToastData[];
	removeToast: (id: string) => void;
}

const getIcon = (type: ToastType) => {
	switch (type) {
		case 'success':
			return (
				<svg
					className={`${styles.icon} ${styles.iconSuccess}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M5 13l4 4L19 7"
					/>
				</svg>
			);
		case 'error':
			return (
				<svg
					className={`${styles.icon} ${styles.iconError}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			);
		case 'warning':
			return (
				<svg
					className={`${styles.icon} ${styles.iconWarning}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
			);
		case 'info':
			return (
				<svg
					className={`${styles.icon} ${styles.iconInfo}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			);
	}
};

const getToastStyle = (type: ToastType) => {
	switch (type) {
		case 'success':
			return styles.toastSuccess;
		case 'error':
			return styles.toastError;
		case 'warning':
			return styles.toastWarning;
		case 'info':
			return styles.toastInfo;
		default:
			return '';
	}
};

const ToastItem: React.FC<{ toast: ToastData; removeToast: (id: string) => void }> = ({
	toast,
	removeToast,
}) => {
	const [progress, setProgress] = useState(100);
	const duration = toast.duration || 5000;

	useEffect(() => {
		const timer = setTimeout(() => removeToast(toast.id), duration);
		const interval = setInterval(() => {
			setProgress((prev) => {
				const next = prev - 100 / (duration / 100);
				return next <= 0 ? 0 : next;
			});
		}, 100);
		return () => {
			clearTimeout(timer);
			clearInterval(interval);
		};
	}, [toast.id, duration, removeToast]);

	const progressColor =
		toast.type === 'error' ? '#e6001a' : toast.type === 'warning' ? '#ffcc00' : '#00e5ff';

	return (
		<motion.div
			className={`${styles.toast} ${getToastStyle(toast.type)}`}
			initial={{ opacity: 0, x: 100, scale: 0.9 }}
			animate={{ opacity: 1, x: 0, scale: 1 }}
			exit={{ opacity: 0, x: 100, scale: 0.9 }}
			transition={{ type: 'spring', stiffness: 500, damping: 40 }}
			layout
		>
			{getIcon(toast.type)}
			<div className={styles.content}>
				{toast.title && <p className={styles.title}>{toast.title}</p>}
				<p className={styles.message}>{toast.message}</p>
			</div>
			<button
				className={styles.closeButton}
				onClick={() => removeToast(toast.id)}
				aria-label="Close"
			>
				<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
			<motion.div
				className={styles.progressBar}
				initial={{ width: '100%' }}
				animate={{ width: `${progress}%` }}
				style={{ color: progressColor }}
			/>
		</motion.div>
	);
};

export const ToastContainer: React.FC<ToastProps> = ({ toasts, removeToast }) => {
	return createPortal(
		<div className={styles.toastContainer}>
			<AnimatePresence mode="sync">
				{toasts.map((toast) => (
					<ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
				))}
			</AnimatePresence>
		</div>,
		document.body
	);
};
