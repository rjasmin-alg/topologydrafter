# TopologyDrafter

A browser-based drag-and-drop editor for **drawing** network topologies — the half of
Packet Tracer you use in front of a class, without the half you don't.

There is no configuration, no CLI, no simulation and nothing to validate. You drop a box,
call it `DC01`, tick the roles it runs, and the diagram says *this is the domain controller,
this one is read-only, that Linux box is the file server, these two sites talk over IPsec*.
Then you export a PNG into your slides.

**Use it online at <https://topodraw.online/>** — nothing to install, and nothing you draw
leaves your browser. To run your own copy:

```bash
./serve.sh            # http://localhost:8770 — opens your browser
./serve.sh 9000       # different port
```

ES modules need `http://`, so it will not work by double-clicking `index.html`. Any static
server will do — `serve.sh` just wraps `python3 -m http.server`. There is no build step and
nothing to install.

## What's in the box

**67 device types** across seven groups — routers, L2/L3/core/PoE switches, APs and WLCs,
firewalls (generic, NGFW/UTM, pfSense/OPNsense), IDS/IPS, WAF, proxies, VPN gateways, SIEM,
NAC, CAs, jump hosts, Windows and Linux servers, domain controllers and **read-only domain
controllers**, DNS/DHCP servers, Windows and Linux **file servers**, databases, mail, print,
backup, monitoring, hypervisors, container and Kubernetes hosts, NAS/SAN/tape, desktops,
laptops, phones, printers, cameras, IoT, and Internet/cloud/MPLS/SaaS/satellite clouds.

**69 services** you can pin to any box, drawn as coloured badges under it: `AD DS`, `RODC`,
`DNS`, `DHCP`, `GW`, `NAT`, `SMB`, `NFS`, `DFS`, `RADIUS`, `CA`, `VPN`, `IPSEC`, `WAF`,
`SIEM`, `K8S`, `SMTP`, `SSH`… Each device type arrives with sensible defaults — drop a
domain controller and it already says `AD DS · DNS · LDAP · KDC · GPO`.

**Zones** for sites, DMZs and trust boundaries. Drag a zone by its title tab and everything
inside travels with it. `Ctrl+G` wraps the current selection in one.

**Eight link kinds** — Ethernet, 802.1Q trunk, fibre, WAN, wireless, VPN tunnel, serial and
a dotted "logical relation". Per-link labels in the middle and at each end (`Gi0/1`, `eth0`),
optional direction arrow, and parallel links between the same pair fan apart automatically.

## Presenting

Press **P**. The chrome disappears, and:

- **Click a device** to spotlight it — everything not attached to it dims.
- **Step reveal:** give each element a *reveal step* in the inspector (0 = always visible),
  then use **←/→** to build the diagram up one tier at a time while you talk. The view does
  not rescale between steps, so nothing jumps around. The "Perimeter, DMZ and internal LAN"
  sample is set up this way.

You can bookmark a lecture directly:

```
index.html?sample=dmz&present=1&step=1&theme=dark
```

## Keyboard

| | |
|---|---|
| `V` `L` `Z` `T` | select · link · zone · text tools |
| `Space`+drag, middle-drag | pan (scroll wheel zooms, `Shift`+wheel scrolls) |
| `0` · `+` `-` | fit to content · zoom |
| `Ctrl+G` | wrap selection in a zone |
| `Ctrl+D` · `Del` | duplicate · delete |
| `Ctrl+Z` / `Ctrl+Y` | undo / redo |
| `Ctrl+S` · `Ctrl+O` | save / open `.json` |
| `Ctrl+Shift+C` | copy the diagram to the clipboard as PNG |
| `Ctrl+F` | jump to the palette search |
| arrows · `Shift`+arrows | nudge by 1px · by one grid step |
| `P` · `Esc` | presentation mode · cancel |

Drawing a cable: select a device, then drag one of the four blue dots on its edge onto
another device. Or press `L` and click the two devices in turn.

## Files and export

Documents are plain JSON — diff them, keep them in a repo, hand them to a student. In Chrome
and Edge, `Save` writes back to the same file via the File System Access API; elsewhere it
downloads. Everything you draw is also autosaved to `localStorage` and restored on the next
visit.

Export gives you PNG at 2× (slides) or 3× (print), a transparent PNG, or **SVG** — vector,
self-contained, with its own styles embedded, so it stays sharp on a projector and can be
recoloured later in Inkscape or Illustrator.

One caveat: exporting *while in presentation mode* exports what is currently revealed. That
is usually what you want; press `Esc` first if it isn't.

## Tests

Open `tests/smoke.html` in the running server. It exercises the catalog, layout, link
routing, undo/redo, every sample and the SVG exporter, and prints a pass/fail list — no
tooling required. Headless:

```bash
firefox --headless --screenshot /tmp/smoke.png http://localhost:8770/tests/smoke.html
```

## Adding your own devices and services

Everything lives in [`js/catalog.js`](js/catalog.js). A device is one row:

```js
['rodc', 'Read-only DC', 'servers', 'rodc', '#4f46e5', ['rodc', 'dns', 'ldap']],
//  id     label           category   icon    accent     default services
```

A service is one row too — `id`, badge text (≤ 6 characters), full name, group. New icons go
in [`js/icons.js`](js/icons.js) as inline SVG drawn in a 24×24 box. Run the smoke tests
afterwards; they will tell you if a device points at an icon or service that doesn't exist.

## Layout of the code

| File | |
|---|---|
| `js/catalog.js` | devices, services, link kinds, zone colours — the domain knowledge |
| `js/icons.js` | one inline SVG glyph per device type |
| `js/state.js` | document model, undo/redo, selection, autosave |
| `js/geom.js` | node layout, badge wrapping, link routing, hit testing |
| `js/render.js` | SVG painting, and the canvas CSS that ships inside exports |
| `js/interact.js` | pointer/drag/zoom/marquee, alignment, grouping |
| `js/palette.js` `js/inspector.js` | the two side rails |
| `js/exporters.js` | PNG, SVG, JSON |
| `js/samples.js` | the ready-made diagrams |
| `js/main.js` | toolbar, keyboard, presentation mode |

## Licence

Copyright (C) 2026 Jasmin Redžepagić.

TopologyDrafter is free software: you can redistribute it and/or modify it under the terms
of the [GNU Affero General Public License](LICENSE), version 3 or (at your option) any later
version. It comes with no warranty. If you run a modified copy as a public service, the AGPL
requires you to offer its users the source. The *source* link in the status bar does that
for this copy.
