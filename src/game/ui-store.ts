import { create } from "zustand";
import { POI, PERK_SPOTS } from "./world";
import type { PerkId } from "./store";

export type Zone = "station" | "box" | "perks" | null;

type UiState = {
  zone: Zone;
  perk: PerkId | null;
  setZone: (v: Zone, perk?: PerkId | null) => void;
};

export const useUi = create<UiState>((set) => ({
  zone: null,
  perk: null,
  setZone: (zone, perk = null) => set({ zone, perk }),
}));

export const STATION_POS = POI.station;
export const BOX_POS = POI.box;
export const PERK_POSITIONS = PERK_SPOTS;
