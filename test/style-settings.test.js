import test from 'node:test';
import assert from 'node:assert/strict';
import { clearAdjustments, updateStyle, readAdjustments, PRESETS } from '../public/static/js/style-settings.js';

const custom = ':root { --theme-color: rebeccapurple; }\nbody { font: 12px Arial; }\n.special { border: 2px dotted red; }\n';

test('visual edits preserve custom CSS and survive repeated save/reopen cycles', () => {
  let css = updateStyle(custom, { fontSize: 11, headingColor: '#123456' });
  for (let i = 0; i < 10; i++) css = updateStyle(css, { marginX: 15, paper: 'Letter' });
  assert.ok(css.startsWith(custom));
  assert.equal(css.match(/Resumis visual styles:start/g).length, 1);
  assert.deepEqual(readAdjustments(css), { paper: 'Letter', fontSize: 11, marginX: 15, headingColor: '#123456' });
  assert.match(css, /--global-font-size: 11pt/);
  assert.match(css, /--page-margin-x: 15mm/);
  assert.doesNotMatch(css, /--global-font-family:/);
  assert.equal(clearAdjustments(css), custom);
});

test('presets round-trip and reset without removing pre-existing styles', () => {
  for (const preset of Object.values(PRESETS)) {
    const css = updateStyle(custom, preset);
    assert.deepEqual(readAdjustments(css), preset);
    assert.equal(clearAdjustments(css), custom);
  }
});

test('unsupported or unsafe control values cannot inject generated CSS', () => {
  assert.equal(updateStyle(custom, { fontSize: 999, marginY: -1, paper: 'Letter; } body { color:red', headingColor: 'red; }', font: 'url(evil)', unknown: 'x' }), custom);
});
