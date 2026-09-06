// SVG painting. One rAF-batched full redraw of each layer.
//
// Everything that affects how the drawing *looks* lives in CANVAS_CSS so that
// exported SVG carries its own styling and opens correctly anywhere.

import { state, on } from './state.js';
import { SERVICES, LINK_KINDS, ZONE_COLORS, deviceOrDefault } from './catalog.js';
import { iconFor } from './icons.js';
import { layoutNode, routeLink, TILE, HALF, NODE_W } from './geom.js';

export const CANVAS_CSS = `
.td-canvas { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.td-canvas .paper { fill: var(--paper); }
.td-canvas .grid-tile { stroke: var(--grid); stroke-width: 1; fill: none; }

.td-canvas .zone-body { fill: currentColor; fill-opacity: .06; stroke: currentColor;
  stroke-width: 1.5; stroke-dasharray: 7 5; rx: 14; }
.td-canvas .zone-tab { fill: currentColor; rx: 5; }
.td-canvas .zone-title { fill: #fff; font-size: 12px; font-weight: 700;
  letter-spacing: .02em; dominant-baseline: middle; }

.td-canvas .link-line { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.td-canvas .link-hit { fill: none; stroke: transparent; stroke-width: 16; cursor: pointer; }
.td-canvas .link-label { font-size: 10.5px; font-weight: 600; fill: var(--ink);
  text-anchor: middle; dominant-baseline: middle; }
.td-canvas .link-label-bg { fill: var(--paper); rx: 4; }
.td-canvas .link-endlabel { font-size: 9.5px; fill: var(--ink-soft); font-weight: 600; }

.td-canvas .node-hit { fill: transparent; }
.td-canvas .tile { fill: var(--paper); stroke: currentColor; stroke-width: 1.7;
  rx: 13; filter: url(#td-shadow); }
.td-canvas .tile-wash { fill: currentColor; fill-opacity: .09; rx: 13; }
.td-canvas .ico { fill: none; stroke: currentColor; stroke-width: 1.6;
  stroke-linecap: round; stroke-linejoin: round; }
.td-canvas .ico .f { fill: currentColor; stroke: none; }
.td-canvas .ico .t { fill: #fff; stroke: none; font-size: 7px; font-weight: 700;
  text-anchor: middle; font-family: system-ui, sans-serif; }
.td-canvas .node-label { font-size: 13px; font-weight: 600; fill: var(--ink);
  text-anchor: middle; }
.td-canvas .node-sub { font-size: 11px; fill: var(--ink-soft); text-anchor: middle; }
/* Cables run behind labels; a paper-coloured halo keeps the text readable
   where a link passes under it. */
.td-canvas .node-label, .td-canvas .node-sub, .td-canvas .link-endlabel {
  paint-order: stroke; stroke: var(--paper); stroke-width: 3.4px;
  stroke-linejoin: round; }
.td-canvas .chip { rx: 4; }
.td-canvas .chip-text { font-size: 9px; font-weight: 700; fill: #fff;
  text-anchor: middle; dominant-baseline: middle; letter-spacing: .03em; }

.td-canvas .note-text { font-size: 14px; fill: var(--ink); }
.td-canvas .note-text.title { font-weight: 700; }

`;

// Editor-only styling. Deliberately NOT part of CANVAS_CSS so that exported
// files carry no trace of selection state or in-progress gestures.
const UI_CSS = `
.td-canvas .selected .tile { stroke-width: 2.4; }
.td-canvas .sel-ring { fill: none; stroke: var(--sel); stroke-width: 1.6;
  stroke-dasharray: 5 3; rx: 8; }
.td-canvas .sel-line { stroke: var(--sel) !important; }
.td-canvas .dim { opacity: .16; }
/* Clicking inside a zone must fall through to the canvas, otherwise you could
   never marquee-select the nodes sitting in it. Only the border and tab grab. */
.td-canvas .zone-body { pointer-events: stroke; }
.td-canvas .link-hit { pointer-events: stroke; }
.td-canvas .chip-g { pointer-events: none; }
.td-canvas .handle { fill: var(--paper); stroke: var(--sel); stroke-width: 2; cursor: crosshair; }
.td-canvas .handle:hover { fill: var(--sel); }
.td-canvas .resize { fill: var(--paper); stroke: var(--sel); stroke-width: 1.6; }
.td-canvas .marquee { fill: var(--sel); fill-opacity: .1; stroke: var(--sel);
  stroke-width: 1; stroke-dasharray: 4 3; }
.td-canvas .ghost-line { fill: none; stroke: var(--sel); stroke-width: 2.4;
  stroke-dasharray: 6 4; stroke-linecap: round; }
.td-canvas .ghost-target { fill: none; stroke: var(--sel); stroke-width: 2.4; rx: 13; }
.td-canvas .drop-ghost { fill: var(--sel); fill-opacity: .12; stroke: var(--sel);
  stroke-width: 1.6; stroke-dasharray: 5 4; rx: 13; }
`;

export const THEMES = {
  light: { paper: '#ffffff', grid: '#e7ebf0', ink: '#0f172a', inkSoft: '#64748b', sel: '#2563eb' },
  dark:  { paper: '#0f172a', grid: '#1e293b', ink: '#e2e8f0', inkSoft: '#94a3b8', sel: '#38bdf8' },
};

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const r1 = (v) => Math.round(v * 10) / 10;

let svg;
let layers;
let frame = null;

export function initRenderer(rootSvg) {
  svg = rootSvg;
  svg.classList.add('td-canvas');
  svg.innerHTML = `
    <defs id="td-defs">${defs()}</defs>
    <style id="td-style">${CANVAS_CSS}${UI_CSS}</style>
    <rect id="td-paper" class="paper" x="-40000" y="-40000" width="80000" height="80000"/>
    <rect id="td-grid" x="-40000" y="-40000" width="80000" height="80000" fill="url(#td-grid-pattern)"/>
    <g id="td-viewport">
      <g id="layer-zones"></g>
      <g id="layer-links"></g>
      <g id="layer-notes"></g>
      <g id="layer-nodes"></g>
      <g id="layer-overlay"></g>
    </g>`;
  layers = {
    viewport: svg.querySelector('#td-viewport'),
    zones: svg.querySelector('#layer-zones'),
    links: svg.querySelector('#layer-links'),
    notes: svg.querySelector('#layer-notes'),
    nodes: svg.querySelector('#layer-nodes'),
    overlay: svg.querySelector('#layer-overlay'),
    paper: svg.querySelector('#td-paper'),
    grid: svg.querySelector('#td-grid'),
  };
  on('change', scheduleRender);
  applyTheme();
  render();
}

function defs() {
  const markers = Object.values(LINK_KINDS).map((k) => `
    <marker id="td-arrow-${k.id}" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 1 L10 5 L0 9 z" fill="${k.color}"/>
    </marker>`).join('');
  return `
    <pattern id="td-grid-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
      <path class="grid-tile" d="M24 0H0V24"/>
    </pattern>
    <filter id="td-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-opacity="0.16"/>
    </filter>
    ${markers}`;
}

export function applyTheme() {
  const t = THEMES[state.theme] || THEMES.light;
  svg.style.setProperty('--paper', t.paper);
  svg.style.setProperty('--grid', t.grid);
  svg.style.setProperty('--ink', t.ink);
  svg.style.setProperty('--ink-soft', t.inkSoft);
  svg.style.setProperty('--sel', t.sel);
}

export function scheduleRender() {
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = null; render(); });
}

// Set by interact.js to draw in-flight gestures (marquee, link preview…).
let overlayFn = () => '';
export function setOverlayPainter(fn) { overlayFn = fn; }

let focusId = null;
export function setFocus(id) { focusId = id; scheduleRender(); }
export function getFocus() { return focusId; }

function visible(item) {
  return !(state.present && (item.step || 0) > state.step);
}

function dimClass(id) {
  if (!state.present || !focusId) return '';
  if (id === focusId) return '';
  const link = state.doc.links.find((l) => l.id === focusId);
  if (link && (id === link.from || id === link.to)) return '';
  const touches = state.doc.links.some(
    (l) => l.id === id && (l.from === focusId || l.to === focusId),
  );
  return touches ? '' : ' dim';
}

export function render() {
  const { view } = state;
  layers.viewport.setAttribute('transform',
    `translate(${r1(view.x)} ${r1(view.y)}) scale(${view.k})`);
  layers.grid.style.display = state.showGrid && !state.present ? '' : 'none';

  layers.zones.innerHTML = state.doc.zones.filter(visible).map(paintZone).join('');
  layers.links.innerHTML = state.doc.links.filter(linkVisible).map(paintLink).join('');
  layers.notes.innerHTML = state.doc.notes.filter(visible).map(paintNote).join('');
  layers.nodes.innerHTML = state.doc.nodes.filter(visible).map(paintNode).join('');
  layers.overlay.innerHTML = state.present ? '' : paintHandles() + overlayFn();
}

function linkVisible(link) {
  if (!visible(link)) return false;
  const a = state.doc.nodes.find((n) => n.id === link.from);
  const b = state.doc.nodes.find((n) => n.id === link.to);
  return !!a && !!b && visible(a) && visible(b);
}

// ------------------------------------------------------------------ zones ---
function paintZone(zone) {
  const color = (ZONE_COLORS.find((c) => c.id === zone.color) || ZONE_COLORS[0]).color;
  const sel = state.selection.has(zone.id);
  const label = esc(zone.label || '');
  const tabW = Math.max(56, label.length * 7.1 + 20);
  return `<g class="zone${sel ? ' selected' : ''}${dimClass(zone.id)}" data-id="${zone.id}"
             data-kind="zone" style="color:${color}">
    <rect class="zone-body" x="${r1(zone.x)}" y="${r1(zone.y)}"
          width="${r1(zone.w)}" height="${r1(zone.h)}"/>
    <rect class="zone-tab" data-part="header" x="${r1(zone.x + 12)}" y="${r1(zone.y - 12)}"
          width="${r1(tabW)}" height="24"/>
    <text class="zone-title" x="${r1(zone.x + 22)}" y="${r1(zone.y)}">${label}</text>
    ${sel ? zoneHandles(zone) : ''}
  </g>`;
}

function zoneHandles(z) {
  const pts = [
    ['nw', z.x, z.y], ['ne', z.x + z.w, z.y],
    ['sw', z.x, z.y + z.h], ['se', z.x + z.w, z.y + z.h],
  ];
  return pts.map(([dir, x, y]) =>
    `<rect class="resize" data-resize="${dir}" x="${r1(x - 5)}" y="${r1(y - 5)}"
           width="10" height="10" rx="2"/>`).join('');
}

// ------------------------------------------------------------------ links ---
function paintLink(link) {
  const a = state.doc.nodes.find((n) => n.id === link.from);
  const b = state.doc.nodes.find((n) => n.id === link.to);
  const kind = LINK_KINDS[link.kind] || LINK_KINDS.lan;
  const route = routeLink(a, b, { routing: state.routing, offset: link.offset || 0 });
  const sel = state.selection.has(link.id);
  const dash = kind.dash ? ` stroke-dasharray="${kind.dash}"` : '';
  const marker = link.directed ? ` marker-end="url(#td-arrow-${kind.id})"` : '';

  let labels = '';
  if (link.label) {
    const w = link.label.length * 6.2 + 10;
    labels += `<rect class="link-label-bg" x="${r1(route.mid.x - w / 2)}"
      y="${r1(route.mid.y - 8)}" width="${r1(w)}" height="16"/>
      <text class="link-label" x="${r1(route.mid.x)}" y="${r1(route.mid.y + 1)}">${esc(link.label)}</text>`;
  }
  labels += endLabel(link.fromLabel, route.start, a);
  labels += endLabel(link.toLabel, route.end, b);

  return `<g class="link${sel ? ' selected' : ''}${dimClass(link.id)}" data-id="${link.id}" data-kind="link">
    <path class="link-hit" d="${route.d}"/>
    <path class="link-line${sel ? ' sel-line' : ''}" d="${route.d}" stroke="${kind.color}"
          stroke-width="${kind.width}"${dash}${marker}/>
    ${labels}
  </g>`;
}

function endLabel(text, point, node) {
  if (!text) return '';
  const away = 12;
  let x = point.x;
  let y = point.y;
  let anchor = 'middle';
  switch (point.side) {
    case 'l': x -= away; anchor = 'end'; y += 3; break;
    case 'r': x += away; anchor = 'start'; y += 3; break;
    case 't': y -= away * 0.6; break;
    default:  y += away; break;
  }
  void node;
  return `<text class="link-endlabel" text-anchor="${anchor}" x="${r1(x)}" y="${r1(y)}">${esc(text)}</text>`;
}

// ------------------------------------------------------------------ nodes ---
const ICON_SIZE = 38;
const ICON_SCALE = ICON_SIZE / 24;

function paintNode(node) {
  const dev = deviceOrDefault(node.type);
  const L = layoutNode(node, SERVICES);
  const sel = state.selection.has(node.id);
  const ix = node.x - ICON_SIZE / 2;
  const iy = node.y - ICON_SIZE / 2;

  const labels = L.labelLines.map((l) =>
    `<text class="node-label" x="${r1(node.x)}" y="${r1(l.y)}">${esc(l.text)}</text>`).join('');
  const sub = L.sub
    ? `<text class="node-sub" x="${r1(node.x)}" y="${r1(L.sub.y)}">${esc(L.sub.text)}</text>` : '';

  const chips = L.chipRows.flatMap((row) => row.chips.map((c) => `
    <g class="chip-g" data-service="${c.id}"><title>${esc(c.label)}</title>
      <rect class="chip" x="${r1(c.x)}" y="${r1(row.y)}" width="${r1(c.w)}" height="14" fill="${c.color}"/>
      <text class="chip-text" x="${r1(c.x + c.w / 2)}" y="${r1(row.y + 7.5)}">${esc(c.short)}</text>
    </g>`)).join('');

  return `<g class="node${sel ? ' selected' : ''}${dimClass(node.id)}" data-id="${node.id}"
             data-kind="node" style="color:${dev.accent}">
    <rect class="node-hit" x="${r1(L.box.x)}" y="${r1(L.box.y)}" width="${r1(L.box.w)}" height="${r1(L.box.h)}"/>
    <rect class="tile" x="${r1(L.tile.x)}" y="${r1(L.tile.y)}" width="${TILE}" height="${TILE}"/>
    <rect class="tile-wash" x="${r1(L.tile.x)}" y="${r1(L.tile.y)}" width="${TILE}" height="${TILE}"/>
    <g class="ico" transform="translate(${r1(ix)} ${r1(iy)}) scale(${r1(ICON_SCALE)})">${iconFor(dev.icon)}</g>
    ${labels}${sub}${chips}
    ${sel ? `<rect class="sel-ring" x="${r1(L.box.x - 3)}" y="${r1(L.box.y - 3)}"
                   width="${r1(L.box.w + 6)}" height="${r1(L.box.h + 6)}"/>` : ''}
  </g>`;
}

// ------------------------------------------------------------------ notes ---
function paintNote(note) {
  const sel = state.selection.has(note.id);
  const size = note.size || 14;
  const lines = String(note.text || '').split('\n');
  const tspans = lines.map((line, i) => {
    const bold = i === 0 && lines.length > 1 && line.trim().endsWith(':');
    return `<tspan x="${r1(note.x)}" dy="${i === 0 ? 0 : size * 1.35}"
      ${bold ? 'font-weight="700"' : ''}>${esc(line) || ' '}</tspan>`;
  }).join('');
  const h = lines.length * size * 1.35;
  return `<g class="note${sel ? ' selected' : ''}${dimClass(note.id)}" data-id="${note.id}" data-kind="note">
    <rect class="node-hit" x="${r1(note.x - 6)}" y="${r1(note.y - size)}"
          width="${r1(note.w)}" height="${r1(h + 8)}"/>
    <text class="note-text" x="${r1(note.x)}" y="${r1(note.y)}" font-size="${size}"
          fill="${note.color || 'currentColor'}">${tspans}</text>
    ${sel ? `<rect class="sel-ring" x="${r1(note.x - 9)}" y="${r1(note.y - size - 3)}"
                   width="${r1(note.w + 6)}" height="${r1(h + 14)}"/>` : ''}
  </g>`;
}

// --------------------------------------------------------------- overlays ---
/** Link handles on the single selected node, so dragging one starts a cable. */
function paintHandles() {
  if (state.selection.size !== 1) return '';
  const id = [...state.selection][0];
  const node = state.doc.nodes.find((n) => n.id === id);
  if (!node || !visible(node)) return '';
  const d = HALF + 9;
  const spots = [
    ['t', node.x, node.y - d], ['b', node.x, node.y + d],
    ['l', node.x - d, node.y], ['r', node.x + d, node.y],
  ];
  return spots.map(([side, x, y]) =>
    `<circle class="handle" data-linkfrom="${node.id}" data-side="${side}"
             cx="${r1(x)}" cy="${r1(y)}" r="5.5"/>`).join('');
}

export function overlayRect(rect, cls = 'marquee') {
  return `<rect class="${cls}" x="${r1(rect.x)}" y="${r1(rect.y)}"
                width="${r1(rect.w)}" height="${r1(rect.h)}"/>`;
}

export function overlayGhostLink(from, to) {
  return `<path class="ghost-line" d="M${r1(from.x)} ${r1(from.y)}L${r1(to.x)} ${r1(to.y)}"/>`;
}

export function overlayNodeOutline(node) {
  return `<rect class="ghost-target" x="${r1(node.x - HALF - 4)}" y="${r1(node.y - HALF - 4)}"
                width="${TILE + 8}" height="${TILE + 8}"/>`;
}

export function overlayDropGhost(x, y) {
  return `<rect class="drop-ghost" x="${r1(x - HALF)}" y="${r1(y - HALF)}"
                width="${TILE}" height="${TILE}"/>`;
}

export { NODE_W };
