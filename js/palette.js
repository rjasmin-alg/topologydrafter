// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Jasmin Redžepagić

// Left rail: searchable device palette. Drag an item onto the canvas, or click
// it to arm it and then click where you want it (fastest when placing a row of
// identical machines — hold Shift while clicking to stay armed).

import { DEVICES, DEVICE_CATEGORIES, SERVICES } from './catalog.js';
import { iconFor } from './icons.js';
import { state, changed } from './state.js';

let root;
let query = '';

export function initPalette(container) {
  root = container;
  root.innerHTML = `
    <div class="palette-search">
      <input type="search" id="palette-q" placeholder="Search devices and services…"
             autocomplete="off" spellcheck="false">
    </div>
    <div class="palette-list" id="palette-list"></div>`;

  root.querySelector('#palette-q').addEventListener('input', (e) => {
    query = e.target.value.trim().toLowerCase();
    renderList();
  });

  root.addEventListener('click', (e) => {
    const item = e.target.closest('[data-device]');
    if (!item) return;
    const type = item.dataset.device;
    state.placingType = state.placingType === type ? null : type;
    state.tool = 'select';
    changed({ structural: false });
    renderList();
  });

  root.addEventListener('dragstart', (e) => {
    const item = e.target.closest('[data-device]');
    if (!item) return;
    e.dataTransfer.setData('text/td-device', item.dataset.device);
    e.dataTransfer.effectAllowed = 'copy';
  });

  renderList();
}

export function refreshPalette() { renderList(); }

export function focusPaletteSearch() {
  const input = root?.querySelector('#palette-q');
  if (input) { input.focus(); input.select(); }
}

function matches(dev) {
  if (!query) return true;
  if (dev.label.toLowerCase().includes(query)) return true;
  if (dev.id.includes(query)) return true;
  // Searching "dns" should also surface every box that ships DNS by default.
  return dev.services.some((s) => {
    const svc = SERVICES[s];
    return svc && (svc.short.toLowerCase().includes(query) || svc.label.toLowerCase().includes(query));
  });
}

function renderList() {
  const list = root.querySelector('#palette-list');
  const byCat = new Map(DEVICE_CATEGORIES.map((c) => [c.id, []]));
  for (const dev of Object.values(DEVICES)) {
    if (matches(dev)) byCat.get(dev.category)?.push(dev);
  }

  let html = '';
  for (const cat of DEVICE_CATEGORIES) {
    const items = byCat.get(cat.id);
    if (!items.length) continue;
    html += `<section class="palette-group">
      <h3>${cat.label}</h3>
      <div class="palette-grid">${items.map(paintItem).join('')}</div>
    </section>`;
  }
  if (!html) html = '<p class="palette-empty">Nothing matches that.</p>';
  list.innerHTML = html;
}

function paintItem(dev) {
  const armed = state.placingType === dev.id ? ' armed' : '';
  const badges = dev.services.slice(0, 3)
    .map((s) => SERVICES[s]?.short).filter(Boolean).join(' · ');
  return `<button class="palette-item${armed}" data-device="${dev.id}" draggable="true"
                  title="${dev.label}${badges ? ` — ${badges}` : ''}">
    <svg viewBox="0 0 24 24" class="pal-ico" style="color:${dev.accent}" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1.6"
         stroke-linecap="round" stroke-linejoin="round">${iconFor(dev.icon)}</g>
    </svg>
    <span class="pal-label">${dev.label}</span>
  </button>`;
}
