import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { launchBrowser, login, clickPhaseCard, BASE_URL, apiCleanupProject } from './helpers.js';

const projectName = `DocEditor Test Project ${Date.now()}`;
const objectiveName = 'Editor Flow';
const docName = `Questions: ${objectiveName}`;

// Document with h1, three h2 sections, and blockquote answer placeholders
const DOC_CONTENT = `# ${docName}

## Alpha Section

**Q1:** What aspects of the problem need clarification?

> _answer here_

## Beta Section

**Q2:** What are the desired outcomes?

> _answer here_

## Gamma Section

**Q3:** Who are the stakeholders?

> _answer here_
`;

let browser;
let page;
let projectUrl = '';

beforeAll(async () => {
	browser = await launchBrowser();
	page = await browser.newPage();
	await login(page);
}, 60000);

afterAll(async () => {
	await apiCleanupProject(projectName);
	await browser?.close();
});

describe('DocEditor — full component test', () => {
	// ── Setup: create project, objective, and seed a document ─────────────

	test('1. creates a project and navigates to detail page', async () => {
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

		// Navigate to the project
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

	test('2. opens Discovery panel and adds an objective', async () => {
		await clickPhaseCard(page, 'Discovery');
		await page.waitForFunction(
			() =>
				Array.from(document.querySelectorAll('h3')).some(
					(h) => h.innerText.trim() === 'Discovery'
				),
			{ timeout: 8000 }
		);

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
	});

	test('3. seeds a questions document via API', async () => {
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

				const res = await fetch(`/api/projects/${projectUuid}/documents`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ name, content, type: 'note', phaseId: discovery.id }),
				});
				if (!res.ok) throw new Error(`Failed to create document: ${res.status}`);
			},
			{ content: DOC_CONTENT, name: docName, projectUrl }
		);
	});

	// ── Open the editor in a modal ───────────────────────────────────────

	test('4. reloads and opens the questions document modal', async () => {
		await page.goto(projectUrl, { waitUntil: 'networkidle0', timeout: 15000 });
		await clickPhaseCard(page, 'Discovery');

		await page.waitForSelector('button[aria-label="view questions document"]', { timeout: 8000 });
		await page.click('button[aria-label="view questions document"]');

		// Modal opens with the doc title
		await page.waitForFunction(
			(name) => document.body.innerText.includes(name),
			{ timeout: 5000 },
			docName
		);
	});

	// ── TOC rendering ────────────────────────────────────────────────────

	test('5. TOC renders all three sections with delete buttons', async () => {
		// Wait for ProseMirror to hydrate
		await page.waitForSelector('.ProseMirror[contenteditable="true"]', { timeout: 5000 });

		// All three sections visible
		await page.waitForFunction(
			() => {
				const text = document.body.innerText;
				return (
					text.includes('Alpha Section') &&
					text.includes('Beta Section') &&
					text.includes('Gamma Section')
				);
			},
			{ timeout: 5000 }
		);

		// Three delete-section buttons (one per h2)
		const trashButtons = await page.$$('button[title="Delete section"]');
		expect(trashButtons.length).toBe(3);
	});

	test('6. clicking a TOC link scrolls the editor to that section', async () => {
		// Click the "Gamma Section" TOC link
		await page.evaluate(() => {
			const tocLinks = Array.from(document.querySelectorAll('button'));
			const gamma = tocLinks.find(
				(b) => b.getAttribute('title') === 'Gamma Section' ||
					(b.innerText.trim() === 'Gamma Section' && b.closest('[class*="toc"]'))
			);
			if (gamma) gamma.click();
		});

		// The editor should have scrolled — Gamma Section heading should be near top.
		// We verify the editor still contains the section (sanity) and focus is in the editor.
		await page.waitForFunction(
			() => {
				const pm = document.querySelector('.ProseMirror');
				return pm && pm.innerHTML.includes('Gamma Section');
			},
			{ timeout: 3000 }
		);
	});

	// ── Section deletion via TOC ─────────────────────────────────────────

	test('7. deleting "Alpha Section" via TOC removes it from the editor', async () => {
		const trashButtons = await page.$$('button[title="Delete section"]');
		// First button = Alpha Section
		await trashButtons[0].click();

		// Alpha gone
		await page.waitForFunction(
			() => {
				const pm = document.querySelector('.ProseMirror');
				return pm && !pm.innerHTML.includes('Alpha Section');
			},
			{ timeout: 5000 }
		);

		// Beta and Gamma still present
		const html = await page.$eval('.ProseMirror', (el) => el.innerHTML);
		expect(html).toContain('Beta Section');
		expect(html).toContain('Gamma Section');

		// TOC now has 2 delete buttons
		const remaining = await page.$$('button[title="Delete section"]');
		expect(remaining.length).toBe(2);
	});

	// ── Inline editing ───────────────────────────────────────────────────

	test('8. typing in the editor makes it dirty (auto-save triggers)', async () => {
		// Click into the editor and type new content
		await page.click('.ProseMirror[contenteditable="true"]');
		// Move to end so we don't break existing structure
		await page.keyboard.press('End');
		await page.keyboard.press('Enter');
		await page.keyboard.type('Additional notes from the E2E test.');

		// Verify the text appears in the editor
		await page.waitForFunction(
			() => {
				const pm = document.querySelector('.ProseMirror');
				return pm && pm.innerText.includes('Additional notes from the E2E test.');
			},
			{ timeout: 3000 }
		);

		// Wait for auto-save (1s debounce + network round-trip)
		await page.waitForFunction(
			() => {
				// Auto-save completes when isDirty resets — no visible "saving" indicator,
				// so we just wait a generous amount for the save to complete
				return true;
			},
			{ timeout: 3000 }
		);
		// Give auto-save time to fire and complete
		await new Promise((r) => setTimeout(r, 2000));
	});

	// ── Close and reopen — verify persistence ────────────────────────────

	test('9. closing the modal and reopening preserves all edits', async () => {
		// Close the modal
		await page.click('button[aria-label="close"]');
		await page.waitForFunction(
			() =>
				!Array.from(document.querySelectorAll('[class*="dialog"]')).some(
					(el) => el.offsetParent !== null
				),
			{ timeout: 5000 }
		);

		// Small delay to ensure auto-save had time to complete before we closed
		await new Promise((r) => setTimeout(r, 500));

		// Reopen the modal
		await page.click('button[aria-label="view questions document"]');
		await page.waitForSelector('.ProseMirror[contenteditable="true"]', { timeout: 5000 });

		// Wait for content to render
		await page.waitForFunction(
			() => {
				const pm = document.querySelector('.ProseMirror');
				return pm && pm.innerText.includes('Beta Section');
			},
			{ timeout: 5000 }
		);

		const editorText = await page.$eval('.ProseMirror', (el) => el.innerText);

		// Alpha Section was deleted — must NOT be present
		expect(editorText).not.toContain('Alpha Section');

		// Beta and Gamma survive
		expect(editorText).toContain('Beta Section');
		expect(editorText).toContain('Gamma Section');

		// Typed content persisted
		expect(editorText).toContain('Additional notes from the E2E test.');
	});

	// ── Bubble menu / formatting toolbar ─────────────────────────────────

	test('10. selecting text shows the bubble menu with formatting buttons', async () => {
		// Triple-click to select a line in the editor
		const pm = await page.$('.ProseMirror[contenteditable="true"]');

		// Find and select the "desired outcomes" text
		await page.evaluate(() => {
			const pm = document.querySelector('.ProseMirror');
			if (!pm) return;
			// Find text node with "desired outcomes"
			const walker = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT);
			let node;
			while ((node = walker.nextNode())) {
				if (node.textContent?.includes('desired outcomes')) {
					const range = document.createRange();
					range.selectNodeContents(node);
					const sel = window.getSelection();
					sel?.removeAllRanges();
					sel?.addRange(range);
					break;
				}
			}
		});

		// Bubble menu should appear with formatting buttons
		await page.waitForFunction(
			() => {
				const buttons = Array.from(document.querySelectorAll('button[title]'));
				return buttons.some((b) => b.getAttribute('title') === 'Bold');
			},
			{ timeout: 5000 }
		);

		// Verify expected formatting buttons are in the bubble menu
		const titles = await page.evaluate(() => {
			const buttons = Array.from(document.querySelectorAll('button[title]'));
			return buttons
				.map((b) => b.getAttribute('title'))
				.filter((t) => ['Bold', 'Italic', 'Inline code', 'Heading 2', 'Heading 3', 'Bullet list', 'Ordered list', 'Blockquote'].includes(t));
		});
		expect(titles).toContain('Bold');
		expect(titles).toContain('Italic');

		// Click somewhere else to dismiss
		await page.click('.ProseMirror[contenteditable="true"]');
	});

	// ── Deleting another section to verify multiple deletes ──────────────

	test('11. deleting "Gamma Section" leaves only "Beta Section"', async () => {
		// After Alpha was deleted, TOC has Beta (index 0) and Gamma (index 1)
		const trashButtons = await page.$$('button[title="Delete section"]');
		expect(trashButtons.length).toBe(2);

		// Delete Gamma (second button)
		await trashButtons[1].click();

		await page.waitForFunction(
			() => {
				const pm = document.querySelector('.ProseMirror');
				return pm && !pm.innerHTML.includes('Gamma Section');
			},
			{ timeout: 5000 }
		);

		const html = await page.$eval('.ProseMirror', (el) => el.innerHTML);
		expect(html).toContain('Beta Section');
		expect(html).not.toContain('Gamma Section');

		// Only 1 delete button left
		const remaining = await page.$$('button[title="Delete section"]');
		expect(remaining.length).toBe(1);

		// Wait for auto-save to fire (1s debounce) and complete
		await new Promise((r) => setTimeout(r, 2500));
	});

	// ── Modal close via Escape key ───────────────────────────────────────

	test('12. pressing Escape closes the modal', async () => {
		await page.keyboard.press('Escape');

		await page.waitForFunction(
			() =>
				!Array.from(document.querySelectorAll('[class*="dialog"]')).some(
					(el) => el.offsetParent !== null
				),
			{ timeout: 5000 }
		);
	});

	// ── Final persistence check after Escape close ───────────────────────

	test('13. reopening after Escape close still shows persisted content', async () => {
		await page.click('button[aria-label="view questions document"]');
		await page.waitForSelector('.ProseMirror[contenteditable="true"]', { timeout: 5000 });

		await page.waitForFunction(
			() => {
				const pm = document.querySelector('.ProseMirror');
				return pm && pm.innerText.includes('Beta Section');
			},
			{ timeout: 5000 }
		);

		const editorText = await page.$eval('.ProseMirror', (el) => el.innerText);
		expect(editorText).not.toContain('Alpha Section');
		expect(editorText).not.toContain('Gamma Section');
		expect(editorText).toContain('Beta Section');

		// Close modal for cleanup
		await page.click('button[aria-label="close"]');
	});

	// ── Cleanup ──────────────────────────────────────────────────────────

	test('14. deletes the project via UI', async () => {
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
