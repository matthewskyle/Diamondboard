import { expect, test, type Locator } from '@playwright/test';
import { drawArrow } from './drag';

const STORAGE_KEY = 'diamondboard.library';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('field')).toBeVisible();
  await expect(page.getByTestId('token-SS')).toBeVisible();
});

async function overlaps(a: Locator, b: Locator): Promise<boolean> {
  const boxA = await a.boundingBox();
  const boxB = await b.boundingBox();
  if (!boxA || !boxB) throw new Error('missing bounding box');
  return (
    boxA.x < boxB.x + boxB.width &&
    boxB.x < boxA.x + boxA.width &&
    boxA.y < boxB.y + boxB.height &&
    boxB.y < boxA.y + boxA.height
  );
}

async function writeNote(page: import('@playwright/test').Page, text: string): Promise<void> {
  await page.getByTestId('step-note-edit').tap();
  const input = page.getByTestId('step-note-input');
  await expect(input).toBeFocused();
  await input.fill(text);
  await page.getByTestId('step-note-done').tap();
  await expect(input).toHaveCount(0);
}

test('a coach writes a note on a step and it shows while editing and during Play', async ({ page }) => {
  await drawArrow(page);
  await expect(page.getByTestId('step-1')).toHaveAttribute('data-movers', '1');

  await writeNote(page, 'SS fields it. 2B covers the bag.');
  const note = page.getByTestId('step-note');
  await expect(note).toHaveText('SS fields it. 2B covers the bag.');

  // Readable, and clear of the Play control.
  const size = await note.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(14);
  expect(await overlaps(note, page.getByTestId('play'))).toBe(false);
  const viewport = page.viewportSize();
  const box = await note.boundingBox();
  if (!viewport || !box) throw new Error('missing layout');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);

  // Another step has its own (empty) note, so nothing shows there.
  await page.getByTestId('add-step').tap();
  await expect(page.getByTestId('step-2')).toHaveAttribute('aria-pressed', 'true');
  await expect(note).toHaveCount(0);

  // Playback shows the note of the step that is running.
  await page.getByTestId('play').tap();
  await expect(note).toHaveText('SS fields it. 2B covers the bag.');
  await expect(page.getByTestId('play')).toBeEnabled({ timeout: 10_000 });
});

test('a note can be cleared, and survives a reload', async ({ page }) => {
  await writeNote(page, 'Hit the cutoff.');
  await expect(page.getByTestId('step-note')).toHaveText('Hit the cutoff.');

  await expect
    .poll(async () => {
      const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
      try {
        const doc = JSON.parse(raw ?? 'null') as { current?: { steps?: { note?: string }[] } };
        return doc.current?.steps?.[0]?.note ?? null;
      } catch {
        return null;
      }
    })
    .toBe('Hit the cutoff.');

  await page.reload();
  await expect(page.getByTestId('step-note')).toHaveText('Hit the cutoff.');

  await writeNote(page, '   ');
  await expect(page.getByTestId('step-note')).toHaveCount(0);
});
