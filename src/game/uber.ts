import * as THREE from "three";

/**
 * Four "Überschnalle" charging buckles scattered across the map. Each one
 * absorbs the souls of zombies killed near it: 15 kills per buckle. When all
 * four are fully charged the Pack-a-Punch machine in the central square
 * powers up and the current weapon can be upgraded.
 */
export const KILLS_PER_UBER = 15;
export const UBER_RADIUS = 9;

export type Uber = {
  id: number;
  name: string;
  x: number;
  z: number;
  charge: number;
};

function polar(deg: number, r: number) {
  const a = (deg * Math.PI) / 180;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

export const ubers: Uber[] = [
  { id: 0, name: "Überschnalle Alfa", ...polar(28, 52), charge: 0 },
  { id: 1, name: "Überschnalle Bravo", ...polar(118, 56), charge: 0 },
  { id: 2, name: "Überschnalle Charlie", ...polar(212, 85), charge: 0 },
  { id: 3, name: "Überschnalle Delta", ...polar(303, 90), charge: 0 },
];

/** Pack-a-Punch stands in the central square, dormant until every buckle is full. */
export const PAP_POS = { x: -14, z: -10 };
export const COST_PAP = 5000;

export function uberCharged(u: Uber) {
  return u.charge >= KILLS_PER_UBER;
}

export function allUbersCharged() {
  return ubers.every(uberCharged);
}

export function resetUbers() {
  for (const u of ubers) u.charge = 0;
}

/**
 * Feed a kill to the nearest buckle in range.
 * Returns the buckle that took the soul, or null.
 */
export function feedKill(pos: THREE.Vector3): Uber | null {
  let best: Uber | null = null;
  let bestD = UBER_RADIUS;
  for (const u of ubers) {
    if (uberCharged(u)) continue;
    const d = Math.hypot(pos.x - u.x, pos.z - u.z);
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  if (!best) return null;
  best.charge++;
  return best;
}
