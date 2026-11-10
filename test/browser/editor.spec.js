import { test, expect } from '@playwright/test';

test('Workers runtime serves home, templates, assets, and policy pages', async ({ page, request }) => {
  const health = await request.get('/health');
  expect(await health.json()).toEqual({ alive: true });
  for (const path of ['/static/css/style.css', '/static/js/script.js', '/static/img/favicon.png', '/static/img/screenshots/data-scientist.png']) {
    expect((await request.get(path)).status()).toBe(200);
  }
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Resume Templates', exact: true })).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(8);
  await expect(page.locator('footer')).toContainText('Resumis');
  await expect(page.locator('footer a[href="/"]')).toHaveText('Resumis');
  await expect(page.locator('footer a[href="https://resumis.com"]')).toHaveText('Resumis');
  await page.getByRole('link', { name: 'Project Manager Resume', exact: true }).click();
  await expect(page.locator('#resume-content')).toContainText('James Smith');
  await expect(page.locator('#resume-content a').first()).toHaveAttribute('target', '_blank');
  for (const [path, title] of [['/privacy-policy', 'Privacy Policy'], ['/terms-of-service', 'Terms of Service']]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
});

test('Markdown and CSS editor preview, rename, save form, and PDF print', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/create/project-manager');
  await expect(page.locator('.CodeMirror')).toHaveCount(2, { timeout: 30000 });
  await expect(page.frameLocator('#preview').locator('h1')).toHaveText('James Smith');
  await page.evaluate(() => {
    const editors = [...document.querySelectorAll('.CodeMirror')].map(element => element.CodeMirror);
    editors[0].setValue('# Browser Test\n\nUnicode résumé 你好');
    editors[1].setValue('body { color: rgb(123, 45, 67); }');
  });
  await expect(page.frameLocator('#preview').locator('h1')).toHaveText('Browser Test');
  await expect(page.frameLocator('#preview').locator('body')).toHaveCSS('color', 'rgb(123, 45, 67)');
  await page.locator('#name-text').click();
  await page.locator('#name-input').fill('Renamed Resume');
  await page.locator('#name-input').blur();
  await expect(page.locator('#name-text')).toHaveText('Renamed Resume');
  // Assert the browser print entry point; there is no server-side PDF conversion in Flask.
  await page.evaluate(() => {
    window.printCalls = 0;
    document.querySelector('#preview').contentWindow.print = () => { window.printCalls++; };
  });
  await page.getByRole('button', { name: /PDF$/ }).click();
  expect(await page.evaluate(() => window.printCalls)).toBe(1);
  expect(await page.evaluate(() => document.querySelector('#preview').contentDocument.title)).toBe('Renamed Resume');
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/resume/save'));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(401);
  expect((await response.json()).message).toBe('Please login to continue');
  const body = response.request().postData();
  expect(body).toContain('Renamed Resume');
  expect(body).toContain('# Browser Test');
  expect(body).toContain('rgb(123, 45, 67)');
  expect(errors).toEqual([]);
});
