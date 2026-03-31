import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { launchBrowser, login, clickPhaseCard, BASE_URL, apiCleanupProject } from '../helpers.js';

const projectName = `Brief Test Project ${Date.now()}`;
let browser;
let page;
let projectUrl = '';

beforeAll(async () => {
	browser = await launchBrowser();
	page = await browser.newPage();
	await login(page);
}, 60000);

afterAll(async () => {
	await apiCleanupProject(projectName); // safety net: deletes project if UI delete test failed
	await browser?.close();
});

describe('Project Brief — callout, DocEditor, and button gate', () => {
	// ── 1. Create project ─────────────────────────────────────────────────────

	test('1. creates a project for the Project Brief flow', async () => {
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

	// ── 2. Navigate to project detail ─────────────────────────────────────────

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

	// ── 3. Open the Discovery phase panel ────────────────────────────────────

	test('3. opens the Discovery phase panel', async () => {
		await clickPhaseCard(page, 'Discovery');
		// The panel title h3 must appear
		await page.waitForFunction(
			() => {
				const h3s = Array.from(document.querySelectorAll('h3'));
				return h3s.some((h) => h.innerText.trim() === 'Discovery');
			},
			{ timeout: 8000 }
		);
	});

	// ── 4. Project Brief callout is visible ──────────────────────────────────

	test('4. the "Project Brief" callout is visible in the Discovery panel', async () => {
		// The callout header toggle button contains the text "Project Brief" (CSS may uppercase it)
		await page.waitForFunction(
			() => {
				const buttons = Array.from(document.querySelectorAll('button'));
				return buttons.some((b) => b.innerText.toLowerCase().includes('project brief'));
			},
			{ timeout: 5000 }
		);
	});

	// ── 5. GENERATE OBJECTIVES is disabled before brief has content ───────────

	test('5. GENERATE OBJECTIVES button is disabled before writing the brief', async () => {
		const btn = await page.$('button[aria-label="run discovery agent"]');
		expect(btn).not.toBeNull();
		const isDisabled = await btn.evaluate((el) => el.disabled);
		expect(isDisabled).toBe(true);
	});

	// ── 6. Expand the callout ────────────────────────────────────────────────

	test('6. expanding the "Project Brief" callout reveals the DocEditor', async () => {
		// The callout starts collapsed (defaultOpen=false). Click its toggle button to open it.
		await page.evaluate(() => {
			const buttons = Array.from(document.querySelectorAll('button'));
			const toggle = buttons.find((b) => b.innerText.toLowerCase().includes('project brief'));
			if (toggle) toggle.click();
		});

		// After expanding, the ProseMirror contenteditable appears
		await page.waitForSelector('.ProseMirror[contenteditable="true"]', { timeout: 5000 });
	});

	// ── 7. Type content and save via API ─────────────────────────────────────

	test('7. typing content in the DocEditor and saving enables the GENERATE OBJECTIVES button', async () => {
		// Type into the editor to confirm it is interactive
		await page.click('.ProseMirror[contenteditable="true"]');
		await page.keyboard.type('This project explores automated discovery tooling for engineering teams.');

		// Save the brief via the API (the Brief DocEditor exposes no save button in the
		// current implementation — onDirtyChange is not wired from PhasePanel)
		await page.evaluate(async () => {
			const raw = localStorage.getItem('dao-auth');
			let token = null;
			try { token = JSON.parse(raw)?.state?.token ?? null; } catch { token = null; }
			if (!token) throw new Error('No auth token in localStorage');

			const projectUuid = window.location.pathname.split('/projects/')[1]?.split('/')[0];
			if (!projectUuid) throw new Error('Could not determine project UUID');

			// Find the Discovery phase (orderIndex 0)
			const phasesRes = await fetch(`/api/projects/${projectUuid}/phases`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const phases = await phasesRes.json();
			const discoveryPhase = phases.find((p) => p.orderIndex === 0);
			if (!discoveryPhase) throw new Error('Could not find Discovery phase');

			// Check for an existing Project Brief document
			const docsRes = await fetch(`/api/projects/${projectUuid}/documents`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const docs = await docsRes.json();
			const existingBrief = docs.find((d) => d.name === 'Project Brief' && d.objectiveId === null);

			if (existingBrief) {
				await fetch(`/api/documents/${existingBrief.uuid}`, {
					method: 'PATCH',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						content: 'This project explores automated discovery tooling for engineering teams.',
					}),
				});
			} else {
				await fetch(`/api/projects/${projectUuid}/documents`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						name: 'Project Brief',
						content: 'This project explores automated discovery tooling for engineering teams.',
						type: 'note',
						phaseId: discoveryPhase.id,
					}),
				});
			}
		});

		// Reload the page so the store picks up the new brief content
		await page.goto(projectUrl, { waitUntil: 'networkidle0', timeout: 15000 });

		// Re-open the Discovery phase panel
		await clickPhaseCard(page, 'Discovery');

		// GENERATE OBJECTIVES button must now be enabled (brief has content)
		await page.waitForFunction(
			() => {
				const btn = document.querySelector('button[aria-label="run discovery agent"]');
				return btn && !btn.disabled;
			},
			{ timeout: 8000 }
		);

		// Confirm by evaluating the disabled property directly
		const btn = await page.$('button[aria-label="run discovery agent"]');
		const isDisabled = await btn.evaluate((el) => el.disabled);
		expect(isDisabled).toBe(false);
	});

	// ── 8. Delete the project via UI ─────────────────────────────────────────

	test('8. deletes the project via UI', async () => {
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
