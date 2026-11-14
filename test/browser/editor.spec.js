import { test, expect } from '@playwright/test';
import { createApp } from '../../src/index.js';
import { sealSession } from '../../src/session.js';
import { githubMock } from '../github-mock.js';
import { resumes } from '../../src/generated/data.js';
import { clearAdjustments } from '../../public/static/js/style-settings.js';

async function drag(page, selector, byX) {
  const box = await page.locator(selector).boundingBox();
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + byX, y, { steps: 10 });
  await page.mouse.up();
}

test('Workers runtime serves home, templates, assets, and policy pages', async ({ page, request }) => {
  const health = await request.get('/health');
  expect(await health.json()).toEqual({ alive: true });
  for (const path of ['/static/css/style.css', '/static/js/script.js', '/static/img/favicon.png', '/static/img/screenshots/data-scientist.png']) {
    expect((await request.get(path)).status()).toBe(200);
  }
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Resume Templates', exact: true })).toBeVisible();
  await expect(page.locator('.template-card')).toHaveCount(8);
  await expect(page.locator('footer')).toContainText('Resumis');
  await expect(page.locator('footer a[href="/"]')).toHaveText('Resumis');
  await expect(page.locator('footer a[href="https://resumis.com"]')).toHaveText('Resumis');
  await page.getByRole('link', { name: 'Project Manager Resume', exact: true }).click();
  await expect(page.frameLocator('#resume-content').locator('body')).toContainText('James Smith');
  await expect(page.frameLocator('#resume-content').locator('a').first()).toHaveAttribute('target', '_blank');
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
  await page.getByRole('radio', { name: 'US Letter' }).click();
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
  await expect(page.getByRole('radio', { name: 'US Letter' })).toHaveAttribute('aria-checked', 'true');
  const savedCss = await page.locator('[name="style"]').inputValue();
  // Everything outside the generated block, including the template's own rules, is untouched.
  expect(clearAdjustments(savedCss)).toBe(clearAdjustments(originalCustom));
  expect(savedCss).toContain('--page-size: Letter;');
  expect(savedCss).toContain('--global-font-size: 11pt;');
  expect(savedCss).toContain('--page-margin-x: 15mm;');
  // The same saved CSS is used for printing, with body padding removed to avoid double margins.
  await page.emulateMedia({ media: 'print' });
  await expect(frame.locator('body')).toHaveCSS('padding-left', '0px');
  expect(await frame.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--page-size').trim())).toBe('Letter');
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'Modern', exact: true }).click();
  await expect(page.getByLabel('Body font', { exact: true })).toHaveValue("Inter, 'Helvetica Neue', Arial, sans-serif");
  await page.getByRole('button', { name: 'Reset visual adjustments' }).click();
  expect(await page.locator('[name="style"]').inputValue()).toBe(clearAdjustments(originalCustom));
  expect(originalCustom).toContain(originalCss);
  await expect(frame.locator('h1')).toHaveCSS('text-align', 'center');
  expect(errors).toEqual([]);
});

test('the editor fills the screen without the site navbar, footer, or panel chrome', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/create/project-manager');
  await expect(page.locator('nav')).toHaveCount(0);
  await expect(page.locator('footer')).toHaveCount(0);
  // The Markdown and preview panels are bare: no headings, hints, or status note.
  await expect(page.locator('.panel-heading, .preview-note')).toHaveCount(0);
  await expect(page.getByText('RESUME EDITOR')).toHaveCount(0);
  const box = await page.locator('.editor-workspace').boundingBox();
  // Full height, and full width apart from the gutter at each screen edge.
  expect(box).toEqual({ x: 12, y: 0, width: 1416, height: 900 });
  // The page itself never scrolls; the Markdown, preview, and appearance panels do.
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  const editor = await page.locator('.markdown-panel .CodeMirror').boundingBox();
  const panel = await page.locator('.markdown-panel').boundingBox();
  expect(editor.y + editor.height).toBeLessThanOrEqual(panel.y + panel.height + 1);
  expect(editor.height).toBeGreaterThan(800);
  await page.evaluate(() => document.querySelector('.markdown-panel .CodeMirror').CodeMirror.setValue('# Tall\n\n' + 'line\n\n'.repeat(200)));
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  expect(await page.evaluate(() => {
    const scroller = document.querySelector('.CodeMirror-scroll');
    return scroller.scrollHeight > scroller.clientHeight;
  })).toBe(true);
});

test('the right bar holds navigation, saving, and the resume name field', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/create/project-manager');
  const bar = page.locator('.appearance-panel .editor-bar');
  await expect(bar.getByRole('link', { name: 'Back to My Resumes' })).toHaveAttribute('href', '/my-resumes');
  await expect(bar.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  await expect(bar.getByRole('button', { name: /PDF$/ })).toBeVisible();
  // The name sits under that bar, inside the right-hand panel.
  const barBox = await bar.boundingBox();
  const nameBox = await page.locator('#name-text').boundingBox();
  const panelBox = await page.locator('.appearance-panel').boundingBox();
  expect(nameBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height);
  expect(nameBox.x).toBeGreaterThanOrEqual(panelBox.x);
  // The name scrolls away with the controls; only the bar stays put.
  await page.locator('.appearance-scroll').evaluate(panel => panel.scrollTo(0, 400));
  expect((await page.locator('#name-text').boundingBox()).y).toBeLessThan(nameBox.y - 100);
  expect((await bar.boundingBox()).y).toBe(barBox.y);
  await page.locator('.appearance-scroll').evaluate(panel => panel.scrollTo(0, 0));
  // Paper size leads the controls, under its own heading, with Photo before Quick styles.
  expect(await page.locator('.appearance-scroll legend').allTextContents()).toEqual(
    ['Paper Size', 'Photo', 'Quick styles', 'Typography', 'Spacing', 'Layout', 'Colors']);
  await expect(page.locator('#paper-section')).toContainText('Paper Size');
  await page.locator('#name-text').click();
  await expect(page.locator('#name-input')).toHaveJSProperty('tagName', 'TEXTAREA');
  const field = await page.locator('#name-input').boundingBox();
  const title = await page.locator('.editor-title').boundingBox();
  expect(Math.abs(field.width - (title.width - 28))).toBeLessThan(2); // Full width of the panel.
  // Wrapped text grows the field downwards instead of being clipped.
  await page.locator('#name-input').fill('A considerably longer resume name that will wrap onto a second line');
  expect((await page.locator('#name-input').boundingBox()).height).toBeGreaterThan(field.height + 10);
  // Line breaks cannot reach a name that becomes a GitHub folder path.
  await page.locator('#name-input').fill('Two\nlines');
  await page.locator('#name-input').blur();
  await expect(page.locator('#name-text')).toHaveText('Two lines');
});

test('the preview scrolls in one box beside the paper', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/create/project-manager');
  await expect(page.locator('.CodeMirror')).toHaveCount(2, { timeout: 30000 });
  const scrolling = await page.locator('.preview-panel *').evaluateAll(nodes => nodes
    .filter(node => node.scrollHeight > node.clientHeight + 2 && ['auto', 'scroll'].includes(getComputedStyle(node).overflowY))
    .map(node => node.id));
  expect(scrolling).toEqual(['preview-scroll']); // Not the stage, and not the frame.
  const frame = await page.locator('#preview').evaluate(element => {
    const doc = element.contentDocument;
    return { overflow: doc.defaultView.getComputedStyle(doc.documentElement).overflowY, over: doc.documentElement.scrollHeight - doc.documentElement.clientHeight };
  });
  expect(frame).toEqual({ overflow: 'hidden', over: 0 });
  // The scrollbar lands against the paper rather than against the appearance panel.
  const sheet = await page.locator('#preview-sheet').boundingBox();
  const box = await page.locator('#preview-scroll').boundingBox();
  expect(box.x + box.width).toBeGreaterThanOrEqual(sheet.x + sheet.width - 1);
  expect(box.x + box.width).toBeLessThan(sheet.x + sheet.width + 20);
});

test('the preview marks where each printed page ends', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/create');
  await expect(page.locator('.CodeMirror')).toHaveCount(2, { timeout: 30000 });
  await expect(page.locator('.page-break')).toHaveCount(0); // A blank resume is one page.
  await page.evaluate(() => document.querySelector('.markdown-panel .CodeMirror')
    .CodeMirror.setValue('# Long resume\n\n' + 'Another paragraph of resume text.\n\n'.repeat(400)));
  await expect(page.locator('.page-break').first()).toBeVisible();
  const tops = await page.locator('.page-break').evaluateAll(marks => marks.map(mark => mark.offsetTop));
  expect(tops.length).toBeGreaterThan(1);
  // Breaks sit one printable area apart: the paper height less the page margins.
  const { printable, margin } = await page.evaluate(() => {
    const frame = document.getElementById('preview');
    const body = frame.contentWindow.getComputedStyle(frame.contentDocument.body);
    const scale = document.getElementById('preview-sheet').getBoundingClientRect().width / (210 * 96 / 25.4);
    const [top, bottom] = [parseFloat(body.paddingTop), parseFloat(body.paddingBottom)];
    return { printable: (297 * 96 / 25.4 - top - bottom) * scale, margin: top * scale };
  });
  expect(Math.abs(tops[0] - (margin + printable))).toBeLessThan(1);
  for (const [index, top] of tops.entries()) {
    expect(Math.abs(top - (margin + printable * (index + 1)))).toBeLessThan(1);
  }
  expect(tops.at(-1)).toBeLessThan((await page.locator('#preview-sheet').boundingBox()).height);
});

test('the marked page count matches what Chrome prints', async ({ page, browser }) => {
  await page.goto('/create/project-manager');
  await expect(page.locator('.CodeMirror')).toHaveCount(2, { timeout: 30000 });
  for (const extra of [0, 14]) {
    await page.evaluate(count => {
      const editor = document.querySelector('.markdown-panel .CodeMirror').CodeMirror;
      editor.setValue(editor.getValue().split('\n## Projects')[0]
        + '\n\n' + '## Extra\n\nSome more resume content here.\n\n'.repeat(count));
    }, extra);
    await expect(page.locator('.page-break').first()).toBeVisible();
    const marked = await page.locator('.page-break').count() + 1;
    // Print the very document the preview shows, and count the pages Chrome makes of it.
    const printer = await browser.newPage();
    await printer.setContent(await page.locator('#preview')
      .evaluate(frame => frame.contentDocument.documentElement.outerHTML));
    const pdf = await printer.pdf({ preferCSSPageSize: true, printBackground: true });
    await printer.close();
    expect(marked).toBe((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length);
  }
});

test('the column dividers resize the panels and the choice is remembered', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/create/project-manager');
  await expect(page.locator('.CodeMirror')).toHaveCount(2, { timeout: 30000 });
  const widths = () => page.evaluate(() => Object.fromEntries(['markdown', 'preview', 'appearance']
    .map(name => [name, Math.round(document.querySelector(`.${name}-panel`).getBoundingClientRect().width)])));
  const before = await widths();
  await drag(page, '.col-resizer[data-edge="markdown"]', 120);
  const wider = await widths();
  // The divider trades width between the two panels it sits between.
  expect(wider.markdown).toBe(before.markdown + 120);
  expect(wider.preview).toBe(before.preview - 120);
  expect(wider.appearance).toBe(before.appearance);
  await drag(page, '.col-resizer[data-edge="appearance"]', -60);
  const narrower = await widths();
  expect(narrower.appearance).toBe(wider.appearance + 60);
  expect(narrower.preview).toBe(wider.preview - 60);
  expect(narrower.markdown).toBe(wider.markdown);
  await page.reload();
  await expect(page.locator('.CodeMirror')).toHaveCount(2, { timeout: 30000 });
  expect(await widths()).toEqual(narrower);
});

test('each quick style restyles the preview and its controls', async ({ page }) => {
  await page.goto('/create/project-manager');
  await expect(page.locator('#style-presets button'))
    .toHaveText(['Classic', 'Modern', 'Compact', 'Developer', 'Designer', 'Academic', 'Executive', 'Romantic']);
  // Every style carries its own icon.
  const icons = await page.locator('#style-presets button svg use').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  expect(icons).toHaveLength(8);
  expect(new Set(icons).size).toBe(8);
  const heading = page.frameLocator('#preview').locator('h1');
  await page.getByRole('button', { name: 'Developer', exact: true }).click();
  await expect(heading).toHaveCSS('font-family', /Courier New/);
  await expect(page.getByLabel('Heading font', { exact: true })).toHaveValue(/Courier New/);
  await expect(page.frameLocator('#preview').locator('body')).toHaveCSS('font-family', /IBM Plex Sans/);
  await page.getByRole('button', { name: 'Designer', exact: true }).click();
  await expect(heading).toHaveCSS('color', 'rgb(178, 86, 13)');
  await expect(heading).toHaveCSS('font-family', /Montserrat/);
  await expect(page.frameLocator('#preview').locator('body')).toHaveCSS('font-family', /Lato/);
  await page.getByRole('button', { name: 'Romantic', exact: true }).click();
  await expect(heading).toHaveCSS('color', 'rgb(155, 59, 90)');
  await expect(heading).toHaveCSS('text-align', 'center');
  await expect(page.getByLabel('Line height', { exact: true })).toHaveValue('1.8');
});

test('resume fonts are served from this origin and render in the preview', async ({ page, request }) => {
  const outside = [];
  page.on('request', call => {
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(call.url())) outside.push(call.url());
  });
  const stylesheet = await request.get('/static/fonts/fonts.css');
  expect(stylesheet.status()).toBe(200);
  expect(await stylesheet.text()).toContain('/static/fonts/');
  await page.goto('/create/project-manager');
  await expect(page.getByLabel('Body font', { exact: true })).toBeVisible();
  for (const font of ['Inter', 'Noto Sans SC']) {
    await page.getByLabel('Body font', { exact: true }).selectOption({ label: font });
    await expect(page.frameLocator('#preview').locator('body')).toHaveCSS('font-family', new RegExp(font));
    // The face itself is loaded, not just named.
    await expect.poll(() => page.locator('#preview').evaluate(async (frame, name) => {
      const doc = frame.contentDocument;
      await doc.fonts.load(`16px "${name}"`, 'Resume');
      return [...doc.fonts].some(face => face.family.replaceAll('"', '') === name && face.status === 'loaded');
    }, font)).toBe(true);
  }
  await page.goto('/template/senior-frontend-engineer');
  await expect(page.frameLocator('#resume-content').locator('h1')).toBeVisible();
  expect(outside).toEqual([]);
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
  await page.getByRole('radio', { name: 'US Letter' }).click();
  const savedCss = await page.locator('[name="style"]').inputValue();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL('**/resume/edit/**');
  await expect(page.getByLabel('Font size', { exact: true })).toHaveValue('12');
  await expect(page.getByLabel('Headings', { exact: true })).toHaveValue('#552288');
  await expect(page.getByRole('radio', { name: 'US Letter' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.frameLocator('#preview').locator('h1')).toHaveCSS('color', 'rgb(85, 34, 136)');
  // Browser multipart forms normalize textarea line endings to CRLF.
  expect(mock.files.get('Project Manager/style.css').content.replaceAll('\r\n', '\n')).toBe(savedCss);
  expect(await page.locator('[name="style"]').inputValue()).toBe(savedCss);
});

test('legacy custom CSS can be adjusted without replacing its existing rules', async ({ page }) => {
  await page.goto('/create/project-manager');
  await expect(page.getByRole('radio', { name: 'A4', exact: true })).toBeVisible();
  const legacy = 'body { color: rgb(123, 45, 67); font-family: Courier New; padding: 10mm; }\n@media print { @page { size: Letter; } }';
  await page.evaluate(css => document.querySelector('#advanced-css .CodeMirror').CodeMirror.setValue(css), legacy);
  await expect(page.getByRole('radio', { name: 'US Letter' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('Horizontal margins', { exact: true })).toHaveValue('10');
  await page.getByLabel('Headings', { exact: true }).fill('#112233');
  await expect(page.frameLocator('#preview').locator('h1')).toHaveCSS('color', 'rgb(17, 34, 51)');
  await expect(page.frameLocator('#preview').locator('body')).toHaveCSS('color', 'rgb(123, 45, 67)');
  expect(await page.locator('[name="style"]').inputValue()).toContain(legacy);
  await page.getByRole('button', { name: 'Reset visual adjustments' }).click();
  expect(await page.locator('[name="style"]').inputValue()).toBe(legacy);
});

test('every template keeps its own look, from the preview through to the editor', async ({ page }) => {
  test.setTimeout(60000);
  const readStyles = body => {
    const style = (element, properties) => Object.fromEntries(properties.map(property => [property, getComputedStyle(element).getPropertyValue(property)]));
    return {
      body: style(body, ['font-family', 'font-size', 'color', 'padding']),
      heading: style(body.querySelector('h1'), ['font-family', 'font-size', 'color', 'text-align']),
      section: style(body.querySelector('h2'), ['margin-top', 'border-bottom-width', 'border-bottom-color']),
      list: style(body.querySelector('ul'), ['column-count', 'padding-left']),
    };
  };
  const looks = [];
  for (const name of Object.keys(resumes)) {
    const slug = name.toLowerCase().replaceAll(' ', '-');
    await page.goto(`/template/${slug}`);
    const frame = page.frameLocator('#resume-content');
    await expect(frame.locator('h1')).toBeVisible();
    await expect(frame.locator('h2').first()).toHaveCSS('border-bottom-width', '1px');
    const templateStyles = await frame.locator('body').evaluate(readStyles);
    expect(parseFloat(templateStyles.body.padding)).toBeGreaterThan(0);
    expect(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--theme-color'))).toBe('');
    const useTemplate = page.getByRole('link', { name: 'Use This Template', exact: true }).first();
    await expect(useTemplate).toHaveAttribute('href', `/create/${slug}`);
    await useTemplate.click();
    await expect(page.getByLabel('Body font', { exact: true })).toBeVisible();
    expect(await page.frameLocator('#preview').locator('body').evaluate(readStyles)).toEqual(templateStyles);
    looks.push(JSON.stringify(templateStyles));
  }
  // Each template ships with a different quick style.
  expect(new Set(looks).size).toBe(looks.length);
});

test('template previews fit mobile screens while retaining paper dimensions and all content', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/template/project-manager');
  const frame = page.frameLocator('#resume-content');
  await expect(frame.locator('h1')).toBeVisible();
  await expect(page.locator('#resume-content')).toHaveCSS('width', '793.688px');
  await expect.poll(() => page.locator('#resume-content').evaluate(el => el.getBoundingClientRect().right <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await frame.locator('body').evaluate(body => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.screenshot({ path: '/tmp/resumis-template-mobile.png', fullPage: true });
});

test('mobile navigation and notifications work without Bootstrap', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const externalUI = [];
  page.on('request', request => {
    if (/bootstrap|lucide|tailwind/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:8788/')) externalUI.push(request.url());
  });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  await expect(page.locator('#navbarNav')).toBeHidden();
  await toggle.click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#navbarNav')).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await expect(toggle).toBeHidden();
  await page.goto('/create/project-manager');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('#toast-container .toast')).toBeVisible();
  await expect(page.locator('#toast-container .toast-text')).toHaveText('Please login to continue');
  await page.getByRole('button', { name: 'Close notification' }).click();
  await expect(page.locator('#toast-container .toast')).toHaveCount(0);
  expect(externalUI).toEqual([]);
  await expect(page.locator('#style-font optgroup, #style-headingFont optgroup')).toHaveCount(0);
  const icons = await page.locator('#style-presets button').evaluateAll(buttons => buttons.map(button => {
    const icon = button.querySelector('svg').getBoundingClientRect();
    const text = button.querySelector('span').getBoundingClientRect();
    return icon.width > 0 && icon.right <= text.left && Math.abs(icon.y + icon.height / 2 - text.y - text.height / 2) < 2;
  }));
  expect(icons.every(Boolean)).toBe(true);
});

test('account and delete disclosures support keyboard and outside dismissal', async ({ page }) => {
  const mock = githubMock();
  mock.put('Example/content.md', '# Example');
  mock.put('Example/style.css', 'body { color: black; }');
  const app = createApp(mock.fetcher);
  const env = { SESSION_SECRET: 'test-session-secret-at-least-32-characters' };
  const session = await sealSession({ user: { id: 123, name: 'Gary', token: 'test-github-token' }, repo: { full_name: 'gary/resumes', branch: 'feature/resumes & css' } }, env.SESSION_SECRET);
  await page.route('**/my-resumes', async route => {
    const response = await app.fetch(new Request(route.request().url(), { headers: { Cookie: `resumis_session=${session}` } }), env);
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
  await page.goto('/my-resumes');
  const account = page.locator('nav summary');
  await account.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: 'Logout' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', { name: 'Logout' })).toBeHidden();
  await expect(account).toBeFocused();
  const remove = page.getByLabel('Delete resume').first();
  await remove.click();
  await expect(page.getByRole('button', { name: 'Confirm' }).first()).toBeVisible();
  await page.getByRole('heading', { name: 'My Resumes' }).click();
  await expect(page.getByRole('button', { name: 'Confirm' }).first()).toBeHidden();
});

test('photo uploads persist through edits, saving and reopening, and print with the resume', async ({ page }) => {
  const mock = githubMock();
  const app = createApp(mock.fetcher);
  const env = { SESSION_SECRET: 'test-session-secret-at-least-32-characters' };
  const session = await sealSession({ user: { id: 123, name: 'Gary', token: 'test-github-token' }, repo: { full_name: 'gary/resumes', branch: 'feature/resumes & css' } }, env.SESSION_SECRET);
  await page.route('**/resume/**', async route => {
    const incoming = route.request();
    const response = await app.fetch(new Request(incoming.url(), {
      method: incoming.method(), headers: { ...incoming.headers(), Cookie: `resumis_session=${session}` },
      body: incoming.postDataBuffer() || undefined,
    }), env);
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
  await page.goto('/create/project-manager');
  await page.locator('#photo-file').setInputFiles('test/fixtures/photo.jpg');
  await expect(page.locator('#photo-status')).toContainText('Photo added');
  const portrait = page.frameLocator('#preview').locator('[data-resume-photo]');
  await expect(portrait).toBeVisible();
  const firstPhoto = await page.locator('#photo-data').inputValue();
  expect(await page.locator('[name=content]').inputValue()).toMatch(/^!\[Profile photo\]\(photo\.jpg\)\n\n/);
  await expect(page.frameLocator('#preview').locator('body > :first-child img')).toHaveAttribute('src', firstPhoto);
  await expect(portrait).toHaveJSProperty('naturalWidth', 400);
  await page.getByRole('button', { name: 'Modern', exact: true }).click();
  await page.evaluate(() => document.querySelector('.markdown-panel .CodeMirror').CodeMirror.setValue('# Photo Test\n\n![Profile photo](photo.jpg)\n\nMy experience'));
  await expect(portrait).toHaveAttribute('src', firstPhoto);
  await expect(page.frameLocator('#preview').locator('body > :first-child')).toHaveText('Photo Test');
  await page.locator('#photo-file').setInputFiles({ name: 'bad.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') });
  await expect(page.locator('#photo-status')).toContainText('could not be opened');
  await expect(portrait).toHaveAttribute('src', firstPhoto);
  await page.locator('#photo-file').setInputFiles('public/static/img/favicon.png');
  await expect(page.locator('#photo-status')).toContainText('Photo added');
  await page.getByLabel('Photo alignment', {exact:true}).selectOption('left');
  await page.getByRole('radio', {name:'Circle', exact:true}).click();
  const cssEditor = page.locator('#advanced-css .CodeMirror');
  await page.locator('#advanced-css summary').click();
  await expect(cssEditor).toBeVisible();
  const photoCss = await cssEditor.evaluate(el => el.CodeMirror.getValue());
  expect(photoCss).toContain('--photo-position: left;');
  expect(photoCss).toContain('--photo-shape-radius: 50%;');
  expect(photoCss).toContain('float: var(--photo-position, none);');
  expect(photoCss).toContain('object-fit: cover;');
  await expect(portrait).not.toHaveAttribute('style');
  const savedPhoto = await page.locator('#photo-data').inputValue();
  expect(savedPhoto).not.toBe(firstPhoto);
  expect(await page.locator('[name=content]').inputValue()).toMatch(/^# Photo Test/);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL('**/resume/edit/**');
  expect(`data:image/jpeg;base64,${mock.files.get('Project Manager/photo.jpg').content.toString('base64')}`).toBe(savedPhoto);
  expect(mock.files.get('Project Manager/style.css').content.replaceAll('\r\n', '\n')).toBe(photoCss);
  await expect(portrait).toHaveAttribute('src', savedPhoto);
  await expect(page.getByLabel('Photo alignment', {exact:true})).toHaveValue('left');
  await expect(portrait.locator('..')).toHaveCSS('float', 'left');
  await expect(page.getByRole('radio', {name:'Circle', exact:true})).toHaveAttribute('aria-checked', 'true');
  await expect(portrait).toHaveCSS('border-radius', '50%');
  await page.evaluate(() => {
    window.printedPhoto = false;
    const frame = document.querySelector('#preview');
    frame.contentWindow.print = () => { window.printedPhoto = frame.contentDocument.querySelector('[data-resume-photo]').naturalWidth === 400; };
  });
  await page.getByRole('button', { name: /PDF$/ }).click();
  await expect.poll(() => page.evaluate(() => window.printedPhoto)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await expect(portrait).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'Remove photo', exact: true }).click();
  await expect(portrait).toHaveCount(0);
  const saved = page.waitForResponse(response => response.url().endsWith('/resume/save'));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved;
  expect(mock.files.has('Project Manager/photo.jpg')).toBe(false);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Upload', exact: true })).toBeVisible();
  await expect(portrait).toHaveCount(0);
});

test('preview strips executable HTML without sandbox warnings or changing saved Markdown', async ({ page }) => {
  const warnings = [];
  page.on('console', message => {
    if (message.text().includes('Blocked script execution')) warnings.push(message.text());
  });
  await page.goto('/create/senior-backend-engineer');
  await page.locator('.CodeMirror').first().waitFor();
  const markdown = '# Resume\n\n<strong>Formatted text</strong>\n\n'
    + '<img src="/static/img/favicon.png" onload="parent.previewScriptRan=true" alt="Example">\n'
    + '<script>parent.previewScriptRan=true</script>\n'
    + '<iframe srcdoc="<script>parent.previewScriptRan=true</script>"></iframe>\n'
    + '<a href="javascript:parent.previewScriptRan=true">Unsafe link</a>\n\n'
    + '[Website](https://example.com)';
  await page.evaluate(content => document.querySelector('.CodeMirror').CodeMirror.setValue(content), markdown);
  const frame = page.frameLocator('#preview');
  await expect(frame.locator('strong')).toHaveText('Formatted text');
  await expect(frame.getByAltText('Example')).toHaveJSProperty('complete', true);
  await expect(frame.locator('script, iframe, [onload]')).toHaveCount(0);
  await expect(frame.getByText('Unsafe link')).not.toHaveAttribute('href');
  await expect(frame.getByRole('link', { name: 'Website' })).toHaveAttribute('href', 'https://example.com');
  await expect(page.locator('#preview')).toHaveAttribute('sandbox', 'allow-same-origin allow-modals');
  expect(await page.evaluate(() => window.previewScriptRan)).toBeUndefined();
  await expect(page.locator('[name=content]')).toHaveValue(markdown);
  expect(warnings).toEqual([]);
});

test('quick styles lay out a header photo without overlapping resume text', async ({ page }) => {
  await page.goto('/create/project-manager');
  await page.locator('#photo-file').setInputFiles('test/fixtures/photo.jpg');
  await expect(page.locator('#photo-status')).toContainText('Photo added');
  const markdown = await page.locator('[name=content]').inputValue();
  const layouts = { Classic: ['none', 26, 2], Modern: ['right', 28, 3], Compact: ['right', 22, 2],
    Developer: ['right', 26, 2], Designer: ['left', 30, 15], Academic: ['right', 24, 0],
    Executive: ['right', 28, 2], Romantic: ['none', 28, 14] };
  for (const [name, [position, size, radius]] of Object.entries(layouts)) {
    await page.getByRole('button', { name, exact: true }).click();
    for (const media of ['screen', 'print']) {
      await page.emulateMedia({ media });
      const geometry = await page.locator('#preview').evaluate(frame => {
        const doc = frame.contentDocument;
        const win = frame.contentWindow;
        const image = doc.querySelector('[data-resume-photo]');
        const rect = image.getBoundingClientRect();
        const heading = doc.querySelector('h1').getBoundingClientRect();
        const section = doc.querySelector('h2').getBoundingClientRect();
        const body = doc.body.getBoundingClientRect();
        const style = win.getComputedStyle(doc.body);
        const left = body.left + parseFloat(style.paddingLeft);
        const right = body.right - parseFloat(style.paddingRight);
        return { position: win.getComputedStyle(image.parentElement).float, width: parseFloat(win.getComputedStyle(image).width),
          radius: win.getComputedStyle(image).borderRadius, left: rect.left - left, right: right - rect.right,
          centered: Math.abs((rect.left + rect.right) / 2 - (left + right) / 2),
          overlaps: !(rect.right <= heading.left + 1 || rect.left >= heading.right - 1 || rect.bottom <= heading.top + 1 || rect.top >= heading.bottom - 1),
          sectionBelow: section.top >= rect.bottom - 1 };
      });
      expect(geometry.position, `${name} ${media}`).toBe(position);
      expect(Math.abs(geometry.width - size * 96 / 25.4)).toBeLessThan(1);
      if (['Designer', 'Romantic'].includes(name)) expect(geometry.radius).toBe('50%');
      else expect(Math.abs(parseFloat(geometry.radius) - 2 * 96 / 25.4)).toBeLessThan(.01);
      expect(geometry.overlaps, `${name} ${media}`).toBe(false);
      expect(geometry.sectionBelow, `${name} ${media}`).toBe(true);
      expect(position === 'none' ? geometry.centered : geometry[position]).toBeLessThan(1);
    }
    await page.emulateMedia({ media: 'screen' });
    await expect(page.locator('[name=content]')).toHaveValue(markdown);
  }
  await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.setValue('# Name\n\nSome contact details\n\n![Profile photo](photo.jpg)\n\n## Experience'));
  await page.getByRole('button', { name: 'Designer', exact: true }).click();
  await expect(page.frameLocator('#preview').locator('[data-resume-photo]').locator('..')).toHaveCSS('float', 'left');
  await expect(page.frameLocator('#preview').locator('body > :first-child')).toHaveText('Name');
  await page.getByRole('button', { name: 'Remove photo', exact: true }).click();
  await expect(page.frameLocator('#preview').locator('[data-resume-photo]')).toHaveCount(0);
});

test('photo position wraps following text on either side without moving Markdown', async ({ page }) => {
  await page.goto('/create/project-manager');
  await expect(page.getByLabel('Photo alignment', { exact: true })).toBeVisible();
  await page.locator('#photo-file').setInputFiles('test/fixtures/photo.jpg');
  await expect(page.locator('#photo-status')).toContainText('Photo added');
  const markdown = '# Name\n\n## About me\n\n![Profile photo](photo.jpg)\n\n' + 'A paragraph of professional experience and skills. '.repeat(40);
  await page.evaluate(markdown => document.querySelector('.CodeMirror').CodeMirror.setValue(markdown), markdown);
  for (const position of ['left', 'right', 'none']) {
    await page.getByLabel('Photo alignment', { exact: true }).selectOption(position);
    for (const media of ['screen', 'print']) {
      await page.emulateMedia({media});
      const flow = await page.locator('#preview').evaluate(frame => {
        const doc = frame.contentDocument;
        const image = doc.querySelector('[data-resume-photo]');
        const rect = image.getBoundingClientRect();
        const paragraph = image.parentElement.nextElementSibling;
        const range = doc.createRange();
        range.setStart(paragraph.firstChild, 0);
        range.setEnd(paragraph.firstChild, 1);
        const firstLetter = range.getBoundingClientRect();
        return { left: firstLetter.left >= rect.right, right: firstLetter.right <= rect.left,
          beside: firstLetter.top < rect.bottom, below: firstLetter.top >= rect.bottom };
      });
      if (position === 'none') expect(flow.below).toBe(true);
      else { expect(flow[position]).toBe(true); expect(flow.beside).toBe(true); }
    }
    await page.emulateMedia({media:'screen'});
    await expect(page.locator('[name=content]')).toHaveValue(markdown);
  }
  await page.getByRole('button', {name:'Remove photo',exact:true}).click();
  await expect(page.getByLabel('Photo alignment', {exact:true})).toBeVisible();
});

test('photo shape switches between square and circle in preview and print', async ({ page }) => {
  await page.goto('/create/project-manager');
  await page.getByRole('radio', {name:'Circle', exact:true}).click();
  await page.locator('#photo-file').setInputFiles('test/fixtures/photo.jpg');
  await expect(page.locator('#photo-status')).toContainText('Photo added');
  const portrait = page.frameLocator('#preview').locator('[data-resume-photo]');
  for (const [shape, radius] of [['Circle', '50%'], ['Square', '7.55906px']]) {
    await page.getByRole('radio', {name:shape, exact:true}).click();
    await expect(portrait).toHaveCSS('border-radius', radius);
    await page.emulateMedia({media:'print'});
    await expect(portrait).toHaveCSS('border-radius', radius);
    await page.emulateMedia({media:'screen'});
  }
  await page.getByRole('button', {name:'Designer',exact:true}).click();
  await expect(page.getByRole('radio', {name:'Circle', exact:true})).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', {name:'Classic',exact:true}).click();
  await expect(page.getByRole('radio', {name:'Square', exact:true})).toHaveAttribute('aria-checked', 'true');
});
