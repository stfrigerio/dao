import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import styles from './LoginPage.module.css';

export function LoginPage() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const { login, loading, error, clearError } = useAuthStore();
	const navigate = useNavigate();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		clearError();
		const ok = await login(email, password);
		if (ok) navigate('/dashboard');
	};

	return (
		<div className={styles.page}>
			<div className={styles.card}>
				<div className={styles.header}>
					<h1 className={styles.logo}>道</h1>
					<p className={styles.subtitle}>Sign in to your workspace</p>
				</div>

				<form className={styles.form} onSubmit={handleSubmit}>
					{error && <div className={styles.errorBanner}>{error}</div>}

					<div className={styles.field}>
						<label className={styles.label} htmlFor="email">
							Email
						</label>
						<input
							id="email"
							className={styles.input}
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@example.com"
							required
							autoFocus
						/>
					</div>

					<div className={styles.field}>
						<label className={styles.label} htmlFor="password">
							Password
						</label>
						<input
							id="password"
							className={styles.input}
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							required
						/>
					</div>

					<button className={styles.submitButton} type="submit" disabled={loading}>
						{loading ? 'Signing in...' : 'Sign in'}
					</button>
				</form>
			</div>
		</div>
	);
}
