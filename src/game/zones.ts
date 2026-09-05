import * as THREE from "three";

/**
 * The city is split into 13 zones:
 *  - zone 0: the central square (r < R_INNER)
 *  - zones 1-4: four quarter sectors of the middle ring (R_INNER..R_MID)
 *  - zones 5-12: eight sectors of the outer ring (R_MID..R_OUTER)
 * Every boundary between two zones is a wall with one gate in it. Only some
 * gates can be bought open; the others are welded shut forever.
 */
export const R_INNER = 20;
export const R_MID = 50;
export const R_OUTER = 82;
export const WALL_H = 3.6;
export const WALL_T = 0.7;
export const GATE_W = 5.2;

export type Seg = { ax: number; az: number; bx: number; bz: number };

export type Gate = {
  id: number;
  x: number;
  z: number;
  /** yaw so that the gate's local X axis runs along the opening */
  yaw: number;
  /** the two zones this gate joins */
  a: number;
  b: number;
  openable: boolean;
  cost: number;
  open: boolean;
  /** visual opening progress 0..1 */
  anim: number;
  seg: Seg;
};

export const ZONE_NAMES = [
  "Piazza Centrale",
  "Quartiere Est",
  "Quartiere Nord",
  "Quartiere Ovest",
  "Quartiere Sud",
  "Porto",
  "Zona Industriale",
  "Ospedale",
  "Stazione Ferroviaria",
  "Cimitero",
  "Mercato",
  "Periferia",
  "Cantiere",
];

const TAU = Math.PI * 2;

function normAng(a: number) {
  a %= TAU;
  return a < 0 ? a + TAU : a;
}

/** Which zone contains world point (x, z). */
export function zoneAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r < R_INNER) return 0;
  const ang = normAng(Math.atan2(z, x));
  if (r < R_MID) return 1 + Math.min(3, Math.floor(ang / (Math.PI / 2)));
  return 5 + Math.min(7, Math.floor(ang / (Math.PI / 4)));
}

/** Random point inside a zone, at least `minDist` from (px, pz) when possible. */
export function randomPointInZone(zone: number, px: number, pz: number, minDist: number, out: THREE.Vector3) {
  let bestD = -1;
  for (let i = 0; i < 12; i++) {
    let x: number;
    let z: number;
    if (zone === 0) {
      const a = Math.random() * TAU;
      const r = 3 + Math.random() * (R_INNER - 6);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    } else {
      const ring1 = zone <= 4;
      const n = ring1 ? 4 : 8;
      const idx = ring1 ? zone - 1 : zone - 5;
      const span = TAU / n;
      const pad = 0.1;
      const a = idx * span + pad + Math.random() * (span - pad * 2);
      const r0 = (ring1 ? R_INNER : R_MID) + 3;
      const r1 = (ring1 ? R_MID : R_OUTER) - 3;
      const r = r0 + Math.random() * (r1 - r0);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    }
    const d = Math.hypot(x - px, z - pz);
    if (d > bestD) {
      bestD = d;
      out.set(x, 0, z);
    }
    if (d >= minDist) break;
  }
  return out;
}

export const walls: Seg[] = [];
export const gates: Gate[] = [];

function arc(r: number, a0: number, a1: number) {
  const len = (a1 - a0) * r;
  const n = Math.max(1, Math.ceil(len / 3.5));
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    walls.push({ ax: Math.cos(t0) * r, az: Math.sin(t0) * r, bx: Math.cos(t1) * r, bz: Math.sin(t1) * r });
  }
}

function radial(ang: number, r0: number, r1: number) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  walls.push({ ax: c * r0, az: s * r0, bx: c * r1, bz: s * r1 });
}

function addGate(a: number, b: number, x: number, z: number, yaw: number, seg: Seg) {
  gates.push({ id: gates.length, x, z, yaw, a, b, openable: false, cost: 0, open: false, anim: 0, seg });
}

/** arc wall of one sector with a gate in the middle */
function arcWithGate(r: number, a0: number, a1: number, inner: number, outer: number) {
  const mid = (a0 + a1) / 2;
  const half = GATE_W / 2 / r;
  arc(r, a0, mid - half);
  arc(r, mid + half, a1);
  const seg = {
    ax: Math.cos(mid - half) * r,
    az: Math.sin(mid - half) * r,
    bx: Math.cos(mid + half) * r,
    bz: Math.sin(mid + half) * r,
  };
  // tangent direction at mid angle
  addGate(inner, outer, Math.cos(mid) * r, Math.sin(mid) * r, -(mid + Math.PI / 2), seg);
}

function radialWithGate(ang: number, r0: number, r1: number, left: number, right: number) {
  const mid = (r0 + r1) / 2;
  radial(ang, r0, mid - GATE_W / 2);
  radial(ang, mid + GATE_W / 2, r1);
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const seg = { ax: c * (mid - GATE_W / 2), az: s * (mid - GATE_W / 2), bx: c * (mid + GATE_W / 2), bz: s * (mid + GATE_W / 2) };
  addGate(left, right, c * mid, s * mid, -ang, seg);
}

// --- build geometry (gate ids are stable in this order) ---
// 0..3   inner ring arcs: center <-> zone 1..4
for (let k = 0; k < 4; k++) arcWithGate(R_INNER, (k * Math.PI) / 2, ((k + 1) * Math.PI) / 2, 0, 1 + k);
// 4..7   radial walls in the middle ring at 0/90/180/270 degrees
for (let k = 0; k < 4; k++) {
  const prev = 1 + ((k + 3) % 4);
  radialWithGate((k * Math.PI) / 2, R_INNER, R_MID, prev, 1 + k);
}
// 8..15  middle ring arcs: zone 1..4 <-> zone 5..12
for (let j = 0; j < 8; j++) arcWithGate(R_MID, (j * Math.PI) / 4, ((j + 1) * Math.PI) / 4, 1 + Math.floor(j / 2), 5 + j);
// 16..23 radial walls in the outer ring every 45 degrees
for (let j = 0; j < 8; j++) {
  const prev = 5 + ((j + 7) % 8);
  radialWithGate((j * Math.PI) / 4, R_MID, R_OUTER, prev, 5 + j);
}

/**
 * Openable gates form two paths out of the central square so that every
 * zone has one or two working gates and the rest stay locked:
 *   centro -> Est -> Porto -> Industriale -> Ospedale -> Ferrovia -> Nord
 *   centro -> Sud -> Cantiere -> Periferia -> Mercato -> Cimitero -> Ovest
 */
const OPENABLE: Record<number, number> = {
  0: 750, // centro - est
  3: 750, // centro - sud
  8: 1000, // est - porto
  15: 1000, // sud - cantiere
  17: 1250, // porto - industriale
  23: 1250, // cantiere - periferia
  18: 1500, // industriale - ospedale
  22: 1500, // periferia - mercato
  19: 1750, // ospedale - ferrovia
  21: 1750, // mercato - cimitero
  11: 2000, // ferrovia - nord
  12: 2000, // cimitero - ovest
};
for (const g of gates) {
  const c = OPENABLE[g.id];
  if (c !== undefined) {
    g.openable = true;
    g.cost = c;
  }
}

export function resetGates() {
  for (const g of gates) {
    g.open = false;
    g.anim = 0;
  }
}

/** Zone ids the player can currently reach from the center. */
export function reachableZones(): Set<number> {
  const seen = new Set<number>([0]);
  const stack = [0];
  while (stack.length) {
    const z = stack.pop()!;
    for (const g of gates) {
      if (!g.open) continue;
      const other = g.a === z ? g.b : g.b === z ? g.a : -1;
      if (other >= 0 && !seen.has(other)) {
        seen.add(other);
        stack.push(other);
      }
    }
  }
  return seen;
}

/** True when (x, z) is within `r` of any gate opening (used to keep gates clear of buildings). */
export function nearGate(x: number, z: number, r: number) {
  return gates.some((g) => Math.hypot(x - g.x, z - g.z) < r);
}

function pushOutOfSeg(pos: THREE.Vector3, s: Seg, radius: number) {
  const dx = s.bx - s.ax;
  const dz = s.bz - s.az;
  const len2 = dx * dx + dz * dz || 1;
  let t = ((pos.x - s.ax) * dx + (pos.z - s.az) * dz) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = s.ax + dx * t;
  const cz = s.az + dz * t;
  let ox = pos.x - cx;
  let oz = pos.z - cz;
  const d2 = ox * ox + oz * oz;
  if (d2 >= radius * radius) return;
  let d = Math.sqrt(d2);
  if (d < 1e-4) {
    // exactly on the line: push along the wall normal
    ox = -dz;
    oz = dx;
    d = Math.sqrt(len2);
  }
  const push = radius - Math.sqrt(d2);
  pos.x += (ox / d) * push;
  pos.z += (oz / d) * push;
}

/** Push a circle out of every wall and every closed gate. */
export function collideWalls(pos: THREE.Vector3, radius: number) {
  const r = radius + WALL_T / 2;
  for (const s of walls) pushOutOfSeg(pos, s, r);
  for (const g of gates) if (!g.open) pushOutOfSeg(pos, g.seg, r);
}
