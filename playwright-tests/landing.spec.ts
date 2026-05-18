import { expect, test } from '@playwright/test';

test('landing page renders with expected title and heading', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Snake-Oil-or-Gold Check/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Snake-Oil-or-Gold Check');
});

test('landing page has no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});
