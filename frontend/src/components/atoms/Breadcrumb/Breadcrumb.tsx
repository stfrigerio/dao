import type { ElementType } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Home } from 'lucide-react';
import styles from './Breadcrumb.module.css';

export interface Crumb {
	label: string;
	to?: string;
	icon?: ElementType;
}

interface BreadcrumbProps {
	items: Crumb[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
	return (
		<nav className={styles.nav}>
			<AnimatePresence mode="popLayout" initial={false}>
				{items.map((item, i) => {
					const isLast = i === items.length - 1;
					const isFirst = i === 0;
					const Icon = item.icon ?? (isFirst ? Home : undefined);
					const key = item.to ?? item.label;

					return (
						<motion.span
							key={key}
							className={styles.crumbGroup}
							initial={{ opacity: 0, x: 10 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: -6 }}
							transition={{ duration: 0.15, ease: 'easeOut' }}
						>
							{i > 0 && <span className={styles.separator}>/</span>}
							{isLast || !item.to ? (
								<span className={styles.current}>
									{Icon && <Icon className={styles.icon} />}
									{item.label}
								</span>
							) : (
								<Link
									to={item.to}
									className={`${styles.link} ${isFirst && !item.label ? styles.iconOnly : ''}`}
								>
									{Icon && <Icon className={styles.icon} />}
									{item.label}
								</Link>
							)}
						</motion.span>
					);
				})}
			</AnimatePresence>
		</nav>
	);
}
