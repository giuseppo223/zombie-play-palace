import { useMemo } from "react";
import * as THREE from "three";
import { buildings, props, ARENA_RADIUS, LAMP_RINGS } from "./world";
import { MAP_SCALE } from "./zones";
import { asphaltTexture, facadeTexture } from "./textures";

type Inst = { x: number; y: number; z: number; sx: number; sy: number; sz: number; rot: number };

function Instances({
  items,
  geometry,
  material,
  shadow = false,
}: {
  items: Inst[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  shadow?: boolean;
}) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
    const o = new THREE.Object3D();
    items.forEach((it, i) => {
      o.position.set(it.x, it.y, it.z);
      o.rotation.set(0, it.rot, 0);
      o.scale.set(it.sx, it.sy, it.sz);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    m.castShadow = shadow;
    m.receiveShadow = true;
    return m;
  }, [items, geometry, material, shadow]);
  return <primitive object={mesh} />;
}

export function City() {
  const asphalt = useMemo(() => {
    const t = asphaltTexture();
    t.repeat.set(14 * MAP_SCALE, 14 * MAP_SCALE);
    return t;
  }, []);
  const facadeMats = useMemo(
    () =>
      [0, 1, 2].map((v) => {
        const map = facadeTexture(v);
        map.repeat.set(2, 5);
        return new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0.05, color: "#8f97a3" });
      }),
    [],
  );

  const data = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
    const pole = new THREE.CylinderGeometry(0.75, 1, 1, 6);
    const byTint: Inst[][] = [[], [], []];
    const parapets: Inst[] = [];
    buildings.forEach((b) => {
      byTint[Math.floor(b.tint * 3) % 3]!.push({ x: b.x, y: b.h / 2, z: b.z, sx: b.w, sy: b.h, sz: b.d, rot: 0 });
      parapets.push({ x: b.x, y: b.h + 0.25, z: b.z, sx: b.w + 0.5, sy: 0.5, sz: b.d + 0.5, rot: 0 });
    });
    const carBody: Inst[] = [];
    const carTop: Inst[] = [];
    const barrels: Inst[] = [];
    const crates: Inst[] = [];
    props.forEach((p) => {
      if (p.kind === "car") {
        carBody.push({ x: p.x, y: 0.55, z: p.z, sx: 2, sy: 0.7, sz: 4.4, rot: p.rot });
        const c = Math.cos(p.rot);
        const s = Math.sin(p.rot);
        carTop.push({ x: p.x - 0.2 * s, y: 1.15, z: p.z - 0.2 * c, sx: 1.7, sy: 0.6, sz: 2, rot: p.rot });
      } else if (p.kind === "barrel") barrels.push({ x: p.x, y: 0.55, z: p.z, sx: 0.45, sy: 1.1, sz: 0.45, rot: 0 });
      else crates.push({ x: p.x, y: 0.45, z: p.z, sx: 0.9, sy: 0.9, sz: 0.9, rot: p.rot });
    });
    const poles: Inst[] = [];
    const heads: Inst[] = [];
    const lit: { x: number; z: number }[] = [];
    LAMP_RINGS.forEach(({ r, n, every }, ri) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ri * 0.3;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        poles.push({ x, y: 2.4, z, sx: 0.12, sy: 4.8, sz: 0.12, rot: 0 });
        heads.push({ x, y: 4.7, z: z + 0.35, sx: 0.4, sy: 0.16, sz: 0.9, rot: 0 });
        if (every < 99 && i % every === 0) lit.push({ x, z });
      }
    });
    const mats = {
      parapet: new THREE.MeshStandardMaterial({ color: "#14181e", roughness: 0.95 }),
      carBody: new THREE.MeshStandardMaterial({ color: "#2a3038", roughness: 0.5, metalness: 0.6 }),
      carTop: new THREE.MeshStandardMaterial({ color: "#0d1014", roughness: 0.2, metalness: 0.3, emissive: "#1c2430", emissiveIntensity: 0.4 }),
      barrel: new THREE.MeshStandardMaterial({ color: "#54402a", roughness: 0.8, metalness: 0.4 }),
      crate: new THREE.MeshStandardMaterial({ color: "#3b3226", roughness: 0.95 }),
      pole: new THREE.MeshStandardMaterial({ color: "#0f1318", roughness: 0.7, metalness: 0.4 }),
      head: new THREE.MeshStandardMaterial({ color: "#e8c07a", emissive: "#e8c07a", emissiveIntensity: 2.4 }),
    };
    return { box, cyl, pole, byTint, parapets, carBody, carTop, barrels, crates, poles, heads, lit, mats };
  }, []);

  return (
    <group>
      {/* street */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[ARENA_RADIUS + 30, 128]} />
        <meshStandardMaterial map={asphalt} roughness={0.55} metalness={0.15} color="#7e848c" />
      </mesh>

      {/* arena edge: rubble barricade ring */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <ringGeometry args={[ARENA_RADIUS - 0.6, ARENA_RADIUS, 256]} />
        <meshStandardMaterial color="#7a2e2e" emissive="#7a2e2e" emissiveIntensity={0.5} />
      </mesh>

      {data.byTint.map((items, i) => (
        <Instances key={i} items={items} geometry={data.box} material={facadeMats[i]!} shadow />
      ))}
      <Instances items={data.parapets} geometry={data.box} material={data.mats.parapet} />
      <Instances items={data.carBody} geometry={data.box} material={data.mats.carBody} shadow />
      <Instances items={data.carTop} geometry={data.box} material={data.mats.carTop} />
      <Instances items={data.barrels} geometry={data.cyl} material={data.mats.barrel} shadow />
      <Instances items={data.crates} geometry={data.box} material={data.mats.crate} shadow />
      <Instances items={data.poles} geometry={data.pole} material={data.mats.pole} />
      <Instances items={data.heads} geometry={data.box} material={data.mats.head} />

      {data.lit.map((l, i) => (
        <pointLight key={i} position={[l.x, 4.4, l.z + 0.35]} color="#f0c07a" intensity={22} distance={16} decay={2} />
      ))}
    </group>
  );
}
