// App wiring: toolbar, keyboard, presentation mode, first-run behaviour.

import {
  state, on, changed, undo, redo, canUndo, canRedo, loadDoc, readAutosave,
  loadPrefs, savePrefs, maxStep, clearSelection, select,
} from './state.js';
import { LINK_KINDS } from './catalog.js';
import { initRenderer, applyTheme, scheduleRender, setFocus, getFocus } from './render.js';
import {
  initInteractions, fitToContent, zoomBy, resetZoom, isTyping,
  deleteSelection, duplicateSelection, nudgeSelection, selectAll, groupIntoZone,
} from './interact.js';
import { initPalette, refreshPalette, focusPaletteSearch } from './palette.js';
import { initInspector, refresh as refreshInspector } from './inspector.js';
import { exportPng, exportSvg, copyPng, saveJson, openJson, newDocument } from './exporters.js';
import { SAMPLES, makeSample } from './samples.js';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#canvas');

// Surface anything unexpected instead of dying silently mid-lecture.
window.addEventListener('error', (e) => toast(e.message || 'Something went wrong', true));
window.addEventListener('unhandledrejection', (e) => toast(String(e.reason), true));

// Declared up here because boot toasts before it would otherwise be initialised.
let toastTimer = null;
function toast(message, isError = false) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  el.classList.toggle('error', isError);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, isError ? 6000 : 2600);
}

// A fit can be asked for before the canvas has a size (first paint, or a pane
// that is still collapsing). Queue it and let the size observer settle it.
let pendingFit = false;
function requestFit() { pendingFit = true; tryFit(); }
function tryFit() {
  if (!pendingFit) return;
  if (fitToContent()) pendingFit = false;
}

// ------------------------------------------------------------------- boot ---
loadPrefs();
initRenderer(canvas);
initInteractions(canvas);
initPalette($('#palette'));
initInspector($('#inspector'));
buildLinkKinds();
buildSamplesMenu();
wireToolbar();
wireKeyboard();
restoreOrSeed();
on('change', syncChrome);
syncChrome();
window.addEventListener('resize', scheduleRender);

if (typeof ResizeObserver === 'function') {
  new ResizeObserver(() => { tryFit(); scheduleRender(); })
    .observe(document.querySelector('.canvas-wrap'));
}
window.addEventListener('load', tryFit);

function restoreOrSeed() {
  // ?sample=dmz&present=1&step=1&theme=dark — bookmark a lecture and open
  // straight into it, already in presentation mode at the right step.
  const params = new URLSearchParams(location.search);

  if (params.get('theme') === 'dark' || params.get('theme') === 'light') {
    state.theme = params.get('theme');
    applyTheme();
  }

  const wanted = params.get('sample');
  const fromUrl = wanted ? makeSample(wanted) : null;
  const saved = fromUrl ? null : readAutosave();

  if (fromUrl) {
    loadDoc(fromUrl);
  } else if (saved) {
    loadDoc(saved);
    toast('Restored your last diagram');
  } else {
    loadDoc(makeSample('two-sites'));
    toast('Loaded a sample — File ▸ New to start empty');
  }
  requestFit();

  if (params.has('present')) {
    setPresent(true);
    setStep(parseInt(params.get('step'), 10) || 0);
  }
}

// ---------------------------------------------------------------- toolbar ---
function buildLinkKinds() {
  const sel = $('#link-kind');
  sel.innerHTML = Object.values(LINK_KINDS)
    .map((k) => `<option value="${k.id}">${k.label}</option>`).join('');
  sel.value = state.linkKind;
  sel.addEventListener('change', () => {
    state.linkKind = sel.value;
    savePrefs();
    // Retarget the current selection if it happens to be a link.
    const id = [...state.selection][0];
    const link = state.doc.links.find((l) => l.id === id);
    if (link) { link.kind = sel.value; changed(); }
  });
}

function buildSamplesMenu() {
  $('#samples-menu').innerHTML = SAMPLES.map((s) =>
    `<button data-sample="${s.id}">${s.label}<small>${s.hint}</small></button>`).join('')
    + '<button data-sample="__blank">Blank canvas<small>start from nothing</small></button>';
}

function wireToolbar() {
  document.querySelector('.toolbar').addEventListener('click', async (e) => {
    const toolBtn = e.target.closest('[data-tool]');
    if (toolBtn) { setTool(toolBtn.dataset.tool); return; }

    const sampleBtn = e.target.closest('[data-sample]');
    if (sampleBtn) {
      closeMenus();
      const id = sampleBtn.dataset.sample;
      if (!confirmDiscard()) return;
      if (id === '__blank') newDocument();
      else loadDoc(makeSample(id));
      requestFit();
      return;
    }

    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    closeMenus();
    await runAction(act);
  });

  $('#doc-title').addEventListener('input', (e) => {
    state.doc.title = e.target.value;
    changed();
  });

  document.addEventListener('td:title', () => { $('#doc-title').value = state.doc.title; });

  // Clicking anywhere else closes an open dropdown.
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu')) closeMenus();
  });

  document.getElementById('present-bar').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act) runAction(act);
  });

  document.addEventListener('td:present-focus', (e) => {
    setFocus(getFocus() === e.detail.id ? null : e.detail.id);
  });
}

async function runAction(act) {
  try {
    switch (act) {
      case 'new': if (confirmDiscard()) { newDocument(); resetZoom(); } break;
      case 'open': { const name = await openJson(); if (name) { requestFit(); toast(`Opened ${name}`); } break; }
      case 'save': { const name = await saveJson(); if (name) toast(`Saved ${name}`); break; }
      case 'png2': await exportPng(2); toast('PNG exported'); break;
      case 'png3': await exportPng(3); toast('PNG exported at 3×'); break;
      case 'pngT': await exportPng(2, { transparent: true }); toast('Transparent PNG exported'); break;
      case 'svg': exportSvg(); toast('SVG exported'); break;
      case 'copy': await copyPng(2); toast('Image copied — paste into your slides'); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'snap': state.snapOn = !state.snapOn; savePrefs(); changed({ structural: false }); break;
      case 'grid': state.showGrid = !state.showGrid; savePrefs(); changed({ structural: false }); break;
      case 'routing':
        state.routing = state.routing === 'orthogonal' ? 'straight' : 'orthogonal';
        savePrefs(); changed({ structural: false }); break;
      case 'theme':
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        applyTheme(); savePrefs(); changed({ structural: false }); break;
      case 'zoom-in': zoomBy(1.2); break;
      case 'zoom-out': zoomBy(1 / 1.2); break;
      case 'zoom-reset': resetZoom(); break;
      case 'fit': fitToContent(); break;
      case 'present': setPresent(true); break;
      case 'exit-present': setPresent(false); break;
      case 'step-next': setStep(state.step + 1); break;
      case 'step-prev': setStep(state.step - 1); break;
      case 'clear-focus': setFocus(null); break;
      default: break;
    }
  } catch (err) {
    toast(err.message || String(err), true);
  }
}

function closeMenus() {
  for (const m of document.querySelectorAll('.menu[open]')) m.removeAttribute('open');
}

function setTool(tool) {
  state.tool = tool;
  state.placingType = null;
  refreshPalette();
  changed({ structural: false });
}

function confirmDiscard() {
  if (!state.dirty || !state.doc.nodes.length) return true;
  return window.confirm('Discard the current diagram? Unsaved changes will be lost.');
}

// -------------------------------------------------------------- presenting --
function setPresent(onFlag) {
  state.present = onFlag;
  state.step = 0;
  setFocus(null);
  document.body.classList.toggle('presenting', onFlag);
  $('#present-bar').hidden = !onFlag;
  if (onFlag) clearSelection();
  changed({ structural: false });
  // Two frames: the first guarantees layout has run, the second does the fit.
  requestFit();
}

function setStep(n) {
  const max = maxStep();
  state.step = Math.max(0, Math.min(max, n));
  changed({ structural: false });
}

// ---------------------------------------------------------------- keyboard --
function wireKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    const mod = e.ctrlKey || e.metaKey;

    if (mod) {
      switch (e.key.toLowerCase()) {
        case 'z': e.preventDefault(); if (e.shiftKey) redo(); else undo(); return;
        case 'y': e.preventDefault(); redo(); return;
        case 's': e.preventDefault(); runAction('save'); return;
        case 'o': e.preventDefault(); runAction('open'); return;
        case 'd': e.preventDefault(); duplicateSelection(); return;
        case 'a': e.preventDefault(); selectAll(); return;
        case 'g': e.preventDefault(); groupIntoZone(); return;
        case 'f': e.preventDefault(); focusPaletteSearch(); return;
        case 'c': if (e.shiftKey) { e.preventDefault(); runAction('copy'); } return;
        default: return;
      }
    }

    switch (e.key) {
      case 'Delete': case 'Backspace': e.preventDefault(); deleteSelection(); break;
      case 'Escape':
        if (state.present) setPresent(false);
        else if (state.placingType) { state.placingType = null; refreshPalette(); changed({ structural: false }); }
        else { setTool('select'); clearSelection(); }
        break;
      case 'ArrowLeft':
        if (state.present) setStep(state.step - 1);
        else { e.preventDefault(); nudgeSelection(e.shiftKey ? -state.snap : -1, 0); }
        break;
      case 'ArrowRight':
        if (state.present) setStep(state.step + 1);
        else { e.preventDefault(); nudgeSelection(e.shiftKey ? state.snap : 1, 0); }
        break;
      case 'ArrowUp': e.preventDefault(); nudgeSelection(0, e.shiftKey ? -state.snap : -1); break;
      case 'ArrowDown': e.preventDefault(); nudgeSelection(0, e.shiftKey ? state.snap : 1); break;
      case ' ':
        if (state.present) { e.preventDefault(); setStep(state.step + 1); }
        break;
      case '0': fitToContent(); break;
      case '+': case '=': zoomBy(1.2); break;
      case '-': zoomBy(1 / 1.2); break;
      default: {
        const k = e.key.toLowerCase();
        if (k === 'v') setTool('select');
        else if (k === 'l') setTool('link');
        else if (k === 'z') setTool('zone');
        else if (k === 't') setTool('note');
        else if (k === 'p') setPresent(!state.present);
        break;
      }
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (!state.dirty || !state.doc.nodes.length) return;
    e.preventDefault();
    e.returnValue = '';
  });
}

// ------------------------------------------------------------------ chrome --
function syncChrome() {
  $('#btn-undo').disabled = !canUndo();
  $('#btn-redo').disabled = !canRedo();
  $('#btn-snap').classList.toggle('on', state.snapOn);
  $('#btn-grid').classList.toggle('on', state.showGrid);
  $('#btn-routing').classList.toggle('on', state.routing === 'orthogonal');
  $('#btn-routing').textContent = state.routing === 'orthogonal' ? 'Elbow' : 'Direct';
  $('#btn-theme').textContent = state.theme === 'light' ? 'Light' : 'Dark';
  $('#btn-theme').classList.toggle('on', state.theme === 'dark');
  $('#zoom-level').textContent = `${Math.round(state.view.k * 100)}%`;
  $('#link-kind').value = state.linkKind;

  for (const btn of document.querySelectorAll('[data-tool]')) {
    btn.classList.toggle('on', btn.dataset.tool === state.tool);
  }

  const title = $('#doc-title');
  if (document.activeElement !== title && title.value !== state.doc.title) {
    title.value = state.doc.title;
  }

  const hint = $('#placing-hint');
  if (state.placingType) {
    hint.hidden = false;
    hint.textContent = 'Click the canvas to place — Shift-click to keep placing — Esc to cancel';
  } else if (state.tool === 'link') {
    hint.hidden = false;
    hint.textContent = 'Click a device, then click the one to connect it to';
  } else if (state.tool === 'zone') {
    hint.hidden = false;
    hint.textContent = 'Drag out a site / zone box';
  } else if (state.tool === 'note') {
    hint.hidden = false;
    hint.textContent = 'Click where the text should go';
  } else {
    hint.hidden = true;
  }

  const sel = state.selection.size;
  $('#status-left').textContent = sel
    ? `${sel} selected`
    : `${state.doc.nodes.length} devices · ${state.doc.links.length} links`;

  const max = maxStep();
  $('#step-label').textContent = max ? `Step ${state.step} / ${max}` : 'No steps';
  $('#status-right').textContent = state.dirty ? 'Unsaved changes' : 'Saved';
}

on('selection', syncChrome);
on('view', syncChrome);
on('loaded', () => { refreshInspector(); refreshPalette(); });

// Handy while iterating on the tool itself.
window.TD = { state, select, fitToContent, toast };
