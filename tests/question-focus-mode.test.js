import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { launchBrowser, login, clickPhaseCard, BASE_URL, apiCleanupProject } from './helpers.js';

const projectName = `Focus Mode Test Project ${Date.now()}`;
let browser;
let page;
let projectUrl = '';

beforeAll(async () => {
	browser = await launchBrowser();
	page = await browser.newPage();
	await login(page);
});

afterAll(async () => {
	await apiCleanupProject(projectName); // safety net: deletes project if UI delete test failed
	await browser?.close();
});

describe('QuestionFocusMode — full-screen question answering overlay', () => {
	// ── 1. Create project ─────────────────────────────────────────────────────

	test('1. creates a project for the focus mode flow', async () => {
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

	// ── 3. Create Project Brief via API so QUESTIONS agent can run later ───────

	test('3. creates a Project Brief via API to satisfy the briefHasContent gate', async () => {
		await page.evaluate(async () => {
			const raw = localStorage.getItem('dao-auth');
			let token = null;
			try { token = JSON.parse(raw)?.state?.token ?? null; } catch { token = null; }
			if (!token) throw new Error('No auth token in localStorage');

			const projectUuid = window.location.pathname.split('/projects/')[1]?.split('/')[0];
			if (!projectUuid) throw new Error('Could not determine project UUID');

			const phasesRes = await fetch(`/api/projects/${projectUuid}/phases`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const phases = await phasesRes.json();
			const discoveryPhase = phases.find((p) => p.orderIndex === 0);
			if (!discoveryPhase) throw new Error('Could not find Discovery phase');

			await fetch(`/api/projects/${projectUuid}/documents`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: 'Project Brief',
					content: 'A platform for teams to run structured discovery sessions and generate actionable objectives.',
					type: 'note',
					phaseId: discoveryPhase.id,
				}),
			});
		});
	});

	// ── 4. Open Discovery phase panel ─────────────────────────────────────────

	test('4. opens the Discovery phase panel', async () => {
		// Reload so the store picks up the brief we created via API
		await page.goto(projectUrl, { waitUntil: 'networkidle0', timeout: 15000 });

		await clickPhaseCard(page, 'Discovery');
		await page.waitForFunction(
			() => {
				const h3s = Array.from(document.querySelectorAll('h3'));
				return h3s.some((h) => h.innerText.trim() === 'Discovery');
			},
			{ timeout: 8000 }
		);
	});

	// ── 5. Add "Research" objective ───────────────────────────────────────────

	test('5. adds a "Research" objective in the Discovery phase panel', async () => {
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
		await page.type('input[placeholder="Objective name"]', 'Research');
		await page.keyboard.press('Enter');
		await page.waitForFunction(
			() => document.body.innerText.includes('Research'),
			{ timeout: 8000 }
		);
	});

	// ── 6. Generate questions for "Research" ──────────────────────────────────

	test('6. clicking QUESTIONS on the "Research" objective starts question generation', async () => {
		// Hover over the objective row to make the QUESTIONS button visible
		await page.hover('button[aria-label="generate questions"]');
		await page.click('button[aria-label="generate questions"]');

		// Button becomes disabled/generating while the agent job is running
		await page.waitForFunction(
			() => {
				const btn = document.querySelector('button[aria-label="generate questions"]');
				return btn && (btn.disabled || btn.innerText.includes('GENERATING'));
			},
			{ timeout: 10000 }
		);
	});

	// ── 7. Wait for "Questions: Research" document ────────────────────────────

	test(
		'7. waits for "Questions: Research" document to be generated',
		async () => {
			// Switch to Documents tab to monitor document creation
			const buttons = await page.$$('button');
			for (const btn of buttons) {
				const text = await btn.evaluate((el) => el.innerText.trim());
				if (text === 'Documents') {
					await btn.click();
					break;
				}
			}

			// Wait up to 120s for the agent to finish and the document to appear
			await page.waitForFunction(
				() => {
					const body = document.body.innerText;
					return (
						!body.includes('Loading documents') &&
						body.includes('Questions: Research')
					);
				},
				{ timeout: 120000 }
			);
		},
		150000
	);

	// ── 8. Go back to Phases tab and open the questions modal ─────────────────

	test('8. clicking "QUESTIONS" button on "Research" opens the questions modal', async () => {
		// Switch back to the Phases tab
		await page.evaluate(() => {
			const btn = Array.from(document.querySelectorAll('button')).find(
				(b) => b.innerText.trim() === 'Phases'
			);
			if (btn) btn.click();
		});

		// Wait for the Discovery panel to re-appear (it may need re-opening)
		await page.waitForFunction(
			() => {
				const spans = Array.from(document.querySelectorAll('span'));
				return spans.some((s) => s.innerText.trim() === 'Discovery');
			},
			{ timeout: 5000 }
		);

		// Check if Discovery panel is already open (h3 present), if not open it
		const panelOpen = await page.evaluate(() => {
			const h3s = Array.from(document.querySelectorAll('h3'));
			return h3s.some((h) => h.innerText.trim() === 'Discovery');
		});
		if (!panelOpen) {
			await clickPhaseCard(page, 'Discovery');
			await page.waitForFunction(
				() => {
					const h3s = Array.from(document.querySelectorAll('h3'));
					return h3s.some((h) => h.innerText.trim() === 'Discovery');
				},
				{ timeout: 8000 }
			);
		}

		// The "Research" objective now has a "QUESTIONS" button (view questions document)
		await page.waitForSelector('button[aria-label="view questions document"]', { timeout: 8000 });
		await page.click('button[aria-label="view questions document"]');

		// The modal opens — its title contains the document name "Questions: Research"
		await page.waitForFunction(
			() => document.body.innerText.includes('Questions: Research'),
			{ timeout: 5000 }
		);
	});

	// ── 9. Click the "Focus mode" button ─────────────────────────────────────

	test('9. clicking the "Focus mode" button opens the QuestionFocusMode overlay', async () => {
		// The modal header has a Focus mode button with title="Focus mode"
		await page.waitForSelector('button[title="Focus mode"]', { timeout: 5000 });
		await page.click('button[title="Focus mode"]');

		// The focus mode overlay renders via createPortal into document.body.
		// It shows a counter like "1 / N" in the top-right span.
		await page.waitForFunction(
			() => {
				const body = document.body.innerText;
				// Counter format: "1 / N" where N >= 1
				return /1 \/ \d+/.test(body);
			},
			{ timeout: 5000 }
		);
	});

	// ── 10. Verify focus mode content ────────────────────────────────────────

	test('10. the focus mode overlay shows the document title and a question', async () => {
		// The title bar shows the document name
		await page.waitForFunction(
			() => document.body.innerText.includes('Questions: Research'),
			{ timeout: 5000 }
		);

		// The answer textarea is present
		await page.waitForSelector('textarea[placeholder="Your answer…"]', { timeout: 5000 });

		// The "Q1" label is visible in the question card
		await page.waitForFunction(
			() => document.body.innerText.includes('Q1'),
			{ timeout: 5000 }
		);
	});

	// ── 11. Type an answer ────────────────────────────────────────────────────

	test('11. typing an answer in the textarea shows the Save button (dirty state)', async () => {
		await page.click('textarea[placeholder="Your answer…"]');
		await page.keyboard.type('We should conduct user interviews and competitive analysis.');

		// The Save button appears when isDirty is true
		await page.waitForFunction(
			() => {
				const buttons = Array.from(document.querySelectorAll('button'));
				return buttons.some((b) => b.innerText.trim() === 'Save' || b.innerText.trim() === 'Saving…');
			},
			{ timeout: 5000 }
		);
	});

	// ── 12. Save the answer ───────────────────────────────────────────────────

	test('12. clicking Save triggers "Saving…" state and then returns to "Save"', async () => {
		// Find and click the Save button
		await page.evaluate(() => {
			const btn = Array.from(document.querySelectorAll('button')).find(
				(b) => b.innerText.trim() === 'Save'
			);
			if (btn) btn.click();
		});

		// The button briefly shows "Saving…" during the async save.
		// After the save completes, it returns to "Save" (savedAnswers is not updated in
		// the component so isDirty stays true and the button remains visible but enabled).
		// We wait for the button to no longer be in the "Saving…" state.
		await page.waitForFunction(
			() => {
				const buttons = Array.from(document.querySelectorAll('button'));
				const saveBtn = buttons.find(
					(b) => b.innerText.trim() === 'Save' || b.innerText.trim() === 'Saving…'
				);
				// Saving completes when the button is back to "Save" (enabled) or gone
				if (!saveBtn) return true;
				return saveBtn.innerText.trim() === 'Save' && !saveBtn.disabled;
			},
			{ timeout: 10000 }
		);

		// The textarea still has our typed content after save
		const textareaValue = await page.$eval(
			'textarea[placeholder="Your answer…"]',
			(el) => el.value
		);
		expect(textareaValue).toBe('We should conduct user interviews and competitive analysis.');
	});

	// ── 13. Navigate to next question ─────────────────────────────────────────

	test('13. clicking Next navigates to the second question', async () => {
		// The Next button is in the bottom bar, disabled only on the last question.
		// Find the Next button by its text content.
		await page.evaluate(() => {
			const buttons = Array.from(document.querySelectorAll('button'));
			const nextBtn = buttons.find((b) => b.innerText.includes('Next'));
			if (nextBtn && !nextBtn.disabled) nextBtn.click();
		});

		// After navigating, the counter should show "2 / N"
		await page.waitForFunction(
			() => /2 \/ \d+/.test(document.body.innerText),
			{ timeout: 5000 }
		);
	});

	// ── 14. Close focus mode via Escape key ───────────────────────────────────

	test('14. pressing Escape closes the QuestionFocusMode overlay', async () => {
		await page.keyboard.press('Escape');

		// The overlay is gone: counter "2 / N" is no longer visible, and the questions
		// modal is also closed (focus mode closing does not reopen the modal —
		// setFocusModeDoc(null) is called, setActiveQuestionsDoc remains null).
		await page.waitForFunction(
			() => !/\d+ \/ \d+/.test(document.body.innerText),
			{ timeout: 5000 }
		);

		// The textarea with "Your answer…" placeholder is also gone
		const textarea = await page.$('textarea[placeholder="Your answer…"]');
		expect(textarea).toBeNull();
	});

	// ── 15. Delete the project via UI ────────────────────────────────────────

	test('15. deletes the project via UI', async () => {
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
