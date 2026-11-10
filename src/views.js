import nunjucks from 'nunjucks/browser/nunjucks-slim.js';
import templates from './generated/templates.js';
import { renderMarkdown, siteName } from './content.js';

const renderer = new nunjucks.Environment(new nunjucks.PrecompiledLoader(templates), { autoescape: true });
const routes = {
  'home.home': '/', 'home.create': '/create', 'home.privacy_policy': '/privacy-policy',
  'home.terms_of_service': '/terms-of-service', 'auth.login': '/auth/login',
  'auth.callback': '/auth/callback', 'auth.logout': '/auth/logout',
  'repo.get_repos': '/repos', 'repo.get_branches': '/repos/branches', 'repo.save': '/repos/save',
  'resume.get_resumes': '/resume', 'resume.save': '/resume/save',
  'resume.duplicate': '/resume/duplicate', 'resume.delete': '/resume/delete',
};

export const toSlug = name => name.toLowerCase().replaceAll(' ', '-');
export function fromSlug(slug) {
  return slug.replaceAll('-', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase()).replaceAll('Devops', 'DevOps');
}

export function urlFor(endpoint, options = {}, origin = '') {
  let path = routes[endpoint];
  if (endpoint === 'static') path = `/static/${options.filename}`;
  if (endpoint === 'home.template') path = `/template/${encodeURIComponent(options.slug)}`;
  if (endpoint === 'home.create_from_template') path = `/create/${encodeURIComponent(options.template_slug)}`;
  if (endpoint === 'resume.edit') path = `/resume/edit/${encodeURIComponent(options.name)}`;
  if (!path) throw new Error(`Unknown endpoint ${endpoint}`);
  return options._external ? `${origin}${path}` : path;
}

// JSON used inside script elements must escape HTML delimiters too.
renderer.addFilter('tojson', value => new nunjucks.runtime.SafeString(JSON.stringify(value ?? '')
  .replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
  .replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')));

export function render(name, context, request, session, env = {}) {
  const url = new URL(request.url);
  const gaMeasurementId = env.GA_MEASUREMENT_ID?.trim() || '';
  const messages = session.messages || [];
  delete session.messages;
  const html = renderer.render(name, {
    sitename: siteName(env), footer_html: renderMarkdown(env.FOOTER_CONTENT),
    ga_measurement_id: /^G-[A-Z0-9]+$/.test(gaMeasurementId) ? gaMeasurementId : '',
    user: session.user || null, repo: session.repo || null,
    base_url: `${url.origin}${url.pathname}`, now: { year: new Date().getUTCFullYear() },
    request: { path: url.pathname }, seo: { title: '', keywords: '', description: '', canonical: '' },
    url_for: (endpoint, options) => urlFor(endpoint, options, url.origin),
    to_slug: toSlug, from_slug: fromSlug, get_flashed_messages: () => messages,
    ...context,
  });
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
