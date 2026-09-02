import { create } from "zustand";
import { POI } from "./world";

export type Zone = "station" | "box" | "perks" | null;

type UiState = {
  zone: Zone;
  setZone: (v: Zone) => void;
};

export const useUi = create<UiState>((set) => ({
  zone: null,
  setZone: (zone) => set({ zone }),
}));

export const STATION_POS = POI.station;
export const BOX_POS = POI.box;
export const PERKS_POS = POI.perks;
