import React, { useState, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Settings, LogOut, Menu, X } from 'lucide-react';
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
	const location = useLocation();
	const crumbs = useBreadcrumbCrumbs();
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const closeSidebar = useCallback(() => setSidebarOpen(false), []);

	// Close sidebar on navigation
	React.useEffect(() => {
		setSidebarOpen(false);
	}, [location.pathname]);

	const handleLogout = async () => {
		await logout();
		navigate('/login');
	};

	return (
		<div className={styles.shell}>
			{sidebarOpen && <div className={styles.overlay} onClick={closeSidebar} />}

			<nav className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
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
						<span className="han">概览</span>
					</NavLink>
					<NavLink
						to="/projects"
						className={({ isActive }) =>
							`${styles.navItem} ${isActive ? styles.navItemActive : ''}`
						}
					>
						<FolderKanban size={18} />
						<DecryptText>Projects</DecryptText>
						<span className="han">项目</span>
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
						<span className="han">设置</span>
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
					<button
						className={styles.hamburger}
						onClick={() => setSidebarOpen((o) => !o)}
						aria-label="Toggle menu"
					>
						{sidebarOpen ? <X size={20} /> : <Menu size={20} />}
					</button>
					<Breadcrumb items={crumbs} />
				</header>
				<main className={styles.main}>{children}</main>
			</div>
		</div>
	);
}
