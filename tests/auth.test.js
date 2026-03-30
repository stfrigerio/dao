import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { launchBrowser, login, isAuthBypassed, BASE_URL, CREDENTIALS } from './helpers.js';

let browser;
let page;
let bypassed;

beforeAll(async () => {
	browser = await launchBrowser();
	page = await browser.newPage();
	bypassed = await isAuthBypassed();
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
		if (bypassed) {
			console.log('  ⏭  Skipped: DEV_AUTH_BYPASS is enabled — wrong creds still log in');
			return;
		}
		await page.goto(`${BASE_URL}/login`);
		await page.waitForSelector('#email');
		await page.type('#email', 'wrong@email.com');
		await page.type('#password', 'wrongpass');
		await page.click('button[type="submit"]');
		await page.waitForFunction(
			() => document.body.innerText.toLowerCase().includes('invalid') ||
				document.body.innerText.toLowerCase().includes('error'),
			{ timeout: 5000 }
		);
	});

	test('logs in with valid credentials', async () => {
		await page.goto(`${BASE_URL}/login`);
		await page.waitForSelector('#email');
		await page.evaluate(() => {
			document.querySelector('#email').value = '';
			document.querySelector('#password').value = '';
		});
		await page.type('#email', CREDENTIALS.email);
		await page.type('#password', CREDENTIALS.password);
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
		await page.evaluate(() => {
			const btn = Array.from(document.querySelectorAll('button'))
				.find((b) => b.innerText.toLowerCase().includes('logout'));
			if (btn) btn.click();
		});
		await page.waitForFunction(
			() => window.location.pathname.includes('/login'),
			{ timeout: 8000 }
		);
		expect(page.url()).toContain('/login');
	});
});
