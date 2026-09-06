// Right rail: properties for whatever is selected.
//
// Text fields edit the model live. Each focus-to-blur session collapses into a
// single undo entry, so Ctrl+Z after renaming a box undoes the rename, not the
// last keystroke.

import {
  state, on, commit, beginGesture, endGesture, changed, selectedItems,
  selectedNodes, kindOf, maxStep,
} from './state.js';
import { SERVICES, SERVICE_GROUPS, DEVICES, DEVICE_CATEGORIES, LINK_KINDS, ZONE_COLORS, deviceOrDefault } from './catalog.js';
import { alignSelection, connectSelection, groupIntoZone, duplicateSelection, deleteSelection } from './interact.js';

let root;
let serviceQuery = '';
let editing = false;

export function initInspector(container) {
  root = container;
  on('change', maybeRefresh);
  on('selection', () => { serviceQuery = ''; refresh(); });
  root.addEventListener('input', onInput);
  root.addEventListener('change', onInput);
  root.addEventListener('click', onClick);
  root.addEventListener('focusout', () => {
    if (editing) { endGesture(); editing = false; }
  });
  document.addEventListener('td:edit-name', () => {
    const field = root.querySelector('[data-field="label"], [data-field="text"]');
    if (field) { field.focus(); field.select?.(); }
  });
  refresh();
}

function maybeRefresh() {
  // Don't yank the DOM out from under a field the user is typing in.
  if (root.contains(document.activeElement) && editing) return;
  refresh();
}

function beginEdit() {
  if (!editing) { beginGesture('edit'); editing = true; }
}

// ------------------------------------------------------------------ render --
export function refresh() {
  const sel = selectedItems();
  if (!sel.length) { root.innerHTML = docPanel(); return; }
  if (sel.length > 1) { root.innerHTML = multiPanel(sel); return; }
  const { kind, item } = sel[0];
  root.innerHTML = kind === 'node' ? nodePanel(item)
    : kind === 'link' ? linkPanel(item)
      : kind === 'zone' ? zonePanel(item)
        : notePanel(item);
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function field(label, name, value, { type = 'text', placeholder = '' } = {}) {
  return `<label class="fld"><span>${label}</span>
    <input type="${type}" data-field="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`;
}

function stepField(item) {
  const max = maxStep();
  return `<label class="fld"><span>Reveal step
      <em title="0 = always visible. In presentation mode the arrow keys reveal higher steps one at a time.">?</em></span>
    <input type="number" min="0" max="99" data-field="step" value="${item.step || 0}">
    ${max ? `<small>diagram has ${max} step${max > 1 ? 's' : ''}</small>` : ''}</label>`;
}

// ---------------------------------------------------------------- document --
function docPanel() {
  const used = new Map();
  for (const n of state.doc.nodes) {
    for (const s of n.services) {
      if (SERVICES[s]) used.set(s, (used.get(s) || 0) + 1);
    }
  }
  const legend = [...used.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => {
    const svc = SERVICES[id];
    return `<li><span class="chip-swatch" style="background:${svc.color}">${svc.short}</span>
      <span class="legend-label">${svc.label}</span><span class="legend-count">${count}</span></li>`;
  }).join('');

  return `<div class="panel">
    <h2>Diagram</h2>
    ${field('Title', 'title', state.doc.title)}
    <div class="stat-row">
      <div><b>${state.doc.nodes.length}</b><span>devices</span></div>
      <div><b>${state.doc.links.length}</b><span>links</span></div>
      <div><b>${state.doc.zones.length}</b><span>zones</span></div>
    </div>
    <h3>Services in this diagram</h3>
    ${legend ? `<ul class="legend">${legend}</ul>`
    : '<p class="hint">No services yet. Select a device and tick the roles it runs.</p>'}
    <h3>Getting around</h3>
    <ul class="hint keys">
      <li><kbd>drag</kbd> from the palette, or click a device then click the canvas</li>
      <li>select a device, then drag one of its <b>blue dots</b> to cable it up</li>
      <li><kbd>L</kbd> link tool · <kbd>Z</kbd> zone · <kbd>T</kbd> text · <kbd>V</kbd> select</li>
      <li><kbd>Space</kbd>+drag or middle-drag to pan · scroll to zoom · <kbd>0</kbd> to fit</li>
      <li><kbd>Ctrl</kbd>+<kbd>G</kbd> wrap selection in a site box</li>
      <li><kbd>P</kbd> presentation mode</li>
    </ul>
  </div>`;
}

// -------------------------------------------------------------------- node --
function nodePanel(node) {
  const dev = deviceOrDefault(node.type);
  const options = DEVICE_CATEGORIES.map((cat) => {
    const items = Object.values(DEVICES).filter((d) => d.category === cat.id);
    return `<optgroup label="${cat.label}">${items.map((d) =>
      `<option value="${d.id}"${d.id === node.type ? ' selected' : ''}>${d.label}</option>`).join('')}</optgroup>`;
  }).join('');

  return `<div class="panel">
    <h2><span class="accent-dot" style="background:${dev.accent}"></span>Device</h2>
    ${field('Name', 'label', node.label)}
    ${field('Subtitle', 'sublabel', node.sublabel, { placeholder: 'e.g. 10.20.0.10 / dc01.lab.local' })}
    <label class="fld"><span>Type</span>
      <select data-field="type">${options}</select></label>

    <h3>Services <small>${node.services.length} on this box</small></h3>
    <input type="search" class="svc-filter" data-field="svcfilter" placeholder="Filter services…"
           value="${esc(serviceQuery)}">
    ${servicePicker(node)}

    <label class="fld"><span>Notes</span>
      <textarea data-field="notes" rows="3" placeholder="Not drawn — just for you">${esc(node.notes)}</textarea></label>
    ${stepField(node)}
    <div class="btn-row">
      <button data-act="reset-services">Reset to type defaults</button>
      <button data-act="duplicate">Duplicate</button>
      <button data-act="delete" class="danger">Delete</button>
    </div>
  </div>`;
}

function servicePicker(node) {
  const q = serviceQuery.toLowerCase();
  const own = new Set(node.services);
  let html = '';
  for (const [gid, group] of Object.entries(SERVICE_GROUPS)) {
    const items = Object.values(SERVICES).filter((s) => s.group === gid
      && (!q || s.short.toLowerCase().includes(q) || s.label.toLowerCase().includes(q)));
    if (!items.length) continue;
    html += `<div class="svc-group"><h4 style="color:${group.color}">${group.label}</h4>
      <div class="svc-wrap">${items.map((s) =>
      `<button class="svc${own.has(s.id) ? ' on' : ''}" data-service="${s.id}"
               style="--svc:${s.color}" title="${esc(s.label)}">${s.short}</button>`).join('')}</div></div>`;
  }
  return html || '<p class="hint">No service matches that filter.</p>';
}

// -------------------------------------------------------------------- link --
function linkPanel(link) {
  const a = state.doc.nodes.find((n) => n.id === link.from);
  const b = state.doc.nodes.find((n) => n.id === link.to);
  const kinds = Object.values(LINK_KINDS).map((k) =>
    `<option value="${k.id}"${k.id === link.kind ? ' selected' : ''}>${k.label}</option>`).join('');
  return `<div class="panel">
    <h2>Link</h2>
    <p class="endpoints">${esc(a?.label)} <span>→</span> ${esc(b?.label)}</p>
    <label class="fld"><span>Kind</span><select data-field="kind">${kinds}</select></label>
    ${field('Label (middle)', 'label', link.label, { placeholder: 'e.g. 1 Gb trunk, VLAN 10,20' })}
    ${field(`Label near ${esc(a?.label || 'A')}`, 'fromLabel', link.fromLabel, { placeholder: 'Gi0/1' })}
    ${field(`Label near ${esc(b?.label || 'B')}`, 'toLabel', link.toLabel, { placeholder: 'eth0' })}
    <label class="fld inline"><input type="checkbox" data-field="directed"
      ${link.directed ? 'checked' : ''}><span>Show direction arrow</span></label>
    <label class="fld"><span>Side offset <small>fan parallel links apart</small></span>
      <input type="range" min="-40" max="40" step="4" data-field="offset" value="${link.offset || 0}"></label>
    ${stepField(link)}
    <div class="btn-row">
      <button data-act="swap">Reverse</button>
      <button data-act="delete" class="danger">Delete</button>
    </div>
  </div>`;
}

// -------------------------------------------------------------------- zone --
function zonePanel(zone) {
  const swatches = ZONE_COLORS.map((c) =>
    `<button class="zone-swatch${c.id === zone.color ? ' on' : ''}" data-zonecolor="${c.id}"
             style="--zc:${c.color}" title="${c.label}"></button>`).join('');
  return `<div class="panel">
    <h2>Zone</h2>
    ${field('Label', 'label', zone.label, { placeholder: 'Head office / DMZ / Branch' })}
    <label class="fld"><span>Colour</span><div class="swatches">${swatches}</div></label>
    <div class="grid2">
      ${field('Width', 'w', Math.round(zone.w), { type: 'number' })}
      ${field('Height', 'h', Math.round(zone.h), { type: 'number' })}
    </div>
    ${stepField(zone)}
    <p class="hint">Drag the zone's title tab or its border to move it — everything
      inside travels with it. Click inside the zone to select the devices instead.</p>
    <div class="btn-row"><button data-act="delete" class="danger">Delete</button></div>
  </div>`;
}

// -------------------------------------------------------------------- note --
function notePanel(note) {
  return `<div class="panel">
    <h2>Text</h2>
    <label class="fld"><span>Text</span>
      <textarea data-field="text" rows="5">${esc(note.text)}</textarea></label>
    <div class="grid2">
      ${field('Size', 'size', note.size, { type: 'number' })}
      <label class="fld"><span>Colour</span>
        <input type="color" data-field="color" value="${note.color || '#334155'}"></label>
    </div>
    ${stepField(note)}
    <div class="btn-row"><button data-act="delete" class="danger">Delete</button></div>
  </div>`;
}

// ------------------------------------------------------------------- multi --
function multiPanel(sel) {
  const counts = sel.reduce((acc, s) => { acc[s.kind] = (acc[s.kind] || 0) + 1; return acc; }, {});
  const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}${v > 1 ? 's' : ''}`).join(', ');
  const nodes = selectedNodes();
  return `<div class="panel">
    <h2>${sel.length} selected</h2>
    <p class="hint">${summary}</p>
    ${nodes.length > 1 ? `
    <h3>Align</h3>
    <div class="align-grid">
      <button data-act="align:left" title="Align left">⇤</button>
      <button data-act="align:hcenter" title="Align centres">⇔</button>
      <button data-act="align:right" title="Align right">⇥</button>
      <button data-act="align:top" title="Align top">⇡</button>
      <button data-act="align:vcenter" title="Align middles">⇕</button>
      <button data-act="align:bottom" title="Align bottom">⇣</button>
      <button data-act="align:hspace" title="Space evenly across">↔≡</button>
      <button data-act="align:vspace" title="Space evenly down">↕≡</button>
    </div>
    <h3>Build</h3>
    <div class="btn-row">
      <button data-act="connect">Connect to first</button>
      <button data-act="group">Wrap in zone</button>
    </div>
    <h3>Services</h3>
    <p class="hint">Applies to all ${nodes.length} selected devices.</p>
    <input type="search" class="svc-filter" data-field="svcfilter" placeholder="Filter services…"
           value="${esc(serviceQuery)}">
    ${bulkServicePicker(nodes)}` : ''}
    <label class="fld"><span>Reveal step for all</span>
      <input type="number" min="0" max="99" data-field="bulkstep" value=""
             placeholder="set…"></label>
    <div class="btn-row">
      <button data-act="duplicate">Duplicate</button>
      <button data-act="delete" class="danger">Delete all</button>
    </div>
  </div>`;
}

function bulkServicePicker(nodes) {
  const q = serviceQuery.toLowerCase();
  const tally = new Map();
  for (const n of nodes) for (const s of n.services) tally.set(s, (tally.get(s) || 0) + 1);
  let html = '';
  for (const [gid, group] of Object.entries(SERVICE_GROUPS)) {
    const items = Object.values(SERVICES).filter((s) => s.group === gid
      && (!q || s.short.toLowerCase().includes(q) || s.label.toLowerCase().includes(q)));
    if (!items.length) continue;
    html += `<div class="svc-group"><h4 style="color:${group.color}">${group.label}</h4>
      <div class="svc-wrap">${items.map((s) => {
      const c = tally.get(s.id) || 0;
      const cls = c === 0 ? '' : c === nodes.length ? ' on' : ' partial';
      return `<button class="svc${cls}" data-service="${s.id}" style="--svc:${s.color}"
               title="${esc(s.label)}">${s.short}</button>`;
    }).join('')}</div></div>`;
  }
  return html;
}

// ------------------------------------------------------------------ events --
function onInput(e) {
  const target = e.target;
  const name = target.dataset.field;
  if (!name) return;

  if (name === 'svcfilter') {
    serviceQuery = target.value;
    const pos = target.selectionStart;
    refresh();
    const again = root.querySelector('.svc-filter');
    if (again) { again.focus(); again.setSelectionRange(pos, pos); }
    return;
  }

  if (name === 'title') {
    beginEdit();
    state.doc.title = target.value;
    document.dispatchEvent(new CustomEvent('td:title'));
    changed();
    return;
  }

  if (name === 'bulkstep') {
    const v = parseInt(target.value, 10);
    if (Number.isNaN(v)) return;
    commit('set step');
    for (const { item } of selectedItems()) item.step = Math.max(0, v);
    changed();
    return;
  }

  const sel = selectedItems();
  if (sel.length !== 1) return;
  const { kind, item } = sel[0];

  if (name === 'type') {
    commit('change type');
    item.type = target.value;
    // Keep the name if the user typed one; otherwise follow the new type.
    const old = DEVICES[Object.keys(DEVICES).find((k) => DEVICES[k].label === item.label)];
    if (old) item.label = deviceOrDefault(target.value).label;
    changed();
    refresh();
    return;
  }

  beginEdit();
  switch (name) {
    case 'step': item.step = Math.max(0, parseInt(target.value, 10) || 0); break;
    case 'directed': item.directed = target.checked; break;
    case 'offset': item.offset = parseInt(target.value, 10) || 0; break;
    case 'size': item.size = Math.max(6, parseInt(target.value, 10) || 14); break;
    case 'w': item.w = Math.max(60, parseInt(target.value, 10) || 60); break;
    case 'h': item.h = Math.max(60, parseInt(target.value, 10) || 60); break;
    case 'kind': item.kind = target.value; break;
    default: item[name] = target.value; break;
  }
  void kind;
  changed();
}

function onClick(e) {
  const svcBtn = e.target.closest('[data-service]');
  if (svcBtn) { toggleService(svcBtn.dataset.service); return; }

  const zc = e.target.closest('[data-zonecolor]');
  if (zc) {
    const sel = selectedItems()[0];
    if (sel?.kind === 'zone') {
      commit('zone colour');
      sel.item.color = zc.dataset.zonecolor;
      state.zoneColor = zc.dataset.zonecolor;
      changed();
      refresh();
    }
    return;
  }

  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  if (act.startsWith('align:')) { alignSelection(act.slice(6)); return; }
  switch (act) {
    case 'delete': deleteSelection(); break;
    case 'duplicate': duplicateSelection(); break;
    case 'connect': connectSelection(); break;
    case 'group': groupIntoZone(); break;
    case 'swap': {
      const link = selectedItems()[0]?.item;
      if (link) {
        commit('reverse link');
        [link.from, link.to] = [link.to, link.from];
        [link.fromLabel, link.toLabel] = [link.toLabel, link.fromLabel];
        changed();
        refresh();
      }
      break;
    }
    case 'reset-services': {
      const node = selectedItems()[0]?.item;
      if (node) {
        commit('reset services');
        node.services = [...deviceOrDefault(node.type).services];
        changed();
        refresh();
      }
      break;
    }
    default: break;
  }
}

function toggleService(id) {
  const nodes = selectedNodes();
  if (!nodes.length) return;
  commit('toggle service');
  const everyone = nodes.every((n) => n.services.includes(id));
  for (const n of nodes) {
    if (everyone) n.services = n.services.filter((s) => s !== id);
    else if (!n.services.includes(id)) n.services.push(id);
  }
  changed();
  refresh();
}

export { kindOf };
