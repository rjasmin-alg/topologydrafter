// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Jasmin Redžepagić

// Geometry: node boxes, link anchors and path routing.
//
// A node's (x, y) is the centre of its icon tile. Labels and service badges
// hang below the tile and deliberately do NOT affect link routing — lines stay
// tidy no matter how much text a node carries.

export const TILE = 58;          // icon tile edge
export const NODE_W = 124;       // text column width
export const HALF = TILE / 2;
export const LINK_PAD = 5;       // gap between tile edge and where a link starts

// --------------------------------------------------------- text measuring ---
const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d');
const widthCache = new Map();

export function textWidth(text, font) {
  const key = `${font}\u0000${text}`;
  let w = widthCache.get(key);
  if (w === undefined) {
    measureCtx.font = font;
    w = measureCtx.measureText(text).width;
    if (widthCache.size > 4000) widthCache.clear();
    widthCache.set(key, w);
  }
  return w;
}

const FONT_LABEL = '600 13px system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_SUB = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_CHIP = '700 9px system-ui, -apple-system, "Segoe UI", sans-serif';

export function wrapText(text, font, maxWidth, maxLines = 2) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, font) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    // Ellipsise the last line if we ran out of room.
    const remaining = words.join(' ');
    const shown = lines.join(' ');
    if (shown.length < remaining.length) {
      let last = lines[maxLines - 1];
      while (last.length > 1 && textWidth(`${last}…`, font) > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

// ------------------------------------------------------------ node layout ---
const CHIP_H = 14;
const CHIP_GAP = 3;
const CHIP_PAD = 5;

/**
 * Full geometry for a node: tile, text lines, wrapped badge rows, hit box.
 * Pure function of the node's own fields, so it is safe to call per frame.
 */
export function layoutNode(node, services) {
  const tile = { x: node.x - HALF, y: node.y - HALF, w: TILE, h: TILE };
  const lines = wrapText(node.label, FONT_LABEL, NODE_W);
  let cursor = node.y + HALF + 14;

  const labelLines = lines.map((text, i) => ({ text, y: cursor + i * 14 }));
  if (labelLines.length) cursor += labelLines.length * 14 - 2;

  let sub = null;
  if (node.sublabel) {
    sub = { text: node.sublabel, y: cursor + 11 };
    cursor += 13;
  }

  const chipRows = [];
  const ids = (node.services || []).filter((id) => services[id]);
  if (ids.length) {
    let row = [];
    let rowW = 0;
    for (const id of ids) {
      const svc = services[id];
      const w = Math.ceil(textWidth(svc.short, FONT_CHIP)) + CHIP_PAD * 2;
      if (row.length && rowW + CHIP_GAP + w > NODE_W) {
        chipRows.push({ chips: row, width: rowW });
        row = [];
        rowW = 0;
      }
      rowW += (row.length ? CHIP_GAP : 0) + w;
      row.push({ id, short: svc.short, label: svc.label, color: svc.color, w });
    }
    if (row.length) chipRows.push({ chips: row, width: rowW });

    cursor += 4;
    for (const r of chipRows) {
      r.y = cursor;
      let x = node.x - r.width / 2;
      for (const chip of r.chips) {
        chip.x = x;
        x += chip.w + CHIP_GAP;
      }
      cursor += CHIP_H + CHIP_GAP;
    }
    cursor -= CHIP_GAP;
  }

  const top = tile.y - 4;
  const bottom = Math.max(cursor + 2, tile.y + TILE + 4);
  return {
    tile,
    labelLines,
    sub,
    chipRows,
    box: { x: node.x - NODE_W / 2, y: top, w: NODE_W, h: bottom - top },
  };
}

export const FONTS = { label: FONT_LABEL, sub: FONT_SUB, chip: FONT_CHIP };

// ---------------------------------------------------------- link routing ----

/** Point on a node's tile boundary, aimed at (tx, ty). */
export function edgePoint(node, tx, ty, pad = LINK_PAD) {
  const hw = HALF + pad;
  const hh = HALF + pad;
  const dx = tx - node.x;
  const dy = ty - node.y;
  if (!dx && !dy) return { x: node.x, y: node.y + hh, side: 'b' };
  const sx = dx ? hw / Math.abs(dx) : Infinity;
  const sy = dy ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  const side = sx <= sy ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'b' : 't');
  return { x: node.x + dx * s, y: node.y + dy * s, side };
}

/** Point on a given side of the tile, offset along that side. */
export function sidePoint(node, side, along = 0, pad = LINK_PAD) {
  const hw = HALF + pad;
  const hh = HALF + pad;
  const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v));
  switch (side) {
    case 'l': return { x: node.x - hw, y: node.y + clamp(along, HALF - 8), side };
    case 'r': return { x: node.x + hw, y: node.y + clamp(along, HALF - 8), side };
    case 't': return { x: node.x + clamp(along, HALF - 8), y: node.y - hh, side };
    default:  return { x: node.x + clamp(along, HALF - 8), y: node.y + hh, side };
  }
}

function roundedPolyline(pts, r = 8) {
  if (pts.length < 3) return `M${fmt(pts[0])}L${fmt(pts[pts.length - 1])}`;
  let d = `M${fmt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const p = pts[i];
    const prev = pts[i - 1];
    const next = pts[i + 1];
    const r1 = Math.min(r, dist(prev, p) / 2);
    const r2 = Math.min(r, dist(p, next) / 2);
    const a = lerpTo(p, prev, r1);
    const b = lerpTo(p, next, r2);
    d += `L${fmt(a)}Q${fmt(p)} ${fmt(b)}`;
  }
  d += `L${fmt(pts[pts.length - 1])}`;
  return d;
}

const fmt = (p) => `${round(p.x)} ${round(p.y)}`;
const round = (v) => Math.round(v * 10) / 10;
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
function lerpTo(from, to, d) {
  const len = dist(from, to) || 1;
  return { x: from.x + ((to.x - from.x) / len) * d, y: from.y + ((to.y - from.y) / len) * d };
}

/**
 * Route a link between two nodes.
 * `offset` fans parallel links apart so redundant uplinks stay readable.
 */
export function routeLink(a, b, { routing = 'orthogonal', offset = 0 } = {}) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Bias towards vertical: network diagrams are drawn in tiers, and on a near
  // diagonal a horizontal elbow makes the cable wrap around to the far side of
  // the target, which reads as a mistake.
  const horizontal = Math.abs(dx) >= Math.abs(dy) * 1.2;

  if (routing === 'straight') {
    const off = offset ? perpOffset(a, b, offset) : { x: 0, y: 0 };
    const p1 = edgePoint(a, b.x + off.x, b.y + off.y);
    const p2 = edgePoint(b, a.x + off.x, a.y + off.y);
    const s = { x: p1.x + off.x * 0.4, y: p1.y + off.y * 0.4 };
    const e = { x: p2.x + off.x * 0.4, y: p2.y + off.y * 0.4 };
    return { d: `M${fmt(s)}L${fmt(e)}`, start: s, end: e, mid: midOf(s, e), points: [s, e] };
  }

  let p1;
  let p2;
  let pts;
  if (horizontal) {
    const along = offset;
    p1 = sidePoint(a, dx > 0 ? 'r' : 'l', along);
    p2 = sidePoint(b, dx > 0 ? 'l' : 'r', along);
    const mx = round((p1.x + p2.x) / 2);
    pts = Math.abs(p1.y - p2.y) < 1
      ? [p1, p2]
      : [p1, { x: mx, y: p1.y }, { x: mx, y: p2.y }, p2];
  } else {
    const along = offset;
    p1 = sidePoint(a, dy > 0 ? 'b' : 't', along);
    p2 = sidePoint(b, dy > 0 ? 't' : 'b', along);
    const my = round((p1.y + p2.y) / 2);
    pts = Math.abs(p1.x - p2.x) < 1
      ? [p1, p2]
      : [p1, { x: p1.x, y: my }, { x: p2.x, y: my }, p2];
  }
  return {
    d: roundedPolyline(pts),
    start: p1,
    end: p2,
    mid: polylineMid(pts),
    points: pts,
  };
}

function perpOffset(a, b, amount) {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (-(b.y - a.y) / len) * amount, y: ((b.x - a.x) / len) * amount };
}

const midOf = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function polylineMid(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) total += dist(pts[i - 1], pts[i]);
  let walked = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const seg = dist(pts[i - 1], pts[i]);
    if (walked + seg >= total / 2) {
      return lerpTo(pts[i - 1], pts[i], total / 2 - walked);
    }
    walked += seg;
  }
  return pts[0];
}

/** Shortest distance from a point to a polyline — used for link hit testing. */
export function distanceToPolyline(pts, x, y) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i += 1) {
    best = Math.min(best, distToSegment(x, y, pts[i - 1], pts[i]));
  }
  return best;
}

function distToSegment(px, py, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = px - a.x;
  const wy = py - a.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0;
  return Math.hypot(px - (a.x + t * vx), py - (a.y + t * vy));
}

export const rectsIntersect = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const pointInRect = (x, y, r) =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export function normalizeRect(x1, y1, x2, y2) {
  return {
    x: Math.min(x1, x2), y: Math.min(y1, y2),
    w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
  };
}
