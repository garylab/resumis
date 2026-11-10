import { test, expect } from '@playwright/test';
import { createApp } from '../../src/index.js';
import { sealSession } from '../../src/session.js';
import { githubMock } from '../github-mock.js';

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

async function setSlider(page, label, value) {
  await page.getByLabel(label, { exact: true }).evaluate((input, value) => {
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('visual controls update the preview, print styles, and saved CSS without losing custom rules', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/create/project-manager');
  await expect(page.getByLabel('Body font', { exact: true })).toBeVisible();
  const originalCss = await page.locator('[name="style"]').inputValue();
  await page.evaluate(() => {
    const css = document.querySelector('#advanced-css .CodeMirror').CodeMirror;
    css.setValue(css.getValue() + '\nblockquote { border-left: 3px dotted purple; }');
  });
  const originalCustom = await page.locator('[name="style"]').inputValue();
  await page.getByLabel('Body font', { exact: true }).selectOption({ label: 'Arial' });
  await page.getByLabel('Heading font', { exact: true }).selectOption({ label: 'Verdana' });
  await setSlider(page, 'Font size', 11);
  await setSlider(page, 'Line height', 1.5);
  await setSlider(page, 'Horizontal margins', 15);
  await setSlider(page, 'Vertical margins', 12);
  await setSlider(page, 'Section spacing', 20);
  await page.getByLabel('Paper size', { exact: true }).selectOption('Letter');
  await page.getByLabel('Bullet list columns', { exact: true }).selectOption('1');
  await page.getByLabel('Name & contact alignment', { exact: true }).selectOption('left');
  await page.getByLabel('Headings', { exact: true }).fill('#123456');
  await page.getByLabel('Body text', { exact: true }).fill('#456789');
  const frame = page.frameLocator('#preview');
  await expect(frame.locator('body')).toHaveCSS('color', 'rgb(69, 103, 137)');
  await expect(frame.locator('body')).toHaveCSS('font-family', 'Arial, Helvetica, sans-serif');
  await expect(frame.locator('h1')).toHaveCSS('color', 'rgb(18, 52, 86)');
  await expect(frame.locator('h1')).toHaveCSS('text-align', 'left');
  await expect(frame.locator('ul').first()).toHaveCSS('column-count', '1');
  await expect(page.locator('#paper-label')).toHaveText('US Letter');
  const savedCss = await page.locator('[name="style"]').inputValue();
  expect(savedCss).toContain(originalCustom);
  expect(savedCss).toContain('--page-size: Letter;');
  expect(savedCss).toContain('--global-font-size: 11pt;');
  expect(savedCss).toContain('--page-margin-x: 15mm;');
  // The same saved CSS is used for printing, with body padding removed to avoid double margins.
  await page.emulateMedia({ media: 'print' });
  await expect(frame.locator('body')).toHaveCSS('padding-left', '0px');
  expect(await frame.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--page-size').trim())).toBe('Letter');
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'Modern', exact: true }).click();
  await expect(page.getByLabel('Body font', { exact: true })).toHaveValue('Arial, Helvetica, sans-serif');
  await page.getByRole('button', { name: 'Reset visual adjustments' }).click();
  expect(await page.locator('[name="style"]').inputValue()).toBe(originalCustom);
  expect(originalCustom).toContain(originalCss);
  await expect(frame.locator('h1')).toHaveCSS('text-align', 'center');
  expect(errors).toEqual([]);
});

test('blank resumes have working controls and the editor fits a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/create');
  await expect(page.getByLabel('Font size', { exact: true })).toHaveValue('9');
  await page.getByRole('button', { name: 'Compact', exact: true }).click();
  await page.evaluate(() => document.querySelector('.markdown-panel .CodeMirror').CodeMirror.setValue('# Mobile Resume\n\nHello world'));
  await expect(page.frameLocator('#preview').locator('h1')).toHaveText('Mobile Resume');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByLabel('Font size', { exact: true })).toHaveValue('8.5');
});

test('visual styles are saved to GitHub and restored when reopening a resume', async ({ page }) => {
  const mock = githubMock();
  const app = createApp(mock.fetcher);
  const env = { SESSION_SECRET: 'test-session-secret-at-least-32-characters' };
  const session = await sealSession({ user: { id: 123, name: 'Gary', token: 'test-github-token' }, repo: { full_name: 'gary/resumes', branch: 'feature/resumes & css' } }, env.SESSION_SECRET);
  await page.route('**/resume/**', async route => {
    const incoming = route.request();
    const response = await app.fetch(new Request(incoming.url(), {
      method: incoming.method(),
      headers: { ...incoming.headers(), Cookie: `resumis_session=${session}` },
      body: incoming.postDataBuffer() || undefined,
    }), env);
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
  await page.goto('/create/project-manager');
  await page.getByRole('button', { name: 'Modern', exact: true }).click();
  await page.getByLabel('Headings', { exact: true }).fill('#552288');
  await setSlider(page, 'Font size', 12);
  await page.getByLabel('Paper size', { exact: true }).selectOption('Letter');
  const savedCss = await page.locator('[name="style"]').inputValue();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL('**/resume/edit/**');
  await expect(page.getByLabel('Font size', { exact: true })).toHaveValue('12');
  await expect(page.getByLabel('Headings', { exact: true })).toHaveValue('#552288');
  await expect(page.getByLabel('Paper size', { exact: true })).toHaveValue('Letter');
  await expect(page.frameLocator('#preview').locator('h1')).toHaveCSS('color', 'rgb(85, 34, 136)');
  // Browser multipart forms normalize textarea line endings to CRLF.
  expect(mock.files.get('Project Manager/style.css').content.replaceAll('\r\n', '\n')).toBe(savedCss);
  expect(await page.locator('[name="style"]').inputValue()).toBe(savedCss);
});

test('legacy custom CSS can be adjusted without replacing its existing rules', async ({ page }) => {
  await page.goto('/create/project-manager');
  await expect(page.getByLabel('Paper size', { exact: true })).toBeVisible();
  const legacy = 'body { color: rgb(123, 45, 67); font-family: Courier New; padding: 10mm; }\n@media print { @page { size: Letter; } }';
  await page.evaluate(css => document.querySelector('#advanced-css .CodeMirror').CodeMirror.setValue(css), legacy);
  await expect(page.getByLabel('Paper size', { exact: true })).toHaveValue('Letter');
  await expect(page.getByLabel('Horizontal margins', { exact: true })).toHaveValue('10');
  await page.getByLabel('Headings', { exact: true }).fill('#112233');
  await expect(page.frameLocator('#preview').locator('h1')).toHaveCSS('color', 'rgb(17, 34, 51)');
  await expect(page.frameLocator('#preview').locator('body')).toHaveCSS('color', 'rgb(123, 45, 67)');
  expect(await page.locator('[name="style"]').inputValue()).toContain(legacy);
  await page.getByRole('button', { name: 'Reset visual adjustments' }).click();
  expect(await page.locator('[name="style"]').inputValue()).toBe(legacy);
});
