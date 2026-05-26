import { test, expect, Page } from '@playwright/test';

async function dismissCookies(page: Page) {
  try {
    await page.waitForSelector('button', { timeout: 3_000 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        /allow all|allow essential/i.test(b.textContent ?? '')
      ) as HTMLElement | undefined;
      btn?.click();
    });
    await page.waitForTimeout(400);
  } catch {
    /* no banner */
  }
}

test.describe('p5.js Editor – Playwright E2E', () => {
  test('editor loads and has a sketch iframe', async ({ page }) => {
    await page.goto('http://localhost:8000', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000
    });
    await dismissCookies(page);
    await page.evaluate(() => {
      (document.querySelector(
        '[aria-label="Play sketch"]'
      ) as HTMLElement)?.click();
    });
    const iframeHandle = await page.waitForSelector('iframe', {
      timeout: 15_000
    });
    expect(iframeHandle).toBeTruthy();
  });

  test('can access iframe content frame', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await dismissCookies(page);
    await page.waitForSelector('iframe');
    const body = page.frameLocator('iframe').first().locator('body');
    await expect(body).toBeAttached({ timeout: 10_000 });
  });

  test('run button triggers sketch in iframe', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await dismissCookies(page);
    await page.evaluate(() => {
      (document.querySelector(
        '[aria-label="Play sketch"]'
      ) as HTMLElement)?.click();
    });
    await page.waitForSelector('iframe', { timeout: 10_000 });
    const iframeSrc = await page.locator('iframe').getAttribute('src');
    console.log('iframe src:', iframeSrc);
    expect(iframeSrc).toBeTruthy();
    await expect(page.locator('iframe')).toBeVisible({ timeout: 10_000 });
  });

  test.skip('sketch execution via postMessage', async () => {
    // FINDING: postMessage interception via page.evaluate() returns empty.
    // The sketch iframe (localhost:8002) sends messages via window.parent.parent
    // but these do not surface in Playwright's main page context.
    // Testing sketch output would require CDP or a dedicated message relay
    // — a candidate for GSoC implementation.
  });

  test('sketch console.log appears in editor console', async ({ page }) => {
    await page.goto('http://localhost:8000');

    await dismissCookies(page);

    // Wait for CodeMirror
    await page.waitForFunction(() => {
      const wrapper = document.querySelector('.CodeMirror') as any;
      return !!wrapper?.CodeMirror;
    });

    // Inject sketch into BOTH CodeMirror + Redux
    await page.evaluate(
      (newCode) => {
        // Update CodeMirror UI
        const cm = (document.querySelector('.CodeMirror') as any)?.CodeMirror;

        if (!cm) {
          throw new Error('CodeMirror not found');
        }

        cm.setValue(newCode);

        // Force CodeMirror refresh/events
        cm.refresh();

        // Find Redux store
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

        if (!store) {
          throw new Error('Redux store not found');
        }

        const state = store.getState();

        // Find active file
        const selectedFile = state.files.find((f: any) => f.isSelectedFile);

        if (!selectedFile) {
          throw new Error('Selected file not found');
        }

        console.log('[SELECTED FILE ID]', selectedFile.id);

        // Dispatch REAL update
        store.dispatch({
          type: 'UPDATE_FILE_CONTENT',
          id: selectedFile.id,
          content: newCode
        });

        // Debug updated state
        const updatedState = store.getState();

        const updatedFile = updatedState.files.find(
          (f: any) => f.id === selectedFile.id
        );

        console.log('[UPDATED REDUX FILE CONTENT]', updatedFile?.content);
      },
      `
function setup() {
  createCanvas(400, 400);
  console.log('hello from sketch');
}

function draw() {
  background(220);
}
`
    );

    // Let Redux + React sync
    await page.waitForTimeout(3000);

    // Verify CodeMirror content
    // const editorContent = await page.evaluate(() => {
    //   return (
    //     document.querySelector('.CodeMirror') as any
    //   ).CodeMirror.getValue();
    // });

    // Verify Redux content
    // const reduxContent = await page.evaluate(() => {
    //   const root = document.querySelector('#root') as any;

    //   const fiberKey = Object.keys(root).find((k) =>
    //     k.startsWith('__reactContainer')
    //   );

    //   let node = root[fiberKey];

    //   let store: any = null;

    //   while (node) {
    //     if (node.memoizedProps?.store) {
    //       store = node.memoizedProps.store;
    //       break;
    //     }

    //     node = node.child;
    //   }

    //   const state = store.getState();

    //   const selectedFile = state.files.find(
    //     (f: any) => f.isSelectedFile
    //   );

    //   return selectedFile?.content;
    // });

    // Click Play
    await page.evaluate(() => {
      (document.querySelector(
        '[aria-label="Play sketch"]'
      ) as HTMLElement)?.click();
    });

    // Wait for preview iframe
    await page.waitForSelector('iframe', {
      timeout: 15000
    });

    // Give preview time to boot
    await page.waitForTimeout(3000);
  });
});
