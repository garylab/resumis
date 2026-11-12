// Resume fonts are served from our own origin: the build downloads them once and
// writes a stylesheet, so neither the site nor a resume preview calls Google.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

// Chrome's user agent is what makes Google Fonts answer with woff2.
const AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FAMILIES = [
  { family: 'Inter', weights: [400, 700] },
  { family: 'Roboto', weights: [400, 700] },
  { family: 'Lato', weights: [400, 700] },
  { family: 'Open Sans', weights: [400, 700] },
  { family: 'Source Sans 3', weights: [400, 700] },
  { family: 'IBM Plex Sans', weights: [400, 700] },
  { family: 'Montserrat', weights: [400, 700] },
  // The site's own typeface needs the weights the pages ask for.
  { family: 'Poppins', weights: [300, 400, 500, 600, 700] },
  { family: 'Noto Sans SC', weights: [400, 700] },
];

const url = ({ family, weights }) =>
  `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights.join(';')}&display=swap`;

async function get(address, type) {
  const response = await fetch(address, { headers: { 'User-Agent': AGENT } });
  if (!response.ok) throw new Error(`${address} answered ${response.status}`);
  return type === 'text' ? response.text() : Buffer.from(await response.arrayBuffer());
}

export async function buildFonts(root) {
  const directory = `${root}public/static/fonts`;
  await mkdir(directory, { recursive: true });
  const present = new Set(await readdir(directory));
  let css = '';
  let ui = '';
  try {
    for (const entry of FAMILIES) {
      let sheet = await get(url(entry), 'text');
      for (const address of [...new Set(sheet.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) || [])]) {
        const file = `${entry.family.toLowerCase().replaceAll(' ', '-')}-${address.split('/').pop()}`;
        if (!present.has(file)) {
          await writeFile(`${directory}/${file}`, await get(address));
          present.add(file);
        }
        sheet = sheet.replaceAll(address, `/static/fonts/${file}`);
      }
      css += `${sheet}\n`;
      // The site's own pages only need their interface typeface.
      if (entry.family === 'Poppins') ui = sheet;
    }
  } catch (cause) {
    // Keep offline builds working once the files have been downloaded.
    if (!present.has('fonts.css')) throw new Error(`Unable to download the fonts: ${cause.message}`);
    console.warn(`Reusing the downloaded fonts: ${cause.message}`);
    return (await readFile(`${directory}/fonts.css`, 'utf8')).match(/@font-face/g).length;
  }
  await writeFile(`${directory}/fonts.css`, css);
  await writeFile(`${directory}/ui.css`, ui);
  return css.match(/@font-face/g).length;
}
