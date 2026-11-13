import { execFileSync } from 'node:child_process';
import { readFile, readdir, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import nunjucks from 'nunjucks';
import { PRESETS, PRESET_ICONS, updateStyle } from '../public/static/js/style-settings.js';
import { buildFonts } from './fonts.mjs';

// One quick style per resume template, so the gallery shows what each looks like.
const styles = {
  'Data Scientist': 'Classic',
  'Full Stack Engineer': 'Modern',
  'Machine Learning Engineer': 'Academic',
  'Project Manager': 'Executive',
  'Senior Backend Engineer': 'Developer',
  'Senior Data Engineer': 'Romantic',
  'Senior DevOps Engineer': 'Compact',
  'Senior Frontend Engineer': 'Designer',
};

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(`${root}public/static/vendor/dompurify`, { recursive: true });
await Promise.all(['dist/purify.es.mjs', 'LICENSE'].map(file => copyFile(
  `${root}node_modules/dompurify/${file}`, `${root}public/static/vendor/dompurify/${file.split('/').at(-1)}`,
)));
// Generate local assets with the installed Tailwind and Lucide packages.
execFileSync(process.execPath, [`${root}node_modules/@tailwindcss/cli/dist/index.mjs`,
  '-i', `${root}styles/tailwind.css`, '-o', `${root}public/static/css/tailwind.css`, '--minify'], { stdio: 'inherit' });
const iconNames = ['house', 'download', 'pencil', 'git-branch', 'log-in', 'file-text',
  'external-link', 'copy', 'trash-2', 'menu', 'x', 'chevron-down', 'circle-alert', ...Object.values(PRESET_ICONS)];
const symbols = await Promise.all([...new Set(iconNames)].map(async name => {
  const svg = await readFile(`${root}node_modules/lucide-static/icons/${name}.svg`, 'utf8');
  return `<symbol id="${name}" viewBox="0 0 24 24">${svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)[1]}</symbol>`;
}));
const iconLicense = await readFile(`${root}node_modules/lucide-static/LICENSE`, 'utf8');
await writeFile(`${root}public/static/img/icons.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg"><desc>${iconLicense.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</desc>${symbols.join('')}</svg>`);
const output = `${root}src/generated`;
await mkdir(output, { recursive: true });

// Compile at build time: Workers do not permit runtime code generation.
const names = (await readdir(`${root}templates`, { recursive: true }))
  .filter(name => name.endsWith('.html')).sort();
let compiled = 'const templates = {};\n';
for (const name of names) {
  let source = await readFile(`${root}templates/${name}`, 'utf8');
  // The copied Flask/Jinja templates need only these syntax adaptations.
  source = source.replace(/\b_external=True\b/g, '_external=true')
    .replace('{% with messages = get_flashed_messages() %}', '{% set messages = get_flashed_messages() %}')
    .replace('{% if messages %}', '{% if messages | length %}')
    .replace('{% endwith %}', '');
  compiled += nunjucks.precompileString(source, {
    name,
    wrapper: entries => entries.map(entry =>
      `templates[${JSON.stringify(entry.name)}] = (function () {\n${entry.template}\n})();\n`).join(''),
  });
}
await writeFile(`${output}/templates.js`, `${compiled}\nexport default templates;\n`);

const markdown = new MarkdownIt({ html: false });
markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  tokens[index].attrSet('rel', 'noopener noreferrer nofollow');
  tokens[index].attrSet('target', '_blank');
  return renderer.renderToken(tokens, index, options);
};
const files = (await readdir(`${root}data/resumes`)).filter(name => name.endsWith('.md')).sort();
const css = await readFile(`${root}data/default.css`, 'utf8');
const resumes = {};
for (const file of files) {
  const name = file.slice(0, -3);
  const style = PRESETS[styles[name]];
  if (!style) throw new Error(`No quick style is assigned to the ${name} template`);
  const content = await readFile(`${root}data/resumes/${file}`, 'utf8');
  resumes[name] = { name, content, html: markdown.render(content), css: updateStyle(css, style) };
}
await writeFile(`${output}/data.js`, `export const resumes = ${JSON.stringify(resumes)};\nexport const css = ${JSON.stringify(css)};\n`);
const faces = await buildFonts(root);
console.log(`Built ${names.length} page templates, ${files.length} resume templates, and ${faces} self-hosted font faces.`);
