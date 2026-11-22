import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Desktop 1280×800 leaves the catcher under the step bar. These tests pin
 * that viewport (and the phone size where the catcher already sits clear)
 * without adding a browser project: CI only installs WebKit.
 */
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * The viewBox settles a frame or two after mount (ResizeObserver). Dragging
 * before that misses the player.
 */
async function waitForFieldLayout(page: Page): Promise<void> {
  const token = page.getByTestId('token-C');
  let previous = '';
  let matches = 0;
  await expect
    .poll(async () => {
      const box = await token.boundingBox();
      if (!box || box.width < 1 || box.height < 1) {
        matches = 0;
        previous = '';
        return 0;
      }
      const key = [box.x, box.y, box.width, box.height].map((n) => n.toFixed(1)).join(',');
      matches = key === previous ? matches + 1 : 0;
      previous = key;
      return matches;
    })
    .toBeGreaterThanOrEqual(2);
}

/** Press the center of a token and pull. Returns the point that was pressed. */
async function dragFromCenter(page: Page, token: Locator, dx: number, dy: number): Promise<void> {
  const box = await token.boundingBox();
  if (!box) throw new Error('token has no bounding box');
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 24 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('field')).toBeVisible();
  await expect(page.getByTestId('token-C')).toBeVisible();
  await waitForFieldLayout(page);
});

test.describe('1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('dragging center field still draws an arrow', async ({ page }) => {
    const play = page.getByTestId('play');
    await expect(play).toBeDisabled();
    await dragFromCenter(page, page.getByTestId('token-CF'), 140, 140);
    await expect(page.getByTestId('move-arrow')).toHaveCount(1);
    await expect(play).toBeEnabled();
  });

  test('the center of the catcher is draggable and the step bar does not cover it', async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 1280, height: 800 });

    const catcher = page.getByTestId('token-C');
    const stepBar = page.getByRole('group', { name: 'Play steps' });
    const catcherBox = await catcher.boundingBox();
    const stepBox = await stepBar.boundingBox();
    if (!catcherBox || !stepBox) throw new Error('catcher or step bar has no bounding box');

    expect(overlaps(catcherBox, stepBox), 'step bar must not cover the catcher').toBe(false);

    const play = page.getByTestId('play');
    await expect(play).toBeDisabled();
    // Up and to the right, the same stroke that works on center field.
    await dragFromCenter(page, catcher, 140, -140);
    await expect(page.getByTestId('move-arrow')).toHaveCount(1);
    await expect(play).toBeEnabled();
  });
});

test.describe('390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the catcher sits above the dock and a drag from its center draws an arrow', async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });

    const catcherBox = await page.getByTestId('token-C').boundingBox();
    const dockBox = await page.locator('.play-dock').boundingBox();
    if (!catcherBox || !dockBox) throw new Error('catcher or play dock has no bounding box');
    expect(catcherBox.y + catcherBox.height).toBeLessThan(dockBox.y);

    const play = page.getByTestId('play');
    await expect(play).toBeDisabled();
    await dragFromCenter(page, page.getByTestId('token-C'), 80, -100);
    await expect(page.getByTestId('move-arrow')).toHaveCount(1);
    await expect(play).toBeEnabled();
  });
});
