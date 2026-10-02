// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Jasmin Redžepagić

// Document model, undo history, selection and autosave.
//
// The whole drawing is one plain-JSON `doc`. Undo is snapshot based: cheap and
// impossible to get subtly wrong, which matters more here than memory use.

import { deviceOrDefault } from './catalog.js';

export const DOC_VERSION = 2;
const AUTOSAVE_KEY = 'topologydrafter.autosave.v2';
const PREFS_KEY = 'topologydrafter.prefs.v2';
const MAX_HISTORY = 120;

let idSeq = 0;
export function uid(prefix = 'n') {
  idSeq += 1;
  return `${prefix}${Date.now().toString(36).slice(-4)}${idSeq.toString(36)}`;
}

export function newDoc(title = 'Untitled topology') {
  return { version: DOC_VERSION, title, nodes: [], links: [], zones: [], notes: [] };
}

export const state = {
  doc: newDoc(),
  selection: new Set(),
  view: { x: 0, y: 0, k: 1 },
  tool: 'select',        // select | link | zone | note | pan
  placingType: null,     // device id queued for click-to-place
  linkKind: 'lan',
  zoneColor: 'slate',
  snap: 10,
  snapOn: true,
  routing: 'orthogonal', // orthogonal | straight
  theme: 'light',
  showGrid: true,
  present: false,
  step: 0,
  filePath: null,        // FileSystemFileHandle when the browser supports it
  dirty: false,
};

// ---------------------------------------------------------------- events ----
const listeners = new Map();
export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => listeners.get(evt).delete(fn);
}
export function emit(evt, payload) {
  const set = listeners.get(evt);
  if (set) for (const fn of set) fn(payload);
}

/** Redraw everything that derives from state. */
export function changed({ structural = true } = {}) {
  if (structural) state.dirty = true;
  emit('change');
  scheduleAutosave();
}

// --------------------------------------------------------------- history ----
const past = [];
const future = [];
let pendingSnapshot = null;

/** Take a snapshot *before* mutating. Call this then mutate then changed(). */
export function commit(label = 'edit') {
  past.push({ label, doc: JSON.stringify(state.doc) });
  if (past.length > MAX_HISTORY) past.shift();
  future.length = 0;
  pendingSnapshot = null;
}

/**
 * For continuous gestures (drag, resize): snapshot once at gesture start,
 * push it only if the gesture actually changed something.
 */
export function beginGesture(label = 'move') {
  pendingSnapshot = { label, doc: JSON.stringify(state.doc) };
}
export function endGesture() {
  if (!pendingSnapshot) return;
  if (pendingSnapshot.doc !== JSON.stringify(state.doc)) {
    past.push(pendingSnapshot);
    if (past.length > MAX_HISTORY) past.shift();
    future.length = 0;
  }
  pendingSnapshot = null;
}
export function cancelGesture() { pendingSnapshot = null; }

export function undo() {
  const entry = past.pop();
  if (!entry) return false;
  future.push({ label: entry.label, doc: JSON.stringify(state.doc) });
  state.doc = JSON.parse(entry.doc);
  pruneSelection();
  changed();
  return true;
}
export function redo() {
  const entry = future.pop();
  if (!entry) return false;
  past.push({ label: entry.label, doc: JSON.stringify(state.doc) });
  state.doc = JSON.parse(entry.doc);
  pruneSelection();
  changed();
  return true;
}
export const canUndo = () => past.length > 0;
export const canRedo = () => future.length > 0;
export function resetHistory() { past.length = 0; future.length = 0; pendingSnapshot = null; }

// -------------------------------------------------------------- accessors ---
export const allItems = () => [
  ...state.doc.zones, ...state.doc.nodes, ...state.doc.links, ...state.doc.notes,
];
export const nodeById = (id) => state.doc.nodes.find((n) => n.id === id);
export const findItem = (id) => allItems().find((i) => i.id === id);

export function kindOf(id) {
  if (state.doc.nodes.some((n) => n.id === id)) return 'node';
  if (state.doc.links.some((l) => l.id === id)) return 'link';
  if (state.doc.zones.some((z) => z.id === id)) return 'zone';
  if (state.doc.notes.some((t) => t.id === id)) return 'note';
  return null;
}

export function selectedItems() {
  return [...state.selection].map((id) => ({ id, kind: kindOf(id), item: findItem(id) }))
    .filter((s) => s.item);
}
export function selectedNodes() {
  return state.doc.nodes.filter((n) => state.selection.has(n.id));
}

export function pruneSelection() {
  for (const id of [...state.selection]) if (!findItem(id)) state.selection.delete(id);
}

export function select(ids, { additive = false, toggle = false } = {}) {
  const list = Array.isArray(ids) ? ids : [ids];
  if (!additive && !toggle) state.selection.clear();
  for (const id of list) {
    if (!id) continue;
    if (toggle && state.selection.has(id)) state.selection.delete(id);
    else state.selection.add(id);
  }
  emit('selection');
  emit('change');
}
export function clearSelection() {
  if (!state.selection.size) return;
  state.selection.clear();
  emit('selection');
  emit('change');
}

// ------------------------------------------------------------- mutations ----
export function addNode(type, x, y, overrides = {}) {
  const dev = deviceOrDefault(type);
  const node = {
    id: uid('nd'),
    type: dev.id,
    x, y,
    label: dev.label,
    sublabel: '',
    services: [...dev.services],
    notes: '',
    step: 0,
    ...overrides,
  };
  state.doc.nodes.push(node);
  return node;
}

export function addLink(from, to, kind = state.linkKind, overrides = {}) {
  if (!from || !to || from === to) return null;
  const dup = state.doc.links.find(
    (l) => (l.from === from && l.to === to) || (l.from === to && l.to === from),
  );
  const link = {
    id: uid('lk'),
    from, to, kind,
    label: '',
    fromLabel: '',
    toLabel: '',
    directed: false,
    step: 0,
    // A second parallel link between the same pair gets nudged aside so both
    // stay visible (redundant uplinks are a normal thing to draw).
    offset: dup ? (state.doc.links.filter((l) =>
      (l.from === from && l.to === to) || (l.from === to && l.to === from)).length) * 16 : 0,
    ...overrides,
  };
  state.doc.links.push(link);
  return link;
}

export function addZone(x, y, w, h, overrides = {}) {
  const zone = {
    id: uid('zn'), x, y, w, h,
    label: 'Site', color: state.zoneColor, step: 0, ...overrides,
  };
  state.doc.zones.push(zone);
  return zone;
}

export function addNote(x, y, overrides = {}) {
  const note = {
    id: uid('tx'), x, y, w: 200,
    text: 'Note', size: 14, color: '#334155', step: 0, ...overrides,
  };
  state.doc.notes.push(note);
  return note;
}

export function removeIds(ids) {
  const set = new Set(ids);
  state.doc.nodes = state.doc.nodes.filter((n) => !set.has(n.id));
  state.doc.zones = state.doc.zones.filter((z) => !set.has(z.id));
  state.doc.notes = state.doc.notes.filter((t) => !set.has(t.id));
  // Links die with either endpoint.
  state.doc.links = state.doc.links.filter(
    (l) => !set.has(l.id) && !set.has(l.from) && !set.has(l.to),
  );
  pruneSelection();
}

export function loadDoc(doc, { name = null } = {}) {
  state.doc = migrate(doc);
  state.selection.clear();
  state.filePath = name;
  state.step = 0;
  resetHistory();
  state.dirty = false;
  emit('selection');
  emit('loaded');
  changed({ structural: false });
}

function migrate(raw) {
  const doc = { ...newDoc(raw.title || 'Untitled topology'), ...raw };
  doc.version = DOC_VERSION;
  for (const key of ['nodes', 'links', 'zones', 'notes']) {
    if (!Array.isArray(doc[key])) doc[key] = [];
  }
  for (const n of doc.nodes) {
    n.services = Array.isArray(n.services) ? n.services : [];
    n.step = n.step || 0;
    n.sublabel = n.sublabel || '';
  }
  for (const l of doc.links) {
    l.kind = l.kind || 'lan';
    l.step = l.step || 0;
    l.offset = l.offset || 0;
  }
  for (const z of doc.zones) z.step = z.step || 0;
  for (const t of doc.notes) { t.step = t.step || 0; t.w = t.w || 200; }
  // Drop links whose endpoints vanished, otherwise rendering has to guard.
  const ids = new Set(doc.nodes.map((n) => n.id));
  doc.links = doc.links.filter((l) => ids.has(l.from) && ids.has(l.to));
  return doc;
}

export function maxStep() {
  return allItems().reduce((m, i) => Math.max(m, i.step || 0), 0);
}

// -------------------------------------------------------------- autosave ----
let autosaveTimer = null;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state.doc));
    } catch { /* quota or private mode: not worth interrupting a lecture over */ }
  }, 600);
}

export function readAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const doc = JSON.parse(raw);
    if (!doc.nodes?.length && !doc.zones?.length && !doc.notes?.length) return null;
    return doc;
  } catch { return null; }
}

export function savePrefs() {
  const { snapOn, snap, routing, theme, showGrid, linkKind } = state;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ snapOn, snap, routing, theme, showGrid, linkKind }));
  } catch { /* ignore */ }
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch { /* ignore */ }
}
