import { expect, test } from '@playwright/test';
import { drawArrow } from './drag';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('field')).toBeVisible();
  await expect(page.getByTestId('token-SS')).toBeVisible();
});

test('draws an arrow, adds a step, plays, and undoes', async ({ page }) => {
  // Device profiles enable touch. WebKit here reports maxTouchPoints as 0, so
  // the check is the touch event surface and a coarse pointer, which is what
  // the field actually listens for. tap() below also throws if hasTouch is off.
  const touch = await page.evaluate(() => ({
    ontouchstart: 'ontouchstart' in window,
    coarse: window.matchMedia('(pointer: coarse)').matches,
  }));
  expect(touch).toEqual({ ontouchstart: true, coarse: true });

  const play = page.getByTestId('play');
  const undo = page.getByTestId('undo');
  const addStep = page.getByTestId('add-step');
  const arrow = page.getByTestId('move-arrow');

  await expect(play).toBeDisabled();
  await expect(undo).toBeDisabled();
  await expect(page.getByTestId('step-1')).toHaveAttribute('data-movers', '0');

  const tokenId = await drawArrow(page);
  const mover = page.getByTestId(tokenId);

  await expect(arrow).toHaveCount(1);
  await expect(arrow).toHaveAttribute('data-step', '1');
  await expect(page.getByTestId('step-1')).toHaveAttribute('data-movers', '1');
  await expect(play).toBeEnabled();
  await expect(undo).toBeEnabled();

  await addStep.tap();
  await expect(page.getByTestId('step-2')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('step-2')).toHaveAttribute('data-movers', '0');
  await expect(page.getByTestId('step-1')).toHaveAttribute('aria-pressed', 'false');
  await expect(arrow).toHaveCount(1);

  const origin = await mover.boundingBox();
  if (!origin) throw new Error(`${tokenId} disappeared before Play`);

  await play.tap();
  await expect(play).toHaveAccessibleName('Pause playback');
  await expect
    .poll(
      async () => {
        const box = await mover.boundingBox();
        if (!box) return 0;
        return Math.hypot(box.x - origin.x, box.y - origin.y);
      },
      { timeout: 10_000 },
    )
    .toBeGreaterThan(20);
  await expect(play).toBeEnabled({ timeout: 10_000 });
  await expect
    .poll(
      async () => {
        const box = await mover.boundingBox();
        if (!box) return 999;
        return Math.hypot(box.x - origin.x, box.y - origin.y);
      },
      { timeout: 10_000 },
    )
    .toBeLessThan(4);

  // The last edit was adding the empty step, so the first undo takes it back
  // and leaves the arrow. The second undo takes the arrow off.
  await undo.tap();
  await expect(page.getByTestId('step-2')).toHaveCount(0);
  await expect(arrow).toHaveCount(1);
  await expect(page.getByTestId('step-1')).toHaveAttribute('data-movers', '1');
  await expect(page.getByTestId('step-1')).toHaveAttribute('aria-pressed', 'true');

  await undo.tap();
  await expect(arrow).toHaveCount(0);
  await expect(page.getByTestId('step-1')).toHaveAttribute('data-movers', '0');
  await expect(play).toBeDisabled();
  await expect(undo).toBeDisabled();
});

test('disables undo while a play is running', async ({ page }) => {
  const play = page.getByTestId('play');
  const undo = page.getByTestId('undo');
  const addStep = page.getByTestId('add-step');
  const arrow = page.getByTestId('move-arrow');
  const caption = page.locator('.play-caption span');
  const speed = page.getByRole('button', { name: /Playback speed/ });

  await drawArrow(page);
  await expect(page.getByTestId('step-1')).toHaveAttribute('data-movers', '1');
  await expect(arrow).toHaveCount(1);

  await addStep.tap();
  await expect(page.getByTestId('step-2')).toHaveAttribute('aria-pressed', 'true');

  const tokenId = await drawArrow(page);
  const mover = page.getByTestId(tokenId);
  await expect(page.getByTestId('step-2')).toHaveAttribute('data-movers', '1');
  await expect(arrow).toHaveCount(2);
  await expect(caption).not.toContainText('Nobody moves yet');
  await expect(undo).toBeEnabled();

  // 1×, then 2×, then 0.5× — a slow clip, so Undo can be checked while it runs.
  await speed.tap();
  await speed.tap();
  await expect(speed).toHaveText('0.5×');

  const origin = await mover.boundingBox();
  if (!origin) throw new Error(`${tokenId} disappeared before Play`);

  await play.tap();
  await expect(play).toHaveAccessibleName('Pause playback');
  await expect(undo).toBeDisabled();

  // Undo must not take step 2's arrow off while the original clip is still running.
  await expect(page.getByTestId('step-2')).toHaveAttribute('data-movers', '1');
  await expect(arrow).toHaveCount(2);
  await expect(caption).not.toContainText('Nobody moves yet');
  await expect(play).toHaveAccessibleName('Pause playback');

  await expect
    .poll(
      async () => {
        const box = await mover.boundingBox();
        if (!box) return 0;
        return Math.hypot(box.x - origin.x, box.y - origin.y);
      },
      { timeout: 10_000 },
    )
    .toBeGreaterThan(20);
  await expect(undo).toBeDisabled();
  await expect(page.getByTestId('step-2')).toHaveAttribute('data-movers', '1');

  await expect(play).toBeEnabled({ timeout: 15_000 });
  await expect(undo).toBeEnabled();
  await expect
    .poll(
      async () => {
        const box = await mover.boundingBox();
        if (!box) return 999;
        return Math.hypot(box.x - origin.x, box.y - origin.y);
      },
      { timeout: 10_000 },
    )
    .toBeLessThan(4);

  await undo.tap();
  await expect(page.getByTestId('step-2')).toHaveAttribute('data-movers', '0');
  await expect(arrow).toHaveCount(1);
  await expect(caption).toContainText('Nobody moves yet');
  await expect(play).toBeEnabled();
});

test('serves the field from the service worker after an offline reload', async ({ page, context }) => {
  await expect
    .poll(async () => page.evaluate(() => navigator.serviceWorker?.controller?.scriptURL ?? ''), {
      timeout: 20_000,
    })
    .toContain('sw.js');

  await context.setOffline(true);
  const response = await page.reload({ waitUntil: 'load' });
  expect(response).not.toBeNull();
  expect(response?.fromServiceWorker()).toBe(true);

  await expect(page.getByTestId('field')).toBeVisible();
  await expect(page.getByTestId('token-SS')).toBeVisible();
  await expect(page.getByTestId('token-CF')).toBeVisible();
  await expect(page.getByTestId('play')).toBeVisible();
  await expect(page.getByTestId('undo')).toBeVisible();
  await expect(page.getByTestId('add-step')).toBeVisible();

  const controller = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? '');
  expect(controller).toContain('sw.js');
});
