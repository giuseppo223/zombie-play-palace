import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

type ShapeProps = { args: [number, number, number] };

/** Soft equipment edges, without changing the existing collision dimensions. */
export function RoundedGeometry({ args: [w, h, d] }: ShapeProps) {
  const geometry = useMemo(() => new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.2), [w, h, d]);
  return <primitive object={geometry} attach="geometry" />;
}

/** Smooth anatomical volumes instead of rectangular limb and face blocks. */
export function OrganicGeometry({ args: [w, h, d] }: ShapeProps) {
  const geometry = useMemo(() => {
    const geo = new THREE.CapsuleGeometry(0.5, 1, 4, 12);
    geo.scale(w, h / 2, d);
    return geo;
  }, [w, h, d]);
  return <primitive object={geometry} attach="geometry" />;
}