import { useMemo } from "react";
import * as THREE from "three";
import { buildings, props, ARENA_RADIUS } from "./world";
import { asphaltTexture, facadeTexture } from "./textures";

function StreetLamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 2.4, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 4.8, 6]} />
        <meshStandardMaterial color="#0f1318" roughness={0.7} metalness={0.4} />
      </mesh>
      <mesh position={[0, 4.7, 0.35]}>
        <boxGeometry args={[0.4, 0.16, 0.9]} />
        <meshStandardMaterial color="#e8c07a" emissive="#e8c07a" emissiveIntensity={2.4} />
      </mesh>
      <pointLight
        position={[0, 4.4, 0.35]}
        color="#f0c07a"
        intensity={22}
        distance={16}
        decay={2}
      />
    </group>
  );
}

export function City() {
  const asphalt = useMemo(() => asphaltTexture(), []);
  const facadeMats = useMemo(
    () =>
      [0, 1, 2].map(
        (v) =>
          new THREE.MeshStandardMaterial({
            map: facadeTexture(v),
            roughness: 0.9,
            metalness: 0.05,
            color: "#8f97a3",
          }),
      ),
    [],
  );

  const lamps = useMemo(() => {
    const out: { x: number; z: number }[] = [];
    const rings = [
      { r: 15, n: 10 },
      { r: 42, n: 14 },
      { r: 68, n: 18 },
    ];
    rings.forEach(({ r, n }, ri) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ri * 0.3;
        out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
      }
    });
    return out;
  }, []);

  return (
    <group>
      {/* street */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[ARENA_RADIUS + 30, 48]} />
        <meshStandardMaterial map={asphalt} roughness={0.55} metalness={0.15} color="#7e848c" />
      </mesh>

      {/* arena edge: rubble barricade ring */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <ringGeometry args={[ARENA_RADIUS - 0.6, ARENA_RADIUS, 64]} />
        <meshStandardMaterial color="#7a2e2e" emissive="#7a2e2e" emissiveIntensity={0.5} />
      </mesh>

      {buildings.map((b, i) => {
        const mat = facadeMats[Math.floor(b.tint * 3) % 3]!;
        const m = mat.clone();
        m.map = mat.map!.clone();
        m.map.repeat.set(Math.max(1, Math.round(b.w / 4)), Math.max(1, Math.round(b.h / 4)));
        m.map.needsUpdate = true;
        return (
          <group key={i} position={[b.x, 0, b.z]}>
            <mesh position={[0, b.h / 2, 0]} castShadow receiveShadow material={m}>
              <boxGeometry args={[b.w, b.h, b.d]} />
            </mesh>
            {/* parapet */}
            <mesh position={[0, b.h + 0.25, 0]}>
              <boxGeometry args={[b.w + 0.5, 0.5, b.d + 0.5]} />
              <meshStandardMaterial color="#14181e" roughness={0.95} />
            </mesh>
          </group>
        );
      })}

      {props.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation-y={p.rot}>
          {p.kind === "car" && (
            <>
              <mesh position={[0, 0.55, 0]} castShadow>
                <boxGeometry args={[2, 0.7, 4.4]} />
                <meshStandardMaterial color="#2a3038" roughness={0.5} metalness={0.6} />
              </mesh>
              <mesh position={[0, 1.15, -0.2]} castShadow>
                <boxGeometry args={[1.7, 0.6, 2]} />
                <meshStandardMaterial
                  color="#0d1014"
                  roughness={0.2}
                  metalness={0.3}
                  emissive="#1c2430"
                  emissiveIntensity={0.4}
                />
              </mesh>
            </>
          )}
          {p.kind === "barrel" && (
            <mesh position={[0, 0.55, 0]} castShadow>
              <cylinderGeometry args={[0.45, 0.45, 1.1, 10]} />
              <meshStandardMaterial color="#54402a" roughness={0.8} metalness={0.4} />
            </mesh>
          )}
          {p.kind === "crate" && (
            <mesh position={[0, 0.45, 0]} castShadow>
              <boxGeometry args={[0.9, 0.9, 0.9]} />
              <meshStandardMaterial color="#3b3226" roughness={0.95} />
            </mesh>
          )}
        </group>
      ))}

      {lamps.map((l, i) => (
        <StreetLamp key={i} x={l.x} z={l.z} />
      ))}
    </group>
  );
}
