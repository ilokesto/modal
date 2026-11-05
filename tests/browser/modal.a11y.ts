import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('inline modal has no detectable axe violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open inline confirm' }).click();

  const dialog = page.getByRole('dialog', { name: 'Delete item?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('opacity', '1');

  const results = await new AxeBuilder({ page }).include('body').analyze();

  expect(results.violations).toEqual([]);
});

test('top-layer modal has no detectable axe violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open top-layer settings' }).click();

  const dialog = page.getByRole('dialog', { name: 'Settings dialog' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('opacity', '1');

  const results = await new AxeBuilder({ page }).include('body').analyze();

  expect(results.violations).toEqual([]);
});

test('mixed transports: inline child in a native host -> one named dialog without detectable axe violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open mixed parent', exact: true }).click();
  await page.getByRole('button', { name: 'Open mixed child', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Mixed child', exact: true });
  await expect(dialog.locator('.mixed-child-panel')).toHaveCSS('opacity', '1');
  await expect(dialog.getByRole('dialog')).toHaveCount(0);

  const results = await new AxeBuilder({ page }).include('body').analyze();

  expect(results.violations).toEqual([]);
});
