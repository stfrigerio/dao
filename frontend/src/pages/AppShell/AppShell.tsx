import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import styles from './AppShell.module.css';

interface AppShellProps {
	children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
	const { user, logout } = useAuthStore();
	const navigate = useNavigate();

	const handleLogout = async () => {
		await logout();
		navigate('/login');
	};

	return (
		<div className={styles.shell}>
			<nav className={styles.sidebar}>
				<div className={styles.logo}>
					<span className={styles.logoText}>道</span>
				</div>

				<div className={styles.navItems}>
					<NavLink
						to="/dashboard"
						className={({ isActive }) =>
							`${styles.navItem} ${isActive ? styles.navItemActive : ''}`
						}
					>
						<LayoutDashboard size={18} />
						<span>Dashboard</span>
					</NavLink>
					<NavLink
						to="/projects"
						className={({ isActive }) =>
							`${styles.navItem} ${isActive ? styles.navItemActive : ''}`
						}
					>
						<FolderKanban size={18} />
						<span>Projects</span>
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
						<span>Settings</span>
					</NavLink>
					<div className={styles.userInfo}>
						<span className={styles.userName}>{user?.name}</span>
						<span className={styles.userEmail}>{user?.email}</span>
					</div>
					<button className={styles.logoutButton} onClick={handleLogout}>
						<LogOut size={16} />
						<span>Logout</span>
					</button>
				</div>
			</nav>

			<main className={styles.main}>{children}</main>
		</div>
	);
}
