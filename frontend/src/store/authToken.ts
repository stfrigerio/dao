// Module-level auth token shared across all stores
// The auth store sets this on login; base store reads it on every request

// Synchronously hydrate from localStorage on module load so getAuthToken()
// works immediately on page reload, before Zustand's async onRehydrateStorage fires
let _token: string | null = (() => {
	try {
		const raw = localStorage.getItem('dao-auth');
		if (raw) return JSON.parse(raw)?.state?.token ?? null;
	} catch {}
	return null;
})();

export const getAuthToken = (): string | null => _token;
export const setAuthToken = (token: string | null): void => {
	_token = token;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
let _refreshPromise: Promise<string | null> | null = null;

/**
 * Try to get a fresh access token using the httpOnly refresh cookie.
 * Deduplicates concurrent calls so only one refresh request is in-flight.
 */
export async function refreshAccessToken(): Promise<string | null> {
	if (_refreshPromise) return _refreshPromise;

	_refreshPromise = (async () => {
		try {
			const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
				method: 'POST',
				credentials: 'include',
			});
			if (!res.ok) return null;
			const { accessToken } = await res.json();
			setAuthToken(accessToken);
			// Persist to localStorage so Zustand picks it up on next hydration
			try {
				const raw = localStorage.getItem('dao-auth');
				if (raw) {
					const parsed = JSON.parse(raw);
					parsed.state.token = accessToken;
					localStorage.setItem('dao-auth', JSON.stringify(parsed));
				}
			} catch {}
			return accessToken as string;
		} catch {
			return null;
		} finally {
			_refreshPromise = null;
		}
	})();

	return _refreshPromise;
}

/**
 * Wrapper around fetch that auto-retries once on 401 using the refresh token.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	const res = await fetch(input, init);
	if (res.status !== 401) return res;

	const newToken = await refreshAccessToken();
	if (!newToken) return res; // refresh failed, return original 401

	// Retry with new token
	const newHeaders = new Headers(init?.headers);
	newHeaders.set('Authorization', `Bearer ${newToken}`);
	return fetch(input, { ...init, headers: newHeaders });
}
