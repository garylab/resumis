import { execFileSync } from 'node:child_process';
import { render, urlFor } from '../src/views.js';
import { resumes, css } from '../src/generated/data.js';

// This optional check needs the parent Python source and uv. It is not part of
// the standalone application's normal build or Node test suite.
const routes = Object.fromEntries([
  'home.home', 'home.create', 'home.privacy_policy', 'home.terms_of_service',
  'auth.login', 'auth.logout', 'repo.get_repos', 'repo.get_branches', 'repo.save',
  'resume.get_resumes', 'resume.save', 'resume.duplicate', 'resume.delete',
].map(endpoint => [endpoint, urlFor(endpoint)]));
const cases = [];
async function add(template, label, extra = {}, session = {}) {
  const request = new Request('https://resumis.example/');
  const context = {
    sitename: 'Resumis', user: session.user || null, repo: session.repo || null,
    base_url: request.url, now: { year: new Date().getUTCFullYear() }, request: { path: '/' },
    seo: { title: 'Test', keywords: 'markdown resume', description: 'Test description', canonical: request.url },
    ...extra,
  };
  cases.push({ template, label, context, actual: await render(template, context, request, session).text() });
}
await add('home.html', 'home', { template_names: Object.keys(resumes), css });
// The visual editor and isolated template previews are covered by browser tests.
await add('privacy-policy.html', 'privacy');
await add('terms-of-service.html', 'terms');
await add('resumes.html', 'saved resumes', { resumes: ['My CV', 'Unicode résumé'] }, {
  user: { name: 'Gary & Co' }, repo: { full_name: 'gary/resumes', branch: 'main' },
});
console.log(execFileSync('uv', ['run', '--with', 'Jinja2==3.1.6', 'python', 'test/python-reference.py'], {
  input: JSON.stringify({ cases, routes }), encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
}).trim());
