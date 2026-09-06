// Getting the drawing out: SVG, PNG, and JSON round-trip.
//
// Exports are built from a *fresh* SVG rather than the live one, so UI-only
// bits (selection rings, handles, grid) never end up in a slide.

import { state, loadDoc, newDoc } from './state.js';
import { CANVAS_CSS, THEMES } from './render.js';
import { contentBounds } from './interact.js';

const stamp = () => new Date().toISOString().slice(0, 10);

function safeName(ext) {
  const base = (state.doc.title || 'topology')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'topology';
  return `${base}-${stamp()}.${ext}`;
}

/** Build a standalone SVG string of the current drawing. */
export function buildSvg({ transparent = false, padding = 48 } = {}) {
  const live = document.querySelector('#canvas');
  const bounds = contentBounds(padding) || { x: 0, y: 0, w: 800, h: 600 };
  const theme = THEMES[state.theme] || THEMES.light;

  const layers = ['layer-zones', 'layer-links', 'layer-notes', 'layer-nodes']
    .map((id) => {
      const node = live.querySelector(`#${id}`);
      return node ? node.outerHTML : '';
    }).join('\n');

  // Strip editor-only decorations that survived in the cloned markup.
  const cleaned = layers
    .replace(/<rect class="sel-ring"[^>]*\/>/g, '')
    .replace(/<rect class="resize"[^>]*\/>/g, '')
    .replace(/ class="(node|zone|note|link) selected/g, ' class="$1')
    .replace(/ sel-line/g, '')
    .replace(/ dim(?=")/g, '');

  const defs = live.querySelector('#td-defs').innerHTML;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${Math.round(bounds.w)}" height="${Math.round(bounds.h)}"
     viewBox="${round(bounds.x)} ${round(bounds.y)} ${round(bounds.w)} ${round(bounds.h)}"
     class="td-canvas"
     style="--paper:${theme.paper};--grid:${theme.grid};--ink:${theme.ink};--ink-soft:${theme.inkSoft};--sel:${theme.sel}">
  <title>${escapeXml(state.doc.title || 'Network topology')}</title>
  <defs>${defs}</defs>
  <style>${CANVAS_CSS}</style>
  ${transparent ? '' : `<rect x="${round(bounds.x)}" y="${round(bounds.y)}" width="${round(bounds.w)}" height="${round(bounds.h)}" fill="${theme.paper}"/>`}
  ${cleaned}
</svg>`;
}

const round = (v) => Math.round(v * 10) / 10;
const escapeXml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

export function exportSvg() {
  download(new Blob([buildSvg()], { type: 'image/svg+xml' }), safeName('svg'));
}

export async function exportPng(scale = 2, { transparent = false } = {}) {
  const svgText = buildSvg({ transparent });
  const bounds = contentBounds(48) || { w: 800, h: 600 };
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bounds.w * scale);
    canvas.height = Math.round(bounds.h * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    download(blob, safeName('png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Copy a PNG of the diagram straight to the clipboard — paste into slides. */
export async function copyPng(scale = 2) {
  if (!navigator.clipboard?.write) throw new Error('Clipboard images are not available in this browser');
  const svgText = buildSvg();
  const bounds = contentBounds(48) || { w: 800, h: 600 };
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bounds.w * scale);
    canvas.height = Math.round(bounds.h * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not rasterise the diagram'));
    img.src = url;
  });
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ------------------------------------------------------------------- JSON ---
const hasFsApi = () => typeof window.showSaveFilePicker === 'function';

export async function saveJson({ saveAs = false } = {}) {
  const text = JSON.stringify(state.doc, null, 2);
  if (hasFsApi()) {
    try {
      let handle = state.filePath;
      if (saveAs || !handle) {
        handle = await window.showSaveFilePicker({
          suggestedName: safeName('json'),
          types: [{ description: 'Topology', accept: { 'application/json': ['.json'] } }],
        });
        state.filePath = handle;
      }
      const w = await handle.createWritable();
      await w.write(text);
      await w.close();
      state.dirty = false;
      return handle.name;
    } catch (err) {
      if (err?.name === 'AbortError') return null;
      // Fall through to a plain download if the picker is unavailable.
    }
  }
  download(new Blob([text], { type: 'application/json' }), safeName('json'));
  state.dirty = false;
  return safeName('json');
}

export async function openJson() {
  if (hasFsApi()) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Topology', accept: { 'application/json': ['.json'] } }],
      });
      const file = await handle.getFile();
      loadDoc(JSON.parse(await file.text()), { name: handle });
      return file.name;
    } catch (err) {
      if (err?.name === 'AbortError') return null;
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      loadDoc(JSON.parse(await file.text()));
      resolve(file.name);
    };
    input.click();
  });
}

export function newDocument() {
  loadDoc(newDoc());
}
