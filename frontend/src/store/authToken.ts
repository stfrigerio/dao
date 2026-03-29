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
