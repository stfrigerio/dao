import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { launchBrowser, login, clickPhaseCard, closePhasePanel, BASE_URL, waitForText, apiCleanupProject } from '../helpers.js';

let browser;
let page;
let projectUrl = '';
const projectName = `Objective Questions Test Project ${Date.now()}`;

beforeAll(async () => {
	browser = await launchBrowser();
	page = await browser.newPage();
	await login(page);
});

afterAll(async () => {
	await apiCleanupProject(projectName); // safety net: deletes project if UI delete test failed
	await browser?.close();
});

describe('Per-objective question generation', () => {
	// ── 1. Setup: create a dedicated project ──────────────────────────────────

	test('1. creates a project for the objective questions flow', async () => {
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

	// ── 2. Navigate to the project detail page ────────────────────────────────

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

	// ── 3. Open the Discovery phase panel ─────────────────────────────────────

	test('3. opens the Discovery phase panel by clicking the Discovery phase card', async () => {
		await clickPhaseCard(page, 'Discovery');

		// The panel title h3 must now say "Discovery"
		await page.waitForFunction(
			() => {
				const h3s = Array.from(document.querySelectorAll('h3'));
				return h3s.some((h) => h.innerText.trim() === 'Discovery');
			},
			{ timeout: 8000 }
		);
	});

	// ── 4. Add the "Requirements" objective manually ───────────────────────────

	test('4. adds an objective "Requirements" in the Discovery phase panel', async () => {
		// Click the "Add" button for objectives
		await page.waitForFunction(
			() =>
				Array.from(document.querySelectorAll('button')).some(
					(b) => b.innerText.trim() === 'Add'
				),
			{ timeout: 5000 }
		);
		const buttons = await page.$$('button');
		for (const btn of buttons) {
			const text = await btn.evaluate((el) => el.innerText.trim());
			if (text === 'Add') {
				await btn.click();
				break;
			}
		}

		await page.waitForSelector('input[placeholder="Objective name"]', { timeout: 5000 });
		await page.type('input[placeholder="Objective name"]', 'Requirements');
		await page.keyboard.press('Enter');

		// Wait for the objective to appear in the list
		await page.waitForFunction(
			() => document.body.innerText.includes('Requirements'),
			{ timeout: 8000 }
		);
	});

	// ── 5. Expand the objective and add a task ────────────────────────────────

	test('5. expands the "Requirements" objective and adds a task', async () => {
		// Click on the objective row to expand it (click the span with text "Requirements")
		await page.evaluate(() => {
			const spans = Array.from(document.querySelectorAll('span'));
			const obj = spans.find((s) => s.innerText.trim() === 'Requirements');
			if (obj) obj.click();
		});

		// Wait for the "Add task" button to appear (task list is now visible)
		await page.waitForFunction(
			() =>
				Array.from(document.querySelectorAll('button')).some((b) =>
					b.innerText.includes('Add task')
				),
			{ timeout: 5000 }
		);

		// Click "Add task"
		await page.evaluate(() => {
			const btn = Array.from(document.querySelectorAll('button')).find((b) =>
				b.innerText.includes('Add task')
			);
			if (btn) btn.click();
		});

		await page.waitForSelector('input[placeholder="Task name"]', { timeout: 5000 });
		await page.type('input[placeholder="Task name"]', 'Define functional requirements');

		// Submit by pressing Enter
		await page.keyboard.press('Enter');

		// Confirm the task now appears
		await page.waitForFunction(
			() => document.body.innerText.includes('Define functional requirements'),
			{ timeout: 8000 }
		);
	});

	// ── 6. Verify QUESTIONS button is visible on hover ─────────────────────────

	test('6. hovering over the "Requirements" objective row reveals the QUESTIONS button', async () => {
		// Find the objective row element to hover over
		const objectiveRowHandle = await page.evaluateHandle(() => {
			const spans = Array.from(document.querySelectorAll('span'));
			const nameSpan = spans.find((s) => s.innerText.trim() === 'Requirements');
			// Walk up to the objectiveRow div (the one with the cursor:pointer / flex layout)
			if (!nameSpan) return null;
			return nameSpan.parentElement;
		});

		if (!objectiveRowHandle || objectiveRowHandle.toString() === 'JSHandle:null') {
			throw new Error('Could not find the objective row to hover over');
		}

		await objectiveRowHandle.hover();

		// After hover, the QUESTIONS button (aria-label="generate questions") should be visible
		await page.waitForFunction(
			() => {
				const btn = document.querySelector('button[aria-label="generate questions"]');
				if (!btn) return false;
				// CSS sets opacity:0 by default; on hover it becomes 1.
				// getComputedStyle gives us the actual rendered value.
				const style = window.getComputedStyle(btn);
				return style.opacity !== '0';
			},
			{ timeout: 5000 }
		);
	});

	// ── 7. Non-discovery phase: no QUESTIONS button ────────────────────────────

	test('7. Planning phase panel does NOT show the QUESTIONS button on objectives', async () => {
		// Open Planning phase (auto-closes Discovery)
		await clickPhaseCard(page, 'Planning');

		// Wait for Planning panel h3
		await page.waitForFunction(
			() => {
				const h3s = Array.from(document.querySelectorAll('h3'));
				return h3s.some((h) => h.innerText.trim() === 'Planning');
			},
			{ timeout: 5000 }
		);

		// Add an objective to the Planning phase
		await page.waitForFunction(
			() =>
				Array.from(document.querySelectorAll('button')).some(
					(b) => b.innerText.trim() === 'Add'
				),
			{ timeout: 5000 }
		);
		const buttons = await page.$$('button');
		for (const btn of buttons) {
			const text = await btn.evaluate((el) => el.innerText.trim());
			if (text === 'Add') {
				await btn.click();
				break;
			}
		}
		await page.waitForSelector('input[placeholder="Objective name"]', { timeout: 5000 });
		await page.type('input[placeholder="Objective name"]', 'Planning Objective');
		await page.keyboard.press('Enter');

		await page.waitForFunction(
			() => document.body.innerText.includes('Planning Objective'),
			{ timeout: 8000 }
		);

		// Hover over the Planning objective row
		const planningRowHandle = await page.evaluateHandle(() => {
			const spans = Array.from(document.querySelectorAll('span'));
			const nameSpan = spans.find((s) => s.innerText.trim() === 'Planning Objective');
			if (!nameSpan) return null;
			return nameSpan.parentElement;
		});

		if (!planningRowHandle || planningRowHandle.toString() === 'JSHandle:null') {
			throw new Error('Could not find Planning objective row to hover over');
		}
		await planningRowHandle.hover();

		// The QUESTIONS button must NOT be present in the Planning phase panel at all
		const questionsButton = await page.$('button[aria-label="generate questions"]');
		expect(questionsButton).toBeNull();

		// Close the Planning panel
		await closePhasePanel(page, 'Planning');
		await page.waitForFunction(
			() => {
				const h3s = Array.from(document.querySelectorAll('h3'));
				return !h3s.some((h) => h.innerText.trim() === 'Planning');
			},
			{ timeout: 5000 }
		);
	});

	// ── 8. Click QUESTIONS button → button shows GENERATING… ──────────────────

	test('8. clicking the QUESTIONS button on "Requirements" shows GENERATING…', async () => {
		// Re-open the Discovery phase panel
		await clickPhaseCard(page, 'Discovery');

		// Wait for Discovery panel h3 AND "Requirements" objective to load
		await page.waitForFunction(
			() => {
				const h3s = Array.from(document.querySelectorAll('h3'));
				const spans = Array.from(document.querySelectorAll('span'));
				return (
					h3s.some((h) => h.innerText.trim() === 'Discovery') &&
					spans.some((s) => s.innerText.trim() === 'Requirements')
				);
			},
			{ timeout: 8000 }
		);

		// Hover the QUESTIONS button directly — being inside objectiveRow triggers :hover on it
		await page.hover('button[aria-label="generate questions"]');

		// Click via Puppeteer CDP mouse event (real event, not synthetic)
		await page.click('button[aria-label="generate questions"]');

		// Button becomes disabled while the agent job is running
		await page.waitForFunction(
			() => {
				const btn = document.querySelector('button[aria-label="generate questions"]');
				return btn && (btn.disabled || btn.innerText.includes('GENERATING'));
			},
			{ timeout: 10000 }
		);
	});

	// ── 9. Wait for "Questions: Requirements" document to appear ──────────────

	test('9. waits for "Questions: Requirements" document to appear in Documents tab', async () => {
		// Switch to the Documents tab
		const buttons = await page.$$('button');
		for (const btn of buttons) {
			const text = await btn.evaluate((el) => el.innerText.trim());
			if (text === 'Documents') {
				await btn.click();
				break;
			}
		}

		// Wait up to 120s for the agent to complete and the document to appear.
		// Poll until loading state is gone AND the specific document title is present.
		await page.waitForFunction(
			() => {
				const body = document.body.innerText;
				return (
					!body.includes('Loading documents') &&
					body.includes('Questions: Requirements')
				);
			},
			{ timeout: 120000 }
		);
	}, 150000);

	// ── 10. Expand the document and verify it has content ─────────────────────

	test('10. clicking the "Questions: Requirements" document card expands it and shows content', async () => {
		// The document card header button contains the doc name
		const clicked = await page.evaluate(() => {
			const btns = Array.from(document.querySelectorAll('button'));
			const cardBtn = btns.find((b) => b.innerText.includes('Questions: Requirements'));
			if (cardBtn) {
				cardBtn.click();
				return true;
			}
			return false;
		});
		expect(clicked).toBe(true);

		// A <pre> element with the document content should appear after expansion
		await page.waitForFunction(() => document.querySelector('pre') !== null, { timeout: 5000 });
		const preContent = await page.$eval('pre', (el) => el.innerText.trim());
		expect(preContent.length).toBeGreaterThan(0);
	});

	// ── 11. Delete the project via UI ─────────────────────────────────────────

	test('11. deletes the project via UI (cascades to all documents and objectives)', async () => {
		await page.goto(projectUrl);
		await page.waitForSelector('button[aria-label="delete project"]', { timeout: 8000 });
		page.once('dialog', (dialog) => dialog.accept());
		await page.click('button[aria-label="delete project"]');
		await page.waitForFunction(() => window.location.pathname === '/projects', {
			timeout: 8000,
		});
		// Confirm the project name no longer appears in the list
		await page.waitForFunction(
			(name) => !document.body.innerText.includes(name),
			{ timeout: 10000 },
			projectName
		);
	});
});
