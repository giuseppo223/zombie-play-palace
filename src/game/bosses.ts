export const BOSS_TYPES = ["brute", "charger", "storm", "summoner"] as const;
export type BossKind = (typeof BOSS_TYPES)[number];
export const BOSS_DEFS = {
  brute: { name: "Bruto", color: "#ff4a2a", hp: 1, speed: 1, scale: 1, cooldown: 8, range: 0 },
  charger: { name: "Predatore", color: "#e8c07a", hp: 0.8, speed: 1.5, scale: 0.85, cooldown: 7, range: 18 },
  storm: { name: "Tempesta", color: "#4fd1e8", hp: 1, speed: 0.9, scale: 1, cooldown: 9, range: 8 },
  summoner: { name: "Necromante", color: "#4fa66b", hp: 1.15, speed: 0.8, scale: 0.95, cooldown: 12, range: 24 },
} as const;
export function chooseBoss(random = Math.random()): BossKind {
  return BOSS_TYPES[Math.min(3, Math.max(0, Math.floor(random * 4)))] ?? "brute";
}