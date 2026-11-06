import { RoundedGeometry, OrganicGeometry } from "./ModelGeometry";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { world, resolveCollisions, MAX_ZOMBIES, ARENA_RADIUS, type Zombie } from "./world";
import { zoneAt, randomPointInZone } from "./zones";
import { useGame } from "./store";
import { isGuest, network, useNetwork } from "./network-state";
import { BOSS_DEFS, chooseBoss } from "./bosses";

const SKIN = "#6f7f63";
const CLOTH = "#2b3138";
const CLOTH2 = "#3a2f2c";
const BOSS_SKIN = "#4d5a44";
const BOSS_CLOTH = "#1a1517";

export const BOSS_EVERY = 10;
export function isBossRound(round: number) {
  return round > 0 && round % BOSS_EVERY === 0;
}

/** Per-round difficulty curve — every round is a bit tougher than the last. */
function roundStats(round: number) {
  return {
    hpMul: 1 + (round - 1) * 0.16,
    speedAdd: Math.min(3.2, (round - 1) * 0.11),
    dmg: 9 + Math.floor((round - 1) * 0.6),
  };
}

function ZombieMesh({ index }: { index: number }) {
  const group = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const normal = useRef<THREE.Group>(null);
  const bossG = useRef<THREE.Group>(null);
  const bossArmL = useRef<THREE.Group>(null);
  const bossArmR = useRef<THREE.Group>(null);
  const bossLegL = useRef<THREE.Mesh>(null);
  const bossLegR = useRef<THREE.Mesh>(null);
  const bossBody = useRef<THREE.Group>(null);
  const bossLight = useRef<THREE.PointLight>(null);
  const core = useRef<THREE.MeshStandardMaterial>(null);
  const warning = useRef<THREE.Mesh>(null);
  const claws = useRef<THREE.Group>(null);
  const coils = useRef<THREE.Group>(null);
  const crown = useRef<THREE.Group>(null);

  useFrame((state) => {
    const g = group.current;
    const z = world.zombies[index];
    if (!g || !z) return;
    if (!z.active) {
      if (g.visible) g.visible = false;
      return;
    }
    g.visible = true;
    if (normal.current) normal.current.visible = !z.boss;
    if (bossG.current) bossG.current.visible = z.boss;
    const def = BOSS_DEFS[z.bossKind];
    if (claws.current) claws.current.visible = z.bossKind === "charger";
    if (coils.current) coils.current.visible = z.bossKind === "storm";
    if (crown.current) crown.current.visible = z.bossKind === "summoner";
    if (core.current) { core.current.color.set(def.color); core.current.emissive.set(def.color); }
    if (warning.current) {
      warning.current.visible = z.boss && z.dying === 0 && z.abilityWindup > 0;
      warning.current.scale.setScalar((z.bossKind === "storm" ? 8 : 3) / z.scale);
      (warning.current.material as THREE.MeshBasicMaterial).color.set(def.color);
    }
    if (bossLight.current) bossLight.current.color.set(def.color);
    const t = state.clock.elapsedTime;

    if (z.dying > 0) {
      const p = Math.min(1, z.dying / 0.9);
      g.position.set(z.pos.x, -0.1 * p, z.pos.z);
      g.rotation.set(-p * (Math.PI / 2) * 0.95, z.facing, 0);
      g.scale.setScalar(z.scale);
      if (bossLight.current) bossLight.current.intensity = 6 * (1 - p);
      return;
    }

    const rate = z.boss ? 3.2 : 5.2;
    const walk = Math.sin(t * rate + z.phase);
    const walk2 = Math.sin(t * rate + z.phase + Math.PI);
    g.position.set(z.pos.x, Math.abs(walk) * (z.boss ? 0.12 : 0.06), z.pos.z);
    g.rotation.set(0, z.facing, Math.sin(t * 2.6 + z.phase) * (z.boss ? 0.04 : 0.07));
    g.scale.setScalar(z.scale * (1 + z.hitFlash * 0.12));

    if (z.boss) {
      if (bossLegL.current) bossLegL.current.rotation.x = walk * 0.55;
      if (bossLegR.current) bossLegR.current.rotation.x = walk2 * 0.55;
      if (bossArmL.current) bossArmL.current.rotation.x = -0.6 + walk2 * 0.35;
      if (bossArmR.current) bossArmR.current.rotation.x = -0.6 + walk * 0.35;
      if (bossBody.current) bossBody.current.rotation.x = 0.3 + Math.sin(t * 2) * 0.04;
      if (bossLight.current) bossLight.current.intensity = 6 + Math.sin(t * 6) * 2 + z.hitFlash * 12;
      return;
    }

    if (legL.current) legL.current.rotation.x = walk * 0.7;
    if (legR.current) legR.current.rotation.x = walk2 * 0.7;
    if (armL.current) armL.current.rotation.x = -1.15 + walk2 * 0.18;
    if (armR.current) armR.current.rotation.x = -1.05 + walk * 0.18;
    if (torso.current) torso.current.rotation.x = 0.18 + Math.sin(t * 2.6 + z.phase) * 0.05;
  });

  return (
    <group ref={group} visible={false}>
      {/* ---------- regular walker ---------- */}
      <group ref={normal}>
        <group ref={torso} position={[0, 0.85, 0]}>
          <mesh position={[0, 0.22, 0]} castShadow>
            <OrganicGeometry args={[0.52, 0.7, 0.3]} />
            <meshStandardMaterial color={CLOTH} roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.78, 0.02]} castShadow>
            <OrganicGeometry args={[0.28, 0.32, 0.28]} />
            <meshStandardMaterial color={SKIN} roughness={0.9} />
          </mesh>
          {[-0.075, 0.075].map(x => <mesh key={x} position={[x, 0.84, 0.155]}><sphereGeometry args={[0.028, 8, 6]} /><meshBasicMaterial color="#df8b71" /></mesh>)}
          <mesh position={[0, 0.75, 0.165]}><OrganicGeometry args={[0.065, 0.1, 0.055]} /><meshStandardMaterial color={SKIN} /></mesh>
          <mesh position={[0, 0.79, 0.17]}>
            <RoundedGeometry args={[0.2, 0.06, 0.02]} />
            <meshStandardMaterial color="#c2413c" emissive="#c2413c" emissiveIntensity={1.6} toneMapped={false} />
          </mesh>
          <group ref={armL} position={[-0.34, 0.42, 0]}>
            <mesh position={[0, 0, 0.34]} castShadow>
              <OrganicGeometry args={[0.15, 0.15, 0.72]} />
              <meshStandardMaterial color={SKIN} roughness={0.9} />
            </mesh>
          </group>
          <group ref={armR} position={[0.34, 0.42, 0]}>
            <mesh position={[0, 0, 0.34]} castShadow>
              <OrganicGeometry args={[0.15, 0.15, 0.72]} />
              <meshStandardMaterial color={CLOTH2} roughness={0.9} />
            </mesh>
          </group>
        </group>
        <mesh ref={legL} position={[-0.14, 0.44, 0]} castShadow>
          <OrganicGeometry args={[0.18, 0.88, 0.2]} />
          <meshStandardMaterial color="#22262c" roughness={0.95} />
        </mesh>
        <mesh ref={legR} position={[0.14, 0.44, 0]} castShadow>
          <OrganicGeometry args={[0.18, 0.88, 0.2]} />
          <meshStandardMaterial color="#22262c" roughness={0.95} />
        </mesh>
      </group>

      {/* ---------- boss: hulking brute (scaled by z.scale) ---------- */}
      <group ref={bossG} visible={false}>
        <group ref={bossBody} position={[0, 0.9, 0]}>
          {/* massive torso */}
          <mesh position={[0, 0.3, 0]} castShadow>
            <OrganicGeometry args={[0.95, 0.9, 0.55]} />
            <meshStandardMaterial color={BOSS_SKIN} roughness={0.9} />
          </mesh>
          {/* chest armor plates */}
          <mesh position={[0, 0.3, 0.29]} castShadow>
            <RoundedGeometry args={[0.7, 0.6, 0.06]} />
            <meshStandardMaterial color={BOSS_CLOTH} roughness={0.6} metalness={0.4} />
          </mesh>
          {/* shoulders */}
          <mesh position={[-0.6, 0.65, 0]} castShadow>
            <RoundedGeometry args={[0.35, 0.3, 0.45]} />
            <meshStandardMaterial color={BOSS_CLOTH} roughness={0.7} metalness={0.3} />
          </mesh>
          <mesh position={[0.6, 0.65, 0]} castShadow>
            <RoundedGeometry args={[0.35, 0.3, 0.45]} />
            <meshStandardMaterial color={BOSS_CLOTH} roughness={0.7} metalness={0.3} />
          </mesh>
          {/* spikes */}
          {[-0.62, 0.62].map((x) => (
            <mesh key={x} position={[x, 0.9, 0]} castShadow>
              <coneGeometry args={[0.09, 0.35, 5]} />
              <meshStandardMaterial color="#8a8f86" roughness={0.5} metalness={0.5} />
            </mesh>
          ))}
          {/* small sunken head */}
          <mesh position={[0, 0.9, 0.12]} castShadow>
            <OrganicGeometry args={[0.32, 0.34, 0.32]} />
            <meshStandardMaterial color={BOSS_SKIN} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.92, 0.29]}>
            <RoundedGeometry args={[0.24, 0.07, 0.02]} />
            <meshStandardMaterial color="#ff5a3c" emissive="#ff5a3c" emissiveIntensity={3} toneMapped={false} />
          </mesh>
          {/* glowing core */}
          <mesh position={[0, 0.25, 0.33]}>
            <RoundedGeometry args={[0.18, 0.18, 0.04]} />
            <meshStandardMaterial ref={core} color={BOSS_DEFS.brute.color} emissive={BOSS_DEFS.brute.color} emissiveIntensity={4} toneMapped={false} />
          </mesh>
          <group ref={claws} visible={false}>
            {[-0.9, 0.9].map(x => <mesh key={x} position={[x, 0.15, 0.9]} rotation-x={Math.PI / 2}><coneGeometry args={[0.18, 1.1, 5]} /><meshStandardMaterial color={BOSS_DEFS.charger.color} metalness={0.7} roughness={0.3} /></mesh>)}
          </group>
          <group ref={coils} visible={false}>
            {[-0.6, 0.6].map(x => <mesh key={x} position={[x, 0.9, 0]}><torusGeometry args={[0.3, 0.07, 6, 12]} /><meshBasicMaterial color={BOSS_DEFS.storm.color} toneMapped={false} /></mesh>)}
          </group>
          <group ref={crown} visible={false}>
            {[-0.24, 0, 0.24].map(x => <mesh key={x} position={[x, 1.3, 0.12]}><coneGeometry args={[0.1, 0.5, 5]} /><meshBasicMaterial color={BOSS_DEFS.summoner.color} toneMapped={false} /></mesh>)}
          </group>
          <pointLight ref={bossLight} position={[0, 0.3, 0.6]} color="#ff4a2a" distance={7} decay={2} intensity={6} />
          {/* huge arms */}
          <group ref={bossArmL} position={[-0.62, 0.5, 0]}>
            <mesh position={[0, -0.05, 0.4]} castShadow>
              <OrganicGeometry args={[0.3, 0.3, 0.9]} />
              <meshStandardMaterial color={BOSS_SKIN} roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.08, 0.9]} castShadow>
              <OrganicGeometry args={[0.36, 0.36, 0.3]} />
              <meshStandardMaterial color="#3a4434" roughness={0.9} />
            </mesh>
          </group>
          <group ref={bossArmR} position={[0.62, 0.5, 0]}>
            <mesh position={[0, -0.05, 0.4]} castShadow>
              <OrganicGeometry args={[0.3, 0.3, 0.9]} />
              <meshStandardMaterial color={BOSS_SKIN} roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.08, 0.9]} castShadow>
              <OrganicGeometry args={[0.36, 0.36, 0.3]} />
              <meshStandardMaterial color="#3a4434" roughness={0.9} />
            </mesh>
          </group>
        </group>
        {/* legs */}
        <mesh ref={bossLegL} position={[-0.28, 0.5, 0]} castShadow>
          <OrganicGeometry args={[0.32, 1, 0.34]} />
          <meshStandardMaterial color={BOSS_CLOTH} roughness={0.95} />
        </mesh>
        <mesh ref={bossLegR} position={[0.28, 0.5, 0]} castShadow>
          <OrganicGeometry args={[0.32, 1, 0.34]} />
          <meshStandardMaterial color={BOSS_CLOTH} roughness={0.95} />
        </mesh>
      </group>
      <mesh ref={warning} visible={false} position={[0, 0.04, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.92, 1, 48]} />
        <meshBasicMaterial color={BOSS_DEFS.storm.color} transparent opacity={0.65} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Place a zombie somewhere inside the player's current zone, away from the player. */
function placeInPlayerZone(z: Zombie, boss: boolean) {
  const pz = zoneAt(world.playerPos.x, world.playerPos.z);
  randomPointInZone(pz, world.playerPos.x, world.playerPos.z, 14, z.pos);
  const d = Math.hypot(z.pos.x, z.pos.z);
  if (d > ARENA_RADIUS - 2) {
    z.pos.x = (z.pos.x / d) * (ARENA_RADIUS - 2);
    z.pos.z = (z.pos.z / d) * (ARENA_RADIUS - 2);
  }
  resolveCollisions(z.pos, boss ? 1.2 : 0.6);
}

function spawn(z: Zombie, round: number, seed: number, boss = false) {
  placeInPlayerZone(z, boss);
  z.active = true;
  z.dying = 0;
  z.hitFlash = 0;
  z.attackCd = 0;
  z.phase = seed * 1.7;
  z.boss = boss;
  z.bossKind = boss ? chooseBoss() : "brute";
  z.abilityCd = 3;
  z.abilityWindup = 0;
  z.chargeTime = 0;
  z.stuck = 0;
  const st = roundStats(round);

  if (boss) {
    const tier = Math.floor(round / BOSS_EVERY); // 1 at round 10, 2 at round 20…
    const def = BOSS_DEFS[z.bossKind];
    z.maxHp = Math.round(120 * tier * st.hpMul * def.hp);
    z.hp = z.maxHp;
    z.speed = (1.9 + tier * 0.15) * def.speed;
    z.scale = (1.9 + Math.min(0.6, tier * 0.1)) * def.scale;
    z.damage = 28 + tier * 6;
    useGame.setState({ notice: `${def.name.toUpperCase()} IN ARRIVO` });
    return;
  }

  const tough = Math.random() < Math.min(0.4, 0.05 * round);
  const baseHp = tough ? 5 : 2;
  z.maxHp = Math.max(1, Math.round(baseHp * st.hpMul));
  z.hp = z.maxHp;
  z.speed = (tough ? 1.5 : 2.1) + Math.random() * 0.7 + st.speedAdd;
  z.scale = tough ? 1.25 : 0.92 + Math.random() * 0.18;
  z.damage = st.dmg;
}

export function ZombieSystem() {
  const dirs = useMemo(() => ({ toPlayer: new THREE.Vector3() }), []);
  const bossQueue = useRef(0);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const g = useGame.getState();
    const widow = g.perks.includes("widow");
    const room = useNetwork.getState().room;
    if (isGuest() || (g.phase !== "playing" && !(room?.started && g.phase === "dead"))) return;

    const activeCount = world.zombies.filter((z) => z.active && z.dying === 0).length;

    // --- wave management ---
    if (world.waveRemaining <= 0 && bossQueue.current <= 0 && activeCount === 0) {
      if (world.betweenWaves > 0) {
        world.betweenWaves -= delta;
      } else {
        const round = world.waveSpawned === 0 ? g.round : g.round + 1;
        if (world.waveSpawned > 0) g.setRound(round);
        world.waveRemaining = 4 + round * 3;
        world.waveSpawned++;
        world.spawnTimer = 0;
        if (isBossRound(round)) {
          bossQueue.current = Math.floor(round / BOSS_EVERY);
          world.waveRemaining = Math.floor(world.waveRemaining * 0.6);
          useGame.setState({ notice: "⚠ BOSS IN ARRIVO" });
          world.shake = Math.max(world.shake, 0.8);
        }
        g.setZombiesLeft(world.waveRemaining + bossQueue.current);
      }
    }

    // bosses spawn first, one at a time
    if (bossQueue.current > 0) {
      world.spawnTimer -= delta;
      if (world.spawnTimer <= 0) {
        const slot = world.zombies.find((z) => !z.active);
        if (slot) {
          spawn(slot, g.round, Math.random() * 10, true);
          bossQueue.current--;
          world.shake = Math.max(world.shake, 0.6);
        }
        world.spawnTimer = 1.5;
      }
    } else if (world.waveRemaining > 0) {
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
    let bossHp = -1;
    for (const z of world.zombies) {
      if (!z.active) continue;
      if (z.dying > 0) {
        z.dying += delta;
        if (z.dying > 2.2) z.active = false;
        continue;
      }
      alive++;
      if (z.boss) bossHp = Math.max(bossHp, z.hp / z.maxHp);
      z.hitFlash = Math.max(0, z.hitFlash - delta * 4);
      z.attackCd = Math.max(0, z.attackCd - delta);

      let targetId = room?.id ?? '';
      let tx = world.playerPos.x, tz = world.playerPos.z;
      let targetWidow = widow;
      let nearest = g.health > 0 ? Math.hypot(tx-z.pos.x,tz-z.pos.z) : Infinity;
      for (const remote of network.remotes.values()) {
        if (remote.health <= 0 || remote.phase !== 'playing') continue;
        const d = Math.hypot(remote.x-z.pos.x,remote.z-z.pos.z);
        if (d < nearest) { nearest=d; tx=remote.x; tz=remote.z; targetId=remote.id; targetWidow=remote.widow; }
      }
      if (!Number.isFinite(nearest)) continue;
      const playerZone = zoneAt(tx,tz);
      dirs.toPlayer.set(tx, 0, tz).sub(z.pos);
      dirs.toPlayer.y = 0;
      const dist = dirs.toPlayer.length() || 1;
      dirs.toPlayer.divideScalar(dist);
      z.facing = Math.atan2(dirs.toPlayer.x, dirs.toPlayer.z) + Math.PI;

      // Only the coordinator resolves abilities; guests receive visuals and damage packets.
      const sameZone = zoneAt(z.pos.x, z.pos.z) === playerZone;
      if (z.boss && z.bossKind !== "brute") {
        const def = BOSS_DEFS[z.bossKind];
        z.abilityCd = Math.max(0, z.abilityCd - delta);
        if (z.abilityWindup > 0) {
          z.abilityWindup = Math.max(0, z.abilityWindup - delta);
          if (z.abilityWindup === 0) {
            z.abilityCd = def.cooldown;
            if (z.bossKind === "charger") { z.chargeTime = 1.2; z.chargeX = dirs.toPlayer.x; z.chargeZ = dirs.toPlayer.z; }
            if (z.bossKind === "storm") {
              const hit = (id: string, x: number, zz: number) => {
                if (zoneAt(x, zz) !== zoneAt(z.pos.x, z.pos.z) || Math.hypot(x-z.pos.x, zz-z.pos.z) > def.range) return;
                if (room && id !== room.id) network.damage(id, z.damage * 0.7);
                else { g.damage(z.damage * 0.7); world.hurt = 1; world.shake = 0.8; }
              };
              if (g.health > 0) hit(room?.id ?? '', world.playerPos.x, world.playerPos.z);
              for (const p of network.remotes.values()) if (p.health > 0 && p.phase === 'playing') hit(p.id, p.x, p.z);
            }
            if (z.bossKind === "summoner") {
              for (let i = 0; i < 3; i++) {
                const slot = world.zombies.find(o => !o.active);
                if (!slot) break;
                spawn(slot, g.round, Math.random() * 10);
                randomPointInZone(playerZone, tx, tz, 8, slot.pos);
                resolveCollisions(slot.pos, 0.6);
              }
            }
          }
          continue;
        }
        if (z.abilityCd === 0 && sameZone && dist <= def.range && z.chargeTime === 0) {
          z.abilityWindup = 1.4;
          useGame.setState({ notice: z.bossKind === "charger" ? "PREPARA LA CARICA!" : z.bossKind === "storm" ? "SCARICA ELETTRICA!" : "IL NECROMANTE EVOCA ZOMBIE!" });
          continue;
        }
        if (z.chargeTime > 0) {
          z.chargeTime = Math.max(0, z.chargeTime - delta);
          z.pos.x += z.chargeX * 14 * delta;
          z.pos.z += z.chargeZ * 14 * delta;
          resolveCollisions(z.pos, 0.9);
          if (Math.hypot(tx-z.pos.x, tz-z.pos.z) < 2.3 && z.attackCd <= 0) {
            z.attackCd = 1.6; z.chargeTime = 0;
            if (room && targetId !== room.id) network.damage(targetId, z.damage * 1.3);
            else { g.damage(z.damage * 1.3); world.hurt = 1; world.shake = 1; }
          }
          continue;
        }
      }

      const reach = z.boss ? 2.3 : 1.15;
      if (dist > reach) {
        // stuck behind a zone wall after the player moved on: re-emerge in the player's zone
        if (dist > 22 && zoneAt(z.pos.x, z.pos.z) !== playerZone) {
          z.stuck += delta;
          if (z.stuck > 3) {
            placeInPlayerZone(z, z.boss);
            z.stuck = 0;
          }
        } else z.stuck = 0;
        z.pos.addScaledVector(
          dirs.toPlayer,
          z.speed * delta * (targetWidow && dist < 4 ? 0.5 : 1),
        );
        resolveCollisions(z.pos, z.boss ? 0.9 : 0.45);
      } else if (z.attackCd <= 0) {
        z.attackCd = z.boss ? 1.6 : 1.1;
        if (room && targetId !== room.id) network.damage(targetId, z.damage);
        else g.damage(z.damage);
        world.hurt = 1;
        world.shake = Math.max(world.shake, z.boss ? 1 : 0.5);
      }

      // separate from other zombies so they don't stack
      const myR = z.boss ? 1.1 : 0.425;
      for (const o of world.zombies) {
        if (o === z || !o.active || o.dying > 0) continue;
        const dx = z.pos.x - o.pos.x;
        const dz = z.pos.z - o.pos.z;
        const d2 = dx * dx + dz * dz;
        const min = myR + (o.boss ? 1.1 : 0.425);
        if (d2 < min * min && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (min - d) * (o.boss && !z.boss ? 1 : 0.5);
          z.pos.x += (dx / d) * push;
          z.pos.z += (dz / d) * push;
        }
      }
    }

    const left = alive + world.waveRemaining + bossQueue.current;
    if (left !== g.zombiesLeft) g.setZombiesLeft(left);
    const shown = bossHp < 0 ? -1 : Math.round(bossHp * 100) / 100;
    if (shown !== g.bossHp) g.setBossHp(shown);
  });

  return (
    <group>
      {Array.from({ length: MAX_ZOMBIES }, (_, i) => (
        <ZombieMesh key={i} index={i} />
      ))}
    </group>
  );
}
