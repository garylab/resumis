<div align="center">

# Resumis · Cloudflare

### Build Markdown resumes. Save them to your own GitHub.

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/garylab/resumis)

[Quick start](#quick-start) · [Features](#features) · [Deploy](#deploy) · [Development](#development)

</div>

---

The Cloudflare Workers version of Resumis, preserving the Python app’s interface and GitHub storage. No database or Python server required.

## Quick start

Requires **Node.js 22+** and npm.

```sh
cd resumis
npm ci
cp -n .dev.vars.example .dev.vars
```

Configure `.dev.vars`:

| Variable | Value |
| --- | --- |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `SESSION_SECRET` | Random secret: generate with `openssl rand -hex 32` |
| `PUBLIC_ORIGIN` | Optional HTTPS proxy origin, e.g. `https://dev.resumis.com` |
| `SITE_NAME` | Site title and branding; default `Resumis` |
| `GA_MEASUREMENT_ID` | Optional Google Analytics measurement ID, e.g. `G-XXXXXXXXXX`; unset, empty, or invalid disables analytics |
| `PRIVACY_POLICY_CONTENT` | Markdown for `/privacy-policy`; empty keeps the original page |
| `TERMS_OF_SERVICE_CONTENT` | Markdown for `/terms-of-service`; empty keeps the original page |
| `FOOTER_CONTENT` | Optional Markdown appended to the footer |

Footer: `{SITE_NAME} Powered by Resumis {FOOTER_CONTENT}`, with **SITE_NAME** linking to the current site's homepage and **Powered by Resumis** linking to https://resumis.com. Markdown supports headings, lists, and links; raw HTML is escaped. Use double-quoted `\n` for newlines in `.dev.vars`, for example:

```dotenv
PRIVACY_POLICY_CONTENT="# Privacy Policy\n\nYour privacy policy."
FOOTER_CONTENT="[Privacy](/privacy-policy) · [Terms](/terms-of-service)"
```

On Cloudflare, configure these optional values as Worker variables, or in `wrangler.jsonc` under `vars`.

```sh
npm run dev
```

Open **http://localhost:8988**. Port **8988** is fixed in `wrangler.jsonc`.

Register your GitHub OAuth callback as `<your-origin>/auth/callback`:

- Local: `http://localhost:8988/auth/callback`
- HTTPS proxy: `https://dev.resumis.com/auth/callback` with `PUBLIC_ORIGIN=https://dev.resumis.com`

Start sign-in from that same origin. The editor and PDF export work without signing in; saving requires GitHub.

## Features

- Eight resume templates, Markdown/CSS editing, and live preview.
- PDF export through the browser’s **Save as PDF** option.
- GitHub sign-in, repository/branch selection, and resume creation, editing, renaming, duplication, and deletion.
- Files stay in your repository as `<resume name>/resume.md` and `style.css`.

Existing GitHub resumes work unchanged. Sign in again when switching from Flask.

## Deploy

Use the **Deploy to Cloudflare** button above, then configure `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and a random `SESSION_SECRET` for your Worker. See [Cloudflare's deploy button documentation](https://developers.cloudflare.com/workers/platform/deploy-buttons/) for the setup flow.

For manual deployment, authenticate and configure production secrets from the repository root:

```sh
npx wrangler login
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
npm run deploy
```

Wrangler may offer to create the Worker when setting the first secret. Register the production OAuth callback as `https://<your-host>/auth/callback`.

For Cloudflare Git builds, use the **repository root** and deploy command **`npm run deploy`**. Attach a custom domain in Cloudflare if needed.

## Development

```sh
npm test                         # Backend and GitHub contract tests
npm run check                    # Deployment dry run
npx playwright install chromium
npm run test:browser              # Browser checks in local Wrangler
```

Tests mock GitHub; real sign-in requires your OAuth app. Health endpoint: `/health`.

<details>
<summary>Updating templates and checking Python parity</summary>

Edit `templates/` for pages, `public/static/` for assets, and `data/resumes/` for built-in resumes. Every build converts resume Markdown directly to HTML with JavaScript (`markdown-it`); no Python or preview snapshots are required:

```sh
npm run build
```

The optional `npm run test:parity` check requires the parent Python project and `uv`. It compares 21 rendered pages against the original templates, excluding the customized footer and configurable analytics; it is not used for Markdown conversion, builds, or deployment.

</details>
