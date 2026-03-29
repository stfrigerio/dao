import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { launchBrowser, login, BASE_URL, CREDENTIALS } from './helpers.js';

let browser;
let page;

beforeAll(async () => {
	browser = await launchBrowser();
	page = await browser.newPage();
});

afterAll(async () => {
	await browser.close();
});

describe('Auth', () => {
	test('redirects to login when not authenticated', async () => {
		await page.goto(`${BASE_URL}/`);
		await page.waitForFunction(
			() => window.location.pathname.includes('/login'),
			{ timeout: 8000 }
		);
		expect(page.url()).toContain('/login');
	});

	test('shows error on wrong credentials', async () => {
		await page.goto(`${BASE_URL}/login`);
		await page.waitForSelector('input[type="email"]');
		await page.type('input[type="email"]', 'wrong@email.com');
		await page.type('input[type="password"]', 'wrongpass');
		await page.click('button[type="submit"]');
		await page.waitForFunction(
			() => document.body.innerText.toLowerCase().includes('invalid') ||
				document.body.innerText.toLowerCase().includes('error'),
			{ timeout: 5000 }
		);
	});

	test('logs in with valid credentials', async () => {
		await page.goto(`${BASE_URL}/login`);
		await page.waitForSelector('input[type="email"]');
		await page.evaluate(() => {
			document.querySelector('input[type="email"]').value = '';
			document.querySelector('input[type="password"]').value = '';
		});
		await page.type('input[type="email"]', CREDENTIALS.email);
		await page.type('input[type="password"]', CREDENTIALS.password);
		await page.click('button[type="submit"]');
		await page.waitForNavigation({ waitUntil: 'networkidle0' });
		expect(page.url()).not.toContain('/login');
	});

	test('shows dashboard after login', async () => {
		await page.waitForFunction(
			() => document.body.innerText.includes('Dashboard'),
			{ timeout: 5000 }
		);
	});

	test('logs out and redirects to login', async () => {
		const logoutBtn = await page.$('button[aria-label="logout"], button');
		const buttons = await page.$$('button');
		for (const btn of buttons) {
			const text = await btn.evaluate((el) => el.innerText.toLowerCase());
			if (text.includes('logout') || text.includes('sign out')) {
				await btn.click();
				break;
			}
		}
		await page.waitForFunction(
			() => window.location.pathname.includes('/login'),
			{ timeout: 5000 }
		);
		expect(page.url()).toContain('/login');
	});
});
