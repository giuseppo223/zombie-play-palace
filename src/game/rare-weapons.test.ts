import { beforeEach, expect, it } from "vitest";
import { RARE_WEAPONS, planPowerHits, rollBoxWeapon } from "./rare-weapons";
import { world, resetWorld } from "./world";
import { WEAPONS, useGame } from "./store";

beforeEach(() => { resetWorld(); useGame.getState().start(); });
it("adds exactly five rare weapons with distinct powers to the box", () => {
  expect(WEAPONS.filter(w => w.rare)).toHaveLength(5);
  expect(new Set(RARE_WEAPONS.map(w => w.power)).size).toBe(5);
});
it("rolls rare weapons less often and never repeats the equipped weapon", () => {
  const counts = new Array(WEAPONS.length).fill(0);
  for (let i = 0; i < 10000; i++) counts[rollBoxWeapon(WEAPONS, 0, 1, () => (i + 0.5) / 10000)]++;
  expect(counts[0]).toBe(0);
  expect(counts[28]).toBeGreaterThan(0);
  expect(counts[28]).toBeLessThan(counts[1]);
});
it("chains to at most three additional nearby living zombies", () => {
  world.zombies.slice(0, 6).forEach((z, i) => { z.active = true; z.hp = z.maxHp = 100; z.pos.set(i, 0, 0); });
  const target = world.zombies[0]; if (!target) throw new Error("Missing zombie");
  const hits = planPowerHits("chain", target, world.zombies, 10);
  expect(hits.map(h => h.damage)).toEqual([10, 7, 7, 7]);
});
it("blasts nearby zombies without hitting distant or dying enemies", () => {
  world.zombies.slice(0, 4).forEach((z, i) => { z.active = true; z.pos.set(i * 3, 0, 0); });
  const target = world.zombies[0]; const dying = world.zombies[1];
  if (!target || !dying) throw new Error("Missing zombie");
  dying.dying = 1;
  expect(planPowerHits("blast", target, world.zombies, 20).map(h => h.damage)).toEqual([20, 10]);
});
it("executes wounded normal zombies but not bosses", () => {
  const z = world.zombies[0]; if (!z) throw new Error("Missing zombie");
  z.hp = 35; z.maxHp = 100;
  expect(planPowerHits("execute", z, world.zombies, 20)[0]?.damage).toBe(35);
  z.boss = true;
  expect(planPowerHits("execute", z, world.zombies, 20)[0]?.damage).toBe(20);
});