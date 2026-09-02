import { create } from "zustand";
import { world } from "./world";

export type Phase = "menu" | "playing" | "dead";

export type WeaponDef = {
  name: string;
  mag: number;
  damage: number;
  fireRate: number; // seconds between shots
  reload: number;
  spread: number;
  auto: boolean;
  /** reserve magazines given when acquired */
  mags: number;
  /** number of projectiles per trigger pull (shotguns) */
  pellets?: number;
  /** allows ray to pass through multiple zombies */
  pierce?: boolean;
};

export const WEAPONS: WeaponDef[] = [
  { name: "M1911", mag: 12, damage: 1, fireRate: 0.26, reload: 1.4, spread: 0.012, auto: false, mags: 8 },
  { name: "Python .357", mag: 6, damage: 3.2, fireRate: 0.42, reload: 1.9, spread: 0.008, auto: false, mags: 8 },
  { name: "Olympia", mag: 2, damage: 1.2, fireRate: 0.5, reload: 1.6, spread: 0.07, auto: false, mags: 12, pellets: 6 },
  { name: "SPAS-12", mag: 8, damage: 1.1, fireRate: 0.55, reload: 2.3, spread: 0.06, auto: false, mags: 6, pellets: 7 },
  { name: "MP-40", mag: 32, damage: 1, fireRate: 0.09, reload: 1.7, spread: 0.03, auto: true, mags: 6 },
  { name: "PPSh-41", mag: 71, damage: 0.9, fireRate: 0.06, reload: 2.4, spread: 0.04, auto: true, mags: 4 },
  { name: "Thompson", mag: 30, damage: 1.15, fireRate: 0.085, reload: 1.8, spread: 0.028, auto: true, mags: 6 },
  { name: "AK-74u", mag: 30, damage: 1.3, fireRate: 0.08, reload: 1.9, spread: 0.032, auto: true, mags: 6 },
  { name: "M14", mag: 8, damage: 2.8, fireRate: 0.2, reload: 1.6, spread: 0.01, auto: false, mags: 10 },
  { name: "STG-44", mag: 30, damage: 1.6, fireRate: 0.1, reload: 2, spread: 0.022, auto: true, mags: 6 },
  { name: "Galil", mag: 35, damage: 1.7, fireRate: 0.095, reload: 2.1, spread: 0.02, auto: true, mags: 6 },
  { name: "FN FAL", mag: 20, damage: 3, fireRate: 0.16, reload: 1.9, spread: 0.012, auto: false, mags: 8 },
  { name: "HK21", mag: 125, damage: 1.5, fireRate: 0.1, reload: 3.6, spread: 0.035, auto: true, mags: 3 },
  { name: "RPK", mag: 100, damage: 1.6, fireRate: 0.09, reload: 3.2, spread: 0.032, auto: true, mags: 3 },
  { name: "Barrett M82", mag: 10, damage: 9, fireRate: 0.75, reload: 2.8, spread: 0.004, auto: false, mags: 4, pierce: true },
  { name: "Ray Gun", mag: 20, damage: 7, fireRate: 0.22, reload: 2.2, spread: 0.01, auto: false, mags: 6 },
  { name: "Wunderwaffe", mag: 3, damage: 40, fireRate: 0.9, reload: 3, spread: 0.01, auto: false, mags: 6, pierce: true },
  { name: "Thundergun", mag: 2, damage: 25, fireRate: 1, reload: 3.4, spread: 0.12, auto: false, mags: 6, pellets: 10, pierce: true },
];

export type PerkId = "jugger" | "speed" | "doubletap" | "stamin";
export const PERKS: { id: PerkId; name: string; desc: string; cost: number; color: string }[] = [
  { id: "jugger", name: "Juggernog", desc: "Vita massima 200", cost: 2500, color: "#c2413c" },
  { id: "speed", name: "Speed Cola", desc: "Ricarica 2x più veloce", cost: 3000, color: "#4fa66b" },
  { id: "doubletap", name: "Double Tap", desc: "Cadenza di fuoco +40%", cost: 2000, color: "#e8c07a" },
  { id: "stamin", name: "Stamin-Up", desc: "Corsa più veloce", cost: 2000, color: "#e0c94a" },
];

export type PickupKind = "maxammo" | "instakill" | "double" | "nuke" | "speed";
export const PICKUP_LABEL: Record<PickupKind, string> = {
  maxammo: "MUNIZIONI MAX",
  instakill: "INSTA-KILL",
  double: "PUNTI DOPPI",
  nuke: "NUKE",
  speed: "VELOCITÀ",
};

export const COST_AMMO = 500;
export const COST_HEAL = 1000;
export const COST_BOX = 950;

type Boosts = { instakill: number; double: number; speed: number };

type GameState = {
  phase: Phase;
  health: number;
  maxHealth: number;
  ammo: number;
  reserve: number;
  reloading: boolean;
  round: number;
  kills: number;
  points: number;
  score: number;
  best: number;
  weapon: number;
  zombiesLeft: number;
  roundBanner: number;
  notice: string;
  perks: PerkId[];
  boosts: Boosts;
  weaponDef: () => WeaponDef;
  start: () => void;
  die: () => void;
  toMenu: () => void;
  damage: (n: number) => void;
  heal: (n: number) => void;
  spendAmmo: () => void;
  setReloading: (r: boolean) => void;
  finishReload: () => void;
  addHit: (points: number) => void;
  addKill: (points: number) => void;
  setRound: (w: number) => void;
  setZombiesLeft: (n: number) => void;
  tickBanner: (d: number) => void;
  buyAmmo: () => void;
  buyHeal: () => void;
  buyPerk: (id: PerkId) => void;
  buyBox: () => void;
  applyPickup: (k: PickupKind) => void;
  syncBoosts: (b: Boosts) => void;
};

export const useGame = create<GameState>((set, get) => ({
  phase: "menu",
  health: 100,
  maxHealth: 100,
  ammo: WEAPONS[0]!.mag,
  reserve: 96,
  reloading: false,
  round: 1,
  kills: 0,
  points: 500,
  score: 0,
  best: 0,
  weapon: 0,
  zombiesLeft: 0,
  roundBanner: 0,
  notice: "",
  perks: [],
  boosts: { instakill: 0, double: 0, speed: 0 },
  weaponDef: () => {
    const s = get();
    const base = WEAPONS[s.weapon] ?? WEAPONS[0]!;
    if (s.perks.length === 0) return base;
    return {
      ...base,
      fireRate: s.perks.includes("doubletap") ? base.fireRate * 0.7 : base.fireRate,
      reload: s.perks.includes("speed") ? base.reload * 0.5 : base.reload,
    };
  },
  start: () =>
    set({
      phase: "playing",
      health: 100,
      maxHealth: 100,
      ammo: WEAPONS[0]!.mag,
      reserve: 96,
      reloading: false,
      round: 1,
      kills: 0,
      points: 500,
      score: 0,
      weapon: 0,
      zombiesLeft: 0,
      roundBanner: 2.5,
      notice: "",
      perks: [],
      boosts: { instakill: 0, double: 0, speed: 0 },
    }),
  die: () => set({ phase: "dead", best: Math.max(get().best, get().score) }),
  toMenu: () => set({ phase: "menu" }),
  damage: (n) => {
    const h = Math.max(0, get().health - n);
    set({ health: h });
    if (h <= 0 && get().phase === "playing") get().die();
  },
  heal: (n) => set({ health: Math.min(get().maxHealth, get().health + n) }),
  spendAmmo: () => set({ ammo: Math.max(0, get().ammo - 1) }),
  setReloading: (reloading) => set({ reloading }),
  finishReload: () => {
    const s = get();
    const need = s.weaponDef().mag - s.ammo;
    const take = Math.min(need, s.reserve);
    set({ ammo: s.ammo + take, reserve: s.reserve - take, reloading: false });
  },
  addHit: (points) => {
    const p = world.boost.double > 0 ? points * 2 : points;
    set({ points: get().points + p, score: get().score + p });
  },
  addKill: (points) => {
    const p = world.boost.double > 0 ? points * 2 : points;
    set({ kills: get().kills + 1, points: get().points + p, score: get().score + p });
  },
  setRound: (round) => set({ round, roundBanner: 2.5 }),
  setZombiesLeft: (zombiesLeft) => set({ zombiesLeft }),
  tickBanner: (d) => {
    const s = get();
    if (s.roundBanner > 0) set({ roundBanner: Math.max(0, s.roundBanner - d) });
  },
  buyAmmo: () => {
    const s = get();
    if (s.points < COST_AMMO) return set({ notice: "Punti insufficienti" });
    set({
      points: s.points - COST_AMMO,
      reserve: s.reserve + s.weaponDef().mag * 3,
      notice: "Munizioni acquistate",
    });
  },
  buyHeal: () => {
    const s = get();
    if (s.points < COST_HEAL) return set({ notice: "Punti insufficienti" });
    if (s.health >= s.maxHealth) return set({ notice: "Sei già al massimo" });
    set({ points: s.points - COST_HEAL, health: s.maxHealth, notice: "Cura completata" });
  },
  buyPerk: (id) => {
    const s = get();
    const perk = PERKS.find((p) => p.id === id)!;
    if (s.perks.includes(id)) return set({ notice: "Perk già attivo" });
    if (s.points < perk.cost) return set({ notice: "Punti insufficienti" });
    const maxHealth = id === "jugger" ? 200 : s.maxHealth;
    set({
      points: s.points - perk.cost,
      perks: [...s.perks, id],
      maxHealth,
      health: id === "jugger" ? Math.min(maxHealth, s.health + 100) : s.health,
      notice: `${perk.name} attivo`,
    });
  },
  buyBox: () => {
    const s = get();
    if (s.points < COST_BOX) return set({ notice: "Punti insufficienti" });
    // random weapon, weighted toward better weapons in later rounds, never the same one
    let next = s.weapon;
    let tries = 0;
    while (next === s.weapon && tries++ < 10) {
      const bias = Math.min(0.6, s.round * 0.05);
      const r = Math.pow(Math.random(), 1 - bias);
      next = Math.min(WEAPONS.length - 1, Math.floor(r * WEAPONS.length));
    }
    const w = WEAPONS[next]!;
    set({
      points: s.points - COST_BOX,
      weapon: next,
      ammo: w.mag,
      reserve: w.mag * w.mags,
      reloading: false,
      notice: `Cassa misteriosa: ${w.name}!`,
    });
    world.reloadTimer = 0;
  },
  applyPickup: (k) => {
    const s = get();
    const w = s.weaponDef();
    if (k === "maxammo") set({ ammo: w.mag, reserve: w.mag * w.mags, reloading: false });
    if (k === "instakill") world.boost.instakill = 25;
    if (k === "double") world.boost.double = 30;
    if (k === "speed") world.boost.speed = 20;
    if (k === "nuke") {
      let n = 0;
      world.zombies.forEach((z) => {
        if (z.active && z.dying === 0) {
          z.dying = 0.001;
          n++;
        }
      });
      const p = 400 + n * 50;
      set({ kills: s.kills + n, points: s.points + p, score: s.score + p });
      world.shake = 1;
    }
    set({ notice: PICKUP_LABEL[k] });
  },
  syncBoosts: (boosts) => set({ boosts }),
}));
