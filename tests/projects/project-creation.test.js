import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { launchBrowser, login, BASE_URL, waitForText, apiCleanupProject } from '../helpers.js';

const projectName = `Creation Test ${Date.now()}`;
const projectDescription = 'E2E test project for creation flow';
let browser;
let page;

beforeAll(async () => {
    browser = await launchBrowser();
    page = await browser.newPage();
    await login(page);
});

afterAll(async () => {
    await apiCleanupProject(projectName);
    await browser?.close();
});

describe('Project creation flow', () => {
    test('navigates to the projects page', async () => {
        await page.goto(`${BASE_URL}/projects`);
        await page.waitForSelector('h1', { timeout: 5000 });
        await page.waitForFunction(
            () => document.querySelector('h1')?.innerText.toLowerCase().includes('project'),
            { timeout: 5000 }
        );
    });

    test('opens the New Project modal', async () => {
        // The "New Project" button is the only button with this text on the page
        await page.waitForFunction(
            () =>
                Array.from(document.querySelectorAll('button')).some((b) =>
                    b.innerText.toLowerCase().includes('new project')
                ),
            { timeout: 5000 }
        );
        const buttons = await page.$$('button');
        for (const btn of buttons) {
            const text = await btn.evaluate((el) => el.innerText);
            if (text.toLowerCase().includes('new project')) {
                await btn.click();
                break;
            }
        }
        // Modal appears when input is rendered
        await page.waitForSelector('input[placeholder="Project name"]', { timeout: 5000 });
    });

    test('fills in the project name and description', async () => {
        await page.type('input[placeholder="Project name"]', projectName);
        await page.type('textarea[placeholder="What is this project about?"]', projectDescription);
        // Verify name field contains what was typed
        const value = await page.$eval(
            'input[placeholder="Project name"]',
            (el) => el.value
        );
        expect(value).toBe(projectName);
    });

    test('selects the Personal project type', async () => {
        // Type toggle: "Professional" is selected by default; switch to "Personal"
        const buttons = await page.$$('button[type="button"]');
        for (const btn of buttons) {
            const text = await btn.evaluate((el) => el.innerText);
            if (text.trim() === 'Personal') {
                await btn.click();
                break;
            }
        }
        // Confirm Personal button has active styling (its class list changes)
        await page.waitForFunction(() => {
            const btns = Array.from(document.querySelectorAll('button[type="button"]'));
            const personal = btns.find((b) => b.innerText.trim() === 'Personal');
            // The active button gets a second class — check className has more than one token
            return personal && personal.className.split(' ').length > 1;
        }, { timeout: 3000 });
    });

    test('submits the form and project is created', async () => {
        // Intercept any console errors to aid diagnosis if the test fails
        page.once('console', (msg) => {
            if (msg.type() === 'error') {
                console.error('[browser console error]', msg.text());
            }
        });

        await page.click('button[type="submit"]');

        // Modal should close (input disappears) once onCreate resolves
        await page.waitForFunction(
            () => !document.querySelector('input[placeholder="Project name"]'),
            { timeout: 15000 }
        );

        // Toast "Project … created" should be visible
        await waitForText(page, `Project "${projectName}" created`, 10000);
    });

    test('newly created project appears on the projects page', async () => {
        // The store was invalidated after creation; a full page reload triggers a fresh fetchAll
        await page.goto(`${BASE_URL}/projects`);
        await page.waitForFunction(
            (name) => document.body.innerText.includes(name),
            { timeout: 10000 },
            projectName
        );
    });

    test('clicking the project card navigates to the detail page', async () => {
        // Find the card link whose text includes our project name and follow it
        const links = await page.$$('a');
        for (const link of links) {
            const text = await link.evaluate((el) => el.innerText || el.textContent || '');
            const href = await link.evaluate((el) => el.getAttribute('href') || '');
            if (href.startsWith('/projects/') && text.includes(projectName)) {
                await link.click();
                break;
            }
        }
        await page.waitForFunction(
            () => /\/projects\/[^/]+$/.test(window.location.pathname),
            { timeout: 8000 }
        );
        expect(page.url()).toMatch(/\/projects\/.+/);
    });

    test('detail page shows the project name and description', async () => {
        // Both were set during creation — unique strings that only exist because of this test
        await waitForText(page, projectName, 8000);
        await waitForText(page, projectDescription, 8000);
    });

    test('detail page shows the default phases created alongside the project', async () => {
        // ProjectsPage.handleCreate posts all DEFAULT_PHASES after creating the project;
        // these should all render on the PhaseBoard
        for (const phase of ['Discovery', 'Planning', 'Execution', 'Review', 'Done']) {
            await waitForText(page, phase, 8000);
        }
    });

    test('deletes the project via the delete button', async () => {
        page.once('dialog', (dialog) => dialog.accept());
        await page.click('button[aria-label="delete project"]');

        // After deletion the store navigates back to /projects
        await page.waitForFunction(
            () => window.location.pathname === '/projects',
            { timeout: 8000 }
        );

        // Project card must no longer be visible in the list
        await page.waitForFunction(
            (name) => !document.body.innerText.includes(name),
            { timeout: 10000 },
            projectName
        );
    });
});
