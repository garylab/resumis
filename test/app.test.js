import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApp } from '../src/index.js';
import { sealSession, openSession } from '../src/session.js';
import { resumes, css } from '../src/generated/data.js';
import { githubMock } from './github-mock.js';

const origin = 'https://resumis.example';
const env = { SESSION_SECRET: 'test-secret-with-more-than-32-characters', GITHUB_CLIENT_ID: 'test-client', GITHUB_CLIENT_SECRET: 'test-client-secret' };
const user = { id: 123, username: 'gary', name: 'Gary & Co', email: 'gary@example.com', token: 'test-github-token' };
const repo = { full_name: 'gary/resumes', branch: 'feature/resumes & css' };

async function client(session = {}, settings = env) {
  const mock = githubMock();
  const app = createApp(mock.fetcher);
  let cookie = Object.keys(session).length ? `resumis_session=${await sealSession(session, settings.SESSION_SECRET)}` : '';
  return {
    mock,
    async request(path, { form, method = form ? 'POST' : 'GET', headers = {} } = {}) {
      const request = new Request(`${origin}${path}`, {
        method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers },
        body: form ? new URLSearchParams(form) : undefined,
      });
      const response = await app.fetch(request, settings);
      const setCookie = response.headers.get('Set-Cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      return response;
    },
    session: () => openSession(cookie.split('=').slice(1).join('='), settings.SESSION_SECRET),
  };
}

test('all public routes, SEO, templates, and Markdown/CSS defaults match the source', async () => {
  const browser = await client();
  const home = await browser.request('/');
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /Build your online/);
  assert.match(html, /href="https:\/\/resumis.example\/"/);
  assert.match(html, /<a[^>]*href="\/">Resumis<\/a>/);
  assert.doesNotMatch(html, /\{%|\{\{/);
  assert.equal(Object.keys(resumes).length, 8);
  for (const [name, resume] of Object.entries(resumes)) {
    const slug = name.toLowerCase().replaceAll(' ', '-');
    const preview = await browser.request(`/template/${slug}`);
    assert.equal(preview.status, 200);
    assert.ok((await preview.text()).includes(resume.html));
    const editor = await browser.request(`/create/${slug}`);
    assert.equal(editor.status, 200);
    const editorHtml = await editor.text();
    assert.ok(editorHtml.includes(name));
    assert.match(editorHtml, /CodeMirror.fromTextArea/);
    assert.match(editorHtml, /downloadPdf\(\)/);
    assert.ok(css.length > 100);
    assert.equal(resume.content, await readFile(new URL(`../data/resumes/${name}.md`, import.meta.url), 'utf8'));
  }
  for (const path of ['/create', '/privacy-policy', '/terms-of-service', '/robots.txt']) {
    assert.equal((await browser.request(path)).status, 200, path);
  }
  assert.deepEqual(await (await browser.request('/health')).json(), { alive: true });
  assert.equal(browser.mock.calls.length, 0);
});

test('site name and Markdown policies/footer are configured per request', async () => {
  const browser = await client({}, { ...env,
    SITE_NAME: 'My CV & Careers',
    PRIVACY_POLICY_CONTENT: '# Our Privacy\n\nKeep your **data** private.\n\n- Item one\n- Item two\n\n[Contact](https://example.com/contact)',
    TERMS_OF_SERVICE_CONTENT: '# Our Terms\n\nUse this service *responsibly*.\n\n```text\nExample terms\n```',
    FOOTER_CONTENT: '[Privacy](/privacy-policy) · [Terms](/terms-of-service)\n\n**Made for you**',
  });
  const home = await (await browser.request('/')).text();
  assert.match(home, /<title>My CV &amp; Careers -/);
  assert.match(home, /class="navbar-brand fw-600" href="\/">My CV &amp; Careers<\/a>/);
  const footer = home.match(/<footer\b[\s\S]*?<\/footer>/)[0];
  assert.match(footer, /<a[^>]*href="\/">My CV &amp; Careers<\/a>/);
  assert.match(footer, /Powered by <a[^>]*href="https:\/\/resumis.com">Resumis<\/a>/);
  assert.match(footer, /<a href="\/privacy-policy">Privacy<\/a>/);
  assert.match(footer, /<strong>Made for you<\/strong>/);
  assert.doesNotMatch(footer, /Gary|Telegram|hirelala|&copy;/);
  const privacy = await (await browser.request('/privacy-policy')).text();
  assert.match(privacy, /<title>Privacy Policy - My CV &amp; Careers<\/title>/);
  assert.match(privacy, /<h1>Our Privacy<\/h1>/);
  assert.match(privacy, /<strong>data<\/strong>/);
  assert.match(privacy, /<li>Item two<\/li>/);
  assert.match(privacy, /<a href="https:\/\/example.com\/contact">Contact<\/a>/);
  assert.doesNotMatch(privacy, /Effective Date/);
  const terms = await (await browser.request('/terms-of-service')).text();
  assert.match(terms, /<h1>Our Terms<\/h1>/);
  assert.match(terms, /<em>responsibly<\/em>/);
  assert.match(terms, /<pre><code class="language-text">Example terms/);
  assert.doesNotMatch(terms, /Effective Date|Our Privacy/);
  const editor = await (await browser.request('/create')).text();
  assert.match(editor, /Markdown resume with My CV &amp; Careers/);
  const defaults = await client();
  for (const path of ['/privacy-policy', '/terms-of-service']) {
    assert.match(await (await defaults.request(path)).text(), /Effective Date/);
  }
  assert.doesNotMatch(await (await defaults.request('/')).text(), /My CV|Made for you/);
});

test('Google Analytics uses the configured measurement ID and is otherwise disabled', async () => {
  const configured = await client({}, { ...env, GA_MEASUREMENT_ID: ' G-TEST123456 ' });
  for (const path of ['/', '/create', '/template/project-manager', '/privacy-policy']) {
    const html = await (await configured.request(path)).text();
    assert.match(html, /src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-TEST123456"/);
    assert.match(html, /gtag\('config', "G-TEST123456"\)/);
  }
  for (const id of [undefined, '', '  ', 'invalid', 'G-TEST\');alert(1)//', 'G-TEST</script><script>alert(1)</script>']) {
    const disabled = await client({}, { ...env, GA_MEASUREMENT_ID: id });
    const html = await (await disabled.request('/')).text();
    assert.doesNotMatch(html, /googletagmanager|gtag\(|dataLayer|alert\(1\)/);
  }
  const alternate = await client({}, { ...env, GA_MEASUREMENT_ID: 'G-OTHER12345' });
  const html = await (await alternate.request('/')).text();
  assert.match(html, /gtag\('config', "G-OTHER12345"\)/);
  assert.doesNotMatch(html, /G-TEST123456/);
});

test('empty branding/content uses defaults and HTML is escaped in configured content', async () => {
  const empty = await client({}, { ...env, SITE_NAME: '  ', PRIVACY_POLICY_CONTENT: ' \n ', TERMS_OF_SERVICE_CONTENT: '', FOOTER_CONTENT: '' });
  const home = await (await empty.request('/')).text();
  assert.match(home, /<a[^>]*href="\/">Resumis<\/a>/);
  assert.doesNotMatch(home, /class="footer-content"/);
  for (const path of ['/privacy-policy', '/terms-of-service']) {
    assert.match(await (await empty.request(path)).text(), /Effective Date/);
  }
  const injected = await client({}, { ...env,
    SITE_NAME: '<img src=x onerror=alert(1)>',
    PRIVACY_POLICY_CONTENT: '<script>alert(1)</script>\n\n[Unsafe](javascript:alert(1))',
    FOOTER_CONTENT: '<img src=x onerror=alert(1)> **Footer**',
  });
  const page = await (await injected.request('/privacy-policy')).text();
  assert.match(page, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(page, /<strong>Footer<\/strong>/);
  assert.doesNotMatch(page, /<script>alert\(1\)|<img src=x|href="javascript:/);
});

test('missing routes/templates, methods, HEAD, and OPTIONS', async () => {
  const browser = await client();
  for (const path of ['/missing', '/template/missing', '/create/missing']) assert.equal((await browser.request(path)).status, 404);
  assert.equal((await browser.request('/%zz')).status, 400);
  assert.equal((await browser.request('/', { method: 'POST' })).status, 405);
  assert.equal((await browser.request('/resume/save')).status, 405);
  const head = await browser.request('/create', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const options = await browser.request('/resume/save', { method: 'OPTIONS' });
  assert.match(options.headers.get('Allow'), /POST/);
});

test('public pages work without secrets; login explains missing configuration', async () => {
  const browser = await client({}, {});
  assert.equal((await browser.request('/')).status, 200);
  assert.equal((await browser.request('/auth/login')).status, 503);
});

test('authentication and repository guards preserve navigation and JSON responses', async () => {
  const anonymous = await client();
  for (const path of ['/repos', '/resume', '/resume/edit/CV']) {
    const response = await anonymous.request(path);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), '/');
  }
  const denied = await anonymous.request('/resume/save', { form: { name: 'CV' } });
  assert.equal(denied.status, 401);
  assert.equal((await denied.json()).success, false);
  const signedIn = await client({ user, repo: { full_name: '', branch: '' } });
  assert.equal((await signedIn.request('/resume')).headers.get('Location'), '/repos');
  const noRepo = await signedIn.request('/resume/save', { form: { name: 'CV' } });
  assert.equal((await noRepo.json()).redirectUrl, '/repos');
});

test('GitHub OAuth callback, private email lookup, return URL, and logout', async () => {
  const browser = await client();
  const login = await browser.request('/auth/login', { headers: { Referer: `${origin}/create/project-manager` } });
  const authorize = new URL(login.headers.get('Location'));
  assert.equal(authorize.origin, 'https://github.com');
  assert.equal(authorize.searchParams.get('scope'), 'repo user:email');
  assert.equal(authorize.searchParams.get('redirect_uri'), `${origin}/auth/callback`);
  assert.match(login.headers.get('Set-Cookie'), /HttpOnly; SameSite=Lax; Secure/);
  assert.doesNotMatch(login.headers.get('Set-Cookie'), /test-client-secret/);
  const callback = await browser.request(`/auth/callback?code=valid-code&state=${authorize.searchParams.get('state')}`);
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('Location'), '/create/project-manager');
  assert.deepEqual((await browser.session()).user, user);
  assert.equal((await browser.session()).repo.full_name, '');
  assert.doesNotMatch(callback.headers.get('Set-Cookie'), /test-github-token/);
  assert.equal((await browser.request(`/auth/callback?code=valid-code&state=${authorize.searchParams.get('state')}`)).status, 400);
  const logout = await browser.request('/auth/logout');
  assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.deepEqual(await browser.session(), {});
});

test('OAuth rejects bad, expired, or missing state and external return URLs', async () => {
  const browser = await client();
  await browser.request('/auth/login', { headers: { Referer: 'https://attacker.example/' } });
  assert.equal((await browser.session()).next, '/');
  assert.equal((await browser.request('/auth/callback?state=wrong&code=valid-code')).status, 400);
  assert.equal(browser.mock.calls.length, 0);
  const expired = await client({ oauth: { state: 'old', expires: Date.now() - 1000 } });
  assert.equal((await expired.request('/auth/callback?state=old&code=valid-code')).status, 400);
  assert.equal(expired.mock.calls.length, 0);
  const denied = await client({ oauth: { state: 'valid', expires: Date.now() + 10000 } });
  assert.equal((await denied.request('/auth/callback?state=valid&error=access_denied')).status, 400);
});

test('HTTPS proxy origin is preserved through OAuth, cookies, forms, and page metadata', async () => {
  const mock = githubMock();
  const app = createApp(mock.fetcher);
  const proxyEnv = { ...env, PUBLIC_ORIGIN: origin };
  const internalOrigin = origin.replace('https:', 'http:');
  const login = await app.fetch(new Request(`${internalOrigin}/auth/login`, {
    headers: { Referer: `${origin}/create/project-manager` },
  }), proxyEnv);
  assert.equal(login.status, 302);
  const authorize = new URL(login.headers.get('Location'));
  assert.equal(authorize.searchParams.get('redirect_uri'), `${origin}/auth/callback`);
  assert.match(login.headers.get('Set-Cookie'), /; Secure/);
  const callback = await app.fetch(new Request(`${internalOrigin}/auth/callback?code=valid-code&state=${authorize.searchParams.get('state')}`, {
    headers: { Cookie: login.headers.get('Set-Cookie').split(';')[0] },
  }), proxyEnv);
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('Location'), '/create/project-manager');
  const exchange = mock.calls.find(call => call.url.hostname === 'github.com');
  assert.equal(new URLSearchParams(exchange.body).get('redirect_uri'), `${origin}/auth/callback`);
  const saved = await app.fetch(new Request(`${internalOrigin}/repos/save`, {
    method: 'POST', headers: { Origin: origin, Cookie: callback.headers.get('Set-Cookie').split(';')[0] },
    body: new URLSearchParams({ repo: 'gary/resumes', branch: 'main' }),
  }), proxyEnv);
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).success, true);
  const home = await app.fetch(new Request(`${internalOrigin}/`), proxyEnv);
  assert.match(await home.text(), /href="https:\/\/resumis.example\/"/);
  const local = await app.fetch(new Request('http://localhost:8988/auth/login'), proxyEnv);
  assert.equal(new URL(local.headers.get('Location')).searchParams.get('redirect_uri'), 'http://localhost:8988/auth/callback');
  assert.doesNotMatch(local.headers.get('Set-Cookie'), /; Secure/);
  const untrusted = await app.fetch(new Request(`${internalOrigin}/auth/login`, {
    headers: { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'attacker.example' },
  }), env);
  assert.equal(new URL(untrusted.headers.get('Location')).searchParams.get('redirect_uri'), `${internalOrigin}/auth/callback`);
});

test('Wrangler-rewritten origin headers allow same-site saves and still reject cross-site writes', async () => {
  const mock = githubMock();
  const app = createApp(mock.fetcher);
  const proxyEnv = { ...env, PUBLIC_ORIGIN: origin };
  const internalOrigin = origin.replace('https:', 'http:');
  const cookie = `resumis_session=${await sealSession({ user, repo }, env.SESSION_SECRET)}`;
  const save = (headerOrigin, site = 'same-origin') => app.fetch(new Request(`${internalOrigin}/repos/save`, {
    method: 'POST', headers: { Origin: headerOrigin, Cookie: cookie, 'Sec-Fetch-Site': site },
    body: new URLSearchParams({ repo: 'gary/selected', branch: 'feature/resume' }),
  }), proxyEnv);
  for (const headerOrigin of [origin, internalOrigin]) {
    const response = await save(headerOrigin);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, 'Repo saved');
    const savedCookie = response.headers.get('Set-Cookie').split(';')[0].split('=').slice(1).join('=');
    assert.deepEqual((await openSession(savedCookie, env.SESSION_SECRET)).repo,
      { full_name: 'gary/selected', branch: 'feature/resume' });
  }
  for (const headerOrigin of ['https://attacker.example', 'http://attacker.example', 'null', `${internalOrigin}:8999`]) {
    assert.equal((await save(headerOrigin)).status, 403);
  }
  assert.equal((await save(internalOrigin, 'cross-site')).status, 403);
  const login = await app.fetch(new Request(`${internalOrigin}/auth/login`, {
    headers: { Referer: `${internalOrigin}/create/project-manager` },
  }), proxyEnv);
  const loginCookie = login.headers.get('Set-Cookie').split(';')[0].split('=').slice(1).join('=');
  assert.equal((await openSession(loginCookie, env.SESSION_SECRET)).next, '/create/project-manager');
  assert.equal(mock.calls.length, 0);
});

test('repo/branch selection, pagination, escaped branch script, and persistence', async () => {
  const browser = await client({ user, repo });
  browser.mock.repos.push(...Array.from({ length: 101 }, (_, i) => ({ full_name: `gary/repo-${i}` })));
  const page = await browser.request('/repos');
  const html = await page.text();
  assert.match(html, /gary\/repo-100/);
  assert.match(html, /Gary &amp; Co/);
  assert.match(html, /"feature\/resumes \\u0026 css"/);
  assert.doesNotMatch(html, /test-github-token/);
  const branches = await browser.request('/repos/branches?repo=gary%2Fresumes');
  assert.deepEqual(await branches.json(), browser.mock.branches);
  assert.equal((await browser.request('/repos/branches?repo=')).status, 400);
  assert.equal((await browser.request('/repos/save', { form: { repo: '', branch: '' } })).status, 400);
  const saved = await browser.request('/repos/save', { form: { repo: 'gary/other', branch: 'new-branch' } });
  assert.deepEqual(await saved.json(), { success: true, message: 'Repo saved', data: {}, redirectUrl: '/resume' });
  assert.deepEqual((await browser.session()).repo, { full_name: 'gary/other', branch: 'new-branch' });
});

test('full resume lifecycle with Unicode names/content and branch-scoped GitHub commits', async () => {
  const browser = await client({ user, repo });
  const form = { oldName: '', name: '我的 CV & résumé', content: '# Gary\n\n你好 👋', style: 'body { color: red; }' };
  assert.equal((await browser.request('/resume')).status, 200); // Empty repository.
  const created = await browser.request('/resume/save', { form });
  assert.equal(created.status, 200);
  const result = await created.json();
  assert.equal(result.message, 'Resume created');
  assert.equal(browser.mock.files.get(`${form.name}/resume.md`).content, form.content);
  assert.equal(browser.mock.files.get(`${form.name}/style.css`).content, form.style);
  const edit = await browser.request(result.redirectUrl);
  assert.equal(edit.status, 200);
  assert.match(await edit.text(), /你好 👋/);
  assert.match(await (await browser.request('/resume')).text(), /我的 CV &amp; résumé/);
  assert.equal((await browser.request('/resume/save', { form })).status, 400);
  const writesBefore = browser.mock.calls.filter(call => call.method === 'PUT').length;
  await browser.request('/resume/save', { form: { ...form, oldName: form.name } });
  assert.equal(browser.mock.calls.filter(call => call.method === 'PUT').length, writesBefore);
  const renamed = await browser.request('/resume/save', { form: { ...form, oldName: form.name, name: 'Updated CV', content: '# Updated' } });
  assert.equal((await renamed.json()).message, 'Resume saved');
  assert.equal(browser.mock.files.has(`${form.name}/resume.md`), false);
  assert.equal(browser.mock.files.get('Updated CV/resume.md').content, '# Updated');
  const duplicate = await browser.request('/resume/duplicate', { form: { name: 'Updated CV' } });
  assert.equal((await duplicate.json()).message, 'Resume duplicated');
  assert.equal(browser.mock.files.get('Updated CV_copy/resume.md').content, '# Updated');
  assert.equal((await browser.request('/resume/duplicate', { form: { name: 'Updated CV' } })).status, 400);
  const deleted = await browser.request('/resume/delete', { form: { name: 'Updated CV' } });
  assert.equal((await deleted.json()).message, 'Resume deleted');
  assert.equal(browser.mock.files.has('Updated CV/resume.md'), false);
  assert.equal(browser.mock.files.has('Updated CV_copy/resume.md'), true);
});

test('duplicate and delete include nested files', async () => {
  const browser = await client({ user, repo });
  browser.mock.put('CV/resume.md', '# CV');
  browser.mock.put('CV/style.css', '');
  browser.mock.put('CV/assets/deep/notes.txt', 'Nested file');
  assert.equal((await browser.request('/resume/duplicate', { form: { name: 'CV' } })).status, 200);
  assert.equal(browser.mock.files.get('CV_copy/assets/deep/notes.txt').content, 'Nested file');
  assert.equal((await browser.request('/resume/delete', { form: { name: 'CV' } })).status, 200);
  assert.ok([...browser.mock.files.keys()].every(path => !path.startsWith('CV/')));
});

test('invalid resume requests and rename collisions leave existing files intact', async () => {
  const browser = await client({ user, repo });
  for (const name of ['', '..', '../outside', 'nested/folder']) {
    assert.equal((await browser.request('/resume/save', { form: { name, content: '# CV' } })).status, 400);
  }
  assert.equal((await browser.request('/resume/save', { form: { name: 'CV', content: ' ' } })).status, 400);
  assert.equal((await browser.request('/resume/edit/absent')).status, 404);
  for (const path of ['/resume/duplicate', '/resume/delete']) {
    assert.equal((await browser.request(path, { form: { name: 'absent' } })).status, 404);
  }
  browser.mock.put('A/resume.md', 'Original A');
  browser.mock.put('B/resume.md', 'Original B');
  assert.equal((await browser.request('/resume/save', { form: { oldName: 'A', name: 'B', content: 'Changed' } })).status, 400);
  assert.equal(browser.mock.files.get('A/resume.md').content, 'Original A');
  assert.equal(browser.mock.files.get('B/resume.md').content, 'Original B');
});

test('GitHub auth failures clear the session and flash once for page requests', async () => {
  const browser = await client({ user, repo });
  browser.mock.fail(401, 'Bad credentials');
  const page = await browser.request('/resume');
  assert.equal(page.headers.get('Location'), '/');
  assert.equal((await browser.session()).user, undefined);
  assert.match(await (await browser.request('/')).text(), /Your Github token is invalid/);
  assert.doesNotMatch(await (await browser.request('/')).text(), /Your Github token is invalid/);
  const api = await client({ user, repo });
  api.mock.fail(401, 'Bad credentials');
  const response = await api.request('/resume/save', { form: { name: 'CV', content: '# CV' } });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).redirectUrl, '/');
  assert.deepEqual(await api.session(), {});
});

test('GitHub permission errors and failed writes never report success', async () => {
  const browser = await client({ user, repo });
  browser.mock.fail(403, 'Resource not accessible');
  const response = await browser.request('/resume/save', { form: { name: 'CV', content: '# CV' } });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).success, false);
  assert.equal(browser.mock.files.size, 0);
  const failedWrite = await client({ user, repo });
  failedWrite.mock.fail(409, 'SHA conflict', 'PUT');
  const conflict = await failedWrite.request('/resume/save', { form: { name: 'CV', content: '# CV' } });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).success, false);
  assert.equal(failedWrite.mock.calls.filter(call => call.method === 'PUT').length, 1);
  assert.equal(failedWrite.mock.files.size, 0);
});

test('cross-origin writes are rejected before GitHub requests', async () => {
  const browser = await client({ user, repo });
  const response = await browser.request('/resume/delete', { form: { name: 'CV' }, headers: { Origin: 'https://elsewhere.example' } });
  assert.equal(response.status, 403);
  assert.equal(browser.mock.calls.length, 0);
});

test('encrypted sessions reject tampering, wrong keys, expiration, and oversized input', async () => {
  const data = { user, repo };
  const token = await sealSession(data, env.SESSION_SECRET, 1000);
  assert.deepEqual(await openSession(token, env.SESSION_SECRET, 2000), data);
  assert.deepEqual(await openSession(token, 'a-different-secret-of-more-than-32-characters', 2000), {});
  const [iv, body] = token.split('.');
  assert.deepEqual(await openSession(`${iv}.${body[0] === 'A' ? 'B' : 'A'}${body.slice(1)}`, env.SESSION_SECRET, 2000), {});
  assert.deepEqual(await openSession(token, env.SESSION_SECRET, 32 * 86400 * 1000), {});
  assert.deepEqual(await openSession('x'.repeat(5000), env.SESSION_SECRET), {});
  assert.deepEqual(await openSession('invalid', env.SESSION_SECRET), {});
});
