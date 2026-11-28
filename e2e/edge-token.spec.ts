import { expect, test, type Page } from '@playwright/test';
import { waitForFieldLayout } from './drag';

/** The nine fielders in the default lineup. */
const FIELDERS = ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'] as const;

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
 * Screen rectangle of the SVG viewBox. Letterboxing lives outside this rect,
 * and the viewBox is what clips a token whose center sits on its edge.
 */
async function viewBoxScreenRect(page: Page): Promise<Box> {
  return page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('[data-testid="field"]');
    if (!svg) throw new Error('field is missing');
    const ctm = svg.getScreenCTM();
    if (!ctm) throw new Error('field has no screen transform');
    const box = svg.viewBox.baseVal;
    const origin = new DOMPoint(box.x, box.y).matrixTransform(ctm);
    const corner = new DOMPoint(box.x + box.width, box.y + box.height).matrixTransform(ctm);
    return { x: origin.x, y: origin.y, width: corner.x - origin.x, height: corner.y - origin.y };
  });
}

/** The white fielder circle, not the drop shadow around the group. */
async function fielderCircle(page: Page, label: string): Promise<Box> {
  const box = await page.getByTestId(`token-${label}`).locator('circle.tk-fielder').boundingBox();
  if (!box) throw new Error(`token-${label} circle has no box`);
  return box;
}

/**
 * The whole circle is on screen: nothing past the viewBox edge, and the same
 * diameter as a token that was never pushed there. A clipped radius is either
 * a smaller box or a box that hangs outside the viewBox.
 */
function expectFullyVisible(circle: Box, view: Box, full: Box, label: string): void {
  const slop = 1;
  expect(circle.width, `${label} circle width`).toBeGreaterThanOrEqual(full.width - slop);
  expect(circle.height, `${label} circle height`).toBeGreaterThanOrEqual(full.height - slop);
  expect(circle.x, `${label} left`).toBeGreaterThanOrEqual(view.x - slop);
  expect(circle.y, `${label} top`).toBeGreaterThanOrEqual(view.y - slop);
  expect(circle.x + circle.width, `${label} right`).toBeLessThanOrEqual(view.x + view.width + slop);
  expect(circle.y + circle.height, `${label} bottom`).toBeLessThanOrEqual(view.y + view.height + slop);
}

/** Arrow-tool drag. Playwright's WebKit touchscreen can tap, but it cannot drag. */
async function dragToken(page: Page, testId: string, to: { x: number; y: number }): Promise<void> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} has no box`);
  const from = center(box);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await expect(page.locator('.fx-move-aiming')).toHaveCount(1);
  await page.mouse.move(to.x, to.y, { steps: 24 });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('field')).toBeVisible();
  await expect(page.getByTestId('token-SS')).toBeVisible();
  await waitForFieldLayout(page);
});

test('keeps a token on the viewBox edge fully visible', async ({ page }, testInfo) => {
  // The QA repro is a 390px-wide phone (Chrome 390×844). This iPhone project
  // is that width — the field is drawn to the width — and the screen height
  // is the browser's layout viewport. The rule is not special to CF or the
  // right edge: any token whose center sits on a viewBox edge has to keep
  // its full radius on screen.
  if (testInfo.project.name === 'iphone') {
    expect(page.viewportSize()?.width).toBe(390);
  }

  const view = await viewBoxScreenRect(page);
  const lineup = await fielderCircle(page, 'P');
  for (const label of FIELDERS) {
    expectFullyVisible(await fielderCircle(page, label), view, lineup, `default ${label}`);
  }

  const cf = await fielderCircle(page, 'CF');
  const lf = await fielderCircle(page, 'LF');
  const ss = await fielderCircle(page, 'SS');
  const second = await fielderCircle(page, '2B');

  // The app opens on the arrow tool. Walk one fielder onto each edge.
  await dragToken(page, 'token-CF', { x: view.x + view.width - 1, y: center(cf).y });
  await dragToken(page, 'token-LF', { x: view.x + 1, y: center(lf).y });
  await dragToken(page, 'token-SS', { x: center(ss).x, y: view.y + 1 });
  await dragToken(page, 'token-2B', { x: center(second).x, y: view.y + view.height - 1 });
  await expect(page.getByTestId('move-arrow')).toHaveCount(4);

  // The next step shows them where they arrived. That is when a route that
  // walked CF right draws his circle on the edge.
  await page.getByTestId('add-step').tap();
  await expect(page.getByTestId('step-2')).toHaveAttribute('aria-pressed', 'true');

  await expect
    .poll(async () => center(await fielderCircle(page, 'CF')).x)
    .toBeGreaterThan(center(cf).x + 40);

  const arrived = {
    CF: await fielderCircle(page, 'CF'),
    LF: await fielderCircle(page, 'LF'),
    SS: await fielderCircle(page, 'SS'),
    '2B': await fielderCircle(page, '2B'),
  };
  expect(center(arrived.CF).x, 'CF walked right').toBeGreaterThan(center(cf).x + 40);
  expect(center(arrived.LF).x, 'LF walked left').toBeLessThan(center(lf).x - 40);
  expect(center(arrived.SS).y, 'SS walked up').toBeLessThan(center(ss).y - 40);
  expect(center(arrived['2B']).y, '2B walked down').toBeGreaterThan(center(second).y + 40);

  const full = await fielderCircle(page, 'P');
  const placed = await viewBoxScreenRect(page);
  for (const label of ['CF', 'LF', 'SS', '2B'] as const) {
    expectFullyVisible(arrived[label], placed, full, label);
  }
});
