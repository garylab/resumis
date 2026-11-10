import { Github, GithubError } from './github.js';
import { loadSession, saveSession } from './session.js';
import { render, fromSlug, urlFor } from './views.js';
import { resumes, css } from './generated/data.js';
import { publicRequest } from './origin.js';
import { renderMarkdown, siteName } from './content.js';

const success = (message = 'Success', redirectUrl = '') => Response.json({ success: true, message, data: {}, redirectUrl });
const error = (message, status = 400, redirectUrl = '') => Response.json({ success: false, message, redirectUrl }, { status });
const redirect = location => new Response(null, { status: 302, headers: { Location: location } });
const text = (message, status = 200, headers = {}) => new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers } });
const getRoutes = new Set(['/', '/health', '/robots.txt', '/create', '/privacy-policy', '/terms-of-service',
  '/auth/login', '/auth/callback', '/auth/logout', '/repos', '/repos/branches', '/resume']);
const postRoutes = new Set(['/repos/save', '/resume/save', '/resume/duplicate', '/resume/delete']);
const validName = name => name && name !== '.' && name !== '..' && !/[/\\\u0000-\u001f\u007f]/.test(name);
const editUrl = name => urlFor('resume.edit', { name });

function safeReturnUrl(value, origin) {
  try {
    const url = new URL(value, origin);
    return url.origin === origin && !url.pathname.startsWith('/auth/')
      ? `${url.pathname}${url.search}${url.hash}` : '/';
  } catch { return '/'; }
}

function seo(title, keywords = '', description = '', canonical = '') {
  return { title, keywords, description, canonical };
}

export function createApp(fetcher = (...args) => fetch(...args)) {
  return {
    async fetch(request, env) {
      try { request = publicRequest(request, env); }
      catch { return text('PUBLIC_ORIGIN must be a valid HTTP(S) origin without a path.', 503); }
      const url = new URL(request.url);
      if (url.pathname.startsWith('/static/')) {
        return env.ASSETS ? env.ASSETS.fetch(request) : text('Not Found', 404);
      }
      let session = await loadSession(request, env);
      const before = JSON.stringify(session);
      const isApi = postRoutes.has(url.pathname) || url.pathname === '/repos/branches';
      let response;
      try {
        response = await dispatch();
      } catch (cause) {
        if (cause instanceof GithubError && cause.status === 401) {
          session = {};
          const message = 'Your Github token is invalid. Please login again';
          if (isApi) response = error(message, 401, '/');
          else {
            session.messages = [message];
            response = redirect('/');
          }
        } else if (cause instanceof GithubError) {
          const status = cause.status >= 400 && cause.status < 500 ? cause.status : 502;
          response = isApi ? error(cause.message, status) : text(cause.message, status);
        } else {
          // Never log session values, authorization headers, or token exchange bodies.
          console.error('Resumis request failed:', cause.name);
          response = isApi ? error('Unable to complete the request. Please try again.', 500)
            : text('Unable to complete the request. Please try again.', 500);
        }
      }
      try {
        if (before !== JSON.stringify(session)) response = await saveSession(response, session, request, env);
      } catch {
        response = isApi ? error('Session configuration is invalid', 503) : text('Session configuration is invalid', 503);
      }
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'private, no-store');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });

      async function dispatch() {
        let path;
        try { path = decodeURIComponent(url.pathname); }
        catch { return text('Invalid URL', 400); }
        const method = request.method;
        const templateMatch = /^\/template\/([^/]+)$/.exec(path);
        const createMatch = /^\/create\/([^/]+)$/.exec(path);
        const editMatch = /^\/resume\/edit\/([^/]+)$/.exec(path);
        const isGetRoute = getRoutes.has(path) || templateMatch || createMatch || editMatch;
        const isPostRoute = postRoutes.has(path);
        if (!isGetRoute && !isPostRoute) return text('Not Found', 404);
        const allow = isPostRoute ? 'POST, OPTIONS' : 'GET, HEAD, OPTIONS';
        if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: allow } });
        if (isPostRoute ? method !== 'POST' : !['GET', 'HEAD'].includes(method)) {
          return text('Method Not Allowed', 405, { Allow: allow });
        }
        if (method === 'POST') {
          const origin = request.headers.get('Origin');
          if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
            return error('Invalid request origin', 403);
          }
        }
        const page = (name, context = {}) => render(name, context, request, session, env);
        if (path === '/health') return Response.json({ alive: true });
        if (path === '/robots.txt') return text('\nUser-agent: *\nDisallow: /auth\n');
        if (path === '/') return page('home.html', { template_names: Object.keys(resumes), css });
        if (templateMatch) {
          const resume = resumes[fromSlug(templateMatch[1])];
          return resume ? page('template.html', { resume: { ...resume, css } }) : text('Not Found', 404);
        }
        if (path === '/create' || createMatch) {
          const resume = createMatch ? resumes[fromSlug(createMatch[1])] : null;
          if (createMatch && !resume) return text(`Template ${fromSlug(createMatch[1])} not found`, 404);
          const name = resume?.name || 'Untitled Resume';
          return page('resume.html', {
            old_name: '', name, content: resume?.content || '', style: resume ? css : '',
            seo: resume ? seo(`Create a ${name} Markdown Resume from Template Online`,
              `${name} resume, markdown resume, resume builder, Github`,
              `Create a ${name} Markdown resume with ${siteName(env)}. Easily build and customize resume and save it to your own Github repository.`,
              `${url.origin}${url.pathname}`)
              : seo('Create a blank Markdown Resume Online', 'markdown resume, resume builder, Github',
                `Create a blank Markdown resume with ${siteName(env)}. Easily build and customize resume and save it to your own Github repository.`,
                `${url.origin}/create`),
          });
        }
        if (path === '/privacy-policy' || path === '/terms-of-service') {
          const title = path === '/privacy-policy' ? 'Privacy Policy' : 'Terms of Service';
          const content = path === '/privacy-policy' ? env.PRIVACY_POLICY_CONTENT : env.TERMS_OF_SERVICE_CONTENT;
          const policyHtml = renderMarkdown(content);
          return page(policyHtml ? 'policy.html' : `${path.slice(1)}.html`, {
            policy_html: policyHtml,
            seo: seo(title, `${title.toLowerCase()}, Github, markdown resume`, title, `${url.origin}${path}`),
          });
        }
        if (path === '/auth/logout') {
          session = {};
          return redirect('/');
        }
        if (path === '/auth/login') {
          if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
            return text('Configure GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and SESSION_SECRET before signing in.', 503);
          }
          const state = crypto.randomUUID();
          session.oauth = { state, expires: Date.now() + 600_000 };
          session.next = safeReturnUrl(request.headers.get('Referer') || '/', url.origin);
          const authorize = new URL('https://github.com/login/oauth/authorize');
          authorize.search = new URLSearchParams({
            client_id: env.GITHUB_CLIENT_ID, redirect_uri: `${url.origin}/auth/callback`,
            scope: 'repo user:email', state,
          }).toString();
          return redirect(authorize.href);
        }
        if (path === '/auth/callback') {
          const oauth = session.oauth;
          delete session.oauth;
          if (!oauth || oauth.expires < Date.now() || url.searchParams.get('state') !== oauth.state) {
            return text('Invalid or expired OAuth state. Please sign in again.', 400);
          }
          if (url.searchParams.has('error')) return text('GitHub authorization was declined. Please sign in again.', 400);
          const code = url.searchParams.get('code');
          if (!code) return text('Missing authorization code', 400);
          const tokenResponse = await fetcher('https://github.com/login/oauth/access_token', {
            method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET,
              code, redirect_uri: `${url.origin}/auth/callback` }).toString(),
          });
          const token = await tokenResponse.json();
          if (!tokenResponse.ok || !token.access_token) return text('GitHub authentication failed. Please sign in again.', 502);
          const github = new Github({ user: { token: token.access_token } }, fetcher);
          const user = await github.request('GET', '/user');
          if (!user.email) {
            const emails = await github.request('GET', '/user/emails');
            user.email = emails.find(email => email.primary)?.email || null;
          }
          const next = safeReturnUrl(session.next || '/', url.origin);
          session = {
            user: { id: user.id, username: user.login, name: user.name, email: user.email, token: token.access_token },
            repo: { full_name: '', branch: '' },
          };
          return redirect(next);
        }

        // All remaining endpoints require GitHub sign-in.
        if (!session.user) return isApi ? error('Please login to continue', 401, '/') : redirect('/');
        const github = new Github(session, fetcher);
        if (path === '/repos') return page('repos.html', { selected_repo: session.repo || {}, repos: await github.repos() });
        if (path === '/repos/branches') {
          const repo = (url.searchParams.get('repo') || '').trim();
          if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) return error('Invalid repo name');
          return Response.json(await github.branches(repo));
        }
        let form;
        if (method === 'POST') {
          try { form = await request.formData(); }
          catch { return error('Invalid form data'); }
        }
        const field = name => typeof form?.get(name) === 'string' ? form.get(name) : '';
        if (path === '/repos/save') {
          const full_name = field('repo').trim();
          const branch = field('branch').trim();
          if (!/^[^/\s]+\/[^/\s]+$/.test(full_name) || !branch) return error('Invalid repo name or branch name');
          session.repo = { full_name, branch };
          return success('Repo saved', '/resume');
        }
        if (!session.repo?.full_name || !session.repo?.branch) {
          return isApi ? error('Please select your Github Repo and branch', 401, '/repos') : redirect('/repos');
        }
        if (path === '/resume') {
          return page('resumes.html', { resumes: (await github.list()).filter(item => item.type === 'dir').map(item => item.name) });
        }
        if (editMatch) {
          const name = editMatch[1];
          if (!validName(name) || !await github.has(name)) return text('Not Found', 404);
          const [content, style] = await Promise.all([github.read(`${name}/resume.md`), github.read(`${name}/style.css`)]);
          return page('resume.html', { seo: seo('Edit Resume'), old_name: name, name, content, style });
        }
        const name = field('name').trim();
        if (path === '/resume/save') {
          const oldName = field('oldName').trim();
          const content = field('content');
          const style = field('style');
          if (!validName(name) || !content.trim() || (oldName && !validName(oldName))) return error('Invalid name or content');
          if (!oldName) {
            if (await github.has(name)) return error('Resume already exists');
            await github.create(`${name}/resume.md`, content);
            await github.create(`${name}/style.css`, style);
            return success('Resume created', editUrl(name));
          }
          if (oldName !== name && await github.has(name)) return error('Resume already exists');
          await github.update(`${oldName}/resume.md`, content);
          await github.update(`${oldName}/style.css`, style);
          if (oldName !== name) {
            await github.duplicate(oldName, name);
            await github.remove(oldName);
          }
          return success('Resume saved', editUrl(name));
        }
        if (!validName(name) || !await github.has(name)) return error('No such resume', 404);
        if (path === '/resume/duplicate') {
          if (await github.has(`${name}_copy`)) return error('Resume already exists');
          await github.duplicate(name, `${name}_copy`);
          return success('Resume duplicated', '/resume');
        }
        await github.remove(name);
        return success('Resume deleted', '/resume');
      }
    },
  };
}

export default createApp();
