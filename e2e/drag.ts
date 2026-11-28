import { expect, type Page } from '@playwright/test';

/** Fielders a finger can grab without landing in the play dock. */
const FIELDERS = [
  'token-SS',
  'token-CF',
  'token-P',
  'token-2B',
  'token-3B',
  'token-LF',
  'token-RF',
  'token-1B',
  'token-C',
] as const;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function center(box: Box): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * The viewBox and token magnification settle a frame or two after mount
 * (ResizeObserver). Dragging before that misses the player.
 */
export async function waitForFieldLayout(page: Page): Promise<void> {
  const token = page.getByTestId('token-SS');
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

/**
 * Pull an arrow out of a fielder.
 *
 * Playwright's WebKit touchscreen can tap, but it cannot drag, so the stroke
 * is a trusted pointer drag. The field listens to pointer events either way;
 * the buttons in this suite are tapped.
 *
 * Returns the token test id that was dragged, so a later assertion can follow
 * that same player through playback.
 */
export async function drawArrow(page: Page): Promise<string> {
  await waitForFieldLayout(page);

  const fieldBox = await page.getByTestId('field').boundingBox();
  if (!fieldBox) throw new Error('Baseball field has no bounding box');
  const dockBox = await page.locator('.play-dock').boundingBox();
  const dockTop = dockBox ? dockBox.y : fieldBox.y + fieldBox.height;

  const bounds = {
    minX: fieldBox.x + 16,
    maxX: fieldBox.x + fieldBox.width - 16,
    minY: fieldBox.y + 16,
    maxY: Math.min(fieldBox.y + fieldBox.height - 16, dockTop - 16),
  };

  const offsets = [
    { x: 0, y: 150 },
    { x: 0, y: -150 },
    { x: 160, y: 0 },
    { x: -160, y: 0 },
    { x: 120, y: 120 },
    { x: -120, y: 120 },
    { x: 120, y: -120 },
    { x: -120, y: -120 },
  ];

  for (const testId of FIELDERS) {
    const box = await page.getByTestId(testId).boundingBox();
    if (!box || box.width < 1 || box.height < 1) continue;
    const start = center(box);
    if (
      start.x < bounds.minX ||
      start.x > bounds.maxX ||
      start.y < bounds.minY ||
      start.y > bounds.maxY
    ) {
      continue;
    }

    const end = offsets
      .map((offset) => ({
        x: Math.min(bounds.maxX, Math.max(bounds.minX, start.x + offset.x)),
        y: Math.min(bounds.maxY, Math.max(bounds.minY, start.y + offset.y)),
      }))
      .find((point) => Math.hypot(point.x - start.x, point.y - start.y) >= 90);
    if (!end) continue;

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expect(page.locator('.fx-move-aiming')).toHaveCount(1);
    await page.mouse.move(end.x, end.y, { steps: 24 });
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    await page.mouse.up();
    return testId;
  }

  throw new Error('No fielder had room for an arrow drag clear of the play dock');
}
