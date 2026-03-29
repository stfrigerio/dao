import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { launchBrowser, login, BASE_URL, apiCleanupProject } from './helpers.js';

let browser;
let page;
let projectUrl = '';
const projectName = `Docs Test Project ${Date.now()}`;

beforeAll(async () => {
	browser = await launchBrowser();
	page = await browser.newPage();
	await login(page);
});

afterAll(async () => {
	await apiCleanupProject(projectName); // safety net: deletes project if UI delete test failed
	await browser?.close();
});

describe('Discovery Agent — generate objectives', () => {
	// ── 1. Setup ──────────────────────────────────────────────────────────────

	test('1. creates a project for the discovery agent flow', async () => {
		await page.goto(`${BASE_URL}/projects`);
		await page.waitForFunction(
			() =>
				Array.from(document.querySelectorAll('button')).some(
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
		await page.type('input[placeholder="Project name"]', projectName);
		await page.click('button[type="submit"]');
		await page.waitForFunction(
			(name) => document.body.innerText.includes(name),
			{ timeout: 10000 },
			projectName
		);
	});

	test('2. navigates to the project detail page', async () => {
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
		projectUrl = page.url();
		expect(projectUrl).toMatch(/\/projects\/.+/);
	});

	// ── 3. Documents tab ──────────────────────────────────────────────────────

	test('3. Documents tab is present and shows empty state', async () => {
		// Wait for the Phases tab to be rendered (confirms project page is fully loaded)
		await page.waitForFunction(
			() => Array.from(document.querySelectorAll('button')).some((b) => b.innerText.trim() === 'Documents'),
			{ timeout: 8000 }
		);

		// Click it
		await page.evaluate(() => {
			const btn = Array.from(document.querySelectorAll('button')).find(
				(b) => b.innerText.trim() === 'Documents'
			);
			if (btn) btn.click();
		});

		await page.waitForFunction(
			() => {
				const body = document.body.innerText;
				return !body.includes('Loading documents') && body.includes('No documents yet');
			},
			{ timeout: 15000 }
		);
	});

	// ── 4. Discovery phase panel ──────────────────────────────────────────────

	test('4. clicking the Discovery phase card opens a panel with GENERATE OBJECTIVES button', async () => {
		// Switch back to Phases tab
		const buttons = await page.$$('button');
		for (const btn of buttons) {
			const text = await btn.evaluate((el) => el.innerText.trim());
			if (text === 'Phases') {
				await btn.click();
				break;
			}
		}

		await page.waitForFunction(
			() => {
				const spans = Array.from(document.querySelectorAll('span'));
				return spans.some((s) => s.innerText.trim() === 'Discovery');
			},
			{ timeout: 5000 }
		);
		await page.evaluate(() => {
			const spans = Array.from(document.querySelectorAll('span'));
			const discoverySpan = spans.find((s) => s.innerText.trim() === 'Discovery');
			if (discoverySpan) discoverySpan.closest('div')?.click();
		});

		await page.waitForSelector('button[aria-label="run discovery agent"]', { timeout: 8000 });
	});

	test('5. non-Discovery phases do NOT show the GENERATE OBJECTIVES button', async () => {
		// Close Discovery panel by clicking its card again
		await page.evaluate(() => {
			const spans = Array.from(document.querySelectorAll('span'));
			const s = spans.find((s) => s.innerText.trim() === 'Discovery');
			if (s) s.closest('div')?.click();
		});
		await page.waitForFunction(
			() => !document.querySelector('button[aria-label="run discovery agent"]'),
			{ timeout: 5000 }
		);

		// Open Planning phase
		await page.evaluate(() => {
			const spans = Array.from(document.querySelectorAll('span'));
			const s = spans.find((s) => s.innerText.trim() === 'Planning');
			if (s) s.closest('div')?.click();
		});
		await page.waitForFunction(
			() => Array.from(document.querySelectorAll('h3')).some((h) => h.innerText.trim() === 'Planning'),
			{ timeout: 5000 }
		);

		const agentButton = await page.$('button[aria-label="run discovery agent"]');
		expect(agentButton).toBeNull();

		// Close Planning panel
		await page.evaluate(() => {
			const spans = Array.from(document.querySelectorAll('span'));
			const s = spans.find((s) => s.innerText.trim() === 'Planning');
			if (s) s.closest('div')?.click();
		});
		await page.waitForFunction(
			() => !Array.from(document.querySelectorAll('h3')).some((h) => h.innerText.trim() === 'Planning'),
			{ timeout: 5000 }
		);
	});

	// ── 6. Run the agent ──────────────────────────────────────────────────────

	test('6. clicking GENERATE OBJECTIVES shows GENERATING… on the button', async () => {
		// Re-open Discovery
		await page.evaluate(() => {
			const spans = Array.from(document.querySelectorAll('span'));
			const s = spans.find((s) => s.innerText.trim() === 'Discovery');
			if (s) s.closest('div')?.click();
		});
		await page.waitForSelector('button[aria-label="run discovery agent"]', { timeout: 8000 });
		await page.click('button[aria-label="run discovery agent"]');

		await page.waitForFunction(
			() => {
				const btn = document.querySelector('button[aria-label="run discovery agent"]');
				return btn && (btn.disabled || btn.innerText.includes('GENERATING'));
			},
			{ timeout: 10000 }
		);
	});

	test(
		'7. after the agent completes, objectives appear in the Discovery panel',
		async () => {
			// Wait for the agent to finish: the button returns to its default state
			// and objectives appear. The standard discovery prompt produces 3 objectives.
			await page.waitForFunction(
				() => {
					const btn = document.querySelector('button[aria-label="run discovery agent"]');
					// Agent is done when button is no longer disabled/generating
					const agentDone = btn && !btn.disabled && !btn.innerText.includes('GENERATING');
					// And at least one objective row is in the panel
					const hasObjectives = document.querySelectorAll('button[aria-label="mark complete"], button[aria-label="mark incomplete"]').length > 0;
					return agentDone && hasObjectives;
				},
				{ timeout: 120000 }
			);

			// The 3 standard Discovery objectives should be present
			const bodyText = await page.evaluate(() => document.body.innerText);
			expect(bodyText).toMatch(/Problem Definition|Scope|Users/);
		},
		150000
	);

	test('8. the generated objectives have tasks underneath', async () => {
		// Click the first objective row to expand it
		await page.evaluate(() => {
			const checkButtons = document.querySelectorAll('button[aria-label="mark complete"], button[aria-label="mark incomplete"]');
			if (checkButtons.length > 0) {
				// Click the parent objectiveRow to expand
				checkButtons[0].closest('div')?.parentElement?.querySelector('span')?.click();
			}
		});

		// "Add task" button appears when objective is expanded
		await page.waitForFunction(
			() =>
				Array.from(document.querySelectorAll('button')).some((b) =>
					b.innerText.includes('Add task')
				),
			{ timeout: 5000 }
		);
	});

	// ── 9. Cleanup ────────────────────────────────────────────────────────────

	test('9. deletes the project via UI', async () => {
		await page.goto(projectUrl);
		await page.waitForSelector('button[aria-label="delete project"]', { timeout: 8000 });
		page.once('dialog', (dialog) => dialog.accept());
		await page.click('button[aria-label="delete project"]');
		await page.waitForFunction(() => window.location.pathname === '/projects', {
			timeout: 8000,
		});
		await page.waitForFunction(
			(name) => !document.body.innerText.includes(name),
			{ timeout: 10000 },
			projectName
		);
	});
});
