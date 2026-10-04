import { useRef, useState } from "react";
import { input } from "./world";

/** Brawl Stars-style touch controls: big move stick bottom-left,
 *  fire/reload/use cluster low on the right. No look stick — the
 *  view auto-faces the nearest zombie while firing. */
export function TouchControls() {
  const moveId = useRef(-1);
  const moveOrigin = useRef({ x: 0, y: 0 });
  const [moveKnob, setMoveKnob] = useState({ x: 0, y: 0, active: false });
  const R = 64; // stick travel radius px

  const key = (code: string, down: boolean) =>
    window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code }));

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.clientX < window.innerWidth / 2 && moveId.current < 0) {
      moveId.current = e.pointerId;
      moveOrigin.current = { x: e.clientX, y: e.clientY };
      setMoveKnob({ x: 0, y: 0, active: true });
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
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
    }
  };

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === moveId.current) {
      moveId.current = -1;
      input.moveX = 0;
      input.moveY = 0;
      setMoveKnob({ x: 0, y: 0, active: false });
    }
  };

  return (
    <>
      {/* touch surface for the move stick (left half only) */}
      <div
        className="pointer-events-auto absolute inset-y-0 left-0 right-1/2 touch-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* left stick — big, Brawl Stars style */}
        <div className="absolute bottom-10 left-8 h-44 w-44 rounded-full border-2 border-border/60 bg-card/40 backdrop-blur-sm">
          <div
            className="absolute left-1/2 top-1/2 h-20 w-20 rounded-full border-2 border-accent/70 bg-accent/40"
            style={{
              transform: `translate(calc(-50% + ${moveKnob.x}px), calc(-50% + ${moveKnob.y}px))`,
              opacity: moveKnob.active ? 1 : 0.55,
            }}
          />
        </div>
      </div>

      {/* fire / reload / use cluster — low on the right, Brawl Stars style */}
      <div className="pointer-events-auto absolute bottom-6 right-6 flex items-end gap-4 touch-none" onPointerDownCapture={(e) => e.stopPropagation()} onPointerMove={(e) => e.stopPropagation()} onPointerMoveCapture={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-3">
          <button
            className="h-16 w-16 rounded-full border-2 border-border/70 bg-card/60 font-hud text-[10px] uppercase tracking-widest text-foreground active:bg-card"
            onPointerDown={() => key("KeyR", true)}
            onPointerUp={() => key("KeyR", false)}
          >
            Ricarica
          </button>
          <button
            className="h-16 w-16 rounded-full border-2 border-accent/70 bg-accent/30 font-hud text-[10px] uppercase tracking-widest text-foreground active:bg-accent/60"
            onPointerDown={() => key("KeyE", true)}
            onPointerUp={() => key("KeyE", false)}
          >
            Usa
          </button>
        </div>
        <button
          className="h-28 w-28 rounded-full border-2 border-destructive bg-destructive/40 font-hud text-sm uppercase tracking-widest text-foreground shadow-[0_0_24px_var(--blood-glow)] active:bg-destructive/70"
          onPointerDown={() => (input.firing = true)}
          onPointerUp={() => (input.firing = false)}
          onPointerCancel={() => (input.firing = false)}
          onPointerLeave={() => (input.firing = false)}
        >
          Fuoco
        </button>
      </div>
    </>
  );
}
