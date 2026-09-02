import { create } from "zustand";

type UiState = {
  nearStation: boolean;
  setNearStation: (v: boolean) => void;
};

export const useUi = create<UiState>((set) => ({
  nearStation: false,
  setNearStation: (nearStation) => set({ nearStation }),
}));

export const STATION_POS = { x: 8, z: 8 };
