import puppeteer from 'puppeteer';

export const BASE_URL = 'http://localhost:10000';
export const CREDENTIALS = { email: 'admin@dao.local', password: 'admin123' };

export async function launchBrowser() {
	return puppeteer.launch({
		headless: true,
		executablePath: '/usr/bin/google-chrome-stable',
		args: ['--no-sandbox', '--disable-setuid-sandbox'],
	});
}

export async function login(page) {
	await page.goto(`${BASE_URL}/login`);
	await page.waitForSelector('#email');
	await page.type('#email', CREDENTIALS.email);
	await page.type('#password', CREDENTIALS.password);
	await page.click('button[type="submit"]');
	await page.waitForNavigation({ waitUntil: 'networkidle0' });
}

export async function waitForText(page, text, timeout = 5000) {
	await page.waitForFunction(
		(t) => document.body.innerText.includes(t),
		{ timeout },
		text
	);
}

const API_URL = 'http://localhost:10001/api';

/**
 * Detect whether DEV_AUTH_BYPASS is enabled by attempting a login with bogus
 * credentials.  If the server lets us in, bypass is on.
 */
let _bypassCached = null;
export async function isAuthBypassed() {
	if (_bypassCached !== null) return _bypassCached;
	try {
		const res = await fetch(`${API_URL}/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'bypass-probe@test', password: 'x' }),
		});
		_bypassCached = res.ok;
	} catch {
		_bypassCached = false;
	}
	return _bypassCached;
}

/** Ensure a phase panel is open by name. If it's already open, don't toggle it closed. */
export async function clickPhaseCard(page, phaseName) {
	await page.waitForSelector(`[data-testid="phase-card-${phaseName}"]`, { timeout: 8000 });
	const alreadyOpen = await page.evaluate((name) => {
		const h3s = Array.from(document.querySelectorAll('h3'));
		return h3s.some((h) => h.innerText.trim() === name);
	}, phaseName);
	if (!alreadyOpen) {
		await page.click(`[data-testid="phase-card-${phaseName}"]`);
	}
}

/** Close a phase panel by clicking its card (only if it's currently open). */
export async function closePhasePanel(page, phaseName) {
	const isOpen = await page.evaluate((name) => {
		const h3s = Array.from(document.querySelectorAll('h3'));
		return h3s.some((h) => h.innerText.trim() === name);
	}, phaseName);
	if (isOpen) {
		await page.click(`[data-testid="phase-card-${phaseName}"]`);
	}
}

async function getAdminToken() {
	const res = await fetch(`${API_URL}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email: CREDENTIALS.email, password: CREDENTIALS.password }),
	});
	const { accessToken } = await res.json();
	return accessToken;
}

// Safety-net cleanup: call in afterAll to delete a project by name even if the UI delete test failed.
// This ensures no test data is ever left in the DB regardless of test outcome.
export async function apiCleanupProject(projectName) {
	try {
		const token = await getAdminToken();
		const headers = { Authorization: `Bearer ${token}` };
		const listRes = await fetch(`${API_URL}/projects`, { headers });
		const projects = await listRes.json();
		const match = projects.find((p) => p.name === projectName);
		if (match) {
			await fetch(`${API_URL}/projects/${match.uuid}`, { method: 'DELETE', headers });
		}
	} catch {
		// Best-effort — don't fail the test suite on cleanup errors
	}
}

// Safety-net cleanup: call in afterAll to delete a user by email even if the UI delete test failed.
export async function apiCleanupUser(email) {
	if (!email) return;
	try {
		const token = await getAdminToken();
		const headers = { Authorization: `Bearer ${token}` };
		const listRes = await fetch(`${API_URL}/users`, { headers });
		const users = await listRes.json();
		const match = users.find((u) => u.email === email);
		if (match) {
			await fetch(`${API_URL}/users/${match.uuid}`, { method: 'DELETE', headers });
		}
	} catch {
		// Best-effort — don't fail the test suite on cleanup errors
	}
}
