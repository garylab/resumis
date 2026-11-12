import { SETTINGS, FONTS, FONT_GROUPS, PRESETS, PRESET_ICONS, DEFAULTS, readAdjustments, updateStyle, clearAdjustments } from './style-settings.js';
import { fitResumePreview } from './preview.js';
import { initPanelResizers } from './panels.js';

const contentEl = document.querySelector('[name="content"]');
const styleEl = document.querySelector('[name="style"]');
const preview = document.getElementById('preview');
const stage = document.getElementById('preview-stage');
const scroller = document.getElementById('preview-scroll');
const sheet = document.getElementById('preview-sheet');
const nameText = document.getElementById('name-text');
const nameInput = document.getElementById('name-input');
const controls = new Map();
const options = { lineNumbers: false, lineWrapping: true, viewportMargin: 20, inputStyle: 'contenteditable' };
const contentEditor = CodeMirror.fromTextArea(contentEl, { ...options, mode: 'markdown', spellcheck: true });
const styleEditor = CodeMirror.fromTextArea(styleEl, { ...options, mode: 'css' });
let applyingControls = false;
let paper = 'A4';

// Keep the same preview document while editing, so scrolling and print state survive updates.
const doc = preview.contentDocument;
doc.open();
doc.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><title></title>'
  + '<link rel="stylesheet" href="/static/fonts/fonts.css"></head><body></body></html>');
doc.close();
// The frame is sized to its content, so its own scrollbars would only be in the way.
const frameStyle = doc.createElement('style');
frameStyle.textContent = 'html { overflow: hidden; }';
const styleNode = doc.createElement('style');
doc.head.append(frameStyle, styleNode);

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

for (const [name, settings] of Object.entries(PRESETS)) {
  const button = node('button', '');
  button.type = 'button';
  const icon = node('i', `bi ${PRESET_ICONS[name]}`);
  icon.setAttribute('aria-hidden', 'true');
  button.append(icon, node('span', '', name));
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    applySettings(settings);
    button.setAttribute('aria-pressed', 'true');
    document.getElementById('style-status').textContent = `${name} style applied.`;
  });
  document.getElementById('style-presets').append(button);
}

for (const group of ['Paper Size', 'Typography', 'Spacing', 'Layout', 'Colors']) {
  const section = node('fieldset', 'style-section');
  section.append(node('legend', '', group));
  const fields = node('div', group === 'Colors' ? 'color-fields' : '');
  section.append(fields);
  for (const setting of SETTINGS.filter(item => item.group === group)) {
    const field = node('div', 'style-field');
    const label = node('label', '', setting.label);
    label.htmlFor = `style-${setting.key}`;
    const output = node('output');
    if (setting.type === 'switch') {
      // One button per choice, so the whole group's state is visible at a glance.
      const options = node('div', 'style-switch');
      options.id = label.htmlFor;
      options.setAttribute('role', 'radiogroup');
      options.setAttribute('aria-label', setting.label);
      for (const [value, text] of Object.entries(setting.options)) {
        const option = node('button', '', text);
        option.type = 'button';
        option.dataset.value = value;
        option.setAttribute('role', 'radio');
        option.setAttribute('aria-checked', 'false');
        option.addEventListener('click', () => applySettings({ [setting.key]: value }));
        options.append(option);
      }
      field.append(options);
      fields.append(field);
      controls.set(setting.key, { input: options, output, setting });
      continue;
    }
    const input = node(setting.type === 'select' || setting.type === 'font' ? 'select' : 'input');
    input.id = label.htmlFor;
    output.htmlFor = input.id;
    if (setting.type === 'font') {
      // Each choice is shown in its own typeface, grouped by the kind of face.
      for (const { label: title, fonts } of FONT_GROUPS) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = title;
        for (const name of fonts) {
          const option = new Option(name, FONTS[name]);
          option.style.fontFamily = FONTS[name];
          optgroup.append(option);
        }
        input.append(optgroup);
      }
      field.append(label, input);
    } else if (input.tagName === 'SELECT') {
      for (const [value, text] of Object.entries(setting.options)) input.add(new Option(text, value));
      field.append(label, input);
    } else if (setting.type === 'range') {
      input.type = 'range';
      Object.assign(input, { min: setting.min, max: setting.max, step: setting.step });
      const row = node('div', 'style-label-row');
      row.append(label, output);
      field.append(row, input);
    } else {
      input.type = 'color';
      const row = node('div', 'style-color');
      row.append(input, output);
      field.append(label, row);
    }
    input.addEventListener('input', () => {
      const value = setting.type === 'range' ? Number(input.value) : input.value;
      applySettings({ [setting.key]: value });
    });
    fields.append(field);
    controls.set(setting.key, { input, output, setting });
  }
  document.getElementById(group === 'Paper Size' ? 'paper-section' : 'style-controls').append(section);
}

function color(value, fallback) {
  const rgb = value.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return rgb ? '#' + rgb.slice(1, 4).map(channel => Number(channel).toString(16).padStart(2, '0')).join('') : fallback;
}

function readAppearance() {
  const win = preview.contentWindow;
  const body = win.getComputedStyle(doc.body);
  // Probes provide meaningful controls even before an empty resume has headings or lists.
  const probe = doc.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
  probe.innerHTML = '<h1>Name</h1><h2>Section</h2><p>Text <a href="#">Link</a></p><ul><li>Item</li></ul>';
  doc.body.append(probe);
  const style = selector => win.getComputedStyle(doc.body.querySelector(selector));
  const heading = style('h1');
  const section = style('h2');
  const line = style('li');
  const round = number => Math.round(number * 100) / 100;
  const root = win.getComputedStyle(doc.documentElement);
  let pageSize = root.getPropertyValue('--page-size').trim();
  if (!pageSize) {
    const readPages = rules => {
      for (const rule of rules) {
        if (rule.type === CSSRule.PAGE_RULE && rule.style.size) pageSize = rule.style.size;
        else if (rule.cssRules) readPages(rule.cssRules);
      }
    };
    readPages(styleNode.sheet.cssRules);
  }
  const result = {
    font: body.fontFamily,
    headingFont: heading.fontFamily,
    fontSize: round(parseFloat(body.fontSize) * .75),
    lineHeight: round(parseFloat(line.lineHeight) / parseFloat(line.fontSize)) || DEFAULTS.lineHeight,
    headingScale: round(parseFloat(heading.fontSize) / (20 / .75)),
    marginX: round(parseFloat(body.paddingLeft) * 25.4 / 96),
    marginY: round(parseFloat(body.paddingTop) * 25.4 / 96),
    sectionSpacing: round(parseFloat(section.marginTop) * .75),
    columns: style('ul').columnCount === '2' ? '2' : '1',
    alignment: ['left', 'center', 'right'].includes(heading.textAlign) ? heading.textAlign : 'left',
    headingColor: color(heading.color, DEFAULTS.headingColor),
    textColor: color(body.color, DEFAULTS.textColor),
    linkColor: color(win.getComputedStyle(probe.querySelector('a')).color, DEFAULTS.linkColor),
    dividerColor: color(section.borderBottomColor, DEFAULTS.dividerColor),
    paper: /^letter$/i.test(pageSize) ? 'Letter' : 'A4',
  };
  probe.remove();
  return result;
}

function syncControls() {
  const appearance = readAppearance();
  const saved = readAdjustments(styleEl.value);
  for (const { input, output, setting } of controls.values()) {
    let value = saved[setting.key] ?? appearance[setting.key] ?? setting.value;
    if (setting.type === 'switch') {
      for (const option of input.children) option.setAttribute('aria-checked', String(option.dataset.value === String(value)));
      continue;
    }
    if (setting.type === 'font') {
      input.querySelector('[data-custom]')?.remove();
      const family = text => text.split(',')[0].replaceAll(/['"]/g, '').trim().toLowerCase();
      const match = Object.values(FONTS).find(font => family(font) === family(value));
      if (match) value = match;
      else {
        const custom = new Option(`Custom: ${value.split(',')[0].replaceAll(/['"]/g, '')}`, value);
        custom.dataset.custom = 'true';
        custom.style.fontFamily = value;
        input.add(custom);
      }
      // The closed picker reads in the face it names.
      input.style.fontFamily = value;
    }
    if (setting.type === 'range') {
      input.min = Math.min(setting.min, Number(value));
      input.max = Math.max(setting.max, Number(value));
    }
    input.value = String(value);
    output.value = `${value}${setting.unit ? ` ${setting.unit}` : ''}`;
  }
  paper = appearance.paper;
}

function fitPreview() {
  fitResumePreview(preview, stage, sheet, paper, true);
}

function warmFonts() {
  if (!doc.fonts) return;
  for (const { input, setting } of controls.values()) {
    if (setting.type !== 'font') continue;
    for (const weight of [400, 700]) doc.fonts.load(`${weight} 16px ${input.value}`).catch(() => {});
  }
}

function render(contentChanged = false) {
  const scrollTop = scroller.scrollTop;
  if (contentChanged) doc.body.innerHTML = marked.parse(contentEditor.getValue());
  styleNode.textContent = styleEditor.getValue();
  doc.title = nameInput.value;
  syncControls();
  warmFonts();
  fitPreview();
  scroller.scrollTop = scrollTop;
}

function applySettings(values) {
  applyingControls = true;
  styleEditor.setValue(updateStyle(styleEditor.getValue(), values));
  applyingControls = false;
  render();
}

contentEditor.on('change', () => {
  contentEl.value = contentEditor.getValue();
  render(true);
});
styleEditor.on('change', () => {
  styleEl.value = styleEditor.getValue();
  document.querySelectorAll('#style-presets button').forEach(button => button.setAttribute('aria-pressed', 'false'));
  if (!applyingControls) render();
});

document.getElementById('reset-style').addEventListener('click', () => {
  styleEditor.setValue(clearAdjustments(styleEditor.getValue()));
  document.getElementById('style-status').textContent = 'Visual adjustments reset. Original CSS restored.';
});
document.getElementById('advanced-css').addEventListener('toggle', event => {
  if (event.currentTarget.open) styleEditor.refresh();
});

// The name field starts at the width of the name and grows as it is typed into.
function sizeNameInput() {
  nameInput.style.height = 'auto';
  nameInput.style.height = `${nameInput.scrollHeight}px`;
}

nameText.addEventListener('click', () => {
  nameText.classList.add('d-none');
  nameInput.classList.remove('d-none');
  sizeNameInput();
  nameInput.focus();
  nameInput.select();
});
function finishRename() {
  // A textarea can receive pasted line breaks, which GitHub paths cannot hold.
  nameInput.value = nameInput.value.replace(/\s+/g, ' ').trim() || 'Untitled Resume';
  nameText.replaceChildren(document.createTextNode(nameInput.value + ' '), node('i', 'bi bi-pencil'));
  nameText.classList.remove('d-none');
  nameInput.classList.add('d-none');
  doc.title = nameInput.value;
}
nameInput.addEventListener('input', sizeNameInput);
nameInput.addEventListener('blur', finishRename);
nameInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); nameInput.blur(); }
});

document.getElementById('export-pdf').addEventListener('click', () => {
  doc.title = nameInput.value;
  preview.contentWindow.focus();
  preview.contentWindow.print();
});

// FormData must include the latest Markdown and the CSS produced by the controls.
document.getElementById('saveResume').addEventListener('submit', () => {
  contentEditor.save();
  styleEditor.save();
});
initFormSubmits();
initPanelResizers(document.querySelector('.editor-workspace'));
render(true);
new ResizeObserver(fitPreview).observe(stage);
doc.addEventListener('load', fitPreview, true);
