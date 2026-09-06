// Pointer, wheel and drag-and-drop handling for the canvas.
//
// All pointer events are bound on the <svg> root rather than on individual
// shapes, because the renderer replaces the DOM wholesale on every frame. We
// capture the element id at pointerdown and work from the model after that.

import {
  state, commit, beginGesture, endGesture, changed, select, clearSelection,
  addNode, addLink, addZone, addNote, removeIds, selectedNodes, uid, kindOf, emit,
} from './state.js';
import { SERVICES } from './catalog.js';
import {
  layoutNode, routeLink, distanceToPolyline, normalizeRect, rectsIntersect,
  pointInRect, HALF, TILE,
} from './geom.js';
import {
  setOverlayPainter, scheduleRender, overlayRect, overlayGhostLink,
  overlayNodeOutline, overlayDropGhost,
} from './render.js';

let svg;
let gesture = null;
let spaceDown = false;
let dropPreview = null;

export function initInteractions(rootSvg) {
  svg = rootSvg;
  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', onPointerUp);
  svg.addEventListener('pointercancel', onPointerUp);
  svg.addEventListener('wheel', onWheel, { passive: false });
  svg.addEventListener('dblclick', onDoubleClick);
  svg.addEventListener('contextmenu', (e) => e.preventDefault());

  svg.addEventListener('dragover', onDragOver);
  svg.addEventListener('dragleave', () => { dropPreview = null; scheduleRender(); });
  svg.addEventListener('drop', onDrop);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isTyping(e)) { spaceDown = true; svg.style.cursor = 'grab'; }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') { spaceDown = false; svg.style.cursor = ''; }
  });

  setOverlayPainter(paintGestureOverlay);
}

export const isTyping = (e) => {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

// ------------------------------------------------------- coordinate space ---
export function toWorld(clientX, clientY) {
  const r = svg.getBoundingClientRect();
  return {
    x: (clientX - r.left - state.view.x) / state.view.k,
    y: (clientY - r.top - state.view.y) / state.view.k,
  };
}

const snap = (v) => (state.snapOn ? Math.round(v / state.snap) * state.snap : v);

// ------------------------------------------------------------ hit testing ---
function nodeAt(x, y) {
  // Topmost first: later nodes paint over earlier ones.
  for (let i = state.doc.nodes.length - 1; i >= 0; i -= 1) {
    const n = state.doc.nodes[i];
    if (pointInRect(x, y, layoutNode(n, SERVICES).box)) return n;
  }
  return null;
}

function nodeTileAt(x, y) {
  for (let i = state.doc.nodes.length - 1; i >= 0; i -= 1) {
    const n = state.doc.nodes[i];
    if (Math.abs(x - n.x) <= HALF + 6 && Math.abs(y - n.y) <= HALF + 6) return n;
  }
  return null;
}

function linkAt(x, y) {
  const tol = 8 / state.view.k;
  for (let i = state.doc.links.length - 1; i >= 0; i -= 1) {
    const l = state.doc.links[i];
    const a = state.doc.nodes.find((n) => n.id === l.from);
    const b = state.doc.nodes.find((n) => n.id === l.to);
    if (!a || !b) continue;
    const route = routeLink(a, b, { routing: state.routing, offset: l.offset || 0 });
    if (distanceToPolyline(route.points, x, y) <= tol) return l;
  }
  return null;
}

// ---------------------------------------------------------------- gestures --
function onPointerDown(e) {
  if (state.present) { presentClick(e); return; }
  if (e.button === 2) return;
  svg.setPointerCapture(e.pointerId);
  const p = toWorld(e.clientX, e.clientY);
  const el = e.target instanceof Element ? e.target : null;

  // Panning wins over everything.
  if (e.button === 1 || spaceDown || state.tool === 'pan') {
    gesture = { type: 'pan', startX: e.clientX, startY: e.clientY, vx: state.view.x, vy: state.view.y };
    svg.style.cursor = 'grabbing';
    return;
  }

  // Queued device from the palette: click to drop it.
  if (state.placingType) {
    commit('add device');
    const node = addNode(state.placingType, snap(p.x), snap(p.y));
    if (!e.shiftKey) state.placingType = null;
    select(node.id);
    changed();
    return;
  }

  if (state.tool === 'note') {
    commit('add note');
    const note = addNote(snap(p.x), snap(p.y));
    state.tool = 'select';
    select(note.id);
    changed();
    return;
  }

  if (state.tool === 'zone') {
    gesture = { type: 'draw-zone', ox: snap(p.x), oy: snap(p.y), x: p.x, y: p.y };
    return;
  }

  // Drag off a link handle to start a cable.
  const handle = el?.closest('[data-linkfrom]');
  if (handle) {
    const from = state.doc.nodes.find((n) => n.id === handle.dataset.linkfrom);
    gesture = { type: 'link', from, to: p, target: null };
    return;
  }

  // Zone resize grip.
  const grip = el?.closest('[data-resize]');
  if (grip) {
    const zoneId = grip.closest('[data-kind="zone"]')?.dataset.id;
    const zone = state.doc.zones.find((z) => z.id === zoneId);
    if (zone) {
      beginGesture('resize zone');
      gesture = { type: 'resize-zone', zone, dir: grip.dataset.resize, orig: { ...zone } };
      return;
    }
  }

  const hitEl = el?.closest('[data-kind]');
  const kind = hitEl?.dataset.kind;
  const id = hitEl?.dataset.id;

  if (state.tool === 'link') {
    const node = nodeTileAt(p.x, p.y) || nodeAt(p.x, p.y);
    if (node) { gesture = { type: 'link', from: node, to: p, target: null }; return; }
  }

  if (kind === 'node' || kind === 'note') {
    if (e.shiftKey) select(id, { toggle: true });
    else if (!state.selection.has(id)) select(id);
    startMove(p, e);
    return;
  }

  if (kind === 'zone') {
    if (e.shiftKey) select(id, { toggle: true });
    else if (!state.selection.has(id)) select(id);
    const zone = state.doc.zones.find((z) => z.id === id);
    beginGesture('move zone');
    gesture = {
      type: 'drag-zone', zone, start: p, orig: { x: zone.x, y: zone.y },
      carried: nodesInside(zone).map((n) => ({ n, x: n.x, y: n.y })),
      moved: false,
    };
    return;
  }

  if (kind === 'link') {
    if (e.shiftKey) select(id, { toggle: true });
    else select(id);
    return;
  }

  // Nothing under the cursor via the DOM — try the model (links are thin).
  const link = linkAt(p.x, p.y);
  if (link) { select(link.id, { toggle: e.shiftKey }); return; }

  gesture = { type: 'marquee', ox: p.x, oy: p.y, x: p.x, y: p.y, additive: e.shiftKey };
  if (!e.shiftKey) clearSelection();
}

function startMove(p, e) {
  beginGesture('move');
  const moving = [];
  for (const id of state.selection) {
    const k = kindOf(id);
    if (k === 'node') {
      const n = state.doc.nodes.find((x) => x.id === id);
      moving.push({ item: n, x: n.x, y: n.y });
    } else if (k === 'note') {
      const t = state.doc.notes.find((x) => x.id === id);
      moving.push({ item: t, x: t.x, y: t.y });
    } else if (k === 'zone') {
      const z = state.doc.zones.find((x) => x.id === id);
      moving.push({ item: z, x: z.x, y: z.y, carried: nodesInside(z).map((n) => ({ n, x: n.x, y: n.y })) });
    }
  }
  gesture = { type: 'drag-nodes', start: p, moving, moved: false, alt: e.altKey };
}

function nodesInside(zone) {
  return state.doc.nodes.filter((n) => pointInRect(n.x, n.y, zone));
}

function onPointerMove(e) {
  const p = toWorld(e.clientX, e.clientY);
  if (!gesture) {
    if (state.tool === 'link' && !state.present) scheduleRender();
    return;
  }

  switch (gesture.type) {
    case 'pan': {
      state.view.x = gesture.vx + (e.clientX - gesture.startX);
      state.view.y = gesture.vy + (e.clientY - gesture.startY);
      scheduleRender();
      break;
    }
    case 'drag-nodes': {
      const dx = p.x - gesture.start.x;
      const dy = p.y - gesture.start.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) gesture.moved = true;
      for (const m of gesture.moving) {
        m.item.x = snap(m.x + dx);
        m.item.y = snap(m.y + dy);
        if (m.carried) {
          const zdx = m.item.x - m.x;
          const zdy = m.item.y - m.y;
          for (const c of m.carried) { c.n.x = c.x + zdx; c.n.y = c.y + zdy; }
        }
      }
      scheduleRender();
      break;
    }
    case 'drag-zone': {
      const dx = p.x - gesture.start.x;
      const dy = p.y - gesture.start.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) gesture.moved = true;
      gesture.zone.x = snap(gesture.orig.x + dx);
      gesture.zone.y = snap(gesture.orig.y + dy);
      const zdx = gesture.zone.x - gesture.orig.x;
      const zdy = gesture.zone.y - gesture.orig.y;
      for (const c of gesture.carried) { c.n.x = c.x + zdx; c.n.y = c.y + zdy; }
      scheduleRender();
      break;
    }
    case 'resize-zone': {
      const z = gesture.zone;
      const o = gesture.orig;
      const nx = snap(p.x);
      const ny = snap(p.y);
      if (gesture.dir.includes('w')) { z.x = Math.min(nx, o.x + o.w - 60); z.w = o.x + o.w - z.x; }
      if (gesture.dir.includes('e')) { z.w = Math.max(60, nx - o.x); }
      if (gesture.dir.includes('n')) { z.y = Math.min(ny, o.y + o.h - 60); z.h = o.y + o.h - z.y; }
      if (gesture.dir.includes('s')) { z.h = Math.max(60, ny - o.y); }
      scheduleRender();
      break;
    }
    case 'draw-zone':
    case 'marquee': {
      gesture.x = p.x;
      gesture.y = p.y;
      scheduleRender();
      break;
    }
    case 'link': {
      gesture.to = p;
      const hit = nodeTileAt(p.x, p.y) || nodeAt(p.x, p.y);
      gesture.target = hit && hit.id !== gesture.from.id ? hit : null;
      scheduleRender();
      break;
    }
    default: break;
  }
}

function onPointerUp(e) {
  if (!gesture) return;
  const g = gesture;
  gesture = null;
  svg.style.cursor = spaceDown ? 'grab' : '';

  switch (g.type) {
    case 'drag-nodes':
    case 'drag-zone':
    case 'resize-zone':
      endGesture();
      changed();
      break;
    case 'marquee': {
      const rect = normalizeRect(g.ox, g.oy, g.x, g.y);
      if (rect.w > 3 || rect.h > 3) {
        const ids = [];
        for (const n of state.doc.nodes) {
          if (rectsIntersect(rect, layoutNode(n, SERVICES).box)) ids.push(n.id);
        }
        for (const t of state.doc.notes) {
          if (pointInRect(t.x, t.y, rect)) ids.push(t.id);
        }
        for (const z of state.doc.zones) {
          if (pointInRect(z.x, z.y, rect) && pointInRect(z.x + z.w, z.y + z.h, rect)) ids.push(z.id);
        }
        select(ids, { additive: g.additive });
      }
      scheduleRender();
      break;
    }
    case 'draw-zone': {
      const rect = normalizeRect(g.ox, g.oy, snap(g.x), snap(g.y));
      if (rect.w > 40 && rect.h > 40) {
        commit('add zone');
        const zone = addZone(rect.x, rect.y, rect.w, rect.h);
        select(zone.id);
      }
      state.tool = 'select';
      changed();
      break;
    }
    case 'link': {
      if (g.target) {
        commit('add link');
        const link = addLink(g.from.id, g.target.id);
        if (link) select(link.id);
        changed();
      } else {
        scheduleRender();
      }
      break;
    }
    default:
      scheduleRender();
      break;
  }
  void e;
}

function onDoubleClick(e) {
  if (state.present) return;
  const p = toWorld(e.clientX, e.clientY);
  const node = nodeAt(p.x, p.y);
  if (node) {
    select(node.id);
    document.dispatchEvent(new CustomEvent('td:edit-name'));
    return;
  }
  const note = state.doc.notes.find((t) => pointInRect(p.x, p.y, { x: t.x - 6, y: t.y - 16, w: t.w, h: 24 }));
  if (note) {
    select(note.id);
    document.dispatchEvent(new CustomEvent('td:edit-name'));
  }
}

function presentClick(e) {
  const p = toWorld(e.clientX, e.clientY);
  const node = nodeAt(p.x, p.y);
  const link = node ? null : linkAt(p.x, p.y);
  document.dispatchEvent(new CustomEvent('td:present-focus', {
    detail: { id: node?.id || link?.id || null },
  }));
}

// -------------------------------------------------------------- wheel/zoom --
function onWheel(e) {
  e.preventDefault();
  if (e.shiftKey && !e.ctrlKey) {
    state.view.x -= e.deltaY;
    scheduleRender();
    return;
  }
  zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016));
}

export function zoomAt(clientX, clientY, factor) {
  const r = svg.getBoundingClientRect();
  const k = Math.max(0.15, Math.min(4, state.view.k * factor));
  const sx = clientX - r.left;
  const sy = clientY - r.top;
  state.view.x = sx - ((sx - state.view.x) / state.view.k) * k;
  state.view.y = sy - ((sy - state.view.y) / state.view.k) * k;
  state.view.k = k;
  emit('view');
  scheduleRender();
}

export function zoomBy(factor) {
  const r = svg.getBoundingClientRect();
  zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
}

export function contentBounds(pad = 60) {
  const boxes = [];
  for (const n of state.doc.nodes) boxes.push(layoutNode(n, SERVICES).box);
  for (const z of state.doc.zones) boxes.push({ x: z.x, y: z.y - 14, w: z.w, h: z.h + 14 });
  for (const t of state.doc.notes) {
    const lines = String(t.text || '').split('\n').length;
    boxes.push({ x: t.x - 6, y: t.y - (t.size || 14), w: t.w, h: lines * (t.size || 14) * 1.35 + 8 });
  }
  if (!boxes.length) return null;
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

/**
 * Fit the drawing to the viewport.
 * Returns false when the canvas has no measurable size yet, so the caller can
 * retry once layout has happened (see requestFit in main.js).
 */
export function fitToContent() {
  const b = contentBounds();
  if (!b) return true;
  const rect = svg.getBoundingClientRect();
  const width = rect.width || svg.parentElement?.clientWidth || 0;
  const height = rect.height || svg.parentElement?.clientHeight || 0;
  if (!width || !height) return false;
  const k = Math.max(0.15, Math.min(2, Math.min(width / b.w, height / b.h)));
  state.view.k = k;
  state.view.x = (width - b.w * k) / 2 - b.x * k;
  state.view.y = (height - b.h * k) / 2 - b.y * k;
  emit('view');
  scheduleRender();
  return true;
}

export function resetZoom() {
  state.view.k = 1;
  emit('view');
  scheduleRender();
}

// ------------------------------------------------------------ drop from UI --
function onDragOver(e) {
  if (!e.dataTransfer?.types.includes('text/td-device')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  const p = toWorld(e.clientX, e.clientY);
  dropPreview = { x: snap(p.x), y: snap(p.y) };
  scheduleRender();
}

function onDrop(e) {
  const type = e.dataTransfer?.getData('text/td-device');
  dropPreview = null;
  if (!type) return;
  e.preventDefault();
  const p = toWorld(e.clientX, e.clientY);
  commit('add device');
  const node = addNode(type, snap(p.x), snap(p.y));
  select(node.id);
  changed();
}

// ------------------------------------------------------------ edit actions --
export function deleteSelection() {
  if (!state.selection.size) return;
  commit('delete');
  removeIds([...state.selection]);
  changed();
}

export function duplicateSelection() {
  const nodes = selectedNodes();
  const notes = state.doc.notes.filter((t) => state.selection.has(t.id));
  if (!nodes.length && !notes.length) return;
  commit('duplicate');
  const idMap = new Map();
  const fresh = [];
  for (const n of nodes) {
    const copy = { ...n, id: uid('nd'), x: n.x + 40, y: n.y + 40, services: [...n.services] };
    idMap.set(n.id, copy.id);
    state.doc.nodes.push(copy);
    fresh.push(copy.id);
  }
  // Keep links that were entirely inside the copied set.
  for (const l of [...state.doc.links]) {
    if (idMap.has(l.from) && idMap.has(l.to)) {
      state.doc.links.push({ ...l, id: uid('lk'), from: idMap.get(l.from), to: idMap.get(l.to) });
    }
  }
  for (const t of notes) {
    const copy = { ...t, id: uid('tx'), x: t.x + 40, y: t.y + 40 };
    state.doc.notes.push(copy);
    fresh.push(copy.id);
  }
  select(fresh);
  changed();
}

export function nudgeSelection(dx, dy) {
  if (!state.selection.size) return;
  commit('nudge');
  for (const id of state.selection) {
    const k = kindOf(id);
    const item = k === 'node' ? state.doc.nodes.find((n) => n.id === id)
      : k === 'note' ? state.doc.notes.find((n) => n.id === id)
        : k === 'zone' ? state.doc.zones.find((n) => n.id === id) : null;
    if (item) { item.x += dx; item.y += dy; }
  }
  changed();
}

export function selectAll() {
  select([
    ...state.doc.nodes.map((n) => n.id),
    ...state.doc.notes.map((n) => n.id),
    ...state.doc.zones.map((n) => n.id),
  ]);
}

/** Wrap the selected nodes in a new zone — the fast way to make a "site". */
export function groupIntoZone() {
  const nodes = selectedNodes();
  if (nodes.length < 1) return;
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const n of nodes) {
    const b = layoutNode(n, SERVICES).box;
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
  }
  const pad = 34;
  commit('group into zone');
  const zone = addZone(x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2, { label: 'Site' });
  select(zone.id);
  changed();
}

export function alignSelection(how) {
  const nodes = selectedNodes();
  if (nodes.length < 2) return;
  commit(`align ${how}`);
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const mid = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  switch (how) {
    case 'left':   { const v = Math.min(...xs); nodes.forEach((n) => { n.x = v; }); break; }
    case 'right':  { const v = Math.max(...xs); nodes.forEach((n) => { n.x = v; }); break; }
    case 'top':    { const v = Math.min(...ys); nodes.forEach((n) => { n.y = v; }); break; }
    case 'bottom': { const v = Math.max(...ys); nodes.forEach((n) => { n.y = v; }); break; }
    case 'hcenter':{ const v = mid(xs); nodes.forEach((n) => { n.x = v; }); break; }
    case 'vcenter':{ const v = mid(ys); nodes.forEach((n) => { n.y = v; }); break; }
    case 'hspace': {
      const sorted = [...nodes].sort((a, b) => a.x - b.x);
      const gap = (sorted[sorted.length - 1].x - sorted[0].x) / (sorted.length - 1);
      sorted.forEach((n, i) => { n.x = sorted[0].x + gap * i; });
      break;
    }
    case 'vspace': {
      const sorted = [...nodes].sort((a, b) => a.y - b.y);
      const gap = (sorted[sorted.length - 1].y - sorted[0].y) / (sorted.length - 1);
      sorted.forEach((n, i) => { n.y = sorted[0].y + gap * i; });
      break;
    }
    default: break;
  }
  changed();
}

/** Link every other selected node to the first one selected. */
export function connectSelection() {
  const nodes = selectedNodes();
  if (nodes.length < 2) return;
  commit('connect');
  const [hub, ...rest] = nodes;
  for (const n of rest) addLink(hub.id, n.id);
  changed();
}

// --------------------------------------------------------------- overlays ---
function paintGestureOverlay() {
  let out = '';
  if (dropPreview) out += overlayDropGhost(dropPreview.x, dropPreview.y);
  if (!gesture) return out;
  if (gesture.type === 'marquee') {
    const r = normalizeRect(gesture.ox, gesture.oy, gesture.x, gesture.y);
    if (r.w > 2 || r.h > 2) out += overlayRect(r);
  } else if (gesture.type === 'draw-zone') {
    const r = normalizeRect(gesture.ox, gesture.oy, gesture.x, gesture.y);
    if (r.w > 2 || r.h > 2) out += overlayRect(r, 'drop-ghost');
  } else if (gesture.type === 'link') {
    const from = { x: gesture.from.x, y: gesture.from.y };
    const to = gesture.target ? { x: gesture.target.x, y: gesture.target.y } : gesture.to;
    out += overlayGhostLink(from, to);
    if (gesture.target) out += overlayNodeOutline(gesture.target);
  }
  return out;
}

export { TILE };
