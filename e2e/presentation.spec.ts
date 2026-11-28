import { expect, test } from '@playwright/test';
import { drawArrow } from './drag';

test('presentation shows the current coaching note and restores the editor at the taught step', async ({ page }) => {
  await page.goto('/');
  const mover = page.getByTestId(await drawArrow(page));
  await page.getByTestId('add-step').tap();
  await page.getByTestId('step-note-edit').tap();
  await page.getByTestId('step-note-input').fill('Cover second on the throw.');
  await page.getByTestId('step-note-done').tap();
  const note = page.getByTestId('step-note');
  const editorField = await page.getByTestId('field').boundingBox();
  const enter = page.getByRole('button', { name: 'Presentation' });
  await expect(enter).toBeVisible({ timeout: 2000 });
  await enter.tap();

  await expect(note).toHaveText('Cover second on the throw.');
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toHaveCount(0);
  await expect(page.getByTestId('add-step')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Runner on 2nd base' })).toHaveCount(0);
  await expect(page.getByTestId('my-plays')).toHaveCount(0);
  const field = page.getByTestId('field');
  const teachingField = await field.boundingBox();
  expect(teachingField!.height).toBeGreaterThan(editorField!.height - 85);

  const next = page.getByRole('button', { name: 'Next step' });
  const previous = page.getByRole('button', { name: 'Previous step' });
  const exit = page.getByRole('button', { name: 'Exit presentation' });
  for (const button of [page.getByTestId('play'), next, previous, exit]) {
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(box!.y + box!.height).toBeLessThan(page.viewportSize()!.height);
  }

  await previous.tap();
  await expect(note).toHaveCount(0);
  const start = await mover.getAttribute('transform');
  await page.getByTestId('play').tap();
  await expect.poll(() => mover.getAttribute('transform')).not.toBe(start);
  await page.getByRole('button', { name: 'Pause playback' }).tap();
  await next.tap();
  await expect(note).toHaveText('Cover second on the throw.');

  await exit.tap();
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
  await expect(page.getByTestId('step-2')).toHaveAttribute('aria-pressed', 'true');
  await expect(note).toHaveText('Cover second on the throw.');
  await expect(page.getByTestId('move-arrow')).toHaveCount(1);
});
