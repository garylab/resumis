import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';

const root = fileURLToPath(new URL('../', import.meta.url));
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

const rendered = JSON.parse(await readFile(`${root}data/rendered.json`, 'utf8'));
const resumes = {};
for (const [name, snapshot] of Object.entries(rendered)) {
  const bytes = await readFile(`${root}data/resumes/${name}.md`);
  if (createHash('sha256').update(bytes).digest('hex') !== snapshot.sha256) {
    throw new Error(`Preview for ${name} is stale. Run scripts/render-markdown.py with markdown==3.6.`);
  }
  resumes[name] = { name, content: bytes.toString('utf8'), html: snapshot.html };
}
const files = (await readdir(`${root}data/resumes`)).filter(name => name.endsWith('.md'));
if (files.length !== Object.keys(resumes).length) {
  throw new Error('Template list changed. Run scripts/render-markdown.py with markdown==3.6.');
}
const css = await readFile(`${root}data/default.css`, 'utf8');
await writeFile(`${output}/data.js`, `export const resumes = ${JSON.stringify(resumes)};\nexport const css = ${JSON.stringify(css)};\n`);
console.log(`Built ${names.length} page templates and ${files.length} resume templates.`);
