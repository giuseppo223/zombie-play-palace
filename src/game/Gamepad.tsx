import { useEffect } from "react";
import { input } from "./world";
import { useGame } from "./store";

const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);

/** PlayStation (standard mapping) controller: L stick move, R stick aim, R2 fire,
 *  Square reload, Cross use/buy, Triangle heal at station. */
const BUTTON_KEYS: Record<number, string> = { 0: "KeyE", 2: "KeyR", 3: "Digit2" };

export function useGamepad(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const prev: boolean[] = [];
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const pad = Array.from(navigator.getGamepads?.() ?? []).find(Boolean);
      if (!pad || useGame.getState().phase !== "playing") return;
      input.moveX = dz(pad.axes[0] ?? 0);
      input.moveY = -dz(pad.axes[1] ?? 0);
      input.aimX = dz(pad.axes[2] ?? 0);
      const r2 = pad.buttons[7]?.pressed || pad.buttons[5]?.pressed;
      if (r2 && !prev[7]) input.firing = true;
      if (!r2 && prev[7]) input.firing = false;
      prev[7] = !!r2;
      for (const [i, code] of Object.entries(BUTTON_KEYS)) {
        const n = Number(i);
        const p = !!pad.buttons[n]?.pressed;
        if (p && !prev[n]) window.dispatchEvent(new KeyboardEvent("keydown", { code }));
        if (!p && prev[n]) window.dispatchEvent(new KeyboardEvent("keyup", { code }));
        prev[n] = p;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      input.moveX = input.moveY = input.aimX = 0;
      input.firing = false;
    };
  }, [enabled]);
}
