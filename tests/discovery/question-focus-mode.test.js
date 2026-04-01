import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { launchBrowser, login, clickPhaseCard, BASE_URL, apiCleanupProject } from '../helpers.js';

const projectName = `Focus Mode Test Project ${Date.now()}`;
const objectiveName = 'Research';
const docName = `Questions: ${objectiveName}`;

// Known questions document with predictable format
const DOC_CONTENT = `# ${docName}
## User & Audience

**Q1:** Who is the primary user of the platform?

[opt: Product managers | Engineers | Cross-functional teams]

> _answer here_

**Q2:** What pain points do users currently experience?

> _answer here_

## Scope & Constraints

**Q3:** What is the expected timeline for the research phase?

[opt: 1-2 weeks | 3-4 weeks | 5+ weeks]

> _answer here_
`;

let browser;
let page;
let projectUrl = '';

beforeAll(async () => {
	browser = await launchBrowser();
	page = await browser.newPage();
	await login(page);
});

afterAll(async () => {
	await apiCleanupProject(projectName);
	await browser?.close();
});

describe('QuestionFocusMode — full-screen question answering overlay', () => {
	// ── 1. Create project ─────────────────────────────────────────────────────

	test('1. creates a project and navigates to the detail page', async () => {
		await page.goto(`${BASE_URL}/projects`);
		await page.waitForFunction(
			() =>
				Array.from(document.querySelectorAll('button')).some(
					(b) => b.innerText.toLowerCase().includes('new') || b.innerText.includes('+')
				),
			{ timeout: 5000 }
		);
		await page.evaluate(() => {
			const btn = Array.from(document.querySelectorAll('button')).find(
				(b) => b.innerText.toLowerCase().includes('new') || b.innerText.includes('+')
			);
			if (btn) btn.click();
		});
		await page.waitForSelector('input[placeholder="Project name"]', { timeout: 5000 });
		await page.type('input[placeholder="Project name"]', projectName);
		await page.click('button[type="submit"]');
		await page.waitForFunction(
			(name) => document.body.innerText.includes(name),
			{ timeout: 10000 },
			projectName
		);

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
	});

	// ── 2. Add objective and seed questions document via API ──────────────────

	test('2. adds "Research" objective and seeds a questions document via API', async () => {
		await clickPhaseCard(page, 'Discovery');
		await page.waitForFunction(
			() =>
				Array.from(document.querySelectorAll('h3')).some(
					(h) => h.innerText.trim() === 'Discovery'
				),
			{ timeout: 8000 }
		);

		// Add objective
		await page.evaluate(() => {
			const btn = Array.from(document.querySelectorAll('button')).find(
				(b) => b.innerText.trim() === 'Add'
			);
			if (btn) btn.click();
		});
		await page.waitForSelector('input[placeholder="Objective name"]', { timeout: 5000 });
		await page.type('input[placeholder="Objective name"]', objectiveName);
		await page.keyboard.press('Enter');
		await page.waitForFunction(
			(name) => document.body.innerText.includes(name),
			{ timeout: 8000 },
			objectiveName
		);

		// Seed the questions document via API
		await page.evaluate(
			async ({ content, name, projectUrl }) => {
				const raw = localStorage.getItem('dao-auth');
				const token = raw ? JSON.parse(raw)?.state?.token ?? null : null;
				if (!token) throw new Error('No auth token');

				const projectUuid = projectUrl.split('/projects/')[1]?.split('/')[0];
				if (!projectUuid) throw new Error('No project UUID');

				const phasesRes = await fetch(`/api/projects/${projectUuid}/phases`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				const phases = await phasesRes.json();
				const discovery = phases.find((p) => p.orderIndex === 0);
				if (!discovery) throw new Error('No discovery phase');

				await fetch(`/api/projects/${projectUuid}/documents`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ name, content, type: 'note', phaseId: discovery.id }),
				});
			},
			{ content: DOC_CONTENT, name: docName, projectUrl }
		);
	});

	// ── 3. Reload and open the questions modal ───────────────────────────────

	test('3. opens the questions modal via the QUESTIONS button', async () => {
		await page.goto(projectUrl, { waitUntil: 'networkidle0', timeout: 15000 });
		await clickPhaseCard(page, 'Discovery');

		await page.waitForSelector('button[aria-label="view questions document"]', { timeout: 8000 });
		await page.click('button[aria-label="view questions document"]');

		await page.waitForFunction(
			(name) => document.body.innerText.includes(name),
			{ timeout: 5000 },
			docName
		);
	});

	// ── 4. Enter focus mode ──────────────────────────────────────────────────

	test('4. clicking the "Focus mode" button opens the QuestionFocusMode overlay', async () => {
		await page.waitForSelector('.ProseMirror[contenteditable="true"]', { timeout: 8000 });
		await page.waitForSelector('button[title="Focus mode"]', { timeout: 5000 });
		await page.click('button[title="Focus mode"]');

		// The overlay shows a counter "1 / 3"
		await page.waitForFunction(
			() => /1 \/ 3/.test(document.body.innerText),
			{ timeout: 8000 }
		);
	});

	// ── 5. Verify focus mode content ─────────────────────────────────────────

	test('5. the overlay shows the document title, Q1 label, option chips, and a textarea', async () => {
		await page.waitForFunction(
			(name) => document.body.innerText.includes(name),
			{ timeout: 5000 },
			docName
		);
		await page.waitForFunction(
			() => document.body.innerText.includes('Q1'),
			{ timeout: 5000 }
		);
		await page.waitForSelector('textarea[placeholder="Your answer…"]', { timeout: 5000 });

		// Option chips for Q1 are present (3 options defined)
		const chipCount = await page.$$eval('[class*="optionChip"]', (els) => els.length);
		expect(chipCount).toBeGreaterThanOrEqual(3);
	});

	// ── 6. First chip is auto-focused on load ────────────────────────────────

	test('6. the first option chip has the focused style automatically', async () => {
		// The chip buttons are inside the optionChips container div.
		// The focused chip gets a second CSS module class (optionChipFocused).
		await page.waitForFunction(
			() => {
				const container = document.querySelector('[class*="optionChips"]');
				if (!container) return false;
				const firstBtn = container.querySelector('button');
				return firstBtn && firstBtn.classList.length > 1;
			},
			{ timeout: 3000 }
		);
	});

	// ── 7. Arrow keys navigate between chips ─────────────────────────────────

	test('7. ArrowDown highlights the next chip, ArrowUp highlights the previous', async () => {
		// Press Down → chip 1 gets the extra focused class, chip 0 loses it
		await page.keyboard.press('ArrowDown');
		await page.waitForFunction(
			() => {
				const container = document.querySelector('[class*="optionChips"]');
				if (!container) return false;
				const btns = container.querySelectorAll('button');
				return btns[1]?.classList.length > 1 && btns[0]?.classList.length === 1;
			},
			{ timeout: 3000 }
		);

		// Press Up → chip 0 gets focused style back
		await page.keyboard.press('ArrowUp');
		await page.waitForFunction(
			() => {
				const container = document.querySelector('[class*="optionChips"]');
				if (!container) return false;
				const btns = container.querySelectorAll('button');
				return btns[0]?.classList.length > 1 && btns[1]?.classList.length === 1;
			},
			{ timeout: 3000 }
		);
	});

	// ── 8. Enter on a chip selects it and advances to the next question ──────

	test('8. pressing Enter on a focused chip selects the answer and goes to Q2', async () => {
		// The first chip is focused — press Enter to select and advance
		await page.keyboard.press('Enter');

		// Should advance to Q2 (counter shows 2 / 3)
		await page.waitForFunction(
			() => /2 \/ 3/.test(document.body.innerText),
			{ timeout: 5000 }
		);
		await page.waitForFunction(
			() => document.body.innerText.includes('Q2'),
			{ timeout: 3000 }
		);
	});

	// ── 9. Arrow keys navigate between questions ─────────────────────────────

	test('9. Prev/Next buttons navigate between questions', async () => {
		// Click Prev to go back to Q1
		await page.evaluate(() => {
			const btn = Array.from(document.querySelectorAll('button')).find(
				(b) => b.innerText.toLowerCase().includes('prev')
			);
			if (btn && !btn.disabled) btn.click();
		});
		await page.waitForFunction(
			() => /1 \/ 3/.test(document.body.innerText),
			{ timeout: 5000 }
		);

		// Click Next to go forward to Q2
		await page.evaluate(() => {
			const btn = Array.from(document.querySelectorAll('button')).find(
				(b) => b.innerText.toLowerCase().includes('next')
			);
			if (btn && !btn.disabled) btn.click();
		});
		await page.waitForFunction(
			() => /2 \/ 3/.test(document.body.innerText),
			{ timeout: 5000 }
		);
	});

	// ── 10. Save and close ──────────────────────────────────────────────────

	test('10. saving closes the overlay', async () => {
		// An answer was set on Q1 via Enter, so isDirty is true — Save button visible
		await page.waitForFunction(
			() => {
				const buttons = Array.from(document.querySelectorAll('button'));
				return buttons.some((b) => b.innerText.trim().toLowerCase() === 'save');
			},
			{ timeout: 5000 }
		);

		await page.evaluate(() => {
			const btn = Array.from(document.querySelectorAll('button')).find(
				(b) => b.innerText.trim().toLowerCase() === 'save'
			);
			if (btn) btn.click();
		});

		// Overlay closes
		await page.waitForFunction(
			() => !/\d+ \/ \d+/.test(document.body.innerText),
			{ timeout: 10000 }
		);
	});

	// ── 11. Close via Escape key ─────────────────────────────────────────────

	test('11. reopening and pressing Escape closes the overlay', async () => {
		// Reopen focus mode
		await clickPhaseCard(page, 'Discovery');
		await page.waitForSelector('button[aria-label="view questions document"]', { timeout: 8000 });
		await page.click('button[aria-label="view questions document"]');
		await page.waitForFunction(
			(name) => document.body.innerText.includes(name),
			{ timeout: 8000 },
			docName
		);
		await page.waitForSelector('button[title="Focus mode"]', { timeout: 5000 });
		await page.click('button[title="Focus mode"]');
		await page.waitForFunction(
			() => /\d+ \/ \d+/.test(document.body.innerText),
			{ timeout: 5000 }
		);
		await page.keyboard.press('Escape');

		await page.waitForFunction(
			() => !/\d+ \/ \d+/.test(document.body.innerText),
			{ timeout: 5000 }
		);

		const textarea = await page.$('textarea[placeholder="Your answer…"]');
		expect(textarea).toBeNull();
	});

	// ── 12. Delete the project ───────────────────────────────────────────────

	test('12. deletes the project via UI', async () => {
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
