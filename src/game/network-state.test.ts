import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS, roomHasSpace } from './network-state';
describe('multiplayer capacity', () => {
  it('allows three players but not a fourth', () => {
    expect(MAX_PLAYERS).toBe(3);
    expect(roomHasSpace(2)).toBe(true);
    expect(roomHasSpace(3)).toBe(false);
  });
});