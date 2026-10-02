// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Jasmin Redžepagić

// Inline SVG device glyphs, all drawn in a 0 0 24 24 box.
//
// The renderer wraps these in a <g class="ico"> that sets
// stroke:currentColor / fill:none, where currentColor is the device accent.
// Inside a glyph: class "f" = filled with currentColor, class "t" = emblem text.

const emblem = (ch, cx = 18.6, cy = 5.4) =>
  `<circle cx="${cx}" cy="${cy}" r="4.5" class="f"/><text x="${cx}" y="${cy + 2.5}" class="t">${ch}</text>`;

// A plain server tower, reused by most of the server-ish glyphs.
const tower = (x = 6.5, y = 2.5, w = 11, h = 19) => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.8"/>
  <path d="M${x + 2} ${y + 3.4}h${w - 4}M${x + 2} ${y + 6.6}h${w - 4}M${x + 2} ${y + 9.8}h${w - 5.5}"/>
  <circle cx="${x + w - 2.6}" cy="${y + 9.8}" r="0.9" class="f"/>`;

// A 1U-ish rack box, for the network gear.
const chassis = (y = 8, h = 11) => `<rect x="2" y="${y}" width="20" height="${h}" rx="2.4"/>`;

const cloudPath = 'M6.4 18.5a4.4 4.4 0 0 1-.5-8.8 5.6 5.6 0 0 1 10.7-1.5 4 4 0 0 1 .9 10.3z';

const monitorBody = `
  <rect x="2.5" y="4" width="19" height="12" rx="1.8"/>
  <path d="M9 20h6M12 16v4"/>`;

export const ICONS = {
  // ---------------- network ----------------
  router: `
    ${chassis()}
    <path d="M15.5 11.6h-8m0 0 2-2m-2 2 2 2"/>
    <path d="M8.5 15.4h8m0 0-2-2m2 2-2 2"/>`,

  switch: `
    ${chassis()}
    <path d="M7 16.6v-5m0 0-1.7 1.7M7 11.6l1.7 1.7"/>
    <path d="M10.7 11.6v5m0 0-1.7-1.7m1.7 1.7 1.7-1.7"/>
    <path d="M14.4 16.6v-5m0 0-1.7 1.7m1.7-1.7 1.7 1.7"/>
    <path d="M18.1 11.6v5m0 0-1.7-1.7m1.7 1.7 1.7-1.7"/>`,

  get switchL3() { return this.switch + emblem('3'); },
  get switchPoe() {
    return this.switch +
      `<circle cx="18.6" cy="5.4" r="4.5" class="f"/>
       <path d="M19.4 2.6 16.6 6.2h2.2l-1.2 2.9 3.4-3.9h-2.4z" fill="#fff" stroke="none"/>`;
  },

  switchCore: `
    <rect x="2" y="6" width="20" height="13" rx="2.4"/>
    <rect x="4.4" y="8.4" width="15.2" height="8.2" rx="1.4"/>
    <path d="M7.6 15.2v-4m0 0-1.4 1.4m1.4-1.4 1.4 1.4"/>
    <path d="M11 11.2v4m0 0-1.4-1.4M11 15.2l1.4-1.4"/>
    <path d="M14.4 15.2v-4m0 0-1.4 1.4m1.4-1.4 1.4 1.4"/>
    <path d="M17.8 11.2v4m0 0-1.4-1.4 1.4 1.4 1.4-1.4"/>`,

  hub: `
    ${chassis()}
    <circle cx="12" cy="13.5" r="2"/>
    <path d="M12 11.5V9M12 15.5V18M10 13.5H6.5M14 13.5H17.5"/>`,

  ap: `
    <rect x="5" y="13" width="14" height="6.5" rx="2.4"/>
    <circle cx="12" cy="16.2" r="1" class="f"/>
    <path d="M7.4 9.6a6.5 6.5 0 0 1 9.2 0"/>
    <path d="M9.7 12a3.3 3.3 0 0 1 4.6 0"/>
    <path d="M5.1 7.3a9.7 9.7 0 0 1 13.8 0"/>`,

  wlc: `
    ${chassis(10, 9)}
    <path d="M5.5 14.5h7"/>
    <circle cx="18" cy="14.5" r="1" class="f"/>
    <path d="M9.6 6.6a4.6 4.6 0 0 1 4.8 0M11.4 4.2a8.4 8.4 0 0 1 1.2 0"/>
    <path d="M12 2.6v4.6"/>`,

  lb: `
    <rect x="7.5" y="9.5" width="9" height="7" rx="1.8"/>
    <path d="M7.5 13H3.4m0 0 1.8-1.8M3.4 13l1.8 1.8"/>
    <path d="M16.5 13h4.1m-3.4-4.6 3.4 4.6-3.4 4.6"/>`,

  modem: `
    ${chassis(11, 8)}
    <path d="M5.5 15h5"/>
    <circle cx="17.5" cy="15" r="1" class="f"/>
    <path d="M8.6 7.6a5 5 0 0 1 6.8 0M6.4 5a8.2 8.2 0 0 1 11.2 0"/>`,

  patch: `
    <rect x="2" y="7.5" width="20" height="9" rx="1.8"/>
    <circle cx="6" cy="12" r="1.3"/><circle cx="10" cy="12" r="1.3"/>
    <circle cx="14" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>`,

  // ---------------- security ----------------
  firewall: `
    <rect x="2.5" y="5" width="19" height="14" rx="1.8"/>
    <path d="M2.5 9.7h19M2.5 14.3h19M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19"/>`,

  get ngfw() {
    return `
    <rect x="2.5" y="5" width="14.5" height="14" rx="1.8"/>
    <path d="M2.5 9.7h14.5M2.5 14.3h14.5M9 5v4.7M6 9.7v4.6M12 9.7v4.6M9 14.3V19"/>
    <path d="M18.6 8.4 22.4 10v3.3c0 2.1-1.6 3.6-3.8 4.5-2.2-.9-3.8-2.4-3.8-4.5V10z" class="f"/>`;
  },

  get firewallOss() {
    return `
    <rect x="2.5" y="5" width="19" height="14" rx="1.8"/>
    <path d="M2.5 9.7h19M2.5 14.3h19M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19"/>
    <circle cx="19" cy="5" r="5" class="f"/>
    <path d="M19 2.4v5.2M16.4 5h5.2M17.2 3.2l3.6 3.6M20.8 3.2l-3.6 3.6" stroke="#fff" stroke-width="1.3" fill="none"/>`;
  },

  ids: `
    <path d="M2.2 12S5.6 6.2 12 6.2 21.8 12 21.8 12 18.4 17.8 12 17.8 2.2 12 2.2 12"/>
    <circle cx="12" cy="12" r="2.8"/>
    <circle cx="12" cy="12" r="0.9" class="f"/>`,

  waf: `
    <path d="M12 2.6 20.4 6v6c0 4.4-3.4 7.5-8.4 9.4C7 19.5 3.6 16.4 3.6 12V6z"/>
    <circle cx="12" cy="11.4" r="3.6"/>
    <path d="M8.4 11.4h7.2M12 7.8c1.6 1.9 1.6 5.3 0 7.2-1.6-1.9-1.6-5.3 0-7.2"/>`,

  proxy: `
    <rect x="8.4" y="8.4" width="7.2" height="7.2" rx="1.6"/>
    <path d="M8.4 12H2.6m0 0 1.8-1.8M2.6 12l1.8 1.8"/>
    <path d="M21.4 12h-5.8m5.8 0-1.8-1.8m1.8 1.8-1.8 1.8"/>
    <path d="M12 8.4V3.2M12 15.6v5.2"/>`,

  vpn: `
    <rect x="4.6" y="10.6" width="14.8" height="9.4" rx="2.2"/>
    <path d="M8 10.6V7.8a4 4 0 0 1 8 0v2.8"/>
    <circle cx="12" cy="14.6" r="1.5" class="f"/>
    <path d="M12 16.1v2"/>`,

  siem: `
    <path d="M12 2.6 20.4 6v6c0 4.4-3.4 7.5-8.4 9.4C7 19.5 3.6 16.4 3.6 12V6z"/>
    <path d="M7.6 14.6l2.6-3.2 2.4 2.2 3.8-4.4"/>`,

  nac: `
    <circle cx="8.6" cy="12" r="3.4"/>
    <path d="M11.8 11.2h8.6v2.6h-2.2v2.2h-2.4v-2.2h-4z" class="f"/>`,

  ca: `
    <rect x="3.4" y="3.4" width="17.2" height="12.4" rx="1.8"/>
    <path d="M6.6 7.4h6.4M6.6 10.4h4.2"/>
    <circle cx="16.4" cy="9.6" r="2.4"/>
    <path d="M14.6 11.8 14 20l2.4-1.6 2.4 1.6-.6-8.2"/>`,

  bastion: `
    <path d="M4 20V9l3-2 5-3 5 3 3 2v11z"/>
    <path d="M4 13h16"/>
    <rect x="10" y="14.6" width="4" height="5.4" rx="0.8"/>`,

  // ---------------- servers & roles ----------------
  server: tower(),
  get winServer() {
    return tower() + `<path d="M15.4 14.4 19 13.9v3.4l-3.6.1zM19.6 13.8l3.2-.5v4l-3.2.1z" class="f"/>
      <path d="M15.4 18.1l3.6.1v3.3l-3.6-.6zM19.6 18.3l3.2.1v4.1l-3.2-.6z" class="f"/>`;
  },
  get linuxServer() {
    return tower() + `<circle cx="18.6" cy="17.6" r="4.9" class="f"/>
      <path d="M16.6 15.9l1.7 1.7-1.7 1.7M19.2 19.4h1.9" stroke="#fff" stroke-width="1.3" fill="none"/>`;
  },
  get dc() {
    return tower() + `<path d="M18.4 12.6 23 14.4v3.3c0 2.4-1.9 4-4.6 5-2.7-1-4.6-2.6-4.6-5v-3.3z" class="f"/>
      <path d="M16.4 17.8l1.5 1.5 2.8-3" stroke="#fff" stroke-width="1.3" fill="none"/>`;
  },
  get rodc() {
    return tower() + `<path d="M18.4 12.6 23 14.4v3.3c0 2.4-1.9 4-4.6 5-2.7-1-4.6-2.6-4.6-5v-3.3z" class="f"/>
      <text x="18.4" y="19.6" class="t" style="font-size:6.4px">RO</text>`;
  },
  get dns() { return tower() + emblem('D', 18.6, 17.6); },
  get dhcp() { return tower() + emblem('H', 18.6, 17.6); },

  get fileServer() {
    return tower(3.5, 2.5, 11, 19) +
      `<path d="M14.4 9.6h3.4l1.3 1.7h4.2v8.4a1.4 1.4 0 0 1-1.4 1.4h-7.5z" class="f"/>`;
  },
  get fileServerWin() {
    return tower(3.5, 2.5, 11, 19) +
      `<path d="M14.4 9.6h3.4l1.3 1.7h4.2v8.4a1.4 1.4 0 0 1-1.4 1.4h-7.5z" class="f"/>
       <path d="M16.6 14.4h2.2v2.2h-2.2zM19.6 14.2h2.4v2.5h-2.4zM16.6 17.4h2.2v2.2h-2.2zM19.6 17.4h2.4v2.3h-2.4z" fill="#fff" stroke="none"/>`;
  },

  web: `
    <circle cx="12" cy="12" r="9.2"/>
    <path d="M2.8 12h18.4"/>
    <path d="M12 2.8c2.6 2.6 3.9 6 3.9 9.2S14.6 18.6 12 21.2c-2.6-2.6-3.9-6-3.9-9.2S9.4 5.4 12 2.8"/>`,

  db: `
    <ellipse cx="12" cy="6.2" rx="8" ry="3.2"/>
    <path d="M4 6.2v11.6c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V6.2"/>
    <path d="M4 12c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2"/>`,

  mail: `
    <rect x="2.4" y="5" width="19.2" height="14" rx="2"/>
    <path d="m3.6 6.6 8.4 6.4 8.4-6.4"/>`,

  app: `
    <rect x="3" y="3" width="7.6" height="7.6" rx="1.6"/>
    <rect x="13.4" y="3" width="7.6" height="7.6" rx="1.6"/>
    <rect x="3" y="13.4" width="7.6" height="7.6" rx="1.6"/>
    <rect x="13.4" y="13.4" width="7.6" height="7.6" rx="1.6" class="f"/>`,

  printServer: `
    <path d="M6.6 8.6V3.4h10.8v5.2"/>
    <rect x="2.6" y="8.6" width="18.8" height="7.6" rx="1.8"/>
    <circle cx="18.2" cy="11.6" r="1" class="f"/>
    <path d="M6.6 13.6h10.8v7H6.6z"/>`,

  backup: `
    <ellipse cx="12" cy="6" rx="7.6" ry="3"/>
    <path d="M4.4 6v6.4c0 1.7 3.4 3 7.6 3"/>
    <path d="M13.4 21.2a5.4 5.4 0 1 0-4.6-8.2"/>
    <path d="M8.4 9.6v3.4h3.4"/>`,

  monitor: `
    <rect x="2.4" y="4" width="19.2" height="13" rx="2"/>
    <path d="M5.6 12.4 8.8 8.6l2.8 3 2.4-4.4 2 5.2 1.6-2"/>
    <path d="M8.6 20.6h6.8M12 17v3.6"/>`,

  update: `
    <path d="M20.4 12a8.4 8.4 0 1 1-2.6-6.1"/>
    <path d="M20.8 3.6v5h-5"/>
    <path d="M12 8.4v4.2l2.8 1.8"/>`,

  radius: `
    <circle cx="8" cy="12" r="3.6"/>
    <path d="M11.6 12h9.2v3h-2.4v-3M16 12v2.4" />
    <circle cx="8" cy="12" r="1" class="f"/>`,

  hypervisor: `
    <rect x="2.6" y="3" width="18.8" height="6.2" rx="1.6"/>
    <rect x="2.6" y="11" width="18.8" height="6.2" rx="1.6"/>
    <circle cx="6" cy="6.1" r="1" class="f"/><circle cx="6" cy="14.1" r="1" class="f"/>
    <path d="M2.6 20.4h18.8"/>`,

  container: `
    <path d="M2.6 12.6h18.8c0 4.6-3 7.8-8.4 7.8-5 0-8.6-2.6-10.4-7.8"/>
    <rect x="5" y="9" width="3.2" height="3.2"/><rect x="9" y="9" width="3.2" height="3.2"/>
    <rect x="13" y="9" width="3.2" height="3.2"/><rect x="9" y="5.2" width="3.2" height="3.2"/>`,

  k8s: `
    <path d="M12 2.4 20.6 6.6v8.8L12 21.6 3.4 15.4V6.6z"/>
    <circle cx="12" cy="12" r="2.4" class="f"/>
    <path d="M12 9.6V5.4M14.4 13.4l3 2.6M9.6 13.4l-3 2.6M14.3 10.6l3.4-1.4M9.7 10.6 6.3 9.2"/>`,

  pbx: `
    <rect x="2.6" y="4" width="18.8" height="16" rx="2.2"/>
    <path d="M6.8 8.4a9 9 0 0 0 8.8 8.8v-2.6l-2.8-.9-1.4 1.4a7 7 0 0 1-2.5-2.5l1.4-1.4-.9-2.8z" class="f"/>`,

  rack: `
    <rect x="4.6" y="2.4" width="14.8" height="19.2" rx="1.8"/>
    <path d="M7 6h10M7 9.4h10M7 12.8h10M7 16.2h10M7 19h6"/>
    <circle cx="17" cy="19" r="0.9" class="f"/>`,

  // ---------------- storage ----------------
  nas: `
    <rect x="3.4" y="4.4" width="17.2" height="15.2" rx="2"/>
    <rect x="6" y="7" width="12" height="3.2" rx="0.9"/>
    <rect x="6" y="11.6" width="12" height="3.2" rx="0.9"/>
    <circle cx="8.4" cy="17.4" r="1" class="f"/><circle cx="11.6" cy="17.4" r="1" class="f"/>`,

  san: `
    <rect x="2.4" y="3.4" width="19.2" height="5.4" rx="1.6"/>
    <rect x="2.4" y="9.4" width="19.2" height="5.4" rx="1.6"/>
    <rect x="2.4" y="15.4" width="19.2" height="5.4" rx="1.6"/>
    <circle cx="18.4" cy="6.1" r="1" class="f"/><circle cx="18.4" cy="12.1" r="1" class="f"/>
    <circle cx="18.4" cy="18.1" r="1" class="f"/>`,

  tape: `
    <rect x="2.4" y="5" width="19.2" height="14" rx="2"/>
    <circle cx="8.6" cy="11.4" r="3"/><circle cx="15.4" cy="11.4" r="3"/>
    <path d="M6 16.6h12"/>`,

  // ---------------- endpoints ----------------
  pc: monitorBody + `<path d="M6 7.4h8M6 10.2h5"/>`,

  laptop: `
    <path d="M5 5.4h14v9.2H5z"/>
    <path d="M2.4 17.8h19.2l-1.4-3.2H3.8z"/>`,

  thin: monitorBody + `<circle cx="12" cy="10" r="2.6"/>`,

  mobile: `
    <rect x="7" y="2.4" width="10" height="19.2" rx="2.2"/>
    <path d="M10.4 5.2h3.2"/><circle cx="12" cy="18.6" r="1.1" class="f"/>`,

  ipphone: `
    <rect x="4.4" y="2.6" width="15.2" height="18.8" rx="2.2"/>
    <rect x="6.8" y="5" width="10.4" height="4.4" rx="0.9"/>
    <circle cx="8.4" cy="12.6" r="1" class="f"/><circle cx="12" cy="12.6" r="1" class="f"/>
    <circle cx="15.6" cy="12.6" r="1" class="f"/><circle cx="8.4" cy="16" r="1" class="f"/>
    <circle cx="12" cy="16" r="1" class="f"/><circle cx="15.6" cy="16" r="1" class="f"/>`,

  printer: `
    <path d="M6.6 8.6V3.4h10.8v5.2"/>
    <rect x="2.6" y="8.6" width="18.8" height="7.6" rx="1.8"/>
    <path d="M6.6 13.6h10.8v7H6.6z"/>
    <path d="M8.8 16.2h6.4M8.8 18.4h4.4"/>`,

  camera: `
    <path d="M3 6.6 17.6 3l1.6 5.6L4.6 12.2z"/>
    <path d="M8.4 11.2 9.6 15M9.6 15H6.2M9.6 15h3.4M9.6 15v6"/>
    <circle cx="20.2" cy="10.6" r="2"/>`,

  iot: `
    <rect x="6.4" y="6.4" width="11.2" height="11.2" rx="2"/>
    <rect x="9.6" y="9.6" width="4.8" height="4.8" rx="1" class="f"/>
    <path d="M9.4 6.4V3.2M14.6 6.4V3.2M9.4 17.6v3.2M14.6 17.6v3.2M6.4 9.4H3.2M6.4 14.6H3.2M17.6 9.4h3.2M17.6 14.6h3.2"/>`,

  user: `
    <circle cx="12" cy="7.6" r="4.2"/>
    <path d="M3.8 20.8a8.2 8.2 0 0 1 16.4 0"/>`,

  // ---------------- internet & cloud ----------------
  internet: `
    <circle cx="12" cy="12" r="9.2"/>
    <path d="M2.8 12h18.4"/>
    <path d="M12 2.8c2.6 2.6 3.9 6 3.9 9.2S14.6 18.6 12 21.2c-2.6-2.6-3.9-6-3.9-9.2S9.4 5.4 12 2.8"/>
    <path d="M4.6 6.8c2 1.3 4.6 2 7.4 2s5.4-.7 7.4-2M4.6 17.2c2-1.3 4.6-2 7.4-2s5.4.7 7.4 2"/>`,

  cloud: `<path d="${cloudPath}"/>`,

  isp: `
    <path d="${cloudPath}"/>
    <path d="M12 17.8v-5.4M9.6 17.8l2.4-6 2.4 6M8.9 10.6a4.4 4.4 0 0 1 6.2 0" />`,

  mpls: `
    <path d="${cloudPath}"/>
    <circle cx="9" cy="13.6" r="1.3" class="f"/><circle cx="15" cy="11.4" r="1.3" class="f"/>
    <circle cx="13.4" cy="16.4" r="1.3" class="f"/>
    <path d="M9 13.6 15 11.4M9 13.6l4.4 2.8M15 11.4l-1.6 5"/>`,

  saas: `
    <path d="${cloudPath}"/>
    <path d="M9.2 13.4h5.6M9.2 15.8h5.6M12 11v6.4" stroke="#fff" stroke-width="1.4"/>`,

  publicCloud: `
    <path d="${cloudPath}" class="f"/>
    <path d="M8.6 13.2h6.8M8.6 15.8h4.4" stroke="#fff" stroke-width="1.4" fill="none"/>`,

  lte: `
    <path d="M4 18V6M4 6l7.6 12M11.6 18V6"/>
    <path d="M15.4 15.4a5 5 0 0 0 0-6.8M18.6 18a9.4 9.4 0 0 0 0-12"/>`,

  satellite: `
    <path d="M9.6 3.4 3.4 9.6l4.2 4.2 6.2-6.2z"/>
    <path d="M7.6 13.8 4 17.4a3 3 0 0 0 4.2 4.2l3.6-3.6"/>
    <path d="M15 9.6a5.6 5.6 0 0 1 0 7.4M18 6.6a9.6 9.6 0 0 1 0 13.4"/>`,

  // ---------------- other ----------------
  box: `
    <rect x="3" y="3" width="18" height="18" rx="2.4"/>
    <path d="M7.4 9h9.2M7.4 12.6h9.2M7.4 16.2h5.6"/>`,

  ups: `
    <rect x="5" y="2.6" width="14" height="18.8" rx="2"/>
    <path d="M12.8 6.4 9.4 12.6h3.2l-1.4 5 4-6.4h-3.2z" class="f"/>
    <path d="M7.6 19h8.8"/>`,
};

export function iconFor(key) {
  return ICONS[key] || ICONS.box;
}
