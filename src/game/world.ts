import * as THREE from "three";

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
};

export type Tracer = {
  life: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
};

export type Obstacle = { x: number; z: number; hx: number; hz: number };

export const ARENA_RADIUS = 46;
export const MAX_ZOMBIES = 34;
export const MAX_TRACERS = 10;

export const input = {
  /** movement vector from keyboard or virtual stick, -1..1 */
  moveX: 0,
  moveY: 0,
  keys: new Set<string>(),
  firing: false,
  /** accumulated yaw delta from pointer / touch drag */
  yawDelta: 0,
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
  zombies: [] as Zombie[],
  tracers: [] as Tracer[],
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
  });
}

for (let i = 0; i < MAX_TRACERS; i++) {
  world.tracers.push({ life: 0, from: new THREE.Vector3(), to: new THREE.Vector3() });
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

export const buildings: Building[] = (() => {
  const list: Building[] = [];
  let seed = 1;
  for (let ring = 0; ring < 3; ring++) {
    const count = 8 + ring * 4;
    const radius = 20 + ring * 13;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand(seed++) * 0.25;
      const r = radius + rand(seed++) * 6;
      const w = 5 + rand(seed++) * 5;
      const d = 5 + rand(seed++) * 5;
      const h = 7 + rand(seed++) * 26 + ring * 5;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.hypot(x, z) < 14) continue;
      list.push({ x, z, w, d, h, tint: rand(seed++) });
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
  for (let i = 0; i < 26; i++) {
    const a = rand(seed++) * Math.PI * 2;
    const r = 8 + rand(seed++) * 30;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const k = rand(seed++);
    list.push({
      kind: k < 0.3 ? "car" : k < 0.65 ? "barrel" : "crate",
      x,
      z,
      rot: rand(seed++) * Math.PI * 2,
    });
  }
  return list;
})();

props.forEach((p) => {
  if (p.kind === "car") world.obstacles.push({ x: p.x, z: p.z, hx: 1.2, hz: 2.4 });
  else world.obstacles.push({ x: p.x, z: p.z, hx: 0.6, hz: 0.6 });
});

/** Push a circle of `radius` out of every obstacle and keep it inside the arena. */
export function resolveCollisions(pos: THREE.Vector3, radius: number) {
  for (const o of world.obstacles) {
    const dx = pos.x - o.x;
    const dz = pos.z - o.z;
    const ox = o.hx + radius - Math.abs(dx);
    const oz = o.hz + radius - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) pos.x += Math.sign(dx || 1) * ox;
      else pos.z += Math.sign(dz || 1) * oz;
    }
  }
  const d = Math.hypot(pos.x, pos.z);
  if (d > ARENA_RADIUS) {
    pos.x = (pos.x / d) * ARENA_RADIUS;
    pos.z = (pos.z / d) * ARENA_RADIUS;
  }
}

export function resetWorld() {
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
  world.zombies.forEach((z) => {
    z.active = false;
    z.dying = 0;
  });
  world.tracers.forEach((t) => (t.life = 0));
}

export function forward(yaw: number, out: THREE.Vector3) {
  return out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
}
