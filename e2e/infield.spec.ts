import { expect, test } from '@playwright/test';
import { drawArrow, waitForFieldLayout } from './drag';

test('the infield close-up enlarges the diamond without editing the play', async ({ page }) => {
  await page.goto('/');
  const field = page.getByTestId('field');
  const toggle = page.getByRole('button', { name: 'Infield view' });
  const mover = page.getByTestId(await drawArrow(page));
  const arrow = page.getByTestId('move-arrow');
  const full = await field.getAttribute('viewBox');
  const scale = () => field.evaluate((node) => (node as SVGSVGElement).getScreenCTM()!.a);
  const fullScale = await scale();
  const outfielder = page.getByTestId('token-LF');
  const outfieldSpot = await outfielder.getAttribute('transform');

  await toggle.tap();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const box = await toggle.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await expect.poll(scale).toBeGreaterThan(fullScale * 1.15);
  const close = await field.getAttribute('viewBox');
  expect(close).not.toBe(full);
  await expect(arrow).toHaveCount(1);

  await page.getByTestId('add-step').tap();
  const moverPosition = async () => (await mover.getAttribute('transform'))?.split(' scale(')[0];
  const beforePlay = await moverPosition();
  await page.getByTestId('play').tap();
  await expect(page.getByRole('button', { name: 'Pause playback' })).toBeVisible();
  await expect(field).toHaveAttribute('viewBox', close!);
  await page.getByRole('button', { name: /Stop playback/ }).tap();
  await page.getByTestId('step-2').tap();
  await expect.poll(moverPosition).toBe(beforePlay);

  await toggle.tap();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(field).toHaveAttribute('viewBox', full!);
  await expect(outfielder).toHaveAttribute('transform', outfieldSpot!);
  await expect.poll(moverPosition).toBe(beforePlay);
  await expect(arrow).toHaveCount(1);
});

test('the close-up remains usable when a phone rotates to landscape', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone', 'starts with the phone in portrait');
  await page.goto('/');
  await waitForFieldLayout(page);
  await page.getByRole('button', { name: 'Infield view' }).tap();
  const field = page.getByTestId('field');
  const close = await field.getAttribute('viewBox');
  const { width, height } = page.viewportSize()!;
  await page.setViewportSize({ width: height, height: width });
  await expect(field).toHaveAttribute('viewBox', close!);
  const catcher = page.getByTestId('token-C');
  const catcherBox = await catcher.boundingBox();
  const play = await page.getByTestId('play').boundingBox();
  const tools = await page.getByRole('toolbar', { name: 'Tools' }).boundingBox();
  expect(catcherBox!.y + catcherBox!.height).toBeLessThanOrEqual(tools!.y);
  expect(catcherBox!.x + catcherBox!.width).toBeLessThan(play!.x);
  await page.getByRole('button', { name: 'Infield view' }).tap();
  await expect(field).toHaveAttribute('viewBox', '0 0 1000 780');
});
