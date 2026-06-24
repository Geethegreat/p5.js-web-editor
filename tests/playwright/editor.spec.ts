import { test, expect, request } from '@playwright/test';

test.describe('p5.js Editor – Playwright E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Wait for the page to be interactive before checking for the banner
    await page.waitForSelector('.CodeMirror', { timeout: 30_000 });

    // Dismiss cookie banner via JS — handles the case where the button
    // is outside the viewport due to the Redux DevTools sidebar
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        /allow essential|allow all/i.test(b.textContent ?? '')
      ) as HTMLElement | undefined;
      btn?.click();
    });

    await page.waitForTimeout(400);
  });

  test('can execute code from the editor by clicking the Play button', async ({
    page
  }) => {
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
    ].join('\n');

    // Wait for CodeMirror to be ready
    await page.waitForFunction(
      () => {
        const wrapper = document.querySelector('.CodeMirror') as any;
        return (wrapper?.CodeMirror?.getValue?.() ?? '').length > 0;
      },
      { timeout: 30_000 }
    );

    // Update code via CodeMirror API + Redux dispatch
    // (confirmed working approach from earlier diagnostic work)
    await page.evaluate((code) => {
      const cm = (document.querySelector('.CodeMirror') as any).CodeMirror;
      cm.setValue(code);
      cm.refresh();

      const root = document.querySelector('#root') as any;
      const fiberKey = Object.keys(root).find((k) =>
        k.startsWith('__reactContainer')
      );
      let node = root[fiberKey];
      let store: any = null;
      while (node) {
        if (node.memoizedProps?.store) {
          store = node.memoizedProps.store;
          break;
        }
        node = node.child;
      }
      if (!store) throw new Error('Redux store not found');

      const selectedFile = store
        .getState()
        .files.find((f: any) => f.isSelectedFile);
      if (!selectedFile) throw new Error('No selected file');

      store.dispatch({
        type: 'UPDATE_FILE_CONTENT',
        id: selectedFile.id,
        content: code
      });
    }, newCode);

    await page.waitForTimeout(500);

    // Click Play
    await page.locator('#play-sketch').click();

    // Wait for the sketch iframe to confirm the sketch actually started
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('iframe')).some((f) =>
          (f as HTMLIFrameElement).src.includes('8002')
        ),
      { timeout: 10_000 }
    );

    // Open console if collapsed
    const openConsole = page.getByLabel('Open console');
    if (await openConsole.isVisible().catch(() => false)) {
      await openConsole.click();
    }

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

    // Wait for editor to initialize
    await page.waitForFunction(() => {
      const wrapper = document.querySelector('.CodeMirror') as any;
      return !!wrapper?.CodeMirror;
    });

    const editor = page.locator('.CodeMirror');
    await editor.click();

    // Attempt save via keyboard shortcut
    await page.keyboard.press('Control+S');

    // Verify login prompt appears
    await expect(
      page.getByText(
        'In order to save sketches, you must be logged in. Please Login or Sign Up.'
      )
    ).toBeVisible();
  });

  function uniqueSuffix() {
    return Date.now().toString(36);
  }

  test('new user can signup with username and password', async ({ page }) => {
    const username = `testuser_${uniqueSuffix()}`;
    const password = 'testpassword';
    const email = `testuser_${uniqueSuffix()}@example.com`;

    await page.goto('/');

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

test.describe('Authenticated user flows', () => {
  const sharedUser = {
    username: '',
    email: '',
    password: 'TestPass123!'
  };

  test.beforeAll(async () => {
    const suffix = Date.now().toString(36);
    sharedUser.username = `pw_test_${suffix}`;
    sharedUser.email = `pw_test_${suffix}@example.com`;

    const ctx = await request.newContext({ baseURL: 'http://localhost:8000' });
    const res = await ctx.post('/editor/signup', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        username: sharedUser.username,
        email: sharedUser.email,
        password: sharedUser.password,
        confirmPassword: sharedUser.password
      }
    });

    const status = res.status();
    const body = await res.text();
    await ctx.dispose();

    if (status < 200 || status >= 300) {
      throw new Error(
        `beforeAll: failed to create test user — ${status}\n${body}`
      );
    }
  });

  test('existing user can log in with username and password', async ({
    page,
    context
  }) => {
    // Navigate directly to login page
    await page.goto('/login');
    await page.waitForSelector('.form-container__title', { timeout: 30_000 });
    await expect(page.locator('h2.form-container__title')).toHaveText('Log In');

    // Fill the login form
    // Passport's usernameField is 'email' — the input accepts either
    // username or email as the value but the field name is 'email'
    await page.fill('input[name="email"]', sharedUser.email);
    await page.fill('input[name="password"]', sharedUser.password);

    // Submit
    await expect(page.locator('button[type="submit"]')).toBeEnabled({
      timeout: 5_000
    });
    await page.click('button[type="submit"]');

    // After successful login, redirected away from /login
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), {
      timeout: 15_000
    });

    // Nav shows username, not "Log in"
    await expect(page.locator('a[href="/login"]')).toHaveCount(0, {
      timeout: 10_000
    });
    await expect(
      page.locator(`text=${sharedUser.username}`).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
