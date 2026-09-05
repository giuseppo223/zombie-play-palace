import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { walls, gates, WALL_H, WALL_T, GATE_W, type Gate } from "./zones";

const concrete = new THREE.MeshStandardMaterial({ color: "#3a3f47", roughness: 0.95, metalness: 0.05 });
const concreteTop = new THREE.MeshStandardMaterial({ color: "#22262c", roughness: 0.9 });
const wire = new THREE.MeshStandardMaterial({ color: "#5a5f66", roughness: 0.5, metalness: 0.8 });
const steel = new THREE.MeshStandardMaterial({ color: "#1a1e24", roughness: 0.45, metalness: 0.85 });
const rust = new THREE.MeshStandardMaterial({ color: "#4a2f1f", roughness: 0.9, metalness: 0.4 });

/** Concrete barricade walls between zones, one box per segment. */
function Walls() {
  const items = useMemo(
    () =>
      walls.map((s) => {
        const dx = s.bx - s.ax;
        const dz = s.bz - s.az;
        const len = Math.hypot(dx, dz) + 0.25;
        return { x: (s.ax + s.bx) / 2, z: (s.az + s.bz) / 2, len, yaw: -Math.atan2(dz, dx) };
      }),
    [],
  );
  return (
    <group>
      {items.map((w, i) => (
        <group key={i} position={[w.x, 0, w.z]} rotation-y={w.yaw}>
          <mesh position={[0, WALL_H / 2, 0]} castShadow receiveShadow material={concrete}>
            <boxGeometry args={[w.len, WALL_H, WALL_T]} />
          </mesh>
          {/* jersey-barrier base */}
          <mesh position={[0, 0.4, 0]} material={concreteTop}>
            <boxGeometry args={[w.len, 0.8, WALL_T + 0.5]} />
          </mesh>
          {/* barbed wire along the top */}
          <mesh position={[0, WALL_H + 0.25, 0]} rotation-z={Math.PI / 2} material={wire}>
            <cylinderGeometry args={[0.06, 0.06, w.len, 5]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function GateMesh({ gate }: { gate: Gate }) {
  const bars = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const color = gate.openable ? "#e8c07a" : "#c2413c";

  useFrame(({ clock }, delta) => {
    const target = gate.open ? 1 : 0;
    gate.anim += (target - gate.anim) * Math.min(1, delta * 1.6);
    if (bars.current) bars.current.position.y = gate.anim * (WALL_H + 0.4);
    const t = clock.elapsedTime;
    const pulse = gate.open ? 0.8 : 1.6 + Math.sin(t * 3 + gate.id) * 0.6;
    if (lamp.current) {
      lamp.current.emissiveIntensity = pulse;
      lamp.current.emissive.set(gate.open ? "#4fa66b" : color);
      lamp.current.color.set(gate.open ? "#4fa66b" : color);
    }
    if (light.current) {
      light.current.intensity = pulse * 5;
      light.current.color.set(gate.open ? "#4fa66b" : color);
    }
  });

  const halfW = GATE_W / 2;
  const barCount = 7;
  return (
    <group position={[gate.x, 0, gate.z]} rotation-y={gate.yaw}>
      {/* posts */}
      {[-halfW, halfW].map((x, i) => (
        <mesh key={i} position={[x, WALL_H / 2 + 0.3, 0]} castShadow material={steel}>
          <boxGeometry args={[0.45, WALL_H + 0.6, 0.45]} />
        </mesh>
      ))}
      {/* lintel */}
      <mesh position={[0, WALL_H + 0.45, 0]} castShadow material={steel}>
        <boxGeometry args={[GATE_W + 0.9, 0.35, 0.6]} />
      </mesh>
      {/* status lamp */}
      <mesh position={[0, WALL_H + 0.8, 0]}>
        <boxGeometry args={[0.5, 0.25, 0.25]} />
        <meshStandardMaterial ref={lamp} color={color} emissive={color} emissiveIntensity={1.6} />
      </mesh>
      <pointLight ref={light} position={[0, WALL_H + 0.6, 0]} color={color} intensity={6} distance={12} decay={2} />

      {/* portcullis bars, slide up when opened */}
      <group ref={bars}>
        {Array.from({ length: barCount }, (_, i) => {
          const x = -halfW + 0.5 + ((GATE_W - 1) * i) / (barCount - 1);
          return (
            <mesh key={i} position={[x, WALL_H / 2, 0]} castShadow material={rust}>
              <cylinderGeometry args={[0.07, 0.07, WALL_H - 0.1, 6]} />
            </mesh>
          );
        })}
        {[0.9, WALL_H / 2, WALL_H - 0.6].map((y, i) => (
          <mesh key={i} position={[0, y, 0]} material={steel}>
            <boxGeometry args={[GATE_W - 0.3, 0.14, 0.18]} />
          </mesh>
        ))}
        {!gate.openable && (
          // welded X plates on permanently locked gates
          <>
            <mesh position={[0, WALL_H / 2, 0.12]} rotation-z={Math.PI / 4} material={rust}>
              <boxGeometry args={[WALL_H * 1.2, 0.22, 0.08]} />
            </mesh>
            <mesh position={[0, WALL_H / 2, 0.12]} rotation-z={-Math.PI / 4} material={rust}>
              <boxGeometry args={[WALL_H * 1.2, 0.22, 0.08]} />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
}

export function ZoneWalls() {
  return (
    <group>
      <Walls />
      {gates.map((g) => (
        <GateMesh key={g.id} gate={g} />
      ))}
    </group>
  );
}
