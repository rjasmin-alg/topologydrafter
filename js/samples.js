// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Jasmin Redžepagić

// Ready-made topologies. These double as the fastest way to start a lecture:
// load one, rename the boxes, delete what you don't need.

import { DOC_VERSION } from './state.js';
import { deviceOrDefault } from './catalog.js';

/** Tiny DSL so the diagrams below read like the picture they draw. */
function build(title, fn) {
  const doc = { version: DOC_VERSION, title, nodes: [], links: [], zones: [], notes: [] };
  const keys = new Map();
  let seq = 0;
  const next = (p) => `${p}${(seq += 1).toString(36)}`;

  const api = {
    node(key, type, x, y, label, sublabel = '', services = null, step = 0) {
      const id = next('n');
      keys.set(key, id);
      doc.nodes.push({
        id, type, x, y, label, sublabel, step, notes: '',
        services: services || [...deviceOrDefault(type).services],
      });
      return id;
    },
    link(a, b, kind = 'lan', opts = {}) {
      doc.links.push({
        id: next('l'), from: keys.get(a), to: keys.get(b), kind,
        label: '', fromLabel: '', toLabel: '', directed: false, offset: 0, step: 0, ...opts,
      });
    },
    zone(x, y, w, h, label, color = 'slate', step = 0) {
      doc.zones.push({ id: next('z'), x, y, w, h, label, color, step });
    },
    note(x, y, text, size = 14, color = '#334155', step = 0) {
      doc.notes.push({ id: next('t'), x, y, w: 320, text, size, color, step });
    },
  };
  fn(api);
  return doc;
}

// ---------------------------------------------------------------------------
const twoSites = () => build('Two sites over the Internet', (d) => {
  d.note(40, 90, 'Two sites, one directory', 24, '#0f172a');
  d.note(40, 120, 'Head office holds the writable DC; the branch gets a read-only copy.', 13, '#64748b');

  d.zone(40, 170, 680, 500, 'Head office — writable directory', 'blue');
  d.zone(1080, 170, 600, 500, 'Branch office — read-only', 'green');

  d.node('inet', 'internet', 900, 190, 'Internet', 'untrusted');

  // --- head office ---
  d.node('fw', 'ngfw', 350, 250, 'Edge firewall', '203.0.113.10');
  d.node('core', 'switch-core', 350, 390, 'Core switch', 'VLAN 10 / 20 / 30');
  d.node('dc', 'dc', 110, 560, 'DC01', '10.10.0.10');
  d.node('fs', 'file-server-w', 280, 560, 'FS01', '10.10.0.20 — \\\\FS01\\share');
  d.node('lin', 'file-server', 450, 560, 'files01', '10.10.0.30 — Samba + NFS');
  d.node('acc', 'switch-l2', 620, 390, 'Access switch', '');
  d.node('pcs', 'pc', 620, 560, 'Staff PCs', '×24, VLAN 20');

  d.link('fw', 'core', 'fiber', { fromLabel: 'LAN', toLabel: 'Te1/0/1' });
  d.link('core', 'acc', 'trunk', { label: '802.1Q' });
  d.link('core', 'dc');
  d.link('core', 'fs');
  d.link('core', 'lin');
  d.link('acc', 'pcs');

  // --- branch ---
  d.node('bfw', 'fw-oss', 1370, 250, 'Branch firewall', '198.51.100.7 — pfSense');
  d.node('bsw', 'switch-l2', 1370, 390, 'Branch switch', '');
  d.node('rodc', 'rodc', 1200, 560, 'RODC01', '10.20.0.10 — no writes');
  d.node('nas', 'nas', 1370, 560, 'NAS01', '10.20.0.20 — DFS replica');
  d.node('bpc', 'pc', 1540, 560, 'Branch PCs', '×8, VLAN 20');

  d.link('bfw', 'bsw');
  d.link('bsw', 'rodc');
  d.link('bsw', 'nas');
  d.link('bsw', 'bpc');

  // --- between the sites ---
  d.link('fw', 'inet', 'wan', { label: '1 Gb fibre' });
  d.link('inet', 'bfw', 'wan', { label: '200/50 Mb' });
  d.link('fw', 'bfw', 'vpn', { label: 'IPsec site-to-site', offset: 24 });

  d.note(760, 700,
    'Talking points:\n'
    + '· The RODC caches credentials but never writes back.\n'
    + '· DFS-R keeps FS01 and NAS01 in step over the tunnel.\n'
    + '· If the tunnel drops, the branch still logs in — locally.', 13, '#475569');
});

// ---------------------------------------------------------------------------
const dmz = () => build('Perimeter, DMZ and internal LAN', (d) => {
  d.note(140, 70, 'Three-legged perimeter', 24, '#0f172a');
  d.note(140, 100, 'Press → in presentation mode to build this up one tier at a time.', 13, '#64748b');

  d.node('inet', 'internet', 420, 190, 'Internet', '');
  d.node('fw', 'ngfw', 420, 330, 'Perimeter firewall', 'NAT + inspection');
  d.link('inet', 'fw', 'wan');

  // The DMZ hangs off its own switch — a firewall leg per server would put
  // cables straight through the neighbouring boxes.
  d.zone(640, 250, 680, 430, 'DMZ — published services', 'amber', 1);
  // Centred over the three servers so every drop routes vertically and
  // nothing is cabled through its neighbour.
  d.node('dmzsw', 'switch-l2', 940, 330, 'DMZ switch', '', null, 1);
  d.node('web', 'web-server', 760, 520, 'www01', '198.51.100.20', null, 1);
  d.node('mail', 'mail-server', 940, 520, 'mx01', '198.51.100.21', null, 1);
  d.node('rp', 'waf', 1120, 520, 'Reverse proxy', 'TLS termination', null, 1);
  d.link('fw', 'dmzsw', 'lan', { label: 'DMZ leg', step: 1 });
  d.link('dmzsw', 'web', 'lan', { step: 1 });
  d.link('dmzsw', 'mail', 'lan', { step: 1 });
  d.link('dmzsw', 'rp', 'lan', { step: 1 });

  d.node('ifw', 'firewall', 420, 540, 'Internal firewall', 'default deny inbound', null, 2);
  d.link('fw', 'ifw', 'lan', { label: 'inside leg', directed: true, step: 2 });

  d.zone(140, 650, 700, 380, 'Internal LAN — trusted', 'green', 2);
  d.node('core', 'switch-l3', 420, 730, 'Core switch', 'inter-VLAN routing', null, 2);
  d.node('dc', 'dc', 250, 900, 'DC01', '10.0.0.10', null, 2);
  d.node('fs', 'file-server', 420, 900, 'files01', '10.0.0.20 — Samba', null, 2);
  d.node('pcs', 'pc', 620, 900, 'Workstations', 'VLAN 20', null, 2);
  d.link('ifw', 'core', 'lan', { step: 2 });
  d.link('core', 'dc', 'lan', { step: 2 });
  d.link('core', 'fs', 'lan', { step: 2 });
  d.link('core', 'pcs', 'trunk', { step: 2 });

  d.note(1400, 300,
    'Why two firewalls?\n'
    + '· A compromise in the DMZ is still outside.\n'
    + '· Different rule owners, different change windows.\n'
    + '· One vendor bug does not open both doors.', 13, '#475569', 2);
});

// ---------------------------------------------------------------------------
const campus = () => build('Campus: core, distribution, access', (d) => {
  d.note(180, 70, 'Three-tier campus', 24, '#0f172a');

  d.node('rtr', 'router', 560, 170, 'Internet edge', 'BGP ×2');
  d.node('core1', 'switch-core', 400, 320, 'Core-1', '');
  d.node('core2', 'switch-core', 720, 320, 'Core-2', '');
  d.node('wlc', 'wlc', 1010, 320, 'WLC', 'controller-based APs');

  d.node('dist1', 'switch-l3', 290, 490, 'Dist-A', 'Building A');
  d.node('dist2', 'switch-l3', 830, 490, 'Dist-B', 'Building B');

  d.node('acc1', 'switch-poe', 170, 660, 'Access A1', '');
  d.node('acc2', 'switch-l2', 400, 660, 'Access A2', '');
  d.node('acc3', 'switch-l2', 720, 660, 'Access B1', '');
  d.node('acc4', 'switch-poe', 950, 660, 'Access B2', '');

  d.node('ap', 'ap', 170, 830, 'APs', 'SSID: staff / guest');
  d.node('pcs', 'pc', 400, 830, 'Labs', '×60');
  d.node('voip', 'ipphone', 720, 830, 'IP phones', 'voice VLAN 100');
  d.node('cam', 'camera', 950, 830, 'Cameras', 'PoE+');

  d.link('rtr', 'core1', 'fiber');
  d.link('rtr', 'core2', 'fiber');
  d.link('core1', 'core2', 'trunk', { label: 'MEC / stack' });
  d.link('core1', 'dist1', 'fiber');
  d.link('core2', 'dist1', 'fiber', { offset: 16 });
  d.link('core1', 'dist2', 'fiber', { offset: -16 });
  d.link('core2', 'dist2', 'fiber');
  d.link('core2', 'wlc');
  d.link('dist1', 'acc1', 'trunk');
  d.link('dist1', 'acc2', 'trunk');
  d.link('dist2', 'acc3', 'trunk');
  d.link('dist2', 'acc4', 'trunk');
  d.link('acc1', 'ap', 'lan');
  d.link('acc2', 'pcs');
  d.link('acc3', 'voip');
  d.link('acc4', 'cam');

  d.note(1130, 620,
    'Every access switch has two ways up.\n'
    + 'Pull one fibre in front of the class and\n'
    + 'ask what spanning-tree does next.', 13, '#475569');
});

export const SAMPLES = [
  { id: 'two-sites', label: 'Two sites over the Internet', hint: 'HQ + branch, DC and RODC, IPsec', make: twoSites },
  { id: 'dmz', label: 'Perimeter, DMZ and internal LAN', hint: 'demonstrates step-by-step reveal', make: dmz },
  { id: 'campus', label: 'Campus: core / distribution / access', hint: 'redundant three-tier design', make: campus },
];

export function makeSample(id) {
  return SAMPLES.find((s) => s.id === id)?.make() || null;
}
