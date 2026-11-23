import { expect, test } from '@playwright/test';
import { drawArrow } from './drag';

/**
 * Same key as `STORAGE_KEY` in src/storage/library.ts. The e2e project does not
 * import the app sources, so the literal is repeated and the unit suite asserts
 * the constant still matches.
 */
const STORAGE_KEY = 'diamondboard.library';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('field')).toBeVisible();
  await expect(page.getByTestId('token-SS')).toBeVisible();
});

test('restores steps, the situation, and strokes after a reload', async ({ page }) => {
  const second = page.getByRole('button', { name: 'Runner on 2nd base' });
  await second.tap();
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('token-R2')).toBeVisible();

  // Confirm the arrow landed before trusting a reload. A drag that missed
  // would otherwise look like a restore failure.
  await drawArrow(page);
  const arrow = page.getByTestId('move-arrow');
  await expect(arrow).toHaveCount(1);
  await expect(arrow).toHaveAttribute('data-step', '1');
  await expect(page.getByTestId('step-1')).toHaveAttribute('data-movers', '1');

  await page.getByRole('button', { name: 'Draw' }).tap();
  await expect(page.getByRole('button', { name: 'Draw' })).toHaveAttribute('aria-pressed', 'true');
  const box = await page.getByTestId('field').boundingBox();
  if (!box) throw new Error('Baseball field has no bounding box');
  const y = box.y + 36;
  const x0 = box.x + box.width * 0.25;
  const x1 = box.x + box.width * 0.75;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  await page.mouse.move(x1, y, { steps: 20 });
  await page.mouse.up();
  await expect(page.locator('.fx-stroke')).toHaveCount(1);

  await page.getByTestId('add-step').tap();
  await expect(page.getByTestId('step-2')).toHaveAttribute('aria-pressed', 'true');

  // An earlier edit already contains the runner, so wait until the save
  // includes the step that was just added. Otherwise the poll returns the
  // previous write.
  await expect
    .poll(async () => {
      const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
      if (!raw) return -1;
      try {
        const document = JSON.parse(raw) as { current?: { activeStep?: number } };
        return document.current?.activeStep ?? -1;
      } catch {
        return -1;
      }
    })
    .toBe(1);

  const saved = JSON.parse(
    (await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)) ?? 'null',
  ) as {
    version: number;
    plays: unknown[];
    current: {
      activeStep: number;
      strokes: unknown[];
      steps: { moves: Record<string, unknown> }[];
      tokens: { label?: string }[];
      undoStack: unknown[];
    };
  };
  expect(saved.current.tokens.some((token) => token.label === 'R2')).toBe(true);
  expect(saved.version).toBe(1);
  expect(saved.plays).toEqual([]);
  expect(saved.current.activeStep).toBe(1);
  expect(saved.current.strokes.length).toBeGreaterThan(0);
  expect(Object.keys(saved.current.steps[0]?.moves ?? {}).length).toBeGreaterThan(0);
  expect(saved.current.undoStack.length).toBeGreaterThan(0);

  await page.reload({ waitUntil: 'load' });
  await expect(page.getByTestId('field')).toBeVisible();
  await expect(page.getByTestId('token-R2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Runner on 2nd base' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('move-arrow')).toHaveCount(1);
  await expect(page.getByTestId('move-arrow')).toHaveAttribute('data-step', '1');
  await expect(page.getByTestId('step-1')).toHaveAttribute('data-movers', '1');
  await expect(page.getByTestId('step-2')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.fx-stroke')).toHaveCount(1);

  // The undo stack survived: the last edit added the empty second step.
  await expect(page.getByTestId('undo')).toBeEnabled();
  await page.getByTestId('undo').tap();
  await expect(page.getByTestId('step-2')).toHaveCount(0);
  await expect(page.getByTestId('move-arrow')).toHaveCount(1);
  await expect(page.getByTestId('token-R2')).toBeVisible();
  await expect(page.locator('.fx-stroke')).toHaveCount(1);
});
