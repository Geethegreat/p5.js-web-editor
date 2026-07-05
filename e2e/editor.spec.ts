import { test, expect } from '@playwright/test';

test.describe('editor page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // initial pageload check to fail fast:
    await expect(page.locator('a.skip_link[href="#play-sketch"]')).toHaveText(
      'Skip to Play Sketch'
    );

    // Dismiss cookie banner if it appears
    // Note: we do document.querySelectorAll instead of page.locator as workaround due to the buttons on the banner being beyond the viewport
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        /allow essential|allow all/i.test(b.textContent ?? '')
      ) as HTMLElement | undefined;
      btn?.click();
    });

    // wait for page to fully load with all main IDE components:
    await expect(page.locator('#play-sketch')).toBeVisible(); // play button
    await expect(page.locator('iframe[title="sketch preview"]')).toBeVisible(); // sketch preview
    await expect(page.locator('.preview-console')).toBeVisible(); // editor console
    await expect(page.locator('.editor-holder')).toBeVisible(); // editor -- NOTE: .editor-holder .CodeMirror cannot be found on CI for some reason, so we are using .editor-holder instead.
  });

  test('can run sketch code written in the editor', async ({ page }) => {
    const newCode = [
      'function setup() {',
      '  createCanvas(400, 400);',
      '}',
      '',
      'function draw() {',
      '  background(220);',
      "  console.log('hi from sketch');",
      '  noLoop();',
      '}'
    ].join(''); // Purposely joining without '\n' to avoid triggering the autocomplete with keyboard.type & creating extra brackets

    // Find editor text area, clear default code & type in the new code
    const editor = page.locator('.editor-holder');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(newCode, { delay: 5 }); // Purposely using .type instead of .insert (.insert does not work with the redux state management)

    // Click Play
    await page.locator('#play-sketch').click({ force: true });

    // Wait for the sketch iframe src to confirm the sketch actually started
    await expect(
      page.locator('iframe[title="sketch preview"]')
    ).toHaveAttribute('src', /8002/, { timeout: 10_000 });

    // Assert console output
    await expect(
      page.locator('.preview-console__messages')
    ).toContainText('hi from sketch', { timeout: 15_000 });
  });

  test('unauthenticated users cannot save sketches', async ({ page }) => {
    // Verify save option is disabled in File menu
    await page.getByRole('menuitem', { name: 'File' }).click();

    const saveButton = page.locator('#file-save');

    await expect(saveButton).toHaveAttribute('aria-disabled', 'true');
    await expect(saveButton).toHaveAttribute(
      'aria-label',
      'Log in to save your sketch'
    );

    // Close menu if needed
    await page.keyboard.press('Escape');

    // Attempt save via keyboard shortcut
    await page.locator('.editor-holder').click();
    await page.keyboard.press('ControlOrMeta+S');

    // Verify login prompt appears
    await expect(
      page.getByText(
        'In order to save sketches, you must be logged in. Please Login or Sign Up.'
      )
    ).toBeVisible();
  });

  test('unauthenticated users cannot save sketches', async ({ page }) => {
    // Verify save option is disabled in File menu
    await page.getByRole('menuitem', { name: 'File' }).click();

    const saveButton = page.locator('#file-save');

    await expect(saveButton).toHaveAttribute('aria-disabled', 'true');
    await expect(saveButton).toHaveAttribute(
      'aria-label',
      'Log in to save your sketch'
    );

    // Close menu if needed
    await page.keyboard.press('Escape');

    // Attempt save via keyboard shortcut
    await page.locator('.editor-holder').click();
    await page.keyboard.press('ControlOrMeta+S');

    // Verify login prompt appears
    await expect(
      page.getByText(
        'In order to save sketches, you must be logged in. Please Login or Sign Up.'
      )
    ).toBeVisible();
  });

  test('new user can signup with username and password', async ({ page }) => {
    const suffix = Date.now().toString(36);
    const username = `testuser_${suffix}`;
    const password = 'testpassword';
    const email = `testuser_${suffix}@example.com`;

    await page.goto('/signup');
    await page.waitForURL('**/signup', { timeout: 10_000 });

    await expect(page.locator('h2.form-container__title')).toHaveText(
      'Sign Up'
    );

    await page.fill('input#username', username);
    await page.fill('input#email', email);
    await page.fill('input#password', password);
    await page.fill('input#confirmPassword', password);

    await expect(page.locator('button[type="submit"]')).toBeEnabled({
      timeout: 5_000
    });
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.endsWith('/signup'), {
      timeout: 15_000
    });

    // Nav should no longer show "Log in"
    await expect(page.locator('a[href="/login"]')).toHaveCount(0, {
      timeout: 5_000
    });

    // Nav should show the new username
    await expect(page.locator(`text=${username}`).first()).toBeVisible({
      timeout: 5_000
    });
  });
});
