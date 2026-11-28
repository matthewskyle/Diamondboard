import { expect, test } from '@playwright/test';
import { drawArrow } from './drag';

test('pauses in place, resumes, steps through beats, and stops at the start', async ({ page }) => {
  await page.goto('/');
  const id = await drawArrow(page);
  const mover = page.getByTestId(id);
  const origin = await mover.getAttribute('transform');
  const speed = page.getByRole('button', { name: /Playback speed/ });
  await speed.tap();
  await speed.tap();
  await page.getByTestId('play').tap();
  await expect.poll(() => mover.getAttribute('transform')).not.toBe(origin);
  await page.getByRole('button', { name: 'Pause playback', exact: true }).tap();
  const paused = await mover.getAttribute('transform');
  await page.waitForTimeout(400);
  await expect(mover).toHaveAttribute('transform', paused!);
  await expect(page.getByTestId('undo')).toBeDisabled();
  await page.getByRole('button', { name: 'Resume playback', exact: true }).tap();
  await expect.poll(() => mover.getAttribute('transform')).not.toBe(paused);
  await page.getByRole('button', { name: 'Stop playback and return to start', exact: true }).tap();
  await expect(mover).toHaveAttribute('transform', origin!);
  await expect(page.getByTestId('undo')).toBeEnabled();

  await page.getByRole('button', { name: 'Next beat', exact: true }).tap();
  const finish = await mover.getAttribute('transform');
  expect(finish).not.toBe(origin);
  await page.waitForTimeout(900);
  await expect(mover).toHaveAttribute('transform', finish!);
  await expect(page.getByRole('button', { name: 'Next beat', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Previous beat', exact: true }).tap();
  await expect(mover).toHaveAttribute('transform', origin!);
  await page.getByRole('button', { name: 'Stop playback and return to start', exact: true }).tap();
});

test('loops until stopped and keeps transport controls reachable', async ({ page }) => {
  await page.goto('/');
  await drawArrow(page);
  const loop = page.getByRole('button', { name: 'Loop playback', exact: true });
  await expect(loop).toHaveAttribute('aria-pressed', 'false');
  await loop.tap();
  await page.getByRole('button', { name: /Playback speed/ }).tap();
  await page.getByTestId('play').tap();
  await page.waitForTimeout(2200);
  await expect(page.getByRole('button', { name: 'Pause playback', exact: true })).toBeVisible();
  for (const name of ['Pause playback', 'Stop playback and return to start', 'Previous beat', 'Next beat', 'Loop playback']) {
    const button = page.getByRole('button', { name, exact: true });
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  }
  await page.getByRole('button', { name: 'Stop playback and return to start', exact: true }).tap();
  await expect(page.getByTestId('undo')).toBeEnabled();
});

async function writeNote(page: import('@playwright/test').Page, text: string): Promise<void> {
  await page.getByTestId('step-note-edit').tap();
  await page.getByTestId('step-note-input').fill(text);
  await page.getByTestId('step-note-done').tap();
  await expect(page.getByTestId('step-note-input')).toHaveCount(0);
}

test('the coaching note follows the held beat, and Stop returns to step 1', async ({ page }) => {
  await page.goto('/');
  await drawArrow(page);
  await writeNote(page, 'SS fields it.');
  await page.getByTestId('add-step').tap();
  await drawArrow(page);
  await writeNote(page, 'Throw to second.');
  await page.getByTestId('step-1').tap();

  const note = page.getByTestId('step-note');
  const next = page.getByRole('button', { name: 'Next beat', exact: true });
  await next.tap();
  await expect(note).toHaveText('SS fields it.');
  await next.tap();
  await expect(note).toHaveText('Throw to second.');
  await page.getByRole('button', { name: 'Previous beat', exact: true }).tap();
  await expect(note).toHaveText('SS fields it.');

  await next.tap();
  await page.getByRole('button', { name: 'Stop playback and return to start', exact: true }).tap();
  await expect(page.getByTestId('step-1')).toHaveAttribute('aria-pressed', 'true');
  await expect(note).toHaveText('SS fields it.');
});

test('steps across multiple beats and skips empty steps', async ({ page }) => {
  await page.goto('/');
  const id = await drawArrow(page);
  await page.getByTestId('add-step').tap();
  const firstFinish = await page.getByTestId(id).getAttribute('transform');
  await page.getByTestId('add-step').tap();
  await drawArrow(page);
  await page.getByTestId('step-1').tap();
  await page.getByRole('button', { name: 'Next beat', exact: true }).tap();
  await expect(page.getByTestId(id)).toHaveAttribute('transform', firstFinish!);
  await expect(page.getByRole('button', { name: 'Next beat', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Next beat', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Next beat', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Previous beat', exact: true }).tap();
  await expect(page.getByTestId(id)).toHaveAttribute('transform', firstFinish!);
  await page.getByRole('button', { name: 'Stop playback and return to start', exact: true }).tap();
  await expect(page.getByTestId('step-1')).toHaveAttribute('aria-pressed', 'true');
});
