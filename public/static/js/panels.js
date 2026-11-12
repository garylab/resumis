// The preview and appearance columns keep a set width; the Markdown column takes
// whatever is left, so widening the window never stretches the resume preview.
const STORAGE_KEY = 'resumis-panel-widths';
const LIMITS = { markdown: 260, preview: [320, 1100], appearance: [260, 520] };
const STEP = 24;

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

function stored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}

export function initPanelResizers(workspace) {
  const read = name => parseFloat(getComputedStyle(workspace).getPropertyValue(`--${name}-width`)) || 0;
  const widths = { preview: read('preview'), appearance: read('appearance'), ...stored() };

  function apply(values = {}) {
    Object.assign(widths, values);
    const room = workspace.clientWidth - LIMITS.markdown;
    widths.appearance = clamp(widths.appearance, ...LIMITS.appearance);
    widths.preview = clamp(widths.preview, LIMITS.preview[0], Math.min(LIMITS.preview[1], room - widths.appearance));
    for (const name of ['preview', 'appearance']) {
      workspace.style.setProperty(`--${name}-width`, `${Math.round(widths[name])}px`);
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(widths)); } catch { /* Private browsing. */ }
  }

  // Dragging a divider resizes the two panels it sits between.
  const resize = (edge, delta) => apply(edge === 'markdown'
    ? { preview: widths.preview - delta }
    : { preview: widths.preview + delta, appearance: widths.appearance - delta });

  for (const handle of workspace.querySelectorAll('.col-resizer')) {
    const edge = handle.dataset.edge;
    handle.addEventListener('pointerdown', event => {
      event.preventDefault();
      const start = { x: event.clientX, preview: widths.preview, appearance: widths.appearance };
      const move = moved => {
        Object.assign(widths, { preview: start.preview, appearance: start.appearance });
        resize(edge, moved.clientX - start.x);
      };
      const stop = () => {
        handle.releasePointerCapture(event.pointerId);
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', stop);
        document.body.classList.remove('resizing-columns');
      };
      handle.setPointerCapture(event.pointerId);
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', stop);
      document.body.classList.add('resizing-columns');
    });
    handle.addEventListener('keydown', event => {
      const step = { ArrowLeft: -STEP, ArrowRight: STEP }[event.key];
      if (!step) return;
      event.preventDefault();
      resize(edge, step);
    });
  }

  apply();
  new ResizeObserver(() => apply()).observe(workspace);
}
