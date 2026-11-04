import { beforeEach, describe, expect, it } from 'vitest';
import { useGame, PERKS } from './store';
import { world, PERK_SPOTS, resetWorld } from './world';
import { BOSS_TYPES, chooseBoss } from './bosses';

beforeEach(() => { resetWorld(); useGame.getState().start(); });
describe('new perks', () => {
  it('adds five perks to the twelve existing machines', () => {
    expect(PERKS).toHaveLength(17);
    expect(PERK_SPOTS).toHaveLength(17);
    expect(new Set(PERK_SPOTS.map(p => p.id)).size).toBe(17);
    for (const a of PERK_SPOTS) for (const b of PERK_SPOTS) if (a !== b) expect(Math.hypot(a.x-b.x, a.z-b.z)).toBeGreaterThanOrEqual(80);
  });
  it('Blood Sip heals per kill without reviving a dead player', () => {
    useGame.setState({ perks: ['blood'], health: 50 });
    useGame.getState().addKill(90);
    expect(useGame.getState().health).toBe(53);
    useGame.setState({ health: 0 }); useGame.getState().addKill(90);
    expect(useGame.getState().health).toBe(0);
  });
  it('Scavenger adds reserve ammo, not loaded ammo', () => {
    useGame.setState({ perks: ['scavenger'] }); useGame.getState().addKill(90);
    expect(useGame.getState().reserve).toBe(98);
    expect(useGame.getState().ammo).toBe(12);
  });
  it('Focus halves spread', () => {
    useGame.setState({ perks: ['precision'] });
    expect(useGame.getState().weaponDef().spread).toBe(0.006);
  });
  it('Piercing enables penetration', () => {
    expect(Boolean(useGame.getState().weaponDef().pierce)).toBe(false);
    useGame.setState({ perks: ['breach'] }); expect(useGame.getState().weaponDef().pierce).toBe(true);
  });
  it('Time Tonic extends every timed boost by 50 percent', () => {
    useGame.setState({ perks: ['timeslip'] });
    for (const k of ['instakill', 'double', 'speed'] as const) useGame.getState().applyPickup(k);
    expect(world.boost).toEqual({ instakill: 37.5, double: 45, speed: 30 });
  });
  it('charges once for duplicate purchases', () => {
    useGame.setState({ points: 5000 }); useGame.getState().buyPerk('blood'); useGame.getState().buyPerk('blood');
    expect(useGame.getState().points).toBe(2000); expect(useGame.getState().perks).toEqual(['blood']);
  });
});
it('keeps the brute and randomly selects three additional boss types', () => {
  expect(BOSS_TYPES).toHaveLength(4);
  expect([0, 0.25, 0.5, 0.75].map(chooseBoss)).toEqual(['brute', 'charger', 'storm', 'summoner']);
});