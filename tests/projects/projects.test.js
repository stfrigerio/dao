import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { launchBrowser, login, BASE_URL, waitForText, apiCleanupProject } from '../helpers.js';

let browser;
let page;
const projectName = `Test Project ${Date.now()}`;

beforeAll(async () => {
	browser = await launchBrowser();
	page = await browser.newPage();
	await login(page);
});

afterAll(async () => {
	await apiCleanupProject(projectName); // safety net: deletes project if UI delete test failed
	await browser?.close();
});

describe('Projects', () => {
	test('navigates to projects page', async () => {
		await page.goto(`${BASE_URL}/projects`);
		await page.waitForSelector('h1, h2', { timeout: 5000 });
		expect(page.url()).toContain('/projects');
	});

	test('opens new project modal', async () => {
		await page.waitForFunction(
			() => Array.from(document.querySelectorAll('button')).some(
				(b) => b.innerText.toLowerCase().includes('new') || b.innerText.includes('+')
			),
			{ timeout: 5000 }
		);
		const buttons = await page.$$('button');
		for (const btn of buttons) {
			const text = await btn.evaluate((el) => el.innerText);
			if (text.toLowerCase().includes('new') || text.includes('+')) {
				await btn.click();
				break;
			}
		}
		await page.waitForSelector('input[placeholder="Project name"]', { timeout: 5000 });
	});

	test('creates a new project', async () => {
		await page.type('input[placeholder="Project name"]', projectName);
		await page.click('button[type="submit"]');
		await page.waitForFunction(
			(name) => document.body.innerText.includes(name),
			{ timeout: 10000 },
			projectName
		);
	});

	test('project appears in list after navigation', async () => {
		// Navigate away and back (SPA navigation, not a full reload — store stays intact)
		await page.click('a[href="/dashboard"], a[href*="dashboard"]').catch(() => {});
		await page.goto(`${BASE_URL}/projects`);
		// Wait for the store's items to render — may need to wait for fetch
		await page.waitForFunction(
			(name) => document.body.innerText.includes(name),
			{ timeout: 10000 },
			projectName
		);
	});

	test('navigates to project detail', async () => {
		const links = await page.$$('a');
		for (const link of links) {
			const href = await link.evaluate((el) => el.getAttribute('href') || '');
			const text = await link.evaluate((el) => el.innerText || el.textContent || '');
			if (href.includes('/projects/') && text.includes(projectName.slice(0, 10))) {
				await link.click();
				break;
			}
		}
		await page.waitForFunction(
			() => window.location.pathname.match(/\/projects\/[^/]+$/),
			{ timeout: 8000 }
		);
		expect(page.url()).toMatch(/\/projects\/.+/);
	});

	test('project detail shows all 5 phases', async () => {
		await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
		for (const phase of ['Discovery', 'Planning', 'Execution', 'Review', 'Done']) {
			await waitForText(page, phase, 5000);
		}
	});

	test('members tab loads user list', async () => {
		// Click Members tab and verify it renders content (not just a static label)
		const buttons = await page.$$('button');
		for (const btn of buttons) {
			const text = await btn.evaluate((el) => el.innerText);
			if (text.trim() === 'Members') { await btn.click(); break; }
		}
		// Admin user should appear as a project member
		await waitForText(page, 'admin@dao.local', 5000);
	});

	test('deletes the project', async () => {
		page.once('dialog', (dialog) => dialog.accept());
		await page.click('button[aria-label="delete project"]');
		await page.waitForFunction(
			() => window.location.pathname === '/projects',
			{ timeout: 8000 }
		);
		// Confirm the project is no longer in the list
		await page.waitForFunction(
			(name) => !document.body.innerText.includes(name),
			{ timeout: 10000 },
			projectName
		);
	});
});
