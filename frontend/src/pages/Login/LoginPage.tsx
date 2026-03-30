import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
			<motion.div
				className={styles.card}
				initial={{ opacity: 0, y: 24 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: -16 }}
				transition={{ duration: 0.5, ease: 'easeOut' }}
			>
				<motion.div
					className={styles.header}
					initial={{ opacity: 0, scale: 0.85 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ delay: 0.15, duration: 0.45, ease: 'easeOut' }}
				>
					<h1 className={styles.logo}>道</h1>
					<p className={styles.subtitle}>the way</p>
				</motion.div>

				<motion.form
					className={styles.form}
					onSubmit={handleSubmit}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.3, duration: 0.4 }}
				>
					{error && <div className={styles.errorBanner}>{error}</div>}

					<div className={styles.field}>
						<label className={styles.label} htmlFor="email">
							Email
						</label>
						<input
							id="email"
							className={styles.input}
							type={import.meta.env.VITE_DEV_AUTH_BYPASS === 'true' ? 'text' : 'email'}
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
				</motion.form>
			</motion.div>
		</div>
	);
}
