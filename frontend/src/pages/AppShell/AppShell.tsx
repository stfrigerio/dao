import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { Breadcrumb } from '@/components/atoms/Breadcrumb/Breadcrumb';
import { GlitchText } from '@/components/atoms/GlitchText/GlitchText';
import { DecryptText } from '@/components/atoms/DecryptText/DecryptText';
import { useBreadcrumbCrumbs } from '@/context/BreadcrumbContext';
import styles from './AppShell.module.css';

interface AppShellProps {
	children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
	const { user, logout } = useAuthStore();
	const navigate = useNavigate();
	const crumbs = useBreadcrumbCrumbs();

	const handleLogout = async () => {
		await logout();
		navigate('/login');
	};

	return (
		<div className={styles.shell}>
			<nav className={styles.sidebar}>
				<div className={styles.logo}>
					<GlitchText className={styles.logoText}>道</GlitchText>
				</div>

				<div className={styles.navItems}>
					<NavLink
						to="/dashboard"
						className={({ isActive }) =>
							`${styles.navItem} ${isActive ? styles.navItemActive : ''}`
						}
					>
						<LayoutDashboard size={18} />
						<DecryptText>Dashboard</DecryptText>
					</NavLink>
					<NavLink
						to="/projects"
						className={({ isActive }) =>
							`${styles.navItem} ${isActive ? styles.navItemActive : ''}`
						}
					>
						<FolderKanban size={18} />
						<DecryptText>Projects</DecryptText>
					</NavLink>
				</div>

				<div className={styles.bottomSection}>
					<NavLink
						to="/settings"
						className={({ isActive }) =>
							`${styles.navItem} ${isActive ? styles.navItemActive : ''}`
						}
					>
						<Settings size={18} />
						<DecryptText>Settings</DecryptText>
					</NavLink>
					<div className={styles.userInfo}>
						<DecryptText className={styles.userName}>{user?.name ?? ''}</DecryptText>
						<DecryptText className={styles.userEmail}>{user?.email ?? ''}</DecryptText>
					</div>
					<button className={styles.logoutButton} onClick={handleLogout}>
						<LogOut size={16} />
						<DecryptText>Logout</DecryptText>
					</button>
				</div>
			</nav>

			<div className={styles.content}>
				<header className={styles.topBar}>
					<Breadcrumb items={crumbs} />
				</header>
				<main className={styles.main}>{children}</main>
			</div>
		</div>
	);
}
