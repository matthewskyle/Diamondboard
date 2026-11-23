import { expect, test, type Page } from '@playwright/test';

/**
 * iPad portrait keeps the open green below home (viewBox height 1130). Landscape
 * crops that green (height 780) but must not rewrite the coordinates a coach
 * already placed there. Rotating back shows the same spots, and undo only walks
 * the Select moves — a rotation is not an edit.
 */
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'ipad-portrait', 'rotation starts from iPad portrait');
  await page.goto('/');
  await expect(page.getByTestId('field')).toBeVisible();
  await expect(page.getByTestId('token-SS')).toBeVisible();
});

interface Point {
  x: number;
  y: number;
}

/** World coordinates from the token transform, not the cropped screen position. */
async function tokenPoint(page: Page, testId: string): Promise<Point> {
  return page.getByTestId(testId).evaluate((el) => {
    const transform = (el as SVGGraphicsElement).transform.baseVal.consolidate();
    if (!transform) throw new Error(`${el.getAttribute('data-testid')} has no transform`);
    return {
      x: Math.round(transform.matrix.e * 100) / 100,
      y: Math.round(transform.matrix.f * 100) / 100,
    };
  });
}

async function viewBoxHeight(page: Page): Promise<number> {
  return page.getByTestId('field').evaluate((el) => (el as SVGSVGElement).viewBox.baseVal.height);
}

/**
 * Positions settle a frame or two after a resize: the viewBox updates, then any
 * follow-up write would move the token. Wait until the point stops changing.
 */
async function settledPoint(page: Page, testId: string): Promise<Point> {
  let previous = '';
  let matches = 0;
  let point: Point = { x: 0, y: 0 };
  await expect
    .poll(async () => {
      point = await tokenPoint(page, testId);
      const key = `${point.x},${point.y}`;
      matches = key === previous ? matches + 1 : 0;
      previous = key;
      return matches;
    })
    .toBeGreaterThanOrEqual(2);
  return point;
}

async function waitForFieldLayout(page: Page): Promise<void> {
  await settledPoint(page, 'token-SS');
}

/** Screen point for a field coordinate, using the SVG's current transform. */
async function screenPoint(page: Page, field: Point): Promise<Point> {
  return page.getByTestId('field').evaluate((svg, target) => {
    const point = (svg as SVGSVGElement).createSVGPoint();
    point.x = target.x;
    point.y = target.y;
    const ctm = (svg as SVGSVGElement).getScreenCTM();
    if (!ctm) throw new Error('field has no screen transform');
    const screen = point.matrixTransform(ctm);
    return { x: screen.x, y: screen.y };
  }, field);
}

async function dragToken(page: Page, testId: string, to: Point): Promise<void> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} has no bounding box`);
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const end = await screenPoint(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 24 });
  await page.mouse.up();
}

function expectNear(actual: Point, expected: Point, tolerance = 1.5): void {
  expect(Math.hypot(actual.x - expected.x, actual.y - expected.y)).toBeLessThanOrEqual(tolerance);
}

test('tokens placed below home keep their spots through an iPad rotation', async ({ page }) => {
  await waitForFieldLayout(page);
  expect(await viewBoxHeight(page)).toBe(1130);

  const cfHome = await tokenPoint(page, 'token-CF');
  const ssHome = await tokenPoint(page, 'token-SS');

  await page.getByRole('button', { name: 'Runner on 1st base' }).tap();
  const runner = page.getByTestId('token-R1');
  await expect(runner).toBeVisible();
  const runnerOnFirst = await tokenPoint(page, 'token-R1');

  await page.getByRole('button', { name: 'Reposition a player without giving him a move' }).tap();

  // The green below the catcher. Landscape's floor is y=780, so both of these
  // sit in the strip a crop would hide.
  const ssSpot: Point = { x: 360, y: 840 };
  const runnerSpot: Point = { x: 640, y: 900 };
  await dragToken(page, 'token-SS', ssSpot);
  await dragToken(page, 'token-R1', runnerSpot);

  const ssPlaced = await settledPoint(page, 'token-SS');
  const runnerPlaced = await settledPoint(page, 'token-R1');
  expectNear(ssPlaced, ssSpot);
  expectNear(runnerPlaced, runnerSpot);
  expect(await tokenPoint(page, 'token-CF')).toEqual(cfHome);

  const portrait = page.viewportSize();
  if (!portrait) throw new Error('iPad portrait has no viewport');
  await page.setViewportSize({ width: portrait.height, height: portrait.width });

  await expect.poll(() => viewBoxHeight(page)).toBe(780);
  const ssLandscape = await settledPoint(page, 'token-SS');
  const runnerLandscape = await settledPoint(page, 'token-R1');
  expect(ssLandscape, 'SS was moved when the board cropped').toEqual(ssPlaced);
  expect(runnerLandscape, 'the runner was moved when the board cropped').toEqual(runnerPlaced);
  expect(await tokenPoint(page, 'token-CF')).toEqual(cfHome);

  await page.setViewportSize(portrait);
  await expect.poll(() => viewBoxHeight(page)).toBe(1130);
  expect(await settledPoint(page, 'token-SS'), 'SS did not return to the grass below home').toEqual(
    ssPlaced,
  );
  expect(
    await settledPoint(page, 'token-R1'),
    'the runner did not return to the grass below home',
  ).toEqual(runnerPlaced);
  expect(await tokenPoint(page, 'token-CF')).toEqual(cfHome);

  // Three Select edits, and nothing else: the runner back to first, SS back to
  // shortstop, then the runner removed. A rotation lift must not be one of them.
  const undo = page.getByTestId('undo');
  await undo.tap();
  expect(await tokenPoint(page, 'token-R1')).toEqual(runnerOnFirst);
  expect(await tokenPoint(page, 'token-SS')).toEqual(ssPlaced);

  await undo.tap();
  expect(await tokenPoint(page, 'token-SS')).toEqual(ssHome);
  expect(await tokenPoint(page, 'token-R1')).toEqual(runnerOnFirst);

  await undo.tap();
  await expect(page.getByTestId('token-R1')).toHaveCount(0);
  expect(await tokenPoint(page, 'token-SS')).toEqual(ssHome);
  expect(await tokenPoint(page, 'token-CF')).toEqual(cfHome);
  await expect(undo).toBeDisabled();
});
