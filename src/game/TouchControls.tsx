import { useRef, useState } from "react";
import { input } from "./world";

/** On-screen controls for touch devices when playing without a gamepad:
 *  left half = move stick, right half = aim stick (rate turn), fire/reload/use buttons. */
export function TouchControls() {
  const moveId = useRef(-1);
  const aimId = useRef(-1);
  const moveOrigin = useRef({ x: 0, y: 0 });
  const aimOrigin = useRef({ x: 0, y: 0 });
  const [moveKnob, setMoveKnob] = useState({ x: 0, y: 0, active: false });
  const [aimKnob, setAimKnob] = useState({ x: 0, y: 0, active: false });
  const R = 52; // stick radius px

  const key = (code: string, down: boolean) =>
    window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code }));

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const half = window.innerWidth / 2;
    if (e.clientX < half && moveId.current < 0) {
      moveId.current = e.pointerId;
      moveOrigin.current = { x: e.clientX, y: e.clientY };
      setMoveKnob({ x: 0, y: 0, active: true });
    } else if (e.clientX >= half && aimId.current < 0) {
      aimId.current = e.pointerId;
      aimOrigin.current = { x: e.clientX, y: e.clientY };
      setAimKnob({ x: 0, y: 0, active: true });
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === moveId.current) {
      let dx = (e.clientX - moveOrigin.current.x) / R;
      let dy = (e.clientY - moveOrigin.current.y) / R;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      input.moveX = dx;
      input.moveY = -dy;
      setMoveKnob({ x: dx * R, y: dy * R, active: true });
    } else if (e.pointerId === aimId.current) {
      let dx = (e.clientX - aimOrigin.current.x) / R;
      let dy = (e.clientY - aimOrigin.current.y) / R;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      input.aimX = Math.abs(dx) < 0.12 ? 0 : dx;
      setAimKnob({ x: dx * R, y: dy * R, active: true });
    }
  };

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === moveId.current) {
      moveId.current = -1;
      input.moveX = 0;
      input.moveY = 0;
      setMoveKnob({ x: 0, y: 0, active: false });
    } else if (e.pointerId === aimId.current) {
      aimId.current = -1;
      input.aimX = 0;
      setAimKnob({ x: 0, y: 0, active: false });
    }
  };

  return (
    <>
      {/* touch surface for the two sticks */}
      <div
        className="pointer-events-auto absolute inset-0 touch-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* left stick */}
        <div className="absolute bottom-8 left-6 h-32 w-32 rounded-full border border-border/50 bg-card/30">
          <div
            className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/60 bg-accent/30"
            style={{
              transform: `translate(calc(-50% + ${moveKnob.x}px), calc(-50% + ${moveKnob.y}px))`,
              opacity: moveKnob.active ? 1 : 0.5,
            }}
          />
        </div>
        {/* right stick (aim) */}
        <div className="absolute bottom-8 right-6 h-32 w-32 rounded-full border border-border/50 bg-card/30">
          <div
            className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/60 bg-accent/30"
            style={{
              transform: `translate(calc(-50% + ${aimKnob.x}px), calc(-50% + ${aimKnob.y}px))`,
              opacity: aimKnob.active ? 1 : 0.5,
            }}
          />
        </div>
      </div>

      {/* action buttons */}
      <div className="pointer-events-auto absolute bottom-40 right-6 flex flex-col items-end gap-3">
        <button
          className="h-20 w-20 rounded-full border border-destructive/70 bg-destructive/30 font-hud text-xs uppercase tracking-widest text-foreground active:bg-destructive/60"
          onPointerDown={() => (input.firing = true)}
          onPointerUp={() => (input.firing = false)}
          onPointerCancel={() => (input.firing = false)}
          onPointerLeave={() => (input.firing = false)}
        >
          Fuoco
        </button>
        <div className="flex gap-3">
          <button
            className="h-14 w-14 rounded-full border border-border/70 bg-card/50 font-hud text-[10px] uppercase tracking-widest text-foreground active:bg-card"
            onPointerDown={() => key("KeyR", true)}
            onPointerUp={() => key("KeyR", false)}
          >
            Ricarica
          </button>
          <button
            className="h-14 w-14 rounded-full border border-accent/70 bg-accent/25 font-hud text-[10px] uppercase tracking-widest text-foreground active:bg-accent/50"
            onPointerDown={() => key("KeyE", true)}
            onPointerUp={() => key("KeyE", false)}
          >
            Usa
          </button>
        </div>
      </div>
    </>
  );
}
