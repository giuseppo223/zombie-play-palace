import { create } from "zustand";
import { POI, PERK_SPOTS } from "./world";
import type { PerkId } from "./store";

export type Zone = "station" | "box" | "perks" | "gate" | null;

type UiState = {
  zone: Zone;
  perk: PerkId | null;
  /** id of the nearby gate when zone === "gate" */
  gate: number;
  setZone: (v: Zone, perk?: PerkId | null, gate?: number) => void;
};

export const useUi = create<UiState>((set) => ({
  zone: null,
  perk: null,
  gate: -1,
  setZone: (zone, perk = null, gate = -1) => set({ zone, perk, gate }),
}));

export const STATION_POS = POI.station;
export const BOX_POS = POI.box;
export const PERK_POSITIONS = PERK_SPOTS;
