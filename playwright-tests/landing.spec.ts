import { expect, test } from '@playwright/test';

test('landing page renders with expected title and heading', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Snake-Oil-or-Gold Check/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Snake-Oil-or-Gold Check');
});

test('landing page declares a favicon that resolves (no /favicon.ico 404 in real browsers)', async ({
  page,
  request,
}) => {
  // Headless Chromium never requests /favicon.ico, so the console-error test
  // below cannot catch a missing favicon — real browsers DO request it and
  // log a 404 (observed live 2026-06-11). Assert the icon link exists and
  // the resource it points to actually resolves.
  await page.goto('/');
  const href = await page.locator('head link[rel~="icon"]').first().getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(href as string);
  expect(res.status()).toBe(200);
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
