import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { User } from '../../../shared/types';
import { setAuthToken } from './authToken';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface AuthState {
	user: User | null;
	token: string | null;
	loading: boolean;
	error: string | null;

	login: (email: string, password: string) => Promise<boolean>;
	logout: () => Promise<void>;
	fetchMe: () => Promise<void>;
	clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
	devtools(
		persist(
			(set, get) => ({
				user: null,
				token: null,
				loading: false,
				error: null,

				login: async (email, password) => {
					set({ loading: true, error: null });
					try {
						const response = await fetch(`${API_BASE_URL}/auth/login`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							credentials: 'include',
							body: JSON.stringify({ email, password }),
						});
						if (!response.ok) {
							const err = await response.json().catch(() => ({}));
							throw new Error(err.error || 'Invalid credentials');
						}
						const { accessToken, user } = await response.json();
						setAuthToken(accessToken);
						set({ token: accessToken, user, loading: false });
						return true;
					} catch (error) {
						set({
							loading: false,
							error: error instanceof Error ? error.message : 'Login failed',
						});
						return false;
					}
				},

				logout: async () => {
					try {
						await fetch(`${API_BASE_URL}/auth/logout`, {
							method: 'POST',
							credentials: 'include',
						});
					} catch (_) {
						// ignore network errors on logout
					}
					setAuthToken(null);
					set({ user: null, token: null });
				},

				fetchMe: async () => {
					const { token } = get();
					if (!token) return;
					setAuthToken(token);
					try {
						const response = await fetch(`${API_BASE_URL}/auth/me`, {
							headers: { Authorization: `Bearer ${token}` },
						});
						if (!response.ok) {
							set({ user: null, token: null });
							setAuthToken(null);
							return;
						}
						const user = await response.json();
						set({ user });
					} catch (_) {
						set({ user: null, token: null });
						setAuthToken(null);
					}
				},

				clearError: () => set({ error: null }),
			}),
			{
				name: 'dao-auth',
				partialize: (state) => ({ token: state.token }),
				onRehydrateStorage: () => (state) => {
					if (state?.token) setAuthToken(state.token);
				},
			}
		),
		{ name: 'AuthStore' }
	)
);
