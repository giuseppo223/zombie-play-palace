import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { world, input, resolveCollisions, forward, type Zombie } from "./world";
import { useGame, type PickupKind } from "./store";
import { useUi, STATION_POS, BOX_POS, PERKS_POS, type Zone } from "./ui-store";

const SPEED = 6.4;
const DROP_CHANCE = 0.045;
const DROP_KINDS: PickupKind[] = ["maxammo", "instakill", "double", "nuke", "speed"];

function tryDrop(pos: THREE.Vector3) {
  if (Math.random() > DROP_CHANCE) return;
  const slot = world.pickups.find((p) => !p.active);
  if (!slot) return;
  slot.active = true;
  slot.kind = DROP_KINDS[Math.floor(Math.random() * DROP_KINDS.length)]!;
  slot.pos.copy(pos);
  slot.life = 30;
}

export function Player() {
  const group = useRef<THREE.Group>(null);
  const gun = useRef<THREE.Group>(null);
  const flash = useRef<THREE.PointLight>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);

  const torchTarget = useMemo(() => new THREE.Object3D(), []);

  const v = useMemo(
    () => ({
      fwd: new THREE.Vector3(),
      right: new THREE.Vector3(),
      move: new THREE.Vector3(),
      camPos: new THREE.Vector3(),
      look: new THREE.Vector3(),
      origin: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      tmp: new THREE.Vector3(),
    }),
    [],
  );

  function fireRay(g: ReturnType<typeof useGame.getState>, def: ReturnType<typeof g.weaponDef>) {
    forward(world.yaw, v.dir);
    v.dir.x += (Math.random() - 0.5) * def.spread * 2;
    v.dir.z += (Math.random() - 0.5) * def.spread * 2;
    v.dir.normalize();
    v.origin.copy(world.playerPos);
    v.origin.y = 1.35;

    // hitscan: zombies intersected along the ray, sorted by distance
    const hits: { t: number; z: Zombie; head: boolean }[] = [];
    for (const z of world.zombies) {
      if (!z.active || z.dying > 0) continue;
      v.tmp.set(z.pos.x - v.origin.x, 0, z.pos.z - v.origin.z);
      const t = v.tmp.x * v.dir.x + v.tmp.z * v.dir.z;
      if (t < 0 || t > 70) continue;
      const px = v.origin.x + v.dir.x * t;
      const pz = v.origin.z + v.dir.z * t;
      const lateral = Math.hypot(z.pos.x - px, z.pos.z - pz);
      const bodyR = 0.42 * z.scale;
      const headR = 0.24 * z.scale;
      const headY = 1.63 * z.scale;
      const bodyTop = 1.4 * z.scale;
      const rayY = v.origin.y;
      if (lateral < headR && Math.abs(rayY - headY) < headR + 0.12) hits.push({ t, z, head: true });
      else if (lateral < bodyR && rayY < bodyTop) hits.push({ t, z, head: false });
    }
    hits.sort((a, b) => a.t - b.t);
    const targets = def.pierce ? hits : hits.slice(0, 1);

    const tracer = world.tracers.find((tr) => tr.life <= 0);
    const endT = def.pierce ? 70 : hits[0] ? hits[0].t : 70;
    if (tracer) {
      tracer.life = 0.09;
      tracer.from.set(v.origin.x + v.dir.x * 0.8, 1.35, v.origin.z + v.dir.z * 0.8);
      tracer.to.set(v.origin.x + v.dir.x * endT, 1.35, v.origin.z + v.dir.z * endT);
    }

    for (const h of targets) {
      const z = h.z;
      const dmg = world.boost.instakill > 0 ? 999 : def.damage * (h.head ? 2.5 : 1);
      z.hp -= dmg;
      z.hitFlash = 1;
      if (z.hp <= 0) {
        z.dying = 0.001;
        g.addKill(h.head ? 160 : 90);
        tryDrop(z.pos);
      } else {
        g.addHit(h.head ? 40 : 15);
      }
    }
  }

  function shoot() {
    const g = useGame.getState();
    const def = g.weaponDef();
    if (g.reloading) return;
    if (g.ammo <= 0) {
      if (g.reserve > 0) {
        g.setReloading(true);
        world.reloadTimer = def.reload;
      }
      return;
    }
    g.spendAmmo();
    world.fireCd = def.fireRate;
    world.muzzle = 1;
    world.shake = Math.min(1, world.shake + (def.pellets ? 0.45 : 0.25));
    for (let i = 0; i < (def.pellets ?? 1); i++) fireRay(g, def);
  }

  useFrame(({ camera }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const g = useGame.getState();
    const playing = g.phase === "playing";

    // camera yaw from drag / mouse
    world.yaw -= input.yawDelta * 0.0032;
    input.yawDelta = 0;

    forward(world.yaw, v.fwd);
    v.right.set(-v.fwd.z, 0, v.fwd.x);

    if (playing) {
      const k = input.keys;
      let mx = input.moveX;
      let my = input.moveY;
      if (k.has("KeyD") || k.has("ArrowRight")) mx += 1;
      if (k.has("KeyA") || k.has("ArrowLeft")) mx -= 1;
      if (k.has("KeyW") || k.has("ArrowUp")) my += 1;
      if (k.has("KeyS") || k.has("ArrowDown")) my -= 1;
      const len = Math.hypot(mx, my);
      if (len > 1) {
        mx /= len;
        my /= len;
      }
      let sprint = k.has("ShiftLeft") || k.has("ShiftRight") ? 1.35 : 1;
      if (g.perks.includes("stamin")) sprint *= 1.18;
      if (world.boost.speed > 0) sprint *= 1.3;
      v.move.set(0, 0, 0).addScaledVector(v.fwd, my).addScaledVector(v.right, mx);
      world.playerPos.addScaledVector(v.move, SPEED * sprint * delta);
      resolveCollisions(world.playerPos, 0.42);
      world.playerBob += len * delta * (sprint > 1 ? 12 : 8);

      // reload
      if (world.reloadTimer > 0) {
        world.reloadTimer -= delta;
        if (world.reloadTimer <= 0) g.finishReload();
      } else if (g.ammo <= 0 && g.reserve > 0 && !g.reloading) {
        g.setReloading(true);
        world.reloadTimer = g.weaponDef().reload;
      }

      // firing
      world.fireCd -= delta;
      const def = g.weaponDef();
      if (input.firing && world.fireCd <= 0) {
        shoot();
        if (!def.auto) input.firing = false;
      }

      // interaction zones
      const px = world.playerPos.x;
      const pz = world.playerPos.z;
      let zone: Zone = null;
      if (Math.hypot(px - STATION_POS.x, pz - STATION_POS.z) < 4) zone = "station";
      else if (Math.hypot(px - BOX_POS.x, pz - BOX_POS.z) < 4) zone = "box";
      else if (Math.hypot(px - PERKS_POS.x, pz - PERKS_POS.z) < 4.5) zone = "perks";
      if (zone !== useUi.getState().zone) useUi.getState().setZone(zone);

      // pickups
      for (const p of world.pickups) {
        if (!p.active) continue;
        p.life -= delta;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        if (Math.hypot(px - p.pos.x, pz - p.pos.z) < 1.3) {
          p.active = false;
          g.applyPickup(p.kind);
        }
      }

      // boost timers -> store only when the displayed second changes
      const b = world.boost;
      b.instakill = Math.max(0, b.instakill - delta);
      b.double = Math.max(0, b.double - delta);
      b.speed = Math.max(0, b.speed - delta);
      const ui = g.boosts;
      const ci = Math.ceil(b.instakill);
      const cd = Math.ceil(b.double);
      const cs = Math.ceil(b.speed);
      if (ci !== ui.instakill || cd !== ui.double || cs !== ui.speed) {
        g.syncBoosts({ instakill: ci, double: cd, speed: cs });
      }

      g.tickBanner(delta);
    }

    world.muzzle = Math.max(0, world.muzzle - delta * 8);
    world.hurt = Math.max(0, world.hurt - delta * 1.6);
    world.shake = Math.max(0, world.shake - delta * 2.2);

    // player transform
    const gr = group.current;
    if (gr) {
      gr.position.set(world.playerPos.x, Math.abs(Math.sin(world.playerBob)) * 0.05, world.playerPos.z);
      gr.rotation.y = world.yaw;
      const swing = Math.sin(world.playerBob) * 0.55;
      if (legL.current) legL.current.rotation.x = swing;
      if (legR.current) legR.current.rotation.x = -swing;
      if (gun.current) gun.current.rotation.x = -0.06 - world.muzzle * 0.25;
    }
    if (flash.current) flash.current.intensity = world.muzzle * 70;

    // third-person camera
    const shake = world.shake * 0.12;
    v.camPos
      .copy(world.playerPos)
      .addScaledVector(v.fwd, -4.6)
      .addScaledVector(v.right, 0.9);
    v.camPos.y = 2.9;
    v.camPos.x += (Math.random() - 0.5) * shake;
    v.camPos.y += (Math.random() - 0.5) * shake;
    camera.position.lerp(v.camPos, 1 - Math.exp(-14 * delta));
    v.look.copy(world.playerPos).addScaledVector(v.fwd, 10).addScaledVector(v.right, 0.55);
    v.look.y = 1.5;
    camera.lookAt(v.look);
  });

  return (
    <group ref={group}>
      {/* torso */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[0.55, 0.75, 0.32]} />
        <meshStandardMaterial color="#2f3a33" roughness={0.85} />
      </mesh>
      {/* hood / head */}
      <mesh position={[0, 1.63, 0]} castShadow>
        <boxGeometry args={[0.3, 0.32, 0.3]} />
        <meshStandardMaterial color="#c9b79c" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.68, -0.04]} castShadow>
        <boxGeometry args={[0.38, 0.3, 0.34]} />
        <meshStandardMaterial color="#3b4a3f" roughness={0.95} />
      </mesh>
      {/* backpack */}
      <mesh position={[0, 1.1, 0.24]} castShadow>
        <boxGeometry args={[0.4, 0.5, 0.2]} />
        <meshStandardMaterial color="#4a3f2f" roughness={0.95} />
      </mesh>
      {/* legs */}
      <mesh ref={legL} position={[-0.15, 0.4, 0]} castShadow>
        <boxGeometry args={[0.2, 0.8, 0.22]} />
        <meshStandardMaterial color="#22282c" roughness={0.95} />
      </mesh>
      <mesh ref={legR} position={[0.15, 0.4, 0]} castShadow>
        <boxGeometry args={[0.2, 0.8, 0.22]} />
        <meshStandardMaterial color="#22282c" roughness={0.95} />
      </mesh>
      {/* arms + weapon */}
      <group ref={gun} position={[0.26, 1.28, -0.1]}>
        <mesh position={[0, 0, -0.35]} castShadow>
          <boxGeometry args={[0.13, 0.13, 0.7]} />
          <meshStandardMaterial color="#c9b79c" roughness={0.9} />
        </mesh>
        <mesh position={[-0.3, 0, -0.35]} castShadow>
          <boxGeometry args={[0.13, 0.13, 0.7]} />
          <meshStandardMaterial color="#c9b79c" roughness={0.9} />
        </mesh>
        <mesh position={[-0.14, 0.02, -0.78]} castShadow>
          <boxGeometry args={[0.1, 0.16, 0.85]} />
          <meshStandardMaterial color="#14181c" roughness={0.4} metalness={0.8} />
        </mesh>
        <pointLight ref={flash} position={[-0.14, 0.02, -1.2]} color="#ffd28a" distance={12} decay={2} intensity={0} />
      </group>
      {/* torch beam */}
      <primitive object={torchTarget} position={[0, 0.5, -14]} />
      <spotLight
        position={[0, 1.5, -0.2]}
        target={torchTarget}
        angle={0.55}
        penumbra={0.65}
        intensity={110}
        distance={34}
        decay={1.6}
        color="#dfe7ef"
      />
      {/* soft key + rim light so the survivor reads against the dark city */}
      <pointLight position={[1.1, 2.4, 1.6]} intensity={9} distance={9} decay={2} color="#9fb4c8" />
      <pointLight position={[-1.2, 1.4, -1.4]} intensity={5} distance={7} decay={2} color="#c9d4c5" />
    </group>
  );
}
