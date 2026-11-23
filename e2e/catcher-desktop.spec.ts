import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Dock overlap. CI installs WebKit only, so the iPhone landscape case is its
 * own WebKit project rather than a second browser.
 *
 * - 1280×800: the step bar used to cover the catcher.
 * - iPhone 13 landscape (750×342): the play controls cover C, the runner chips
 *   cover LF and RF, and the step caption paints across the infield.
 * - 390×844: walking C or 1B onto the bottom viewBox edge parks them behind
 *   the dock. 390×844 is also the phone size where the catcher already sits
 *   clear of the dock until someone drags him down.
 */
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * The viewBox settles a frame or two after mount (ResizeObserver). Dragging
 * before that misses the player.
 */
async function waitForFieldLayout(page: Page): Promise<void> {
  const token = page.getByTestId('token-C');
  let previous = '';
  let matches = 0;
  await expect
    .poll(async () => {
      const box = await token.boundingBox();
      if (!box || box.width < 1 || box.height < 1) {
        matches = 0;
        previous = '';
        return 0;
      }
      const key = [box.x, box.y, box.width, box.height].map((n) => n.toFixed(1)).join(',');
      matches = key === previous ? matches + 1 : 0;
      previous = key;
      return matches;
    })
    .toBeGreaterThanOrEqual(2);
}

/** Screen rectangle of the SVG viewBox, letterboxing excluded. */
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

/** What a press at the token's center actually hits. */
async function hitAtCenter(page: Page, testId: string): Promise<{ onField: boolean; label: string }> {
  return page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    const field = document.querySelector('[data-testid="field"]');
    if (!el || !field) return { onField: false, label: 'missing' };
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const onField = !!hit && (hit === field || field.contains(hit));
    const label = hit?.getAttribute('aria-label') || hit?.getAttribute('class') || hit?.tagName || 'nothing';
    return { onField, label };
  }, testId);
}

/** Press the center of a token and pull. */
async function dragFromCenter(page: Page, token: Locator, dx: number, dy: number): Promise<void> {
  const box = await token.boundingBox();
  if (!box) throw new Error('token has no bounding box');
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 24 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('field')).toBeVisible();
  await expect(page.getByTestId('token-C')).toBeVisible();
  await waitForFieldLayout(page);
});

test.describe('1280×800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('dragging center field still draws an arrow', async ({ page }) => {
    const play = page.getByTestId('play');
    await expect(play).toBeDisabled();
    await dragFromCenter(page, page.getByTestId('token-CF'), 140, 140);
    await expect(page.getByTestId('move-arrow')).toHaveCount(1);
    await expect(play).toBeEnabled();
  });

  test('the center of the catcher is draggable and the step bar does not cover it', async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 1280, height: 800 });

    const catcher = page.getByTestId('token-C');
    const stepBar = page.getByRole('group', { name: 'Play steps' });
    const catcherBox = await catcher.boundingBox();
    const stepBox = await stepBar.boundingBox();
    if (!catcherBox || !stepBox) throw new Error('catcher or step bar has no bounding box');

    expect(overlaps(catcherBox, stepBox), 'step bar must not cover the catcher').toBe(false);

    const play = page.getByTestId('play');
    await expect(play).toBeDisabled();
    // Up and to the right, the same stroke that works on center field.
    await dragFromCenter(page, catcher, 140, -140);
    await expect(page.getByTestId('move-arrow')).toHaveCount(1);
    await expect(play).toBeEnabled();
  });
});

test.describe('390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the catcher sits above the dock and a drag from its center draws an arrow', async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });

    const catcherBox = await page.getByTestId('token-C').boundingBox();
    const dockBox = await page.locator('.play-dock').boundingBox();
    if (!catcherBox || !dockBox) throw new Error('catcher or play dock has no bounding box');
    expect(catcherBox.y + catcherBox.height).toBeLessThan(dockBox.y);

    const play = page.getByTestId('play');
    await expect(play).toBeDisabled();
    await dragFromCenter(page, page.getByTestId('token-C'), 80, -100);
    await expect(page.getByTestId('move-arrow')).toHaveCount(1);
    await expect(play).toBeEnabled();
  });

  test('C and 1B walked to the bottom edge stay clear of the play dock', async ({ page }) => {
    for (const label of ['C', '1B'] as const) {
      if (label !== 'C') {
        // Reload would restore the autosaved play, so start over instead.
        await page.getByRole('button', { name: 'Start over: clear the play and send everyone home' }).click();
        await expect(page.getByTestId('move-arrow')).toHaveCount(0);
        await waitForFieldLayout(page);
      }
      const view = await viewBoxScreenRect(page);
      const token = page.getByTestId(`token-${label}`);
      const box = await token.boundingBox();
      if (!box) throw new Error(`${label} has no bounding box`);
      const fromY = box.y + box.height / 2;
      await dragFromCenter(page, token, 0, view.y + view.height - 1 - fromY);
      await expect(page.getByTestId('move-arrow')).toHaveCount(1);

      // The next step is where a player walked to the edge actually stands.
      await page.getByTestId('add-step').tap();
      await expect(page.getByTestId('step-2')).toHaveAttribute('aria-pressed', 'true');

      const circle = await token.locator('circle.tk-fielder').boundingBox();
      const dock = await page.locator('.play-dock').boundingBox();
      if (!circle || !dock) throw new Error(`${label} or the play dock has no bounding box`);
      expect(circle.y + circle.height / 2 - fromY, `${label} walked down`).toBeGreaterThan(40);
      expect(circle.y + circle.height, `${label} is behind the play dock`).toBeLessThanOrEqual(dock.y + 1);
    }
  });
});

test.describe('iPhone 13 landscape', () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-landscape');
  });

  test('the catcher and the corner outfielders are draggable from their centers', async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 750, height: 342 });
    const play = page.getByTestId('play');
    await expect(play).toBeDisabled();

    const blocked: string[] = [];
    for (const label of ['C', 'LF', 'RF'] as const) {
      const hit = await hitAtCenter(page, `token-${label}`);
      if (!hit.onField) blocked.push(`${label} center hits ${hit.label}`);
    }
    expect(blocked, 'dock rows cover fielders').toEqual([]);

    for (const label of ['C', 'LF', 'RF'] as const) {
      // Up and away from home, the same kind of stroke that draws an arrow on CF.
      await dragFromCenter(page, page.getByTestId(`token-${label}`), label === 'RF' ? 60 : -70, -60);
    }

    await expect(page.getByTestId('move-arrow')).toHaveCount(3);
    await expect(play).toBeEnabled();

    // The dock's box covers this short screen, but the rows do not. The
    // catcher's arrow has to end where he was dragged, not on the top edge.
    const catcherArrow = await page.getByTestId('move-arrow').evaluateAll((nodes) => {
      const parsed = nodes.map((node) => {
        const nums = (node.getAttribute('d') ?? '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
        return { y1: nums[1] ?? 0, y2: nums[3] ?? 0 };
      });
      return parsed.reduce((lowest, arrow) => (arrow.y1 > lowest.y1 ? arrow : lowest));
    });
    expect(catcherArrow.y2, 'catcher arrow was pulled to the top of the field').toBeGreaterThan(200);
    expect(catcherArrow.y2, 'catcher arrow did not follow the drag').toBeLessThan(catcherArrow.y1 - 40);
  });

  test('tapping left field does not load the bases', async ({ page }) => {
    const box = await page.getByTestId('token-LF').boundingBox();
    if (!box) throw new Error('LF has no bounding box');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByRole('button', { name: 'Load the bases' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.token-runner')).toHaveCount(0);
  });

  test('the step caption does not cover the infield', async ({ page }) => {
    const caption = await page.locator('.play-caption').boundingBox();
    if (!caption) throw new Error('step caption has no bounding box');
    const covered: string[] = [];
    for (const label of ['SS', '2B', '3B', '1B'] as const) {
      const circle = await page.getByTestId(`token-${label}`).locator('circle.tk-fielder').boundingBox();
      if (!circle) throw new Error(`${label} circle has no bounding box`);
      if (overlaps(caption, circle)) covered.push(label);
    }
    expect(covered, 'caption covers the infield').toEqual([]);
  });
});
