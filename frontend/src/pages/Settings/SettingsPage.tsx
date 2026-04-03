import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { useThemeStore, type Palette } from '@/store/theme';
import { getAuthToken } from '@/store/authToken';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import type { User } from '../../../../shared/types';
import styles from './SettingsPage.module.css';

const PALETTES: { id: Palette; label: string; color: string; bg: string }[] = [
	{ id: 'red', label: 'Red', color: '#ff2020', bg: '#050101' },
	{ id: 'amber', label: 'Amber', color: '#ff9500', bg: '#010200' },
	{ id: 'green', label: 'Green', color: '#39ff62', bg: '#010401' },
	{ id: 'white', label: 'White', color: '#c8c8c8', bg: '#010101' },
	{ id: 'blue', label: 'Blue', color: '#80b4ff', bg: '#000105' },
];

const PALETTES_LIGHT: { id: Palette; label: string; color: string; bg: string }[] = [
	{ id: 'red-light', label: 'Red', color: '#cc1818', bg: '#f8f0f0' },
	{ id: 'amber-light', label: 'Amber', color: '#c07000', bg: '#f8f4ee' },
	{ id: 'green-light', label: 'Green', color: '#1a9e38', bg: '#f0f8f0' },
	{ id: 'white-light', label: 'White', color: '#555555', bg: '#f4f4f4' },
	{ id: 'blue-light', label: 'Blue', color: '#3070cc', bg: '#f0f4f8' },
];

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const getHeaders = () => {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const token = getAuthToken();
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return headers;
};

export function SettingsPage() {
	const { user } = useAuthStore();
	const toast = useToastStore();
	const { palette, setPalette } = useThemeStore();

	useBreadcrumb([{ label: 'Dashboard', to: '/dashboard' }, { label: 'Settings' }]);
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState(false);
	const [showNewUser, setShowNewUser] = useState(false);
	const [newEmail, setNewEmail] = useState('');
	const [newName, setNewName] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [newRole, setNewRole] = useState<'admin' | 'member'>('member');

	const [linearKey, setLinearKey] = useState('');
	const [linearConnected, setLinearConnected] = useState(false);
	const [linearSaving, setLinearSaving] = useState(false);

	const isAdmin = user?.role === 'admin';

	useEffect(() => {
		if (isAdmin) loadUsers();
	}, [isAdmin]);

	// Check if Linear is connected by loading any project's key
	useEffect(() => {
		(async () => {
			try {
				const res = await fetch(`${API_BASE_URL}/projects`, { headers: getHeaders() }); // allow-fetch
				if (!res.ok) return;
				const projects = await res.json();
				const connected = projects.some((p: any) => p.linearApiKey);
				setLinearConnected(connected);
			} catch {}
		})();
	}, []);

	const handleLinearSave = async () => {
		if (!linearKey.trim()) return;
		setLinearSaving(true);
		try {
			// Validate the key first
			const validateRes = await fetch(`${API_BASE_URL}/settings/linear`, { // allow-fetch
				method: 'POST',
				headers: getHeaders(),
				body: JSON.stringify({ apiKey: linearKey.trim() }),
			});
			if (!validateRes.ok) {
				const err = await validateRes.json().catch(() => ({}));
				toast.error(err.error || 'Invalid API key');
				return;
			}
			setLinearConnected(true);
			setLinearKey('');
			toast.success('Linear workspace connected');
		} catch {
			toast.error('Failed to connect Linear');
		} finally {
			setLinearSaving(false);
		}
	};

	const loadUsers = async () => {
		setLoading(true);
		try {
			const res = await fetch(`${API_BASE_URL}/users`, { headers: getHeaders() }); // allow-fetch
			if (res.ok) setUsers(await res.json());
		} finally {
			setLoading(false);
		}
	};

	const handleCreateUser = async (e: React.FormEvent) => {
		e.preventDefault();
		const res = await fetch(`${API_BASE_URL}/users`, {
			// allow-fetch
			method: 'POST',
			headers: getHeaders(),
			body: JSON.stringify({
				email: newEmail,
				name: newName,
				password: newPassword,
				role: newRole,
			}),
		});
		if (!res.ok) {
			toast.error('Failed to create user');
			return;
		}
		const created = await res.json();
		setUsers((prev) => [...prev, created]);
		setShowNewUser(false);
		setNewEmail('');
		setNewName('');
		setNewPassword('');
		setNewRole('member');
		toast.success(`User ${created.name} created`);
	};

	const handleDeleteUser = async (uuid: string) => {
		if (!confirm('Delete this user?')) return;
		const res = await fetch(`${API_BASE_URL}/users/${uuid}`, {
			// allow-fetch
			method: 'DELETE',
			headers: getHeaders(),
		});
		if (!res.ok) {
			toast.error('Failed to delete user');
			return;
		}
		setUsers((prev) => prev.filter((u) => u.uuid !== uuid));
		toast.success('User deleted');
	};

	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<h1 className={styles.title}>Settings <span className="han">设置</span></h1>
			</div>

			<section className={styles.section}>
				<h2 className={styles.sectionTitle}>Your Profile</h2>
				<div className={styles.profileCard}>
					<div className={styles.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
					<div>
						<p className={styles.profileName}>{user?.name}</p>
						<p className={styles.profileEmail}>{user?.email}</p>
						<span className={`${styles.roleBadge} ${styles[`role-${user?.role}`]}`}>
							{user?.role}
						</span>
					</div>
				</div>
			</section>

			<section className={styles.section}>
				<h2 className={styles.sectionTitle}>Display</h2>
				<p className={styles.sectionDesc}>CRT phosphor color</p>
				<div className={styles.paletteGrid}>
					{PALETTES.map((p) => (
						<button
							key={p.id}
							className={`${styles.paletteSwatch} ${palette === p.id ? styles.paletteSwatchActive : ''}`}
							onClick={() => setPalette(p.id)}
						>
							<span
								className={styles.palettePreview}
								style={{ background: p.bg, borderColor: p.color }}
							>
								<span
									style={{ background: p.color }}
									className={styles.paletteDot}
								/>
							</span>
							<span className={styles.paletteLabel}>{p.label}</span>
						</button>
					))}
				</div>
				<p className={styles.sectionDesc}>Light mode</p>
				<div className={styles.paletteGrid}>
					{PALETTES_LIGHT.map((p) => (
						<button
							key={p.id}
							className={`${styles.paletteSwatch} ${palette === p.id ? styles.paletteSwatchActive : ''}`}
							onClick={() => setPalette(p.id)}
						>
							<span
								className={styles.palettePreview}
								style={{ background: p.bg, borderColor: p.color }}
							>
								<span
									style={{ background: p.color }}
									className={styles.paletteDot}
								/>
							</span>
							<span className={styles.paletteLabel}>{p.label}</span>
						</button>
					))}
				</div>
			</section>

			{isAdmin && (
				<section className={styles.section}>
					<h2 className={styles.sectionTitle}>Linear</h2>
					{linearConnected ? (
						<p className={styles.sectionDesc}>Workspace connected. All projects will sync to this Linear workspace.</p>
					) : (
						<>
							<p className={styles.sectionDesc}>Connect a Linear workspace to enable issue sync across all projects.</p>
							<div className={styles.formRow}>
								<input
									className={styles.input}
									type="password"
									placeholder="lin_api_..."
									value={linearKey}
									onChange={(e) => setLinearKey(e.target.value)}
								/>
								<button
									className={styles.submitButton}
									onClick={handleLinearSave}
									disabled={linearSaving || !linearKey.trim()}
								>
									{linearSaving ? 'Connecting...' : 'Connect'}
								</button>
							</div>
						</>
					)}
				</section>
			)}

			{isAdmin && (
				<section className={styles.section}>
					<div className={styles.sectionHeader}>
						<h2 className={styles.sectionTitle}>Users</h2>
						<button className={styles.addButton} onClick={() => setShowNewUser(true)}>
							<Plus size={14} />
							Add User
						</button>
					</div>

					{showNewUser && (
						<form className={styles.newUserForm} onSubmit={handleCreateUser}>
							<div className={styles.formRow}>
								<input
									className={styles.input}
									type="text"
									placeholder="Name"
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									required
								/>
								<input
									className={styles.input}
									type="email"
									placeholder="Email"
									value={newEmail}
									onChange={(e) => setNewEmail(e.target.value)}
									required
								/>
								<input
									className={styles.input}
									type="password"
									placeholder="Password"
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									required
								/>
								<select
									className={styles.select}
									value={newRole}
									onChange={(e) =>
										setNewRole(e.target.value as 'admin' | 'member')
									}
								>
									<option value="member">Member</option>
									<option value="admin">Admin</option>
								</select>
							</div>
							<div className={styles.formActions}>
								<button
									type="button"
									className={styles.cancelButton}
									onClick={() => setShowNewUser(false)}
								>
									Cancel
								</button>
								<button type="submit" className={styles.submitButton}>
									Create User
								</button>
							</div>
						</form>
					)}

					{loading ? (
						<p className={styles.loading}>Loading users...</p>
					) : (
						<div className={styles.userList}>
							{users.map((u) => (
								<div key={u.uuid} className={styles.userRow}>
									<div className={styles.userAvatar}>
										{u.name[0]?.toUpperCase()}
									</div>
									<div className={styles.userInfo}>
										<span className={styles.userName}>{u.name}</span>
										<span className={styles.userEmail}>{u.email}</span>
									</div>
									<span
										className={`${styles.roleBadge} ${styles[`role-${u.role}`]}`}
									>
										{u.role}
									</span>
									{u.uuid !== user?.uuid && (
										<button
											className={styles.deleteButton}
											onClick={() => handleDeleteUser(u.uuid)}
										>
											<Trash2 size={14} />
										</button>
									)}
								</div>
							))}
						</div>
					)}
				</section>
			)}
		</div>
	);
}
