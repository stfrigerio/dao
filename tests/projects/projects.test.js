import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { launchBrowser, login, BASE_URL, waitForText, apiCleanupProject } from '../helpers.js';

let browser;
let page;
const projectName = `Test Project ${Date.now()}`;
const projectDescription = 'E2E test project for creation flow';

beforeAll(async () => {
	browser = await launchBrowser();
	page = await browser.newPage();
	await login(page);
});

afterAll(async () => {
	await apiCleanupProject(projectName);
	await browser?.close();
});

describe('Projects', () => {
	test('navigates to projects page', async () => {
		await page.goto(`${BASE_URL}/projects`);
		await page.waitForSelector('h1', { timeout: 5000 });
		expect(page.url()).toContain('/projects');
	});

	test('opens new project modal', async () => {
		await page.waitForFunction(
			() =>
				Array.from(document.querySelectorAll('button')).some(
					(b) => b.innerText.toLowerCase().includes('new project')
				),
			{ timeout: 5000 }
		);
		const buttons = await page.$$('button');
		for (const btn of buttons) {
			const text = await btn.evaluate((el) => el.innerText);
			if (text.toLowerCase().includes('new project')) {
				await btn.click();
				break;
			}
		}
		await page.waitForSelector('input[placeholder="Project name"]', { timeout: 5000 });
	});

	test('fills in the project name and description', async () => {
		await page.type('input[placeholder="Project name"]', projectName);
		await page.type('textarea[placeholder="What is this project about?"]', projectDescription);
		const value = await page.$eval(
			'input[placeholder="Project name"]',
			(el) => el.value
		);
		expect(value).toBe(projectName);
	});

	test('selects the Personal project type', async () => {
		const buttons = await page.$$('button[type="button"]');
		for (const btn of buttons) {
			const text = await btn.evaluate((el) => el.innerText);
			if (text.trim() === 'Personal') {
				await btn.click();
				break;
			}
		}
		await page.waitForFunction(() => {
			const btns = Array.from(document.querySelectorAll('button[type="button"]'));
			const personal = btns.find((b) => b.innerText.trim() === 'Personal');
			return personal && personal.className.split(' ').length > 1;
		}, { timeout: 3000 });
	});

	test('submits the form and shows toast', async () => {
		await page.click('button[type="submit"]');
		await page.waitForFunction(
			() => !document.querySelector('input[placeholder="Project name"]'),
			{ timeout: 15000 }
		);
		await waitForText(page, `Project "${projectName}" created`, 10000);
	});

	test('project appears in list after navigation', async () => {
		await page.click('a[href="/dashboard"], a[href*="dashboard"]').catch(() => {});
		await page.goto(`${BASE_URL}/projects`);
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

	test('detail page shows the project name and description', async () => {
		await waitForText(page, projectName, 8000);
		await waitForText(page, projectDescription, 8000);
	});

	test('project detail shows all 5 phases', async () => {
		await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
		for (const phase of ['Discovery', 'Planning', 'Execution', 'Review', 'Done']) {
			await waitForText(page, phase, 5000);
		}
	});

	test('members tab loads user list', async () => {
		const buttons = await page.$$('button');
		for (const btn of buttons) {
			const text = await btn.evaluate((el) => el.innerText);
			if (text.trim() === 'Members') { await btn.click(); break; }
		}
		await waitForText(page, 'admin@dao.local', 5000);
	});

	test('deletes the project', async () => {
		page.once('dialog', (dialog) => dialog.accept());
		await page.click('button[aria-label="delete project"]');
		await page.waitForFunction(
			() => window.location.pathname === '/projects',
			{ timeout: 8000 }
		);
		await page.waitForFunction(
			(name) => !document.body.innerText.includes(name),
			{ timeout: 10000 },
			projectName
		);
	});
});
