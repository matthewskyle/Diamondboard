import { expect, test, type Locator, type Page } from '@playwright/test';
import { drawArrow } from './drag';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('field')).toBeVisible();
  await expect(page.getByTestId('token-SS')).toBeVisible();
});

/**
 * Pan and pinch-zoom are not DOM events Playwright can fire. WebKit's
 * touchscreen can tap, and a dispatched touch is untrusted, so neither one
 * makes Safari zoom. The Pointer Events spec decides both gestures from
 * `touch-action` on the hit target and its ancestors; canceling the event
 * cannot. The field SVG is that hit target — its children are
 * `pointer-events: none` — and `touch-action: none` there is what keeps a
 * finger on the field from scrolling or zooming the page.
 */
async function fieldOwnsGesture(page: Page): Promise<void> {
  const owned = await page.evaluate(() => {
    const field = document.querySelector<SVGSVGElement>('[data-testid="field"]');
    const dock = document.querySelector('.play-dock');
    const fieldBox = field?.getBoundingClientRect();
    const dockTop = dock?.getBoundingClientRect().top ?? 0;
    const onField = (x: number, y: number) => {
      if (!field) return false;
      const hit = document.elementFromPoint(x, y);
      return !!hit && (hit === field || field.contains(hit));
    };

    const token = [...document.querySelectorAll<SVGElement>('[data-testid^="token-"]')].find((el) => {
      if (!fieldBox) return false;
      const box = el.getBoundingClientRect();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      return y > fieldBox.top + 8 && y < dockTop - 8 && x > fieldBox.left && x < fieldBox.right;
    });
    const tokenBox = token?.getBoundingClientRect();

    return {
      touchAction: field ? getComputedStyle(field).touchAction : '',
      grass: !!fieldBox && onField(fieldBox.left + fieldBox.width / 2, fieldBox.top + 16),
      fielder: !!tokenBox && onField(tokenBox.x + tokenBox.width / 2, tokenBox.y + tokenBox.height / 2),
    };
  });
  expect(owned).toEqual({ touchAction: 'none', grass: true, fielder: true });
}

/** A two-finger pinch dispatched on the field. It must not move the viewport. */
async function pinch(field: Locator): Promise<void> {
  const box = await field.boundingBox();
  if (!box) throw new Error('Baseball field has no bounding box');
  const centerX = box.x + box.width / 2;
  const centerY = box.y + Math.min(72, box.height / 3);
  const rest = 36;

  const fingers = (spread: number) => [
    { identifier: 1, clientX: centerX - spread, clientY: centerY },
    { identifier: 2, clientX: centerX + spread, clientY: centerY },
  ];

  const start = fingers(rest);
  await field.dispatchEvent('touchstart', {
    touches: start,
    changedTouches: start,
    targetTouches: start,
  });
  const opened = fingers(rest * 2.5);
  await field.dispatchEvent('touchmove', {
    touches: opened,
    changedTouches: opened,
    targetTouches: opened,
  });
  await field.dispatchEvent('touchend', {
    touches: [],
    changedTouches: opened,
    targetTouches: [],
  });
}

async function viewport(page: Page): Promise<{ x: number; y: number; scale: number }> {
  return page.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
    scale: window.visualViewport?.scale ?? 1,
  }));
}

test('viewport meta does not block user zoom', async ({ page }) => {
  const content = await page.locator('meta[name="viewport"]').getAttribute('content');
  // Home-screen safe area still needs the viewport fitted to the screen.
  expect(content).toContain('width=device-width');
  expect(content).toContain('viewport-fit=cover');
  expect(content ?? '').not.toMatch(/maximum-scale|user-scalable\s*=\s*no/i);
});

test('a pinch or drag on the field does not scroll or zoom the page', async ({ page }) => {
  const before = await viewport(page);

  // drawArrow waits until the viewBox and token size settle, which is also
  // when a hit test on a fielder means something.
  const tokenId = await drawArrow(page);
  await expect(page.getByTestId('move-arrow')).toHaveCount(1);
  await expect(page.getByTestId(tokenId)).toBeVisible();

  await fieldOwnsGesture(page);
  await pinch(page.getByTestId('field'));

  expect(await viewport(page)).toEqual(before);
});
