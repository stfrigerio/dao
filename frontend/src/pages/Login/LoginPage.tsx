import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import { FaultyTerminal } from '@/components/atoms/FaultyTerminal/FaultyTerminal';
import styles from './LoginPage.module.css';

const PALETTE_TINTS: Record<string, string> = {
	amber: '#ff9500',
	red: '#ff2020',
	green: '#39ff62',
	white: '#c8c8c8',
	blue: '#80b4ff',
};

export function LoginPage() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const { login, loading, error, clearError } = useAuthStore();
	const { palette } = useThemeStore();
	const navigate = useNavigate();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		clearError();
		const ok = await login(email, password);
		if (ok) navigate('/dashboard');
	};

	return (
		<div className={styles.page}>
			<FaultyTerminal
				tint={PALETTE_TINTS[palette] ?? '#ff9500'}
				brightness={0.35}
				curvature={0.15}
				glitchAmount={2}
				flickerAmount={1.2}
				scanlineIntensity={1.1}
				chromaticAberration={1.5}
				noiseAmp={0.6}
				mouseReact
			/>
			<div className={styles.card}>
				<div className={styles.header}>
					<h1 className={styles.logo}>道</h1>
					<p className={styles.subtitle}>the way</p>
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
