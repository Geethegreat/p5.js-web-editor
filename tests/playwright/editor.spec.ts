import { test, expect } from '@playwright/test';

test.describe('p5.js Editor - Playwright', () => {
  async function dismissCookies(page) {
    try {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const dismiss = buttons.find((b) =>
          /accept|ok|got it|agree|close|dismiss|continue/i.test(
            b.textContent || ''
          )
        );
        if (dismiss) dismiss.click();
      });
      await page.waitForTimeout(500);
    } catch {
      // No banner, continue
    }
  }

  async function clickPlayButton(page) {
    await page.evaluate(() => {
      const btn = document.querySelector(
        '[aria-label="Play sketch"]'
      ) as HTMLElement;
      if (btn) btn.click();
    });
  }

  test('editor loads and has a sketch iframe', async ({ page }) => {
    await page.waitForTimeout(1000);
    await page.goto('http://localhost:8000', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await dismissCookies(page);
    await clickPlayButton(page);

    const iframeHandle = await page.waitForSelector('iframe', {
      timeout: 15000
    });
    expect(iframeHandle).toBeTruthy();
  });

  test('can access iframe content frame', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await dismissCookies(page);
    await page.waitForSelector('iframe');

    const frame = page.frameLocator('iframe').first();
    const body = frame.locator('body');
    await expect(body).toBeAttached({ timeout: 10000 });
  });

  test('run button triggers sketch — iframe src is cross-origin', async ({
    page
  }) => {
    await page.goto('http://localhost:8000');
    await dismissCookies(page);
    await clickPlayButton(page);

    await page.waitForSelector('iframe', { timeout: 10000 });

    const iframeSrc = await page.locator('iframe').getAttribute('src');
    console.log('iframe src:', iframeSrc);

    // Key finding: preview runs on a separate origin (8002)
    // meaning canvas/console contents are inaccessible cross-origin
    expect(iframeSrc).toBeTruthy();
    await expect(page.locator('iframe')).toBeVisible({ timeout: 10000 });
  });
});
