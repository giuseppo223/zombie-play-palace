import { beforeEach, expect, it } from "vitest";
import * as THREE from "three";
import { CENTER_OPEN, CENTER_ZONE, gates, walls, zoneAt, nearWall, collideWalls, reachableZones, randomPointInZone, resetGates } from "./zones";

beforeEach(resetGates);

it("encloses the spawn courtyard with four initially closed purchasable exits", () => {
  const exits = gates.filter(g => g.a === CENTER_ZONE);
  expect(exits).toHaveLength(4);
  expect(exits.every(g => !g.open && g.openable)).toBe(true);
  expect(zoneAt(0, 0)).toBe(CENTER_ZONE);
  expect([...reachableZones()]).toEqual([CENTER_ZONE]);
  const exit = exits[0];
  if (!exit) throw new Error("Missing central exit");
  const radial = new THREE.Vector3(exit.x, 0, exit.z).normalize();
  const blocked = new THREE.Vector3(exit.x, 0, exit.z).addScaledVector(radial, -0.4);
  collideWalls(blocked, 0.5);
  expect(blocked.length()).toBeLessThan(CENTER_OPEN - 0.5);
  exit.open = true;
  expect(reachableZones().has(exit.b)).toBe(true);
  const passing = new THREE.Vector3(exit.x, 0, exit.z).addScaledVector(radial, 0.1);
  collideWalls(passing, 0.5);
  expect(passing.length()).toBeGreaterThan(CENTER_OPEN);
});

it("makes the central walls solid while keeping the spawn interior free", () => {
  const segment = walls.find(s => Math.abs(Math.hypot(s.ax, s.az) - CENTER_OPEN) < 0.01 && Math.abs(Math.hypot(s.bx, s.bz) - CENTER_OPEN) < 0.01);
  if (!segment) throw new Error("Missing central wall");
  const midpoint = new THREE.Vector3((segment.ax + segment.bx) / 2, 0, (segment.az + segment.bz) / 2);
  const original = midpoint.clone();
  collideWalls(midpoint, 0.5);
  expect(midpoint.distanceTo(original)).toBeGreaterThan(0.5);
  expect(nearWall(CENTER_OPEN, 0, 1)).toBe(true);
  const spawn = new THREE.Vector3();
  collideWalls(spawn, 0.5);
  expect(spawn.length()).toBe(0);
  for (let i = 0; i < 30; i++) {
    const point = randomPointInZone(CENTER_ZONE, 0, 0, 14, new THREE.Vector3());
    expect(zoneAt(point.x, point.z)).toBe(CENTER_ZONE);
  }
});