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

  await page.getByRole('button', { name: 'Draw', exact: true }).tap();
  const [start, end] = await field.evaluate((node) => {
    const matrix = (node as SVGSVGElement).getScreenCTM()!;
    return [410, 570].map((x) => {
      const point = new DOMPoint(x, 325).matrixTransform(matrix);
      return { x: point.x, y: point.y };
    });
  });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
  const stroke = page.locator('.fx-stroke');
  await expect(stroke).toHaveCount(1);
  const strokePath = await stroke.getAttribute('d');

  await toggle.tap();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const box = await toggle.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await expect.poll(scale).toBeGreaterThan(fullScale * 1.15);
  const close = await field.getAttribute('viewBox');
  expect(close).not.toBe(full);
  await expect(arrow).toHaveCount(1);
  await expect(stroke).toHaveAttribute('d', strokePath!);

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
  await expect(stroke).toHaveAttribute('d', strokePath!);
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

test('a long note on a short phone leaves room for the close-up and Play', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone', 'uses a short phone viewport');
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/');
  await drawArrow(page);
  const addStep = page.getByTestId('add-step');
  await addStep.tap();
  await page.getByTestId('step-note-edit').tap();
  const note = 'Cover the bag as soon as the pitcher breaks. '.repeat(6).trim();
  await page.getByTestId('step-note-input').fill(note);
  await page.getByTestId('step-note-done').tap();
  await expect(page.getByTestId('step-note')).toHaveText(note);

  const field = page.getByTestId('field');
  const scale = () => field.evaluate((node) => (node as SVGSVGElement).getScreenCTM()!.a);
  const fullScale = await scale();
  await page.getByRole('button', { name: 'Infield view' }).tap();
  await expect.poll(scale).toBeGreaterThan(fullScale * 1.15);
  const play = page.getByTestId('play');
  await expect(play).toBeInViewport({ ratio: 1 });
  await page.getByTestId('step-1').tap();
  await expect(page.getByTestId('step-1')).toHaveAttribute('aria-pressed', 'true');
  await addStep.tap();
  await expect(page.getByTestId('step-2')).toHaveAttribute('aria-pressed', 'true');
  await play.tap();
  await expect(page.getByRole('button', { name: 'Pause playback' })).toBeVisible();
});
