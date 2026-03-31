import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { launchBrowser, login, clickPhaseCard, closePhasePanel, BASE_URL, apiCleanupProject } from '../helpers.js';

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
		await page.evaluate(() => {
			const btn = Array.from(document.querySelectorAll('button')).find(
				(b) => b.innerText.trim() === 'Phases'
			);
			if (btn) btn.click();
		});

		await clickPhaseCard(page, 'Discovery');

		await page.waitForSelector('button[aria-label="run discovery agent"]', { timeout: 15000 });
	});

	test('5. non-Discovery phases do NOT show the GENERATE OBJECTIVES button', async () => {
		// Open Planning phase (clicking a different card auto-closes Discovery)
		await clickPhaseCard(page, 'Planning');
		await page.waitForFunction(
			() => Array.from(document.querySelectorAll('h3')).some((h) => h.innerText.trim() === 'Planning'),
			{ timeout: 5000 }
		);

		const agentButton = await page.$('button[aria-label="run discovery agent"]');
		expect(agentButton).toBeNull();

		// Close Planning panel
		await closePhasePanel(page, 'Planning');
		await page.waitForFunction(
			() => !Array.from(document.querySelectorAll('h3')).some((h) => h.innerText.trim() === 'Planning'),
			{ timeout: 5000 }
		);
	});

	// ── 6. Run the agent ──────────────────────────────────────────────────────

	test('6. clicking GENERATE OBJECTIVES shows GENERATING… on the button', async () => {
		// Re-open Discovery
		await clickPhaseCard(page, 'Discovery');
		await page.waitForSelector('button[aria-label="run discovery agent"]', { timeout: 8000 });

		// The GENERATE OBJECTIVES button is disabled until the Project Brief has content.
		// Expand the "Project Brief" callout and type some content into the DocEditor, then
		// save it via the API (the current DocEditor implementation exposes no save button
		// for the brief — the API is the only reliable save path in this context).
		await page.evaluate(() => {
			// Click the callout toggle button that contains "Project Brief" (CSS may uppercase it)
			const buttons = Array.from(document.querySelectorAll('button'));
			const toggle = buttons.find(
				(b) => b.innerText.toLowerCase().includes('project brief')
			);
			if (toggle) toggle.click();
		});

		// Wait for the ProseMirror contenteditable to appear inside the callout
		await page.waitForSelector('.ProseMirror[contenteditable="true"]', { timeout: 5000 });

		// Type brief content into the editor
		await page.click('.ProseMirror[contenteditable="true"]');
		await page.keyboard.type('This project aims to build a discovery agent system for project management.');

		// Save via the API using the auth token stored in localStorage
		await page.evaluate(async () => {
			const raw = localStorage.getItem('dao-auth');
			const token = raw ? JSON.parse(raw)?.state?.token ?? null : null;
			if (!token) throw new Error('No auth token found in localStorage');

			// Get the current project UUID from the URL
			const projectUuid = window.location.pathname.split('/projects/')[1]?.split('/')[0];
			if (!projectUuid) throw new Error('Could not determine project UUID from URL');

			// Find the Discovery phase to get phaseId
			const phasesRes = await fetch(`/api/projects/${projectUuid}/phases`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const phases = await phasesRes.json();
			const discoveryPhase = phases.find((p) => p.orderIndex === 0);
			if (!discoveryPhase) throw new Error('Could not find Discovery phase');

			// Check if the brief already exists
			const docsRes = await fetch(`/api/projects/${projectUuid}/documents`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const docs = await docsRes.json();
			const existingBrief = docs.find((d) => d.name === 'Project Brief' && d.objectiveId === null);

			if (existingBrief) {
				// Update existing brief
				await fetch(`/api/documents/${existingBrief.uuid}`, {
					method: 'PATCH',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						content: 'This project aims to build a discovery agent system for project management.',
					}),
				});
			} else {
				// Create new brief
				await fetch(`/api/projects/${projectUuid}/documents`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						name: 'Project Brief',
						content: 'This project aims to build a discovery agent system for project management.',
						type: 'note',
						phaseId: discoveryPhase.id,
					}),
				});
			}
		});

		// Navigate to the same page to reload the store with the new brief content
		await page.goto(page.url(), { waitUntil: 'networkidle0', timeout: 15000 });

		// Re-open the Discovery phase panel
		await clickPhaseCard(page, 'Discovery');

		// Wait for the button to appear and become enabled (brief now has content)
		await page.waitForFunction(
			() => {
				const btn = document.querySelector('button[aria-label="run discovery agent"]');
				return btn && !btn.disabled;
			},
			{ timeout: 8000 }
		);

		// Now click the button
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
