import type { Zombie } from "./world";

export type WeaponPower = "chain" | "blast" | "drain" | "repulse" | "execute";
export const POWER_COLORS: Record<WeaponPower, string> = {
  chain: "#69d8f5", blast: "#f5b65e", drain: "#ed648b", repulse: "#9ce5b5", execute: "#e9edf4",
};
export const RARE_WEAPONS = [
  { name: "Tesla Tempesta", mag: 6, damage: 16, fireRate: 0.65, reload: 2.7, spread: 0.009, auto: false, mags: 5, rare: true, power: "chain", ability: "Fulmine a catena" },
  { name: "Lanciatore Nova", mag: 4, damage: 22, fireRate: 0.8, reload: 2.9, spread: 0.012, auto: false, mags: 6, rare: true, power: "blast", ability: "Esplosione ad area" },
  { name: "Zanna Vampirica", mag: 16, damage: 8, fireRate: 0.22, reload: 2, spread: 0.01, auto: false, mags: 5, rare: true, power: "drain", ability: "Assorbimento vitale" },
  { name: "Cannone Repulsore", mag: 5, damage: 18, fireRate: 0.7, reload: 2.6, spread: 0.018, auto: false, mags: 5, rare: true, power: "repulse", ability: "Onda respingente" },
  { name: "Falce dell’Oblio", mag: 8, damage: 20, fireRate: 0.6, reload: 2.5, spread: 0.004, auto: false, mags: 5, rare: true, power: "execute", ability: "Esecuzione dei feriti" },
] as const;

/** Pure hit planning shared by local shots and creator-authoritative guest shots. */
export function planPowerHits(power: WeaponPower | undefined, target: Zombie, zombies: Zombie[], damage: number) {
  const primary = { zombie: target, damage, primary: true };
  const hits = [primary];
  if (power === "execute" && !target.boss && target.hp / target.maxHp <= 0.35) primary.damage = Math.max(damage, target.hp);
  if (power !== "chain" && power !== "blast" && power !== "repulse") return hits;
  const radius = power === "chain" ? 8 : 6;
  const nearby = zombies.filter(z => z !== target && z.active && z.dying === 0 && z.pos.distanceTo(target.pos) <= radius)
    .sort((a, b) => a.pos.distanceToSquared(target.pos) - b.pos.distanceToSquared(target.pos));
  for (const z of nearby.slice(0, power === "chain" ? 3 : nearby.length)) hits.push({ zombie: z, damage: damage * (power === "chain" ? 0.7 : 0.5), primary: false });
  return hits;
}

export function rollBoxWeapon<T extends { rare?: boolean }>(weapons: readonly T[], current: number, round: number, random = Math.random) {
  const candidates = weapons.map((weapon, index) => ({ index, weight: index === current ? 0 : weapon.rare ? 0.2 : 1 + Math.min(0.6, round * 0.05) * index / weapons.length }));
  let pick = random() * candidates.reduce((total, c) => total + c.weight, 0);
  for (const c of candidates) { pick -= c.weight; if (pick < 0 && c.weight > 0) return c.index; }
  return candidates.slice().reverse().find(c => c.weight > 0)?.index ?? current;
}