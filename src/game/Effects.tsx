import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { world, MAX_TRACERS } from "./world";
import { STATION_POS } from "./ui-store";
import { useGame } from "./store";

const UP = new THREE.Vector3(0, 1, 0);

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
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
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
