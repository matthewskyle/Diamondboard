import { expect, test, type Page } from '@playwright/test';
import { drawArrow } from './drag';

async function savePlay(page: Page, name: string): Promise<void> {
  await page.getByTestId('my-plays').tap();
  await page.getByRole('textbox', { name: 'Play name' }).fill(name);
  await page.getByRole('button', { name: 'Save play' }).tap();
  await expect(page.getByRole('button', { name: `Open ${name}` })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).tap();
}

test('edits an ordered practice queue and advances between saved plays after an offline relaunch', async ({ page, context }) => {
  await page.goto('/');
  const first = page.getByRole('button', { name: 'Runner on 1st base' });
  const second = page.getByRole('button', { name: 'Runner on 2nd base' });
  await drawArrow(page);
  await first.tap();
  await savePlay(page, 'Bunt coverage');
  await first.tap();
  await second.tap();
  await page.getByTestId('add-step').tap();
  await savePlay(page, 'Cutoffs');
  await second.tap();
  await savePlay(page, 'Empty bases');

  const practice = page.getByRole('button', { name: 'Practice queue', exact: true });
  await expect(practice).toBeVisible({ timeout: 2000 });
  await practice.tap();
  const dialog = page.getByRole('dialog', { name: 'Practice queue' });
  await dialog.getByRole('textbox', { name: 'Queue name' }).fill('Tuesday practice');
  await dialog.getByRole('button', { name: 'Save name' }).tap();
  const picker = dialog.getByRole('combobox', { name: 'Saved play' });
  for (const label of ['Bunt coverage', 'Cutoffs', 'Empty bases', 'Empty bases']) {
    await picker.selectOption({ label });
    await dialog.getByRole('button', { name: 'Add to queue' }).tap();
  }
  const entries = dialog.getByRole('listitem');
  await expect(entries).toHaveCount(4);
  await dialog.getByRole('button', { name: 'Move Cutoffs up' }).tap();
  await entries.last().getByRole('button', { name: 'Remove Empty bases' }).tap();
  await expect(entries).toHaveCount(3);
  await dialog.getByRole('button', { name: 'Start practice' }).tap();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('token-R2')).toBeVisible();
  await expect(page.getByTestId('step-1')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('play')).toBeEnabled();

  const next = page.getByRole('button', { name: 'Next practice play' });
  const previous = page.getByRole('button', { name: 'Previous practice play' });
  await expect(previous).toBeDisabled();
  await page.getByTestId('play').tap();
  await next.tap();
  await expect(page.getByTestId('token-R1')).toBeVisible();
  await expect(page.getByTestId('token-R2')).toHaveCount(0);
  await expect(page.getByTestId('play')).toBeEnabled();
  await expect(page.getByTestId('play')).toHaveAccessibleName('Play');

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('token-R1')).toBeVisible();
  await expect(page.getByRole('status', { name: 'Practice position' })).toHaveText('2 / 3');
  await next.tap();
  await expect(page.getByTestId('token-R1')).toHaveCount(0);
  await expect(next).toBeDisabled();
  await previous.tap();
  await expect(page.getByTestId('token-R1')).toBeVisible();
  await practice.tap();
  await expect(dialog.getByRole('textbox', { name: 'Queue name' })).toHaveValue('Tuesday practice');
  await expect(entries).toHaveCount(3);
});
