# TopologyDrafter — plan & progress

**Goal:** a browser-based drag-and-drop network topology editor for lecturing.
Packet Tracer's *drawing* half, none of its configuration/simulation half. Draw two
sites talking over the Internet, drop a domain controller in one and an RODC in the
other, badge each box with the services it runs (DNS, DHCP, gateway, SMB…), and get
a clean PNG/SVG into a slide in under a minute.

**Explicit non-goals:** no device configuration, no CLI, no packet simulation, no
IP address validation. Labels are free text — if a slide says `10.0.0.1/24`, nobody
checks it. That is the point.

## Design decisions

| Decision | Why |
| --- | --- |
| Vanilla ES modules + inline SVG, **no build step, no npm install** | It has to still work in three years, five minutes before a lecture, on a machine you didn't prepare. `./serve.sh` and go. |
| Snapshot-based undo (whole doc as JSON) | Diagrams are small. Correctness beats memory efficiency here. |
| Full re-render on change, batched via rAF | Simple and correct; a teaching diagram is < 200 nodes. |
| Icons hand-drawn inline, no external assets | Exported SVG is self-contained; no licence questions about vendor icon sets. |
| Services are a *badge* on a node, not a nested object | The whole ask is "show that this box is the DNS" — a chip does that at projector distance. |
| Link routing biases vertical on near-diagonals | Tiered diagrams; a horizontal elbow wraps the cable to the far side of the target. |

## Progress — v1 complete

### Phase 1 — foundations
- [x] Survey what already exists (draw.io, NetworkMaps, Topolizer, NetMapper, GNS3/EVE-NG)
- [x] `js/catalog.js` — 67 device types, 69 services, 8 link kinds, zone colours
- [x] `js/icons.js` — inline SVG glyph per device type
- [x] `js/state.js` — document model, undo/redo, selection, autosave, prefs
- [x] `js/geom.js` — node layout, badge wrapping, link routing, hit testing

### Phase 2 — the editor
- [x] `js/render.js` — zones, links, nodes, badges, notes, overlays; export-safe CSS split
- [x] `js/interact.js` — drag, drop, link drawing, marquee, pan/zoom, resize, align, group
- [x] `js/palette.js` — searchable palette (searching "dns" finds boxes that run it)
- [x] `js/inspector.js` — device / link / zone / note / multi-select property panels
- [x] `index.html` + `css/style.css` — toolbar, rails, status bar

### Phase 3 — output & teaching aids
- [x] `js/exporters.js` — PNG 2×/3×/transparent, SVG, clipboard, JSON open/save
- [x] `js/samples.js` — two sites over the Internet · DMZ · three-tier campus
- [x] Presentation mode — hides chrome, click-to-spotlight
- [x] Step reveal — per-element step number, ←/→ builds the diagram up live
- [x] Bookmarkable lecture links — `?sample=dmz&present=1&step=1&theme=dark`

### Phase 4 — wrap up
- [x] `js/main.js` — toolbar, keyboard, presentation mode, error surfacing
- [x] `serve.sh` + `README.md` + project `CLAUDE.md`
- [x] `tests/smoke.html` — 23 checks, all passing (headless Firefox verified)
- [x] Row in `~/projects/PROJECTS.md`
- [x] `git init` + first commit

## Backlog (not doing yet — say the word)

- Per-port / interface anchors instead of tile-edge anchors
- Auto-layout (hierarchical: core → distribution → access)
- Printable legend generated from the services actually used in the diagram
- Multi-page documents (one topology per tab)
- Copy/paste between two open tabs
- A "handout" export: the diagram plus a numbered table of every device and its roles
- Shareable read-only link (needs a backend — there is none, by design)
