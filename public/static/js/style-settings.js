// Visual adjustments are stored alongside the original CSS, so old resumes keep their styles.
export const FONTS = {
  'Times New Roman': "'Times New Roman', 'Hiragino Sans GB', 'Microsoft YaHei', serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  Arial: 'Arial, Helvetica, sans-serif',
  Verdana: 'Verdana, Geneva, sans-serif',
  'Trebuchet MS': "'Trebuchet MS', Arial, sans-serif",
  'Courier New': "'Courier New', monospace",
  // Served from /static/fonts, downloaded at build time.
  Inter: "Inter, 'Helvetica Neue', Arial, sans-serif",
  Roboto: 'Roboto, Arial, sans-serif',
  Lato: "Lato, 'Helvetica Neue', Arial, sans-serif",
  'Open Sans': "'Open Sans', Arial, sans-serif",
  'Source Sans 3': "'Source Sans 3', 'Source Sans Pro', Arial, sans-serif",
  'IBM Plex Sans': "'IBM Plex Sans', Arial, sans-serif",
  Montserrat: "Montserrat, 'Helvetica Neue', Arial, sans-serif",
  Poppins: "Poppins, 'Helvetica Neue', Arial, sans-serif",
  'Noto Sans SC': "'Noto Sans SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
};

// Float the photo paragraph as a unit, so its empty wrapper cannot leave a gap.
const photoImage = ':is(img[data-resume-photo], img[src="photo.jpg"])';
const standalonePhoto = `body > p:has(> ${photoImage}:only-child)`;
const headerPhoto = `body > p:first-child:has(> ${photoImage}:only-child)`;
const photoLayout = position => `/* Photo layout */
${photoImage} {
  display: block; width: var(--photo-size, 28mm); height: var(--photo-size, 28mm);
  max-width: 100%; object-fit: cover; border-radius: var(--photo-shape-radius, var(--photo-radius, 2mm));
}
${standalonePhoto} {
  float: var(--photo-position, none); width: var(--photo-size, 28mm); max-width: 100%;
  margin: ${position === 'left' ? '0 6mm 4mm 0' : position === 'right' ? '0 0 4mm 6mm' : '0 auto 4mm'};
  padding: 0; line-height: 0; break-inside: avoid;
}
${headerPhoto} ~ h1, ${headerPhoto} ~ h1 + p { display: flow-root; }
${headerPhoto} ~ h2 { clear: both; }`;

export const SETTINGS = [
  { key: 'photoSize', group: 'Photo', variable: '--photo-size', type: 'range', min: 16, max: 40, unit: 'mm', value: 26, rules: `${photoImage} { width: var(--photo-size); height: var(--photo-size); }` },
  { key: 'photoRadius', group: 'Photo', variable: '--photo-radius', type: 'range', min: 0, max: 20, unit: 'mm', value: 2, rules: `${photoImage} { border-radius: var(--photo-radius); }` },
  { key: 'photoShape', group: 'Photo', variable: '--photo-shape-radius', type: 'switch', options: { '2mm': 'Square', '50%': 'Circle' }, value: '2mm', rules: `${photoImage} { border-radius: var(--photo-shape-radius); }` },
  { key: 'paper', label: 'Paper size', group: 'Paper Size', variable: '--page-size', type: 'switch', options: { A4: 'A4', Letter: 'US Letter' }, value: 'A4', rules: '@page { size: var(--page-size); }' },
  { key: 'font', label: 'Body font', group: 'Typography', variable: '--global-font-family', type: 'font', value: FONTS['Times New Roman'], rules: 'html, body { font-family: var(--global-font-family) !important; }' },
  { key: 'headingFont', label: 'Heading font', group: 'Typography', variable: '--header-font-family', type: 'font', value: FONTS.Georgia, rules: 'h1, h2, h3, h4, h5, h6 { font-family: var(--header-font-family) !important; }' },
  { key: 'fontSize', label: 'Font size', group: 'Typography', variable: '--global-font-size', type: 'range', min: 7, max: 16, step: 0.5, unit: 'pt', value: 9, rules: 'html, body { font-size: var(--global-font-size) !important; }' },
  { key: 'lineHeight', label: 'Line height', group: 'Typography', variable: '--line-height', type: 'range', min: 1, max: 2.2, step: 0.05, unit: '', value: 1.75, rules: 'p, ul li, ol li { line-height: var(--line-height) !important; }' },
  { key: 'headingScale', label: 'Heading scale', group: 'Typography', variable: '--heading-scale', type: 'range', min: 0.75, max: 1.5, step: 0.05, unit: '', value: 1, rules: 'h1 { font-size: calc(20pt * var(--heading-scale)) !important; }\nh2 { font-size: calc(13pt * var(--heading-scale)) !important; }\nh3, h4, h5, h6 { font-size: calc(var(--global-font-size, 9pt) * var(--heading-scale)) !important; }' },
  { key: 'marginX', label: 'Horizontal margins', group: 'Spacing', variable: '--page-margin-x', type: 'range', min: 0, max: 30, step: 1, unit: 'mm', value: 9, rules: '@media screen { body { padding-left: var(--page-margin-x) !important; padding-right: var(--page-margin-x) !important; margin-left: 0; margin-right: 0; } }\n@page { margin-left: var(--page-margin-x); margin-right: var(--page-margin-x); }\n@media print { body { padding-left: 0 !important; padding-right: 0 !important; margin-left: 0 !important; margin-right: 0 !important; } }' },
  { key: 'marginY', label: 'Vertical margins', group: 'Spacing', variable: '--page-margin-y', type: 'range', min: 0, max: 30, step: 1, unit: 'mm', value: 9, rules: '@media screen { body { padding-top: var(--page-margin-y) !important; padding-bottom: var(--page-margin-y) !important; margin-top: 0; margin-bottom: 0; } }\n@page { margin-top: var(--page-margin-y); margin-bottom: var(--page-margin-y); }\n@media print { body { padding-top: 0 !important; padding-bottom: 0 !important; margin-top: 0 !important; margin-bottom: 0 !important; } }' },
  { key: 'sectionSpacing', label: 'Section spacing', group: 'Spacing', variable: '--section-spacing', type: 'range', min: 0, max: 30, step: 1, unit: 'pt', value: 17, rules: 'h2 { margin-top: var(--section-spacing) !important; }' },
  { key: 'photoPosition', label: 'Photo alignment', group: 'Layout', variable: '--photo-position', type: 'select', options: { none: 'Centered — own row', left: 'Left — wrap text', right: 'Right — wrap text' }, value: 'none', rules: photoLayout },
  { key: 'alignment', label: 'Name & contact alignment', group: 'Layout', variable: '--heading-align', type: 'select', options: { left: 'Left', center: 'Center', right: 'Right' }, value: 'center', rules: 'h1, h1 + p { text-align: var(--heading-align) !important; }' },
  { key: 'columns', label: 'Bullet list columns', group: 'Layout', variable: '--list-columns', type: 'select', options: { 1: 'One column', 2: 'Two columns' }, value: '2', rules: 'ul { columns: var(--list-columns) !important; padding-left: 0 !important; }\nul > li { list-style-position: inside !important; padding-left: 1rem !important; text-indent: -1rem !important; }' },
  { key: 'headingColor', label: 'Headings', group: 'Colors', variable: '--theme-color', type: 'color', value: '#007ea5', rules: 'h1, h2, h3, h4, h5, h6, h2 a, h3 a, h3 strong, h3 b { color: var(--theme-color) !important; }' },
  { key: 'textColor', label: 'Body text', group: 'Colors', variable: '--body-color', type: 'color', value: '#333333', rules: 'html, body { color: var(--body-color) !important; }' },
  { key: 'linkColor', label: 'Links', group: 'Colors', variable: '--main-color', type: 'color', value: '#000000', rules: 'a { color: var(--main-color) !important; }' },
  { key: 'dividerColor', label: 'Dividers', group: 'Colors', variable: '--underline-color', type: 'color', value: '#eeeeee', rules: 'h2 { border-bottom-color: var(--underline-color) !important; }\np a { text-decoration-color: var(--underline-color) !important; }' },
];

export const DEFAULTS = Object.fromEntries(SETTINGS.map(setting => [setting.key, setting.value]));
export const PRESETS = {
  Classic: { ...DEFAULTS },
  Modern: { ...DEFAULTS, photoPosition: 'right', photoSize: 28, photoRadius: 3, font: FONTS.Inter, headingFont: FONTS.Inter, fontSize: 10, lineHeight: 1.5, headingColor: '#25636b', linkColor: '#25636b', columns: '1', alignment: 'left', sectionSpacing: 14, marginX: 14, marginY: 14 },
  Compact: { ...DEFAULTS, photoPosition: 'right', photoSize: 22, font: FONTS.Roboto, headingFont: FONTS.Roboto, fontSize: 8.5, lineHeight: 1.4, headingScale: 0.9, marginX: 8, marginY: 8, sectionSpacing: 10, headingColor: '#252641' },
  Developer: { ...DEFAULTS, photoPosition: 'right', font: FONTS['IBM Plex Sans'], headingFont: FONTS['Courier New'], fontSize: 9, lineHeight: 1.5, headingScale: 0.95, marginX: 12, marginY: 12, sectionSpacing: 14, columns: '1', alignment: 'left', headingColor: '#2f6f4f', textColor: '#2b2f33', linkColor: '#2f6f4f', dividerColor: '#dde3e0' },
  Designer: { ...DEFAULTS, photoShape: '50%', photoPosition: 'left', photoSize: 30, photoRadius: 15, font: FONTS.Lato, headingFont: FONTS.Montserrat, fontSize: 9.5, lineHeight: 1.6, headingScale: 1.2, marginX: 16, marginY: 14, sectionSpacing: 20, alignment: 'left', headingColor: '#b2560d', textColor: '#333333', linkColor: '#b2560d', dividerColor: '#f0d9c4' },
  Academic: { ...DEFAULTS, photoPosition: 'right', photoSize: 24, photoRadius: 0, font: FONTS['Times New Roman'], headingFont: FONTS['Times New Roman'], fontSize: 10, lineHeight: 1.6, headingScale: 1.05, marginX: 16, marginY: 16, sectionSpacing: 16, columns: '1', alignment: 'left', headingColor: '#1f3a5f', textColor: '#2c2c2c', linkColor: '#1f3a5f', dividerColor: '#dde3ec' },
  Executive: { ...DEFAULTS, photoPosition: 'right', photoSize: 28, font: FONTS['Source Sans 3'], headingFont: FONTS.Georgia, fontSize: 9.5, lineHeight: 1.55, headingScale: 1.1, marginX: 14, marginY: 14, sectionSpacing: 18, columns: '1', alignment: 'left', headingColor: '#243b53', textColor: '#2d3340', linkColor: '#1f6f8b', dividerColor: '#d8dee9' },
  Romantic: { ...DEFAULTS, photoShape: '50%', photoSize: 28, photoRadius: 14, font: FONTS.Georgia, headingFont: FONTS.Georgia, fontSize: 9.5, lineHeight: 1.8, headingScale: 1.1, marginX: 18, marginY: 16, sectionSpacing: 18, columns: '1', alignment: 'center', headingColor: '#9b3b5a', textColor: '#3f3238', linkColor: '#9b3b5a', dividerColor: '#f0d6de' },
};

export const PRESET_ICONS = {
  Classic: 'file-text', Modern: 'sparkles', Compact: 'fold-vertical',
  Developer: 'code', Designer: 'palette', Academic: 'graduation-cap',
  Executive: 'briefcase', Romantic: 'heart',
};

const managedBlock = /\n{0,2}\/\* Resumis visual styles:start \*\/[\s\S]*?\/\* Resumis visual styles:end \*\//g;

function validValue(setting, value) {
  if (setting.type === 'range') return Number.isFinite(Number(value)) && Number(value) >= setting.min && Number(value) <= setting.max;
  if (setting.type === 'color') return /^#[0-9a-f]{6}$/i.test(value);
  if (setting.type === 'font') return Object.values(FONTS).includes(value);
  return Object.hasOwn(setting.options, value);
}

export function readAdjustments(css) {
  const values = {};
  for (const block of css.match(managedBlock) || []) {
    for (const setting of SETTINGS) {
      const match = block.match(new RegExp(`${setting.variable}:\\s*([^;]+);`));
      if (!match) continue;
      const raw = match[1].trim();
      const value = setting.type === 'range' ? Number(raw.replace(new RegExp(`${setting.unit}$`), '')) : raw;
      if (validValue(setting, value)) values[setting.key] = value;
    }
  }
  return values;
}

export function clearAdjustments(css) {
  return css.replace(managedBlock, '');
}

export function updateStyle(css, updates) {
  const values = { ...readAdjustments(css) };
  for (const [key, value] of Object.entries(updates)) {
    const setting = SETTINGS.find(item => item.key === key);
    if (setting && validValue(setting, value)) values[key] = value;
  }
  const active = SETTINGS.filter(setting => Object.hasOwn(values, setting.key));
  if (!active.length) return clearAdjustments(css);
  const declarations = active.map(setting => `  ${setting.variable}: ${values[setting.key]}${setting.unit || ''};`).join('\n');
  return `${clearAdjustments(css)}\n\n/* Resumis visual styles:start */\n:root {\n${declarations}\n}\n${active.map(setting => typeof setting.rules === 'function' ? setting.rules(values[setting.key]) : setting.rules).join('\n')}\n/* Resumis visual styles:end */`;
}
