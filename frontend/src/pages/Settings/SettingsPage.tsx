import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import { getAuthToken } from '@/store/authToken';
import type { User } from '../../../../shared/types';
import styles from './SettingsPage.module.css';

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
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState(false);
	const [showNewUser, setShowNewUser] = useState(false);
	const [newEmail, setNewEmail] = useState('');
	const [newName, setNewName] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [newRole, setNewRole] = useState<'admin' | 'member'>('member');

	const isAdmin = user?.role === 'admin';

	useEffect(() => {
		if (isAdmin) loadUsers();
	}, [isAdmin]);

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
				<h1 className={styles.title}>Settings</h1>
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
