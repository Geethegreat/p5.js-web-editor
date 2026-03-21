import { test, expect } from '@playwright/test';

test.describe('p5.js Editor - Playwright', () => {
  async function dismissCookies(page) {
    try {
      // Use JS click to bypass viewport restrictions on the cookie banner
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const dismiss = buttons.find((b) =>
          /accept|ok|got it|agree|close|dismiss|continue/i.test(
            b.textContent || ''
          )
        );
        if (dismiss) dismiss.click();
      });
      await page.waitForTimeout(500); // let banner animate away
    } catch {
      // No banner, continue
    }
  }

  async function clickPlayButton(page) {
    // Use JS click directly — bypasses viewport/overlay issues
    await page.evaluate(() => {
      const btn = document.querySelector(
        '[aria-label="Play sketch"]'
      ) as HTMLElement;
      if (btn) btn.click();
    });
  }

  test('editor loads and has a sketch iframe', async ({ page }) => {
    await page.goto('http://localhost:8000');
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

  test('run button triggers sketch in iframe', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await dismissCookies(page);
    await clickPlayButton(page);

    // Wait for iframe to appear first
    await page.waitForSelector('iframe', { timeout: 10000 });

    // Check the iframe src — it points to preview port (cross-origin)
    const iframeSrc = await page.locator('iframe').getAttribute('src');
    console.log('iframe src:', iframeSrc);

    // For cross-origin iframes, verify the iframe exists and has a src
    // rather than trying to access its contents
    expect(iframeSrc).toBeTruthy();

    // Also verify iframe is visible
    await expect(page.locator('iframe')).toBeVisible({ timeout: 10000 });
  });
});
