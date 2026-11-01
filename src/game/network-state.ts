import { create } from 'zustand';

export const MAX_PLAYERS = 3;
export type Member = { id: string; name: string };
export type Room = { code: string; id: string; hostId: string | null; started: boolean; members: Member[] };
export type RemoteState = { id: string; x: number; z: number; yaw: number; health: number; phase: string; widow: boolean };
export const useNetwork = create<{ room: Room | null; connected: boolean; error: string }>(() => ({ room: null, connected: false, error: '' }));
export const network = {
  remotes: new Map<string, RemoteState>(),
  commands: [] as Record<string, unknown>[],
  damage: (_id: string, _amount: number) => {},
};
export function isGuest() { const r = useNetwork.getState().room; return !!r?.started && r.id !== r.hostId; }
export function queueCommand(command: Record<string, unknown>) { network.commands.push(command); }
export function roomHasSpace(count: number) { return count < MAX_PLAYERS; }