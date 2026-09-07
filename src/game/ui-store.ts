import { create } from "zustand";
import { POI, PERK_SPOTS } from "./world";
import type { PerkId } from "./store";

export type Zone = "station" | "box" | "perks" | "gate" | "uber" | "pap" | null;

type UiState = {
  zone: Zone;
  perk: PerkId | null;
  /** id of the nearby gate when zone === "gate" */
  gate: number;
  /** id of the nearby Überschnalle when zone === "uber" */
  uber: number;
  setZone: (v: Zone, perk?: PerkId | null, gate?: number, uber?: number) => void;
};

export const useUi = create<UiState>((set) => ({
  zone: null,
  perk: null,
  gate: -1,
  uber: -1,
  setZone: (zone, perk = null, gate = -1, uber = -1) => set({ zone, perk, gate, uber }),
}));

export const STATION_POS = POI.station;
export const BOX_POS = POI.box;
export const PERK_POSITIONS = PERK_SPOTS;
