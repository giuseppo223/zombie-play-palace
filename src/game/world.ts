import * as THREE from "three";
import { collideWalls, nearGate, resetGates } from "./zones";
import { resetUbers } from "./uber";

export type Zombie = {
  active: boolean;
  pos: THREE.Vector3;
  hp: number;
  maxHp: number;
  speed: number;
  phase: number;
  facing: number;
  hitFlash: number;
  dying: number; // 0 = alive, >0 = death animation timer
  attackCd: number;
  scale: number;
  /** damage dealt per hit */
  damage: number;
  boss: boolean;
  /** seconds spent far away in another zone (walls in the way) */
  stuck: number;
};

export type Tracer = {
  life: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
};

export type Pickup = {
  active: boolean;
  kind: "maxammo" | "instakill" | "double" | "nuke" | "speed";
  pos: THREE.Vector3;
  life: number;
};

export type Obstacle = { x: number; z: number; hx: number; hz: number; rot?: number };

export const ARENA_RADIUS = 82;
export const MAX_ZOMBIES = 40;
export const MAX_TRACERS = 24;
export const MAX_PICKUPS = 6;

export const input = {
  /** movement vector from keyboard or virtual stick, -1..1 */
  moveX: 0,
  moveY: 0,
  keys: new Set<string>(),
  firing: false,
  /** accumulated yaw delta from pointer / touch drag */
  yawDelta: 0,
  /** continuous aim from the right virtual stick, -1..1 (positive = turn right) */
  aimX: 0,
};

export const world = {
  yaw: 0,
  playerPos: new THREE.Vector3(0, 0, 0),
  playerVel: new THREE.Vector3(),
  playerBob: 0,
  muzzle: 0,
  shake: 0,
  hurt: 0,
  spawnTimer: 0,
  waveRemaining: 0,
  waveSpawned: 0,
  betweenWaves: 0,
  reloadTimer: 0,
  fireCd: 0,
  /** temporary power-up timers (seconds) */
  boost: { instakill: 0, double: 0, speed: 0 },
  zombies: [] as Zombie[],
  tracers: [] as Tracer[],
  pickups: [] as Pickup[],
  obstacles: [] as Obstacle[],
};

for (let i = 0; i < MAX_ZOMBIES; i++) {
  world.zombies.push({
    active: false,
    pos: new THREE.Vector3(),
    hp: 3,
    maxHp: 3,
    speed: 2,
    phase: 0,
    facing: 0,
    hitFlash: 0,
    dying: 0,
    attackCd: 0,
    scale: 1,
    damage: 9,
    boss: false,
    stuck: 0,
  });
}

for (let i = 0; i < MAX_TRACERS; i++) {
  world.tracers.push({ life: 0, from: new THREE.Vector3(), to: new THREE.Vector3() });
}

for (let i = 0; i < MAX_PICKUPS; i++) {
  world.pickups.push({ active: false, kind: "maxammo", pos: new THREE.Vector3(), life: 0 });
}

/** Deterministic pseudo-random so the city layout is stable across renders. */
export function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export type Building = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  tint: number;
};

/** Points of interest kept clear of buildings/props. */
export const POI = {
  station: { x: 8, z: 8 },
  /** mystery box sits in the first unlockable zone (east quarter) */
  box: { x: 26, z: 22 },
  /** pack-a-punch in the central square */
  pap: { x: -10, z: -7 },
  uberA: { x: Math.cos((28 * Math.PI) / 180) * 37, z: Math.sin((28 * Math.PI) / 180) * 37 },
  uberB: { x: Math.cos((118 * Math.PI) / 180) * 40, z: Math.sin((118 * Math.PI) / 180) * 40 },
  uberC: { x: Math.cos((212 * Math.PI) / 180) * 61, z: Math.sin((212 * Math.PI) / 180) * 61 },
  uberD: { x: Math.cos((303 * Math.PI) / 180) * 64, z: Math.sin((303 * Math.PI) / 180) * 64 },
};

/** Each perk machine stands alone in its own corner of the city. */
export const PERK_SPOTS: { id: "jugger" | "speed" | "doubletap" | "stamin" | "revive" | "deadshot" | "vulture" | "cherry"; x: number; z: number }[] =
  (() => {
    const ids = ["jugger", "speed", "doubletap", "stamin", "revive", "deadshot", "vulture", "cherry"] as const;
    let seed = 909;
    return ids.map((id, i) => {
      // keep clear of the zone walls (radial walls every 45°, ring walls at r=20/50/82)
      const a = (i / ids.length) * Math.PI * 2 + 0.2 + rand(seed++) * 0.2;
      const r = i % 2 === 0 ? 28 + rand(seed++) * 16 : 57 + rand(seed++) * 18;
      return { id, x: Math.cos(a) * r, z: Math.sin(a) * r };
    });
  })();

function nearPoi(x: number, z: number, r: number) {
  if (Object.values(POI).some((p) => Math.hypot(x - p.x, z - p.z) < r)) return true;
  if (nearGate(x, z, r + 1)) return true;
  return PERK_SPOTS.some((p) => Math.hypot(x - p.x, z - p.z) < r);
}

export const buildings: Building[] = (() => {
  const list: Building[] = [];
  let seed = 1;
  for (let ring = 0; ring < 6; ring++) {
    const count = 8 + ring * 4;
    const radius = 20 + ring * 13;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand(seed++) * 0.25;
      const r = radius + rand(seed++) * 6;
      const w = 5 + rand(seed++) * 5;
      const d = 5 + rand(seed++) * 5;
      const h = 7 + rand(seed++) * 26 + ring * 4;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const tint = rand(seed++);
      if (Math.hypot(x, z) < 14) continue;
      if (nearPoi(x, z, 9)) continue;
      list.push({ x, z, w, d, h, tint });
    }
  }
  return list;
})();

world.obstacles = buildings.map((b) => ({ x: b.x, z: b.z, hx: b.w / 2, hz: b.d / 2 }));

/** Props scattered around the street level (crates, barrels, cars). */
export type Prop = { kind: "car" | "barrel" | "crate"; x: number; z: number; rot: number };

export const props: Prop[] = (() => {
  const list: Prop[] = [];
  let seed = 500;
  for (let i = 0; i < 70; i++) {
    const a = rand(seed++) * Math.PI * 2;
    const r = 8 + rand(seed++) * (ARENA_RADIUS - 12);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const k = rand(seed++);
    const rot = rand(seed++) * Math.PI * 2;
    if (nearPoi(x, z, 5)) continue;
    list.push({ kind: k < 0.3 ? "car" : k < 0.65 ? "barrel" : "crate", x, z, rot });
  }
  return list;
})();

props.forEach((p) => {
  if (p.kind === "car") world.obstacles.push({ x: p.x, z: p.z, hx: 1.0, hz: 2.2, rot: p.rot });
  else if (p.kind === "crate") world.obstacles.push({ x: p.x, z: p.z, hx: 0.45, hz: 0.45, rot: p.rot });
  else world.obstacles.push({ x: p.x, z: p.z, hx: 0.45, hz: 0.45 });
});

// street lamps (same layout as City.tsx)
[
  { r: 15, n: 10 },
  { r: 42, n: 14 },
  { r: 68, n: 18 },
].forEach(({ r, n }, ri) => {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + ri * 0.3;
    world.obstacles.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, hx: 0.15, hz: 0.15 });
  }
});

// machines and devices: station, box, Pack-a-Punch, Überschnalle, perk machines
for (const [k, p] of Object.entries(POI)) {
  const h = k.startsWith("uber") ? 0.7 : 1.0;
  world.obstacles.push({ x: p.x, z: p.z, hx: h, hz: h });
}
PERK_SPOTS.forEach((p) => world.obstacles.push({ x: p.x, z: p.z, hx: 0.65, hz: 0.65 }));

/** Push a circle of `radius` out of every obstacle and keep it inside the arena. */
export function resolveCollisions(pos: THREE.Vector3, radius: number) {
  collideWalls(pos, radius);
  for (const o of world.obstacles) {
    const wx = pos.x - o.x;
    const wz = pos.z - o.z;
    const reach = Math.max(o.hx, o.hz) + radius + 0.5;
    if (wx > reach || wx < -reach || wz > reach || wz < -reach) continue;
    // move into the obstacle's local (rotated) frame
    const c = o.rot ? Math.cos(o.rot) : 1;
    const sn = o.rot ? Math.sin(o.rot) : 0;
    let dx = wx * c - wz * sn;
    let dz = wx * sn + wz * c;
    const ox = o.hx + radius - Math.abs(dx);
    const oz = o.hz + radius - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) dx += Math.sign(dx || 1) * ox;
      else dz += Math.sign(dz || 1) * oz;
      pos.x = o.x + dx * c + dz * sn;
      pos.z = o.z - dx * sn + dz * c;
    }
  }
  const d = Math.hypot(pos.x, pos.z);
  if (d > ARENA_RADIUS) {
    pos.x = (pos.x / d) * ARENA_RADIUS;
    pos.z = (pos.z / d) * ARENA_RADIUS;
  }
}

export function resetWorld() {
  resetGates();
  resetUbers();
  world.yaw = 0;
  world.playerPos.set(0, 0, 0);
  world.playerVel.set(0, 0, 0);
  world.spawnTimer = 0;
  world.waveRemaining = 0;
  world.waveSpawned = 0;
  world.betweenWaves = 1.5;
  world.reloadTimer = 0;
  world.fireCd = 0;
  world.hurt = 0;
  world.shake = 0;
  world.boost.instakill = 0;
  world.boost.double = 0;
  world.boost.speed = 0;
  world.zombies.forEach((z) => {
    z.active = false;
    z.dying = 0;
  });
  world.tracers.forEach((t) => (t.life = 0));
  world.pickups.forEach((p) => (p.active = false));
}

export function forward(yaw: number, out: THREE.Vector3) {
  return out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
}
