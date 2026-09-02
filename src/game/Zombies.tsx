import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { world, resolveCollisions, MAX_ZOMBIES, ARENA_RADIUS, type Zombie } from "./world";
import { useGame } from "./store";

const SKIN = "#6f7f63";
const CLOTH = "#2b3138";
const CLOTH2 = "#3a2f2c";

function ZombieMesh({ index }: { index: number }) {
  const group = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);

  useFrame((state) => {
    const g = group.current;
    const z = world.zombies[index];
    if (!g || !z) return;
    if (!z.active) {
      if (g.visible) g.visible = false;
      return;
    }
    g.visible = true;
    const t = state.clock.elapsedTime;

    if (z.dying > 0) {
      const p = Math.min(1, z.dying / 0.9);
      g.position.set(z.pos.x, -0.1 * p, z.pos.z);
      g.rotation.set(-p * (Math.PI / 2) * 0.95, z.facing, 0);
      g.scale.setScalar(z.scale);
      return;
    }

    const walk = Math.sin(t * 5.2 + z.phase);
    const walk2 = Math.sin(t * 5.2 + z.phase + Math.PI);
    g.position.set(z.pos.x, Math.abs(walk) * 0.06, z.pos.z);
    g.rotation.set(0, z.facing, Math.sin(t * 2.6 + z.phase) * 0.07);
    g.scale.setScalar(z.scale * (1 + z.hitFlash * 0.12));

    if (legL.current) legL.current.rotation.x = walk * 0.7;
    if (legR.current) legR.current.rotation.x = walk2 * 0.7;
    if (armL.current) armL.current.rotation.x = -1.15 + walk2 * 0.18;
    if (armR.current) armR.current.rotation.x = -1.05 + walk * 0.18;
    if (torso.current) torso.current.rotation.x = 0.18 + Math.sin(t * 2.6 + z.phase) * 0.05;
  });

  return (
    <group ref={group} visible={false} castShadow>
      <group ref={torso} position={[0, 0.85, 0]}>
        {/* torso */}
        <mesh position={[0, 0.22, 0]} castShadow>
          <boxGeometry args={[0.52, 0.7, 0.3]} />
          <meshStandardMaterial color={CLOTH} roughness={0.95} />
        </mesh>
        {/* head */}
        <mesh position={[0, 0.78, 0.02]} castShadow>
          <boxGeometry args={[0.28, 0.32, 0.28]} />
          <meshStandardMaterial color={SKIN} roughness={0.9} />
        </mesh>
        {/* jaw / eyes glow */}
        <mesh position={[0, 0.79, 0.17]}>
          <boxGeometry args={[0.2, 0.06, 0.02]} />
          <meshStandardMaterial
            color="#c2413c"
            emissive="#c2413c"
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
        {/* arms reaching forward */}
        <group ref={armL} position={[-0.34, 0.42, 0]}>
          <mesh position={[0, 0, 0.34]} castShadow>
            <boxGeometry args={[0.15, 0.15, 0.72]} />
            <meshStandardMaterial color={SKIN} roughness={0.9} />
          </mesh>
        </group>
        <group ref={armR} position={[0.34, 0.42, 0]}>
          <mesh position={[0, 0, 0.34]} castShadow>
            <boxGeometry args={[0.15, 0.15, 0.72]} />
            <meshStandardMaterial color={CLOTH2} roughness={0.9} />
          </mesh>
        </group>
      </group>
      {/* legs */}
      <mesh ref={legL} position={[-0.14, 0.44, 0]} castShadow>
        <boxGeometry args={[0.18, 0.88, 0.2]} />
        <meshStandardMaterial color="#22262c" roughness={0.95} />
      </mesh>
      <mesh ref={legR} position={[0.14, 0.44, 0]} castShadow>
        <boxGeometry args={[0.18, 0.88, 0.2]} />
        <meshStandardMaterial color="#22262c" roughness={0.95} />
      </mesh>
    </group>
  );
}

function spawn(z: Zombie, wave: number, seed: number) {
  // spawn around the player so the bigger map still feels busy
  const a = Math.random() * Math.PI * 2;
  const r = 26 + Math.random() * 14;
  z.pos.set(world.playerPos.x + Math.cos(a) * r, 0, world.playerPos.z + Math.sin(a) * r);
  const d = Math.hypot(z.pos.x, z.pos.z);
  if (d > ARENA_RADIUS - 2) {
    z.pos.x = (z.pos.x / d) * (ARENA_RADIUS - 2);
    z.pos.z = (z.pos.z / d) * (ARENA_RADIUS - 2);
  }
  resolveCollisions(z.pos, 0.6);
  z.active = true;
  z.dying = 0;
  z.hitFlash = 0;
  z.attackCd = 0;
  z.phase = seed * 1.7;
  const tough = Math.random() < Math.min(0.35, 0.06 * wave);
  z.maxHp = tough ? 5 + wave : 2 + Math.floor(wave / 2);
  z.hp = z.maxHp;
  z.speed = (tough ? 1.5 : 2.1) + Math.random() * 0.7 + wave * 0.09;
  z.scale = tough ? 1.25 : 0.92 + Math.random() * 0.18;
}

export function ZombieSystem() {
  const dirs = useMemo(() => ({ toPlayer: new THREE.Vector3() }), []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const g = useGame.getState();
    if (g.phase !== "playing") return;

    const activeCount = world.zombies.filter((z) => z.active && z.dying === 0).length;

    // --- wave management ---
    if (world.waveRemaining <= 0 && activeCount === 0) {
      if (world.betweenWaves > 0) {
        world.betweenWaves -= delta;
      } else {
        const wave = world.waveSpawned === 0 ? g.round : g.round + 1;
        if (world.waveSpawned > 0) {
          g.setRound(wave);
        }
        world.waveRemaining = 4 + wave * 3;
        world.waveSpawned++;
        world.spawnTimer = 0;
        g.setZombiesLeft(world.waveRemaining);
      }
    }

    if (world.waveRemaining > 0) {
      world.spawnTimer -= delta;
      const cap = Math.min(MAX_ZOMBIES, 9 + g.round * 2);
      if (world.spawnTimer <= 0 && activeCount < cap) {
        const slot = world.zombies.find((z) => !z.active);
        if (slot) {
          spawn(slot, g.round, Math.random() * 10);
          world.waveRemaining--;
        }
        world.spawnTimer = Math.max(0.25, 1.1 - g.round * 0.06);
      }
    }

    // --- movement / attacks ---
    let alive = 0;
    for (const z of world.zombies) {
      if (!z.active) continue;
      if (z.dying > 0) {
        z.dying += delta;
        if (z.dying > 2.2) z.active = false;
        continue;
      }
      alive++;
      z.hitFlash = Math.max(0, z.hitFlash - delta * 4);
      z.attackCd = Math.max(0, z.attackCd - delta);

      dirs.toPlayer.copy(world.playerPos).sub(z.pos);
      dirs.toPlayer.y = 0;
      const dist = dirs.toPlayer.length() || 1;
      dirs.toPlayer.divideScalar(dist);
      z.facing = Math.atan2(dirs.toPlayer.x, dirs.toPlayer.z) + Math.PI;

      if (dist > 1.15) {
        z.pos.addScaledVector(dirs.toPlayer, z.speed * delta);
        resolveCollisions(z.pos, 0.45);
      } else if (z.attackCd <= 0) {
        z.attackCd = 1.1;
        g.damage(9);
        world.hurt = 1;
        world.shake = Math.max(world.shake, 0.5);
      }

      // separate from other zombies so they don't stack
      for (const o of world.zombies) {
        if (o === z || !o.active || o.dying > 0) continue;
        const dx = z.pos.x - o.pos.x;
        const dz = z.pos.z - o.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.72 && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (0.85 - d) * 0.5;
          z.pos.x += (dx / d) * push;
          z.pos.z += (dz / d) * push;
        }
      }
    }

    const left = alive + world.waveRemaining;
    if (left !== g.zombiesLeft) g.setZombiesLeft(left);
  });

  return (
    <group>
      {Array.from({ length: MAX_ZOMBIES }, (_, i) => (
        <ZombieMesh key={i} index={i} />
      ))}
    </group>
  );
}
