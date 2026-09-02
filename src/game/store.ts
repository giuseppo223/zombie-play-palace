import { create } from "zustand";

export type Phase = "menu" | "playing" | "dead";

export type WeaponDef = {
  name: string;
  mag: number;
  damage: number;
  fireRate: number; // seconds between shots
  reload: number;
  spread: number;
  auto: boolean;
};

export const WEAPONS: WeaponDef[] = [
  { name: "M1911", mag: 12, damage: 1, fireRate: 0.26, reload: 1.4, spread: 0.012, auto: false },
  { name: "MP-40", mag: 32, damage: 1, fireRate: 0.09, reload: 1.7, spread: 0.03, auto: true },
  { name: "RAY-7", mag: 45, damage: 2.5, fireRate: 0.08, reload: 2, spread: 0.022, auto: true },
];

export const COST_AMMO = 500;
export const COST_HEAL = 1000;
export const COST_UPGRADE = [1500, 4000];

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
  buyUpgrade: () => void;
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
  weaponDef: () => WEAPONS[get().weapon] ?? WEAPONS[0]!,
  start: () =>
    set({
      phase: "playing",
      health: 100,
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
  addHit: (points) => set({ points: get().points + points, score: get().score + points }),
  addKill: (points) =>
    set({
      kills: get().kills + 1,
      points: get().points + points,
      score: get().score + points,
    }),
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
  buyUpgrade: () => {
    const s = get();
    const next = s.weapon + 1;
    if (next >= WEAPONS.length) return set({ notice: "Arma già al massimo" });
    const cost = COST_UPGRADE[s.weapon] ?? 99999;
    if (s.points < cost) return set({ notice: "Punti insufficienti" });
    const w = WEAPONS[next]!;
    set({
      points: s.points - cost,
      weapon: next,
      ammo: w.mag,
      reserve: w.mag * 4,
      reloading: false,
      notice: `${w.name} sbloccata`,
    });
  },
}));
