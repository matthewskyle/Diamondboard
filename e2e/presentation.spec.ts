import { expect, test } from '@playwright/test';
import { drawArrow, waitForFieldLayout } from './drag';

test('presentation shows the current coaching note and restores the editor at the taught step', async ({ page }, info) => {
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
  if (info.project.name === 'iphone') {
    const { width, height } = page.viewportSize()!;
    await page.setViewportSize({ width: height, height: width });
    await expect(field).toHaveAttribute('viewBox', '0 0 1000 780');
    await expect(note).toHaveText('Cover second on the throw.');
  }

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

test('entering presentation discards an unfinished field edit', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone', 'checks the mode switch on a phone');
  await page.goto('/');
  await waitForFieldLayout(page);
  await page.getByRole('button', { name: 'Reposition a player without giving him a move' }).tap();
  const token = page.getByTestId('token-SS');
  const position = async () => (await token.getAttribute('transform'))?.split(' scale(')[0];
  const original = await position();
  const box = await token.boundingBox();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 45, y - 35, { steps: 12 });
  await expect.poll(position).not.toBe(original);

  await page.getByRole('button', { name: 'Presentation' }).focus();
  await page.keyboard.press('Enter');
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Exit presentation' })).toBeVisible();
  await expect.poll(position).toBe(original);
  await page.getByRole('button', { name: 'Exit presentation' }).tap();
  await expect.poll(position).toBe(original);
  await expect(page.getByTestId('undo')).toBeDisabled();
});
