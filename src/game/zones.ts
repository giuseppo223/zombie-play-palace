import * as THREE from "three";

/**
 * The city is split into a central square plus sector zones on concentric
 * rings (see RING_B / RING_N).
 * Every boundary between two zones is a wall with one gate in it. Only some
 * gates can be bought open; the others are welded shut forever.
 */
/** Scale factor applied to the whole map layout (distances, not object sizes). */
export const MAP_SCALE = 10;
/** Ring boundaries (centre square + 4 rings) and how many sector zones each ring has. */
export const RING_B = [0, 18, 42, 70, 95, 115].map((r) => r * MAP_SCALE);
export const RING_N = [4, 6, 10, 14, 18];
/** Open plaza at the very centre: no walls inside this radius, so the spawn stays clear. */
export const CENTER_OPEN = 3 * MAP_SCALE;
const RING_OFF = RING_N.map((_, i) => RING_N.slice(0, i).reduce((a, b) => a + b, 0));
export const ZONE_COUNT = RING_N.reduce((a, b) => a + b, 0);
export const R_INNER = RING_B[1]!;
export const R_OUTER = RING_B[RING_B.length - 1]!;
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

const NAME_POOL = [
  "Quartiere Est", "Quartiere Nord", "Quartiere Ovest", "Quartiere Sud", "Porto", "Zona Industriale",
  "Ospedale", "Stazione Ferroviaria", "Cimitero", "Mercato", "Periferia", "Cantiere", "Università",
  "Stadio", "Raffineria", "Centrale Elettrica", "Borgo Vecchio", "Parco", "Darsena", "Aeroporto",
  "Prigione", "Fabbrica", "Cattedrale", "Metropolitana",
];
export const ZONE_NAMES = [
  "Piazza Centrale I",
  "Piazza Centrale II",
  "Piazza Centrale III",
  "Piazza Centrale IV",
  ...Array.from({ length: ZONE_COUNT - 4 }, (_, i) => NAME_POOL[i % NAME_POOL.length] + (i >= NAME_POOL.length ? " II" : "")),
];

const TAU = Math.PI * 2;

function normAng(a: number) {
  a %= TAU;
  return a < 0 ? a + TAU : a;
}

function ringOf(r: number) {
  for (let i = 1; i < RING_B.length; i++) if (r < RING_B[i]!) return i - 1;
  return RING_N.length - 1;
}

/** Which zone contains world point (x, z). */
export function zoneAt(x: number, z: number): number {
  const ring = ringOf(Math.hypot(x, z));
  const n = RING_N[ring]!;
  const sec = Math.min(n - 1, Math.floor(normAng(Math.atan2(z, x)) / (TAU / n)));
  return RING_OFF[ring]! + sec;
}

/** True when (x, z) is within `m` of a zone wall line. */
export function nearWall(x: number, z: number, m: number) {
  const r = Math.hypot(x, z);
  for (let i = 1; i < RING_B.length; i++) if (Math.abs(r - RING_B[i]!) < m) return true;
  const ring = ringOf(r);
  // the centre plaza has no radial walls inside CENTER_OPEN
  if (ring === 0 && r < CENTER_OPEN) return false;
  const span = TAU / RING_N[ring]!;
  const f = (normAng(Math.atan2(z, x)) / span) % 1;
  return Math.min(f, 1 - f) * span * r < m;
}

/** Random point inside a zone, at least `minDist` from (px, pz) when possible. */
export function randomPointInZone(zone: number, px: number, pz: number, minDist: number, out: THREE.Vector3) {
  // prefer spots fairly close to the player so zombies don't spawn kilometres away
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * TAU;
    const r = minDist + Math.random() * 25;
    const x = px + Math.cos(a) * r;
    const z = pz + Math.sin(a) * r;
    if (Math.hypot(x, z) < R_OUTER - 4 && zoneAt(x, z) === zone) {
      out.set(x, 0, z);
      return out;
    }
  }
  let bestD = -1;
  for (let i = 0; i < 12; i++) {
    let x: number;
    let z: number;
    {
      let ring = 0;
      while (ring < RING_N.length - 1 && zone >= RING_OFF[ring + 1]!) ring++;
      const idx = zone - RING_OFF[ring]!;
      const span = TAU / RING_N[ring]!;
      const pad = 0.05;
      const a = idx * span + pad + Math.random() * (span - pad * 2);
      const r0 = (ring === 0 ? CENTER_OPEN : RING_B[ring]!) + 3;
      const r1 = RING_B[ring + 1]! - 3;
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
  const n = Math.max(1, Math.ceil(len / 10));
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
for (let ring = 0; ring < RING_N.length; ring++) {
  const n = RING_N[ring]!;
  const off = RING_OFF[ring]!;
  // radial walls between neighbouring sectors of this ring
  // (the centre ring's walls start at CENTER_OPEN so the spawn plaza stays open)
  const rInner = ring === 0 ? CENTER_OPEN : RING_B[ring]!;
  for (let k = 0; k < n; k++) radialWithGate((k * TAU) / n, rInner, RING_B[ring + 1]!, off + ((k + n - 1) % n), off + k);
  // arc wall on the inner edge of this ring, one gate per outer sector
  if (ring === 0) continue;
  for (let k = 0; k < n; k++) {
    const a0 = (k * TAU) / n;
    const a1 = ((k + 1) * TAU) / n;
    const r = RING_B[ring]!;
    const mid = (a0 + a1) / 2;
    const inner = zoneAt(Math.cos(mid) * (r - 5), Math.sin(mid) * (r - 5));
    arcWithGate(r, a0, a1, inner, off + k);
  }
}

/** Every gate opens; each one opened raises the price of the next, up to 10000. */
export const GATE_COST_MIN = 500;
export const GATE_COST_MAX = 10000;
export function refreshGateCosts() {
  const opened = gates.filter((g) => g.open).length;
  const step = (GATE_COST_MAX - GATE_COST_MIN) / Math.max(1, gates.length - 1);
  const cost = Math.min(GATE_COST_MAX, Math.round((GATE_COST_MIN + opened * step) / 50) * 50);
  for (const g of gates) {
    g.openable = true;
    g.cost = cost;
  }
}
refreshGateCosts();

export function resetGates() {
  for (const g of gates) {
    g.open = false;
    g.anim = 0;
  }
  refreshGateCosts();
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
