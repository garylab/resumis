// Visual adjustments are stored alongside the original CSS, so old resumes keep their styles.
export const FONTS = {
  'Times New Roman': "'Times New Roman', 'Hiragino Sans GB', 'Microsoft YaHei', serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  Arial: 'Arial, Helvetica, sans-serif',
  Verdana: 'Verdana, Geneva, sans-serif',
  'Trebuchet MS': "'Trebuchet MS', Arial, sans-serif",
  'Courier New': "'Courier New', monospace",
};

export const SETTINGS = [
  { key: 'paper', label: 'Paper size', group: 'Paper Size', variable: '--page-size', type: 'select', options: { A4: 'A4', Letter: 'US Letter' }, value: 'A4', rules: '@page { size: var(--page-size); }' },
  { key: 'font', label: 'Body font', group: 'Typography', variable: '--global-font-family', type: 'font', value: FONTS['Times New Roman'], rules: 'html, body { font-family: var(--global-font-family) !important; }' },
  { key: 'headingFont', label: 'Heading font', group: 'Typography', variable: '--header-font-family', type: 'font', value: FONTS.Georgia, rules: 'h1, h2, h3, h4, h5, h6 { font-family: var(--header-font-family) !important; }' },
  { key: 'fontSize', label: 'Font size', group: 'Typography', variable: '--global-font-size', type: 'range', min: 7, max: 16, step: 0.5, unit: 'pt', value: 9, rules: 'html, body { font-size: var(--global-font-size) !important; }' },
  { key: 'lineHeight', label: 'Line height', group: 'Typography', variable: '--line-height', type: 'range', min: 1, max: 2.2, step: 0.05, unit: '', value: 1.75, rules: 'p, ul li, ol li { line-height: var(--line-height) !important; }' },
  { key: 'headingScale', label: 'Heading scale', group: 'Typography', variable: '--heading-scale', type: 'range', min: 0.75, max: 1.5, step: 0.05, unit: '', value: 1, rules: 'h1 { font-size: calc(20pt * var(--heading-scale)) !important; }\nh2 { font-size: calc(13pt * var(--heading-scale)) !important; }\nh3, h4, h5, h6 { font-size: calc(var(--global-font-size, 9pt) * var(--heading-scale)) !important; }' },
  { key: 'marginX', label: 'Horizontal margins', group: 'Spacing', variable: '--page-margin-x', type: 'range', min: 0, max: 30, step: 1, unit: 'mm', value: 9, rules: '@media screen { body { padding-left: var(--page-margin-x) !important; padding-right: var(--page-margin-x) !important; margin-left: 0; margin-right: 0; } }\n@page { margin-left: var(--page-margin-x); margin-right: var(--page-margin-x); }\n@media print { body { padding-left: 0 !important; padding-right: 0 !important; margin-left: 0 !important; margin-right: 0 !important; } }' },
  { key: 'marginY', label: 'Vertical margins', group: 'Spacing', variable: '--page-margin-y', type: 'range', min: 0, max: 30, step: 1, unit: 'mm', value: 9, rules: '@media screen { body { padding-top: var(--page-margin-y) !important; padding-bottom: var(--page-margin-y) !important; margin-top: 0; margin-bottom: 0; } }\n@page { margin-top: var(--page-margin-y); margin-bottom: var(--page-margin-y); }\n@media print { body { padding-top: 0 !important; padding-bottom: 0 !important; margin-top: 0 !important; margin-bottom: 0 !important; } }' },
  { key: 'sectionSpacing', label: 'Section spacing', group: 'Spacing', variable: '--section-spacing', type: 'range', min: 0, max: 30, step: 1, unit: 'pt', value: 17, rules: 'h2 { margin-top: var(--section-spacing) !important; }' },
  { key: 'columns', label: 'Bullet list columns', group: 'Layout', variable: '--list-columns', type: 'select', options: { 1: 'One column', 2: 'Two columns' }, value: '2', rules: 'ul { columns: var(--list-columns) !important; }' },
  { key: 'alignment', label: 'Name & contact alignment', group: 'Layout', variable: '--heading-align', type: 'select', options: { left: 'Left', center: 'Center', right: 'Right' }, value: 'center', rules: 'h1, h1 + p { text-align: var(--heading-align) !important; }' },
  { key: 'headingColor', label: 'Headings', group: 'Colors', variable: '--theme-color', type: 'color', value: '#007ea5', rules: 'h1, h2, h3, h4, h5, h6, h2 a, h3 a, h3 strong, h3 b { color: var(--theme-color) !important; }' },
  { key: 'textColor', label: 'Body text', group: 'Colors', variable: '--body-color', type: 'color', value: '#333333', rules: 'html, body { color: var(--body-color) !important; }' },
  { key: 'linkColor', label: 'Links', group: 'Colors', variable: '--main-color', type: 'color', value: '#000000', rules: 'a { color: var(--main-color) !important; }' },
  { key: 'dividerColor', label: 'Dividers', group: 'Colors', variable: '--underline-color', type: 'color', value: '#eeeeee', rules: 'h2 { border-bottom-color: var(--underline-color) !important; }\np a { text-decoration-color: var(--underline-color) !important; }' },
];

export const DEFAULTS = Object.fromEntries(SETTINGS.map(setting => [setting.key, setting.value]));
export const PRESETS = {
  Classic: { ...DEFAULTS },
  Modern: { ...DEFAULTS, font: FONTS.Arial, headingFont: FONTS.Arial, fontSize: 10, lineHeight: 1.5, headingColor: '#25636b', linkColor: '#25636b', columns: '1', alignment: 'left', sectionSpacing: 14, marginX: 14, marginY: 14 },
  Compact: { ...DEFAULTS, font: FONTS.Arial, headingFont: FONTS.Arial, fontSize: 8.5, lineHeight: 1.4, headingScale: 0.9, marginX: 8, marginY: 8, sectionSpacing: 10, headingColor: '#252641' },
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
  return `${clearAdjustments(css)}\n\n/* Resumis visual styles:start */\n:root {\n${declarations}\n}\n${active.map(setting => setting.rules).join('\n')}\n/* Resumis visual styles:end */`;
}
