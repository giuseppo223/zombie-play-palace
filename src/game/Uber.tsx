import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ubers, uberCharged, KILLS_PER_UBER, UBER_RADIUS, PAP_POS, type Uber } from "./uber";
import { useGame } from "./store";

const IDLE = new THREE.Color("#5fb6e8");
const FULL = new THREE.Color("#e8c07a");

/** A soul-collecting buckle: obelisk with a floating ring that spins faster as it charges. */
function UberMesh({ uber }: { uber: Uber }) {
  const ring = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const beam = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const p = Math.min(1, uber.charge / KILLS_PER_UBER);
    const full = uberCharged(uber);
    const col = IDLE.clone().lerp(FULL, p);

    if (ring.current) {
      ring.current.rotation.y += delta * (0.6 + p * 4);
      ring.current.position.y = 1.9 + Math.sin(t * 1.5) * 0.12 + p * 0.4;
    }
    if (core.current) {
      const m = core.current.material as THREE.MeshStandardMaterial;
      m.emissive.copy(col);
      m.color.copy(col);
      m.emissiveIntensity = 1 + p * 2.5 + (full ? Math.sin(t * 6) * 0.6 : 0);
      const s = 0.5 + p * 0.35;
      core.current.scale.setScalar(s);
    }
    if (light.current) {
      light.current.color.copy(col);
      light.current.intensity = 6 + p * 22;
    }
    if (beam.current) {
      beam.current.visible = full;
      beam.current.rotation.y = t * 0.5;
    }
  });

  return (
    <group position={[uber.x, 0, uber.z]}>
      {/* pedestal */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.15, 1.45, 0.7, 6]} />
        <meshStandardMaterial color="#2b3038" roughness={0.9} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.62, 0.9, 6]} />
        <meshStandardMaterial color="#1b1f26" roughness={0.6} metalness={0.7} />
      </mesh>

      {/* glowing core */}
      <mesh ref={core} position={[0, 1.9, 0]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={IDLE} emissive={IDLE} emissiveIntensity={1.4} />
      </mesh>

      {/* spinning buckle ring */}
      <group ref={ring} position={[0, 1.9, 0]}>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.95, 0.09, 6, 16]} />
          <meshStandardMaterial color="#8a6a3a" roughness={0.4} metalness={0.9} />
        </mesh>
        <mesh rotation-z={Math.PI / 2}>
          <torusGeometry args={[0.75, 0.07, 6, 16]} />
          <meshStandardMaterial color="#8a6a3a" roughness={0.4} metalness={0.9} />
        </mesh>
      </group>

      {/* charged beacon */}
      <mesh ref={beam} position={[0, 9, 0]} visible={false}>
        <cylinderGeometry args={[0.22, 0.5, 16, 6, 1, true]} />
        <meshBasicMaterial color={FULL} transparent opacity={0.16} side={THREE.DoubleSide} />
      </mesh>

      {/* soul-collection area marker */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <ringGeometry args={[UBER_RADIUS - 0.35, UBER_RADIUS, 40]} />
        <meshBasicMaterial color={FULL} transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>

      <pointLight ref={light} position={[0, 2.2, 0]} color={IDLE} intensity={8} distance={20} decay={2} />
    </group>
  );
}

/** Pack-a-Punch: dark, sparking machine that lights up once every buckle is charged. */
function PackAPunch() {
  const unlocked = useGame((s) => s.papUnlocked);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const arm = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const i = unlocked ? 2.2 + Math.sin(t * 4) * 0.8 : 0.12;
    if (glow.current) {
      glow.current.emissiveIntensity = i;
      glow.current.emissive.set(unlocked ? "#4fa66b" : "#3a3f47");
    }
    if (light.current) {
      light.current.intensity = unlocked ? 16 + Math.sin(t * 5) * 6 : 0;
      light.current.color.set("#4fa66b");
    }
    if (arm.current) arm.current.position.y = unlocked ? 1.5 + Math.sin(t * 2.5) * 0.12 : 1.42;
  });

  return (
    <group position={[PAP_POS.x, 0, PAP_POS.z]} rotation-y={Math.PI * 0.25}>
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 2.2, 1.5]} />
        <meshStandardMaterial color="#232830" roughness={0.75} metalness={0.5} />
      </mesh>
      {/* feeding slot */}
      <mesh ref={arm} position={[0, 1.5, 0.82]} castShadow>
        <boxGeometry args={[1.5, 0.35, 0.35]} />
        <meshStandardMaterial color="#111418" roughness={0.5} metalness={0.8} />
      </mesh>
      {/* screen */}
      <mesh position={[0, 2.35, 0]}>
        <boxGeometry args={[2.1, 0.5, 1.2]} />
        <meshStandardMaterial ref={glow} color="#2a3038" emissive="#3a3f47" emissiveIntensity={0.12} />
      </mesh>
      {/* pipes */}
      {[-0.9, 0.9].map((x, i) => (
        <mesh key={i} position={[x, 1.4, -0.85]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 2.8, 6]} />
          <meshStandardMaterial color="#4a2f1f" roughness={0.9} metalness={0.4} />
        </mesh>
      ))}
      <pointLight ref={light} position={[0, 2.5, 0.8]} color="#4fa66b" intensity={0} distance={18} decay={2} />
    </group>
  );
}

export function UberSystem() {
  return (
    <group>
      {ubers.map((u) => (
        <UberMesh key={u.id} uber={u} />
      ))}
      <PackAPunch />
    </group>
  );
}
