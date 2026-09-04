import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { world, MAX_TRACERS, MAX_PICKUPS } from "./world";
import { STATION_POS, BOX_POS, PERK_POSITIONS } from "./ui-store";
import { useGame, PERKS } from "./store";

const UP = new THREE.Vector3(0, 1, 0);

const PICKUP_COLOR = {
  maxammo: "#e8c07a",
  instakill: "#c2413c",
  double: "#4fa66b",
  nuke: "#f0f0f0",
  speed: "#5fb6e8",
} as const;

function PickupMesh({ index }: { index: number }) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const g = group.current;
    const p = world.pickups[index];
    if (!g || !p) return;
    if (!p.active) {
      if (g.visible) g.visible = false;
      return;
    }
    g.visible = true;
    const t = clock.elapsedTime;
    g.position.set(p.pos.x, 1 + Math.sin(t * 3 + index) * 0.15, p.pos.z);
    g.rotation.y = t * 2.2;
    const c = PICKUP_COLOR[p.kind];
    const blink = p.life < 6 ? (Math.sin(t * 14) > 0 ? 1 : 0.15) : 1;
    if (mat.current) {
      mat.current.color.set(c);
      mat.current.emissive.set(c);
      mat.current.emissiveIntensity = 2.2 * blink;
    }
    if (light.current) {
      light.current.color.set(c);
      light.current.intensity = 18 * blink;
    }
  });

  return (
    <group ref={group} visible={false}>
      <mesh>
        <octahedronGeometry args={[0.35, 0]} />
        <meshStandardMaterial ref={mat} color="#fff" emissive="#fff" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.55, 0.03, 6, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
      </mesh>
      <pointLight ref={light} intensity={18} distance={8} decay={2} />
    </group>
  );
}

export function Pickups() {
  return (
    <group>
      {Array.from({ length: MAX_PICKUPS }, (_, i) => (
        <PickupMesh key={i} index={i} />
      ))}
    </group>
  );
}

/** Mystery box: pulsing chest with a light beam, random weapon on purchase. */
export function MysteryBox() {
  const lid = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (lid.current) lid.current.rotation.x = -0.15 + Math.sin(t * 1.5) * 0.08;
    if (beam.current) {
      (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(t * 3) * 0.05;
    }
  });
  return (
    <group position={[BOX_POS.x, 0, BOX_POS.z]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[1.9, 0.9, 1]} />
        <meshStandardMaterial color="#4a3320" roughness={0.9} />
      </mesh>
      <mesh ref={lid} position={[0, 0.95, -0.5]} castShadow>
        <boxGeometry args={[1.95, 0.12, 1.05]} />
        <meshStandardMaterial color="#5a3d24" roughness={0.9} />
      </mesh>
      {/* question marks strip */}
      <mesh position={[0, 0.5, 0.51]}>
        <planeGeometry args={[1.6, 0.4]} />
        <meshStandardMaterial color="#5fb6e8" emissive="#5fb6e8" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <mesh ref={beam} position={[0, 12, 0]}>
        <cylinderGeometry args={[0.35, 0.9, 24, 12, 1, true]} />
        <meshBasicMaterial color="#5fb6e8" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 1.6, 0]} color="#5fb6e8" intensity={26} distance={14} decay={2} />
    </group>
  );
}

/** Row of perk vending machines. */
export function PerkMachines() {
  return (
    <group position={[PERKS_POS.x, 0, PERKS_POS.z]}>
      {PERKS.map((p, i) => (
        <group key={p.id} position={[(i - 1.5) * 1.5, 0, 0]}>
          <mesh position={[0, 1, 0]} castShadow>
            <boxGeometry args={[1.1, 2, 0.8]} />
            <meshStandardMaterial color="#1c2430" roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh position={[0, 1.25, 0.41]}>
            <planeGeometry args={[0.8, 1.1]} />
            <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
          <pointLight position={[0, 1.6, 0.9]} color={p.color} intensity={8} distance={6} decay={2} />
        </group>
      ))}
    </group>
  );
}

function Tracer({ index }: { index: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, delta) => {
    const m = ref.current;
    const t = world.tracers[index];
    if (!m || !t) return;
    if (t.life <= 0) {
      if (m.visible) m.visible = false;
      return;
    }
    t.life -= delta;
    m.visible = true;
    dir.copy(t.to).sub(t.from);
    const len = dir.length() || 1;
    m.position.copy(t.from).addScaledVector(dir, 0.5);
    q.setFromUnitVectors(UP, dir.normalize());
    m.quaternion.copy(q);
    m.scale.set(1, len, 1);
    (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, t.life / 0.09) * 0.85;
  });

  return (
    <mesh ref={ref} visible={false}>
      <cylinderGeometry args={[0.025, 0.025, 1, 5]} />
      <meshBasicMaterial color="#ffd28a" transparent opacity={0.8} toneMapped={false} />
    </mesh>
  );
}

export function Tracers() {
  return (
    <group>
      {Array.from({ length: MAX_TRACERS }, (_, i) => (
        <Tracer key={i} index={i} />
      ))}
    </group>
  );
}

/** Wall-buy style supply station: glowing crate you stand next to to spend points. */
export function Station() {
  const sign = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (sign.current) {
      const t = clock.elapsedTime;
      sign.current.position.y = 2.3 + Math.sin(t * 2) * 0.08;
      (sign.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        1.6 + Math.sin(t * 5) * 0.5;
    }
  });

  return (
    <group position={[STATION_POS.x, 0, STATION_POS.z]}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[1.8, 1.2, 1]} />
        <meshStandardMaterial color="#3a2f26" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.28, 0]}>
        <boxGeometry args={[1.9, 0.16, 1.1]} />
        <meshStandardMaterial
          color="#e8c07a"
          emissive="#e8c07a"
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={sign} position={[0, 2.3, 0]}>
        <boxGeometry args={[0.9, 0.9, 0.06]} />
        <meshStandardMaterial
          color="#c2413c"
          emissive="#c2413c"
          emissiveIntensity={1.8}
          toneMapped={false}
        />
      </mesh>
      <pointLight position={[0, 2, 0]} color="#ffb060" intensity={14} distance={12} decay={2} />
    </group>
  );
}

/** Distant thunder-ish flicker + round pacing hook for atmosphere. */
export function Atmosphere() {
  const light = useRef<THREE.DirectionalLight>(null);
  const next = useRef(4 + Math.random() * 8);

  useFrame((_, delta) => {
    const l = light.current;
    if (!l) return;
    next.current -= delta;
    if (next.current <= 0) {
      l.intensity = 1.6;
      next.current = 5 + Math.random() * 9;
    }
    l.intensity = THREE.MathUtils.lerp(l.intensity, 0.22, 1 - Math.exp(-6 * delta));
  });

  const round = useGame((s) => s.round);

  return (
    <>
      <hemisphereLight args={["#28313f", "#0a0c10", 0.5]} />
      <ambientLight intensity={0.18} color="#2a3546" />
      <directionalLight
        ref={light}
        position={[-30, 40, -20]}
        intensity={0.22}
        color="#9fb6d4"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-camera-far={220}
      />
      {/* blood moon grows redder as rounds go up */}
      <pointLight
        position={[0, 26, -40]}
        color={round > 6 ? "#c2413c" : "#8fa8c8"}
        intensity={220}
        distance={140}
        decay={1.4}
      />
    </>
  );
}
