import { test, expect } from '@playwright/test';

test('PDF rendering and the email editor survive dependency integration', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tests/browser/dependency-fixture.html');
  await page.getByLabel('Compatibility text').fill('Updated text');
  await expect(page.getByTestId('text-value')).toHaveText('Updated text');
  await expect(page.getByText('suffix', { exact: true })).toBeVisible();
  await expect(page.getByText('px', { exact: true })).toBeVisible();
  await expect(page.locator('.react-pdf__Page canvas')).toBeVisible();
  await expect(page.getByTestId('email-editor').getByRole('tab').first()).toBeVisible();
  await expect(page.getByTestId('email-editor-toolbar')).toHaveCSS('align-items', 'center');
  await expect(page.getByTestId('email-editor-toolbar')).toHaveCSS('justify-content', 'space-between');
  await page.screenshot({ path: testInfo.outputPath('dependency-interface.png'), fullPage: true });
  expect(errors).toEqual([]);
});
