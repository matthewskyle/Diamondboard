import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * Same key as `STORAGE_KEY` in src/storage/library.ts. The e2e project does not
 * import the app sources, so the literal is repeated there and asserted.
 */
const STORAGE_KEY = 'diamondboard.library';

interface StoredToken {
  label?: string;
}

interface StoredPlay {
  name: string;
  board: { tokens: StoredToken[] };
}

interface StoredLibrary {
  version: number;
  current: { tokens: StoredToken[] };
  plays: StoredPlay[];
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('field')).toBeVisible();
  await expect(page.getByTestId('token-SS')).toBeVisible();
});

test('saves, opens, renames, duplicates, and deletes a play', async ({ page }) => {
  const second = page.getByRole('button', { name: 'Runner on 2nd base' });
  await second.tap();
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('token-R2')).toBeVisible();

  const dialog = await openMyPlays(page);
  await saveNamedPlay(dialog, 'Hit and run');

  const saved = await readLibrary(page);
  expect(saved.version).toBe(1);
  expect(saved.plays.map((play) => play.name)).toEqual(['Hit and run']);
  expect(saved.plays[0].board.tokens.some((token) => token.label === 'R2')).toBe(true);
  expect(saved.current.tokens.some((token) => token.label === 'R2')).toBe(true);

  await dialog.getByRole('button', { name: 'Close' }).tap();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Start over: clear the play and send everyone home' }).tap();
  await expect(page.getByTestId('token-R2')).toHaveCount(0);
  await expect(page.getByTestId('token-SS')).toBeVisible();

  const reopened = await openMyPlays(page);
  await reopened.getByRole('button', { name: 'Open Hit and run', exact: true }).tap();
  await expect(reopened).toBeHidden();
  await expect(page.getByTestId('token-R2')).toBeVisible();
  await expect(page.getByTestId('token-SS')).toBeVisible();

  await page.reload({ waitUntil: 'load' });
  await expect(page.getByTestId('field')).toBeVisible();
  await expect(page.getByTestId('token-R2')).toBeVisible();
  await expect(page.getByTestId('token-SS')).toBeVisible();

  const listed = await openMyPlays(page);
  await expect(listed.getByRole('listitem', { name: 'Hit and run', exact: true })).toBeVisible();

  await listed.getByRole('button', { name: 'Rename Hit and run', exact: true }).tap();
  const rename = listed.getByRole('textbox', { name: 'New name for Hit and run', exact: true });
  await expect(rename).toBeVisible();
  await rename.fill('Bunt');
  await listed.getByRole('button', { name: 'Save name', exact: true }).tap();
  await expect(listed.getByRole('listitem', { name: 'Bunt', exact: true })).toBeVisible();
  await expect(listed.getByRole('listitem', { name: 'Hit and run', exact: true })).toHaveCount(0);

  await listed.getByRole('button', { name: 'Duplicate Bunt', exact: true }).tap();
  await expect(listed.getByRole('listitem', { name: 'Bunt copy', exact: true })).toBeVisible();
  await expect(listed.getByRole('listitem')).toHaveCount(2);

  await listed.getByRole('button', { name: 'Delete Bunt copy', exact: true }).tap();
  const confirmCopy = listed.getByRole('button', { name: 'Confirm delete Bunt copy', exact: true });
  await expect(confirmCopy).toBeVisible();
  await confirmCopy.tap();
  await expect(listed.getByRole('listitem', { name: 'Bunt copy', exact: true })).toHaveCount(0);
  await expect(listed.getByRole('listitem', { name: 'Bunt', exact: true })).toBeVisible();

  await listed.getByRole('button', { name: 'Delete Bunt', exact: true }).tap();
  const confirm = listed.getByRole('button', { name: 'Confirm delete Bunt', exact: true });
  await expect(confirm).toBeVisible();
  await confirm.tap();
  await expect(listed.getByRole('listitem')).toHaveCount(0);
  await expect(listed.getByText('Nothing saved yet')).toBeVisible();

  const emptied = await readLibrary(page);
  expect(emptied.plays).toEqual([]);
  expect(emptied.version).toBe(1);
  expect(emptied.current.tokens.some((token) => token.label === 'R2')).toBe(true);
});

test('a saved play stays put when the open board changes', async ({ page }) => {
  const second = page.getByRole('button', { name: 'Runner on 2nd base' });
  await second.tap();
  await expect(page.getByTestId('token-R2')).toBeVisible();

  const dialog = await openMyPlays(page);
  await saveNamedPlay(dialog, 'Hit and run');
  await dialog.getByRole('button', { name: 'Close' }).tap();
  await expect(dialog).toBeHidden();

  await second.tap();
  await expect(second).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('token-R2')).toHaveCount(0);

  await expect
    .poll(async () => {
      const library = await readLibrary(page);
      return {
        currentHasR2: library.current.tokens.some((token) => token.label === 'R2'),
        playHasR2: library.plays[0]?.board.tokens.some((token) => token.label === 'R2') ?? false,
        name: library.plays[0]?.name ?? '',
      };
    })
    .toEqual({ currentHasR2: false, playHasR2: true, name: 'Hit and run' });

  await page.reload({ waitUntil: 'load' });
  await expect(page.getByTestId('field')).toBeVisible();
  await expect(page.getByTestId('token-R2')).toHaveCount(0);
  await expect(page.getByTestId('token-SS')).toBeVisible();

  const again = await openMyPlays(page);
  await expect(again.getByRole('listitem', { name: 'Hit and run', exact: true })).toBeVisible();
  await again.getByRole('button', { name: 'Open Hit and run', exact: true }).tap();
  await expect(again).toBeHidden();
  await expect(page.getByTestId('token-R2')).toBeVisible();
  await expect(page.getByTestId('token-SS')).toBeVisible();
});

/** Opens the shelf and does not return until it is actually on screen. */
async function openMyPlays(page: Page): Promise<Locator> {
  await page.getByTestId('my-plays').tap();
  const dialog = page.getByRole('dialog', { name: 'My plays' });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Saves and does not return until that name is in the list. */
async function saveNamedPlay(dialog: Locator, name: string): Promise<void> {
  await dialog.getByRole('textbox', { name: 'Play name', exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Save play', exact: true }).tap();
  await expect(dialog.getByRole('listitem', { name, exact: true })).toBeVisible();
}

async function readLibrary(page: Page): Promise<StoredLibrary> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  if (!raw) throw new Error(`${STORAGE_KEY} is empty`);
  return JSON.parse(raw) as StoredLibrary;
}
