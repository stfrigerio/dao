import React, { useState } from 'react';
import {
	Info,
	Lightbulb,
	CheckCircle,
	AlertTriangle,
	AlertOctagon,
	HelpCircle,
	ClipboardList,
	FileText,
	ChevronDown,
	type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './Callout.module.css';

export type CalloutType =
	| 'note'
	| 'info'
	| 'tip'
	| 'success'
	| 'warning'
	| 'danger'
	| 'question'
	| 'abstract';

const META: Record<CalloutType, { icon: LucideIcon; label: string }> = {
	note: { icon: FileText, label: 'Note' },
	info: { icon: Info, label: 'Info' },
	tip: { icon: Lightbulb, label: 'Tip' },
	success: { icon: CheckCircle, label: 'Success' },
	warning: { icon: AlertTriangle, label: 'Warning' },
	danger: { icon: AlertOctagon, label: 'Danger' },
	question: { icon: HelpCircle, label: 'Question' },
	abstract: { icon: ClipboardList, label: 'Abstract' },
};

interface CalloutProps {
	type?: CalloutType;
	title?: string;
	/** Default open state when collapsible. Defaults to true. */
	defaultOpen?: boolean;
	/** Extra content rendered in the header row (e.g. icon buttons). */
	actions?: React.ReactNode;
	children: React.ReactNode;
}

export function Callout({
	type = 'note',
	title,
	defaultOpen = true,
	actions,
	children,
}: CalloutProps) {
	const { icon: Icon, label } = META[type];
	const [open, setOpen] = useState(defaultOpen);

	return (
		<div className={`${styles.callout} ${styles[type]}`}>
			<div className={styles.header} data-expanded={open}>
				<button
					className={styles.headerToggle}
					onClick={() => setOpen((o) => !o)}
					aria-expanded={open}
				>
					<Icon size={14} className={styles.icon} />
					<span className={styles.title}>{title ?? label}</span>
					<ChevronDown
						size={13}
						className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
					/>
				</button>
				{actions && (
					<div className={styles.headerActions} onClick={(e) => e.stopPropagation()}>
						{actions}
					</div>
				)}
			</div>

			<AnimatePresence initial={false}>
				{open && (
					<motion.div
						key="body"
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.18, ease: 'easeInOut' }}
						style={{ overflow: 'hidden' }}
					>
						<div className={styles.body}>{children}</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
