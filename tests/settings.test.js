import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { launchBrowser, login, BASE_URL, waitForText, apiCleanupUser } from './helpers.js';

let browser;
let page;
let testEmail;

beforeAll(async () => {
	browser = await launchBrowser();
	page = await browser.newPage();
	await login(page);
});

afterAll(async () => {
	await apiCleanupUser(testEmail); // safety net: deletes user if UI delete test failed
	await browser?.close();
});

describe('Settings', () => {
	test('navigates to settings page', async () => {
		await page.goto(`${BASE_URL}/settings`);
		await page.waitForSelector('h1', { timeout: 5000 });
		expect(page.url()).toContain('/settings');
	});

	test('shows current user profile', async () => {
		await waitForText(page, 'admin@dao.local', 5000);
	});

	test('shows users list for admin', async () => {
		// 'Add User' button only renders for admins who have the users list loaded
		await waitForText(page, 'Add User', 5000);
	});

	test('opens add user form', async () => {
		const buttons = await page.$$('button');
		for (const btn of buttons) {
			const text = await btn.evaluate((el) => el.innerText);
			if (text.toLowerCase().includes('add user')) {
				await btn.click();
				break;
			}
		}
		await page.waitForSelector('input[placeholder="Name"]', { timeout: 5000 });
	});

	test('creates a new user', async () => {
		testEmail = `test${Date.now()}@dao.local`;

		await page.type('input[placeholder="Name"]', 'Test User');
		await page.type('input[placeholder="Email"]', testEmail);
		await page.type('input[placeholder="Password"]', 'password123');
		await page.click('button[type="submit"]');

		await waitForText(page, testEmail, 8000);
	});

	test('deletes the test user', async () => {
		// Find the row containing the test email and click its delete button
		const rows = await page.$$('[class*="userRow"]');
		for (const row of rows) {
			const text = await row.evaluate((el) => el.innerText);
			if (text.includes(testEmail)) {
				page.once('dialog', (dialog) => dialog.accept());
				const deleteBtn = await row.$('button');
				await deleteBtn.click();
				break;
			}
		}
		await page.waitForFunction(
			(email) => !document.body.innerText.includes(email),
			{ timeout: 8000 },
			testEmail
		);
	});
});
