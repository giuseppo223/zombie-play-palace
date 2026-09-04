import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { world, input, resolveCollisions, forward, type Zombie } from "./world";
import { useGame, type PickupKind } from "./store";
import { useUi, STATION_POS, BOX_POS, PERKS_POS, type Zone } from "./ui-store";

const SPEED = 6.4;
const DROP_CHANCE = 0.045;
const DROP_KINDS: PickupKind[] = ["maxammo", "instakill", "double", "nuke", "speed"];

const SKIN = "#c9a98a";
const JACKET = "#33413a";
const JACKET_DARK = "#26302b";
const PANTS = "#242a30";
const BOOT = "#15181b";
const VEST = "#3d3427";
const STRAP = "#1c1a17";
const METAL = "#14181c";

function tryDrop(pos: THREE.Vector3) {
  if (Math.random() > DROP_CHANCE) return;
  const slot = world.pickups.find((p) => !p.active);
  if (!slot) return;
  slot.active = true;
  slot.kind = DROP_KINDS[Math.floor(Math.random() * DROP_KINDS.length)]!;
  slot.pos.copy(pos);
  slot.life = 30;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function Player() {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const gun = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const flash = useRef<THREE.PointLight>(null);
  const hipL = useRef<THREE.Group>(null);
  const hipR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);

  const torchTarget = useMemo(() => new THREE.Object3D(), []);
  const anim = useRef({ moveBlend: 0, lean: 0, recoil: 0, reloadT: 0 });

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

    const hits: { t: number; z: Zombie; head: boolean }[] = [];
    for (const z of world.zombies) {
      if (!z.active || z.dying > 0) continue;
      v.tmp.set(z.pos.x - v.origin.x, 0, z.pos.z - v.origin.z);
      const t = v.tmp.x * v.dir.x + v.tmp.z * v.dir.z;
      if (t < 0 || t > 70) continue;
      const px = v.origin.x + v.dir.x * t;
      const pz = v.origin.z + v.dir.z * t;
      const lateral = Math.hypot(z.pos.x - px, z.pos.z - pz);
      const bodyR = (z.boss ? 0.55 : 0.42) * z.scale;
      const headR = 0.24 * z.scale;
      const headY = (z.boss ? 1.8 : 1.63) * z.scale;
      const bodyTop = (z.boss ? 1.7 : 1.4) * z.scale;
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
      let dmg = def.damage * (h.head ? 2.5 : 1);
      if (world.boost.instakill > 0) dmg = z.boss ? z.maxHp * 0.08 : 999;
      z.hp -= dmg;
      z.hitFlash = 1;
      if (z.hp <= 0) {
        z.dying = 0.001;
        if (z.boss) {
          g.addKill(1500);
          world.shake = 1;
          useGame.setState({ notice: "BOSS ABBATTUTO" });
          tryDrop(z.pos);
          tryDrop(z.pos);
        } else {
          g.addKill(h.head ? 160 : 90);
          tryDrop(z.pos);
        }
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
    anim.current.recoil = 1;
    world.shake = Math.min(1, world.shake + (def.pellets ? 0.45 : 0.25));
    for (let i = 0; i < (def.pellets ?? 1); i++) fireRay(g, def);
  }

  useFrame(({ camera }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const g = useGame.getState();
    const playing = g.phase === "playing";

    world.yaw -= input.yawDelta * 0.0032;
    input.yawDelta = 0;
    if (playing && input.aimX !== 0) {
      // rate-controlled turning from the aim stick: gentle near centre, fast at the edge
      const a = input.aimX;
      world.yaw -= Math.sign(a) * Math.pow(Math.abs(a), 1.6) * 3.6 * delta;
    }

    forward(world.yaw, v.fwd);
    v.right.set(-v.fwd.z, 0, v.fwd.x);

    let moveLen = 0;
    let strafe = 0;
    let sprinting = false;

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
      moveLen = Math.min(1, len);
      strafe = mx;
      let sprint = k.has("ShiftLeft") || k.has("ShiftRight") ? 1.35 : 1;
      sprinting = sprint > 1 && moveLen > 0;
      if (g.perks.includes("stamin")) sprint *= 1.18;
      if (world.boost.speed > 0) sprint *= 1.3;
      v.move.set(0, 0, 0).addScaledVector(v.fwd, my).addScaledVector(v.right, mx);
      world.playerPos.addScaledVector(v.move, SPEED * sprint * delta);
      resolveCollisions(world.playerPos, 0.42);
      world.playerBob += moveLen * delta * (sprint > 1 ? 12 : 8.5);

      if (world.reloadTimer > 0) {
        world.reloadTimer -= delta;
        if (world.reloadTimer <= 0) g.finishReload();
      } else if (g.ammo <= 0 && g.reserve > 0 && !g.reloading) {
        g.setReloading(true);
        world.reloadTimer = g.weaponDef().reload;
      }

      world.fireCd -= delta;
      const def = g.weaponDef();
      if (input.firing && world.fireCd <= 0) {
        shoot();
        if (!def.auto) input.firing = false;
      }

      const px = world.playerPos.x;
      const pz = world.playerPos.z;
      let zone: Zone = null;
      if (Math.hypot(px - STATION_POS.x, pz - STATION_POS.z) < 4) zone = "station";
      else if (Math.hypot(px - BOX_POS.x, pz - BOX_POS.z) < 4) zone = "box";
      else if (Math.hypot(px - PERKS_POS.x, pz - PERKS_POS.z) < 4.5) zone = "perks";
      if (zone !== useUi.getState().zone) useUi.getState().setZone(zone);

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

    // ---------- character animation ----------
    const a = anim.current;
    const t = performance.now() * 0.001;
    const k = 1 - Math.exp(-10 * delta);
    a.moveBlend = lerp(a.moveBlend, moveLen, k);
    a.lean = lerp(a.lean, strafe * 0.12, k);
    a.recoil = Math.max(0, a.recoil - delta * 9);
    const reloading = g.reloading;
    a.reloadT = lerp(a.reloadT, reloading ? 1 : 0, 1 - Math.exp(-8 * delta));
    const hurt = world.hurt;

    const gr = group.current;
    if (gr) {
      const cycle = world.playerBob;
      const bob = Math.abs(Math.sin(cycle)) * 0.06 * a.moveBlend;
      const breathe = Math.sin(t * 1.6) * 0.008 * (1 - a.moveBlend);
      gr.position.set(world.playerPos.x, bob + breathe, world.playerPos.z);
      gr.rotation.y = world.yaw;

      // torso lean forward when running, sideways on strafe, flinch when hurt
      if (body.current) {
        body.current.rotation.x = a.moveBlend * (sprinting ? 0.22 : 0.1) + hurt * 0.15;
        body.current.rotation.z = -a.lean;
        body.current.rotation.y = Math.sin(cycle) * 0.06 * a.moveBlend;
      }
      if (head.current) {
        head.current.rotation.x = -a.moveBlend * 0.08 + Math.sin(t * 1.6) * 0.02;
        head.current.rotation.z = a.lean * 0.5;
      }

      // legs: hip swing + knee bend, tiny idle settle
      const swing = Math.sin(cycle) * 0.65 * a.moveBlend;
      const kneeA = Math.max(0, Math.sin(cycle + 0.9)) * 0.9 * a.moveBlend;
      const kneeB = Math.max(0, Math.sin(cycle + Math.PI + 0.9)) * 0.9 * a.moveBlend;
      if (hipL.current) hipL.current.rotation.x = swing;
      if (hipR.current) hipR.current.rotation.x = -swing;
      if (kneeL.current) kneeL.current.rotation.x = kneeA;
      if (kneeR.current) kneeR.current.rotation.x = kneeB;

      // arms: two-handed aim pose, recoil kick, reload dips the gun and moves the left hand
      const rec = a.recoil * a.recoil;
      const rl = a.reloadT;
      if (gun.current) {
        gun.current.rotation.x = -0.05 - rec * 0.28 + rl * 0.55;
        gun.current.rotation.z = rl * -0.35;
        gun.current.position.z = -0.1 + rec * 0.08 + rl * 0.1;
        gun.current.position.y = 1.3 - rl * 0.15;
      }
      if (armR.current) armR.current.rotation.x = -1.35 - rec * 0.25 + rl * 0.6 + Math.sin(cycle) * 0.05 * a.moveBlend;
      if (armL.current) armL.current.rotation.x = -1.2 - rec * 0.2 + rl * 0.2;
      if (foreR.current) foreR.current.rotation.x = -0.35 - rec * 0.2;
      if (foreL.current) {
        foreL.current.rotation.x = -0.75 + rl * -0.6 + Math.sin(t * 14) * 0.25 * rl;
        foreL.current.rotation.y = rl * 0.6;
      }
    }
    if (flash.current) flash.current.intensity = world.muzzle * 70;

    // ---------- third-person camera ----------
    const shake = world.shake * 0.12;
    v.camPos.copy(world.playerPos).addScaledVector(v.fwd, -4.6).addScaledVector(v.right, 0.9);
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
      {/* ===== upper body (pivots at hips) ===== */}
      <group ref={body} position={[0, 0.82, 0]}>
        {/* torso / jacket */}
        <mesh position={[0, 0.34, 0]} castShadow>
          <boxGeometry args={[0.5, 0.62, 0.3]} />
          <meshStandardMaterial color={JACKET} roughness={0.85} />
        </mesh>
        {/* tactical vest */}
        <mesh position={[0, 0.36, 0.05]} castShadow>
          <boxGeometry args={[0.44, 0.44, 0.3]} />
          <meshStandardMaterial color={VEST} roughness={0.95} />
        </mesh>
        {/* vest pouches */}
        {[-0.13, 0, 0.13].map((x) => (
          <mesh key={x} position={[x, 0.25, -0.2]} castShadow>
            <boxGeometry args={[0.1, 0.12, 0.08]} />
            <meshStandardMaterial color={STRAP} roughness={0.95} />
          </mesh>
        ))}
        {/* shoulder pads */}
        <mesh position={[-0.31, 0.58, 0]} castShadow>
          <boxGeometry args={[0.18, 0.12, 0.3]} />
          <meshStandardMaterial color={JACKET_DARK} roughness={0.9} />
        </mesh>
        <mesh position={[0.31, 0.58, 0]} castShadow>
          <boxGeometry args={[0.18, 0.12, 0.3]} />
          <meshStandardMaterial color={JACKET_DARK} roughness={0.9} />
        </mesh>
        {/* belt */}
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.52, 0.08, 0.32]} />
          <meshStandardMaterial color={STRAP} roughness={0.7} />
        </mesh>
        {/* backpack */}
        <mesh position={[0, 0.32, 0.25]} castShadow>
          <boxGeometry args={[0.38, 0.46, 0.2]} />
          <meshStandardMaterial color="#4a3f2f" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.5, 0.36]} castShadow>
          <boxGeometry args={[0.3, 0.12, 0.06]} />
          <meshStandardMaterial color={STRAP} roughness={0.95} />
        </mesh>

        {/* head + neck */}
        <group ref={head} position={[0, 0.66, 0]}>
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[0.14, 0.1, 0.14]} />
            <meshStandardMaterial color={SKIN} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.22, 0]} castShadow>
            <boxGeometry args={[0.28, 0.3, 0.28]} />
            <meshStandardMaterial color={SKIN} roughness={0.9} />
          </mesh>
          {/* eyes */}
          <mesh position={[-0.06, 0.25, -0.145]}>
            <boxGeometry args={[0.05, 0.03, 0.01]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[0.06, 0.25, -0.145]}>
            <boxGeometry args={[0.05, 0.03, 0.01]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          {/* beard stubble */}
          <mesh position={[0, 0.12, -0.12]}>
            <boxGeometry args={[0.24, 0.1, 0.06]} />
            <meshStandardMaterial color="#5a4638" roughness={1} />
          </mesh>
          {/* beanie */}
          <mesh position={[0, 0.4, 0.01]} castShadow>
            <boxGeometry args={[0.32, 0.14, 0.32]} />
            <meshStandardMaterial color="#5a2a2a" roughness={1} />
          </mesh>
          <mesh position={[0, 0.33, 0.01]}>
            <boxGeometry args={[0.33, 0.05, 0.33]} />
            <meshStandardMaterial color="#6f3535" roughness={1} />
          </mesh>
          {/* headset */}
          <mesh position={[0.15, 0.24, 0]}>
            <boxGeometry args={[0.04, 0.1, 0.1]} />
            <meshStandardMaterial color={METAL} roughness={0.5} metalness={0.5} />
          </mesh>
        </group>

        {/* right arm (trigger hand) */}
        <group ref={armR} position={[0.32, 0.56, 0]}>
          <mesh position={[0, -0.16, 0]} castShadow>
            <boxGeometry args={[0.15, 0.34, 0.16]} />
            <meshStandardMaterial color={JACKET} roughness={0.85} />
          </mesh>
          <group ref={foreR} position={[0, -0.32, 0]}>
            <mesh position={[0, -0.16, 0]} castShadow>
              <boxGeometry args={[0.13, 0.32, 0.14]} />
              <meshStandardMaterial color={JACKET_DARK} roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.36, 0]} castShadow>
              <boxGeometry args={[0.12, 0.12, 0.12]} />
              <meshStandardMaterial color="#2a2624" roughness={0.9} />
            </mesh>
          </group>
        </group>

        {/* left arm (support hand) */}
        <group ref={armL} position={[-0.32, 0.56, 0]}>
          <mesh position={[0, -0.16, 0]} castShadow>
            <boxGeometry args={[0.15, 0.34, 0.16]} />
            <meshStandardMaterial color={JACKET} roughness={0.85} />
          </mesh>
          <group ref={foreL} position={[0, -0.32, 0]}>
            <mesh position={[0, -0.16, 0]} castShadow>
              <boxGeometry args={[0.13, 0.32, 0.14]} />
              <meshStandardMaterial color={JACKET_DARK} roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.36, 0]} castShadow>
              <boxGeometry args={[0.12, 0.12, 0.12]} />
              <meshStandardMaterial color="#2a2624" roughness={0.9} />
            </mesh>
          </group>
        </group>
      </group>

      {/* weapon (held in front at chest height) */}
      <group ref={gun} position={[0.2, 1.3, -0.1]}>
        <mesh position={[0, 0, -0.55]} castShadow>
          <boxGeometry args={[0.09, 0.14, 0.8]} />
          <meshStandardMaterial color={METAL} roughness={0.4} metalness={0.8} />
        </mesh>
        <mesh position={[0, -0.02, -1.05]} castShadow>
          <boxGeometry args={[0.05, 0.05, 0.3]} />
          <meshStandardMaterial color="#0d1013" roughness={0.3} metalness={0.9} />
        </mesh>
        <mesh position={[0, -0.16, -0.5]} castShadow>
          <boxGeometry args={[0.07, 0.2, 0.09]} />
          <meshStandardMaterial color="#2a2624" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.12, -0.28]} castShadow>
          <boxGeometry args={[0.07, 0.14, 0.08]} />
          <meshStandardMaterial color="#2a2624" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.08, -0.12]} castShadow>
          <boxGeometry args={[0.08, 0.12, 0.3]} />
          <meshStandardMaterial color="#3a3128" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.1, -0.6]}>
          <boxGeometry args={[0.03, 0.05, 0.08]} />
          <meshStandardMaterial color={METAL} roughness={0.4} metalness={0.8} />
        </mesh>
        <pointLight ref={flash} position={[0, 0, -1.3]} color="#ffd28a" distance={12} decay={2} intensity={0} />
      </group>

      {/* ===== legs: hip -> knee chains ===== */}
      <group ref={hipL} position={[-0.14, 0.82, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <boxGeometry args={[0.2, 0.42, 0.22]} />
          <meshStandardMaterial color={PANTS} roughness={0.95} />
        </mesh>
        <group ref={kneeL} position={[0, -0.4, 0]}>
          <mesh position={[0, -0.18, 0]} castShadow>
            <boxGeometry args={[0.18, 0.36, 0.2]} />
            <meshStandardMaterial color={PANTS} roughness={0.95} />
          </mesh>
          <mesh position={[0, -0.38, -0.03]} castShadow>
            <boxGeometry args={[0.2, 0.1, 0.3]} />
            <meshStandardMaterial color={BOOT} roughness={0.7} />
          </mesh>
        </group>
      </group>
      <group ref={hipR} position={[0.14, 0.82, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <boxGeometry args={[0.2, 0.42, 0.22]} />
          <meshStandardMaterial color={PANTS} roughness={0.95} />
        </mesh>
        <group ref={kneeR} position={[0, -0.4, 0]}>
          <mesh position={[0, -0.18, 0]} castShadow>
            <boxGeometry args={[0.18, 0.36, 0.2]} />
            <meshStandardMaterial color={PANTS} roughness={0.95} />
          </mesh>
          <mesh position={[0, -0.38, -0.03]} castShadow>
            <boxGeometry args={[0.2, 0.1, 0.3]} />
            <meshStandardMaterial color={BOOT} roughness={0.7} />
          </mesh>
        </group>
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
      <pointLight position={[1.1, 2.4, 1.6]} intensity={9} distance={9} decay={2} color="#9fb4c8" />
      <pointLight position={[-1.2, 1.4, -1.4]} intensity={5} distance={7} decay={2} color="#c9d4c5" />
    </group>
  );
}
