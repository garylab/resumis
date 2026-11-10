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

Configure secrets in `.dev.vars` and public settings in `wrangler.jsonc` under `vars`. For local development, you can also override public settings in your untracked `.dev.vars` file.

| Variable | Type | Value |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | Plaintext | Required for sign-in: GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Secret | Required for sign-in: GitHub OAuth app client secret |
| `SESSION_SECRET` | Secret | Required for sign-in: random secret, generate with `openssl rand -hex 32` |
| `PUBLIC_ORIGIN` | Plaintext | Optional HTTPS proxy origin, e.g. `https://dev.resumis.com` |
| `SITE_NAME` | Plaintext | Optional site title and branding; default `Resumis` |
| `GA_MEASUREMENT_ID` | Plaintext | Optional Google Analytics measurement ID, e.g. `G-XXXXXXXXXX`; unset, empty, or invalid disables analytics |
| `PRIVACY_POLICY_CONTENT` | Plaintext | Optional Markdown for `/privacy-policy`; unset or empty keeps the original page |
| `TERMS_OF_SERVICE_CONTENT` | Plaintext | Optional Markdown for `/terms-of-service`; unset or empty keeps the original page |
| `FOOTER_CONTENT` | Plaintext | Optional Markdown appended to the footer |

Footer: `{SITE_NAME} Powered by Resumis {FOOTER_CONTENT}`, with **SITE_NAME** linking to the current site's homepage and **Powered by Resumis** linking to https://resumis.com. Markdown supports headings, lists, and links; raw HTML is escaped. Use double-quoted `\n` for newlines in `.dev.vars`, for example:

```dotenv
PRIVACY_POLICY_CONTENT="# Privacy Policy\n\nYour privacy policy."
FOOTER_CONTENT="[Privacy](/privacy-policy) · [Terms](/terms-of-service)"
```

On Cloudflare, these public settings are plaintext Worker variables. Optional settings are commented examples in `wrangler.jsonc`, so they are omitted from deployment prompts and the app uses its defaults. Add only the ones you need under your Worker's **Settings → Variables and Secrets** as **Text**, or under `vars` in your deployed repository's `wrangler.jsonc`. `keep_vars: true` preserves dashboard variables that are not declared in `vars`; explicitly declared values still take precedence on deployment. See [Wrangler's configuration documentation](https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth).

`.dev.vars.example` lists only the two secrets needed for sign-in. The editor and PDF export work without any credentials; the deployment button prompts for credentials to enable GitHub saving.

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
- The last saved repository and branch are remembered in this browser for 31 days, including after logout or browser restart. On sign-in with the same GitHub account, the app restores them if the branch is still accessible. The encrypted preference cookie contains no GitHub token; clearing site cookies forgets the selection.
- Files stay in your repository as `<resume name>/resume.md` and `style.css`.

Existing GitHub resumes work unchanged. Sign in again when switching from Flask.

## Deploy

Use the **Deploy to Cloudflare** button above, then configure `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and a random `SESSION_SECRET` for your Worker. See [Cloudflare's deploy button documentation](https://developers.cloudflare.com/workers/platform/deploy-buttons/) for the setup flow.

For manual deployment, set `GITHUB_CLIENT_ID` and any other public settings in `wrangler.jsonc` under `vars`, then authenticate and configure the two production secrets from the repository root:

```sh
npx wrangler login
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
npm run deploy
```

Wrangler may offer to create the Worker when setting the first secret. Register the production OAuth callback as `https://<your-host>/auth/callback`.

For Cloudflare Git builds, use the **repository root** and deploy command **`npm run deploy`**. Attach a custom domain in Cloudflare if needed.

If you deployed an earlier version that classified all settings as secrets, save your public setting values, remove their secret entries under your Worker's **Settings → Variables and Secrets**, and put those values in your deployed repository's `wrangler.jsonc` under `vars` before redeploying. Keep `GITHUB_CLIENT_SECRET` and `SESSION_SECRET` as secrets. Updating this template does not automatically reclassify an existing Worker's bindings.

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
