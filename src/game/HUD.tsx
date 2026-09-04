import { useEffect, useRef, useState } from "react";
import { useGame, COST_AMMO, COST_HEAL, COST_BOX, WEAPONS, PERKS, PICKUP_LABEL } from "./store";
import { useUi } from "./ui-store";
import { input, world, resetWorld } from "./world";

function BuyRow({
  label,
  cost,
  hotkey,
  onBuy,
}: {
  label: string;
  cost: string;
  hotkey: string;
  onBuy: () => void;
}) {
  return (
    <button
      onClick={onBuy}
      className="flex w-full items-center justify-between gap-3 border border-border/60 bg-card/70 px-3 py-2 text-left backdrop-blur-sm transition-colors hover:border-accent hover:bg-card"
    >
      <span className="font-hud text-sm tracking-wide text-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-hud text-sm text-accent">{cost}</span>
        <span className="hidden rounded-sm bg-muted px-1.5 py-0.5 font-hud text-[10px] text-muted-foreground sm:inline">
          {hotkey}
        </span>
      </span>
    </button>
  );
}

export function HUD() {
  const g = useGame();
  const zone = useUi((s) => s.zone);
  const activeBoosts = (["instakill", "double", "speed"] as const).filter((k) => g.boosts[k] > 0);
  const [hurtPulse, setHurtPulse] = useState(0);
  const lastHealth = useRef(g.health);

  useEffect(() => {
    if (g.health < lastHealth.current) setHurtPulse(Date.now());
    lastHealth.current = g.health;
  }, [g.health]);

  useEffect(() => {
    if (!g.notice) return;
    const t = setTimeout(() => useGame.setState({ notice: "" }), 1600);
    return () => clearTimeout(t);
  }, [g.notice]);

  const startGame = () => {
    resetWorld();
    g.start();
    // on touch devices go fullscreen and try to lock landscape
    if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
      const el = document.documentElement;
      const fs = el.requestFullscreen?.({ navigationUI: "hide" });
      const lock = () => {
        const o = screen.orientation as ScreenOrientation & { lock?: (t: string) => Promise<void> };
        o.lock?.("landscape").catch(() => {});
      };
      if (fs) fs.then(lock).catch(lock);
      else lock();
    }
  };

  const lowHealth = g.health <= 35;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* damage vignette */}
      <div
        key={hurtPulse}
        className={`absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,var(--blood-glow)_100%)] transition-opacity duration-500 ${
          g.phase === "playing" && (lowHealth || Date.now() - hurtPulse < 400)
            ? "opacity-90"
            : "opacity-0"
        }`}
      />

      {g.phase === "playing" && (
        <>
          {/* crosshair */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative h-6 w-6 opacity-70">
              <span className="absolute left-1/2 top-0 h-2 w-[2px] -translate-x-1/2 bg-accent" />
              <span className="absolute bottom-0 left-1/2 h-2 w-[2px] -translate-x-1/2 bg-accent" />
              <span className="absolute left-0 top-1/2 h-[2px] w-2 -translate-y-1/2 bg-accent" />
              <span className="absolute right-0 top-1/2 h-[2px] w-2 -translate-y-1/2 bg-accent" />
            </div>
          </div>

          {/* top left: points + round */}
          <div className="absolute left-4 top-4 space-y-1">
            <div className="font-grunge text-3xl leading-none text-accent drop-shadow-[0_2px_10px_var(--blood-glow)]">
              {g.points.toLocaleString("it-IT")}
            </div>
            <div className="font-hud text-xs uppercase tracking-[0.3em] text-muted-foreground">
              punti
            </div>
          </div>

          {/* top right: round */}
          <div className="absolute right-4 top-4 text-right">
            <div className="font-grunge text-3xl leading-none text-destructive">
              {String(g.round).padStart(2, "0")}
            </div>
            <div className="font-hud text-xs uppercase tracking-[0.3em] text-muted-foreground">
              round
            </div>
            <div className="mt-1 font-hud text-xs text-muted-foreground">
              rimasti {g.zombiesLeft}
            </div>
          </div>

          {/* boss health bar */}
          {g.bossHp >= 0 && (
            <div className="absolute left-1/2 top-4 w-72 -translate-x-1/2 sm:w-96">
              <div className="mb-1 text-center font-grunge text-sm uppercase tracking-[0.4em] text-destructive animate-pulse">
                Boss
              </div>
              <div className="h-2.5 w-full overflow-hidden border border-destructive/60 bg-background/70">
                <div
                  className="h-full bg-destructive transition-[width] duration-150"
                  style={{ width: `${Math.max(0, g.bossHp) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* bottom left: health */}
          <div className="absolute bottom-24 left-4 w-40 sm:bottom-6">
            <div className="h-2 w-full overflow-hidden bg-muted/70">
              <div
                className={`h-full transition-[width] duration-200 ${
                  lowHealth ? "bg-destructive" : "bg-primary"
                }`}
                style={{ width: `${g.health}%` }}
              />
            </div>
            <div className="mt-1 font-hud text-xs uppercase tracking-[0.2em] text-muted-foreground">
              vita {Math.round(g.health)}
            </div>
          </div>

          {/* bottom right: weapon */}
          <div className="absolute bottom-24 right-4 text-right sm:bottom-6">
            <div className="font-hud text-sm uppercase tracking-[0.2em] text-muted-foreground">
              {WEAPONS[g.weapon]?.name}
            </div>
            <div className="font-grunge text-2xl leading-tight text-foreground">
              {g.reloading ? "RICARICA" : `${g.ammo} / ${g.reserve}`}
            </div>
            <div className="font-hud text-xs text-muted-foreground">
              uccisioni {g.kills}
            </div>
          </div>

          {/* perks owned (above health bar) */}
          {g.perks.length > 0 && (
            <div className="absolute bottom-36 left-4 flex gap-1.5 sm:bottom-16">
              {g.perks.map((id) => {
                const p = PERKS.find((x) => x.id === id)!;
                return (
                  <div
                    key={id}
                    title={p.name}
                    className="flex h-8 w-8 items-center justify-center border border-border/60 bg-card/70 font-grunge text-sm"
                    style={{ color: p.color, boxShadow: `0 0 10px ${p.color}55` }}
                  >
                    {p.name[0]}
                  </div>
                );
              })}
            </div>
          )}

          {/* active boosts */}
          {activeBoosts.length > 0 && (
            <div className="absolute left-1/2 top-4 flex -translate-x-1/2 gap-3">
              {activeBoosts.map((k) => (
                <div key={k} className="text-center">
                  <div
                    className={`font-grunge text-base uppercase tracking-widest ${
                      g.boosts[k] <= 5 ? "animate-pulse text-destructive" : "text-accent"
                    }`}
                  >
                    {PICKUP_LABEL[k]}
                  </div>
                  <div className="font-hud text-xs text-muted-foreground">{g.boosts[k]}s</div>
                </div>
              ))}
            </div>
          )}

          {/* station buy panel */}
          {zone === "station" && (
            <div className="pointer-events-auto absolute left-1/2 top-1/2 w-64 -translate-x-1/2 translate-y-8 space-y-1.5">
              <div className="font-hud text-xs uppercase tracking-[0.3em] text-muted-foreground">
                stazione rifornimenti
              </div>
              <BuyRow
                label="Munizioni"
                cost={`${COST_AMMO}`}
                hotkey="1"
                onBuy={() => g.buyAmmo()}
              />
              <BuyRow label="Cura" cost={`${COST_HEAL}`} hotkey="2" onBuy={() => g.buyHeal()} />
            </div>
          )}

          {/* mystery box panel */}
          {zone === "box" && (
            <div className="pointer-events-auto absolute left-1/2 top-1/2 w-64 -translate-x-1/2 translate-y-8 space-y-1.5">
              <div className="font-hud text-xs uppercase tracking-[0.3em] text-muted-foreground">
                cassa misteriosa · {WEAPONS.length} armi
              </div>
              <BuyRow
                label="Arma casuale"
                cost={`${COST_BOX}`}
                hotkey="1 / E"
                onBuy={() => g.buyBox()}
              />
            </div>
          )}

          {/* single perk machine panel */}
          {zone === "perks" &&
            (() => {
              const p = PERKS.find((x) => x.id === nearPerk);
              if (!p) return null;
              const owned = g.perks.includes(p.id);
              return (
                <div className="pointer-events-auto absolute left-1/2 top-1/2 w-72 -translate-x-1/2 translate-y-8 space-y-1.5">
                  <div className="font-hud text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    distributore perk
                  </div>
                  <BuyRow
                    label={owned ? `${p.name} ✓` : `${p.name} — ${p.desc}`}
                    cost={owned ? "attivo" : `${p.cost}`}
                    hotkey="1"
                    onBuy={() => g.buyPerk(p.id)}
                  />
                </div>
              );
            })()}
        </>
      )}

      {g.phase === "menu" && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-background/80 px-6 text-center backdrop-blur-sm">
          <div className="font-hud text-xs uppercase tracking-[0.5em] text-accent">
            sopravvivenza a ondate
          </div>
          <h1 className="mt-3 font-grunge text-5xl uppercase leading-none text-destructive drop-shadow-[0_0_30px_var(--blood-glow)] sm:text-7xl">
            Notte dei
            <br />
            Morti
          </h1>
          <p className="mt-5 max-w-sm font-hud text-sm text-muted-foreground">
            Round infiniti in una città enorme. Colpi alla testa valgono il doppio. Spendi punti alla
            stazione (munizioni, cure), alla cassa misteriosa ({WEAPONS.length} armi casuali) e ai
            distributori perk. Gli zombie possono lasciare boost: Insta-Kill, Punti Doppi, Nuke,
            Munizioni Max, Velocità.
          </p>
          <button
            onClick={startGame}
            className="mt-7 border border-destructive/70 bg-destructive/15 px-8 py-3 font-grunge text-xl uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-destructive/35"
          >
            Inizia
          </button>
          <div className="mt-6 space-y-1 font-hud text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <div className="hidden sm:block">WASD muovi · mouse gira · click spara · R ricarica</div>
            <div className="sm:hidden">stick sinistro muovi · stick destro mira · FUOCO spara · meglio in orizzontale</div>
          </div>
        </div>
      )}

      {g.phase === "dead" && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-background/85 px-6 text-center backdrop-blur-sm">
          <h2 className="font-grunge text-5xl uppercase text-destructive drop-shadow-[0_0_30px_var(--blood-glow)]">
            Sei morto
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-6 font-hud">
            <div>
              <div className="text-2xl text-foreground">{g.round}</div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">round</div>
            </div>
            <div>
              <div className="text-2xl text-foreground">{g.kills}</div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                uccisioni
              </div>
            </div>
            <div>
              <div className="text-2xl text-accent">{g.score.toLocaleString("it-IT")}</div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                punteggio
              </div>
            </div>
          </div>
          <button
            onClick={startGame}
            className="mt-8 border border-destructive/70 bg-destructive/15 px-8 py-3 font-grunge text-xl uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-destructive/35"
          >
            Riprova
          </button>
          <div className="mt-3 font-hud text-xs uppercase tracking-[0.2em] text-muted-foreground">
            record {g.best.toLocaleString("it-IT")}
          </div>
        </div>
      )}
    </div>
  );
}

/** Touch stick + fire button, shown on small screens. */
function useStick(max: number, onMove: (nx: number, ny: number) => void, onEnd: () => void) {
  const knob = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const setKnob = (dx: number, dy: number) => {
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const end = () => {
    origin.current = null;
    setKnob(0, 0);
    onEnd();
  };
  return {
    knob,
    handlers: {
      onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const r = e.currentTarget.getBoundingClientRect();
        // dynamic origin: stick centres where the thumb lands
        origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      },
      onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
        const o = origin.current;
        if (!o) return;
        let dx = e.clientX - o.x;
        let dy = e.clientY - o.y;
        const len = Math.hypot(dx, dy);
        if (len > max) {
          dx = (dx / len) * max;
          dy = (dy / len) * max;
        }
        setKnob(dx, dy);
        onMove(dx / max, dy / max);
      },
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}

export function TouchControls() {
  const phase = useGame((s) => s.phase);
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait) and (pointer: coarse)");
    const upd = () => setPortrait(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  const move = useStick(
    52,
    (nx, ny) => {
      input.moveX = nx;
      input.moveY = -ny;
    },
    () => {
      input.moveX = 0;
      input.moveY = 0;
    },
  );
  const aim = useStick(
    48,
    (nx) => {
      input.aimX = nx;
    },
    () => {
      input.aimX = 0;
    },
  );

  if (phase !== "playing") return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 hidden pointer-coarse:block">
      {portrait && (
        <div className="absolute left-1/2 top-16 -translate-x-1/2 animate-pulse rounded-sm border border-accent/50 bg-card/70 px-3 py-1 font-hud text-xs uppercase tracking-[0.2em] text-accent">
          Ruota il telefono in orizzontale
        </div>
      )}

      {/* move stick */}
      <div
        {...move.handlers}
        className="pointer-events-auto absolute bottom-6 left-5 h-32 w-32 touch-none rounded-full border border-border/70 bg-card/40 backdrop-blur-sm landscape:bottom-5"
      >
        <div
          ref={move.knob}
          className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/60 bg-accent/25"
        />
      </div>

      {/* aim stick */}
      <div
        {...aim.handlers}
        className="pointer-events-auto absolute bottom-6 right-32 h-28 w-28 touch-none rounded-full border border-border/70 bg-card/40 backdrop-blur-sm landscape:bottom-5 landscape:right-36"
      >
        <div
          ref={aim.knob}
          className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/60 bg-primary/25"
        />
        <span className="pointer-events-none absolute inset-x-0 -top-5 text-center font-hud text-[10px] uppercase tracking-widest text-muted-foreground">
          mira
        </span>
      </div>

      <button
        className="pointer-events-auto absolute bottom-8 right-4 h-24 w-24 touch-none rounded-full border border-destructive/70 bg-destructive/25 font-grunge text-lg uppercase tracking-widest text-foreground active:bg-destructive/50"
        onPointerDown={(e) => {
          e.preventDefault();
          input.firing = true;
        }}
        onPointerUp={() => (input.firing = false)}
        onPointerLeave={() => (input.firing = false)}
      >
        fuoco
      </button>

      <button
        className="pointer-events-auto absolute bottom-36 right-8 h-14 w-14 touch-none rounded-full border border-border/70 bg-card/50 font-hud text-xs uppercase text-muted-foreground active:bg-card landscape:bottom-8 landscape:right-72"
        onPointerDown={(e) => {
          e.preventDefault();
          const g = useGame.getState();
          if (!g.reloading && g.ammo < g.weaponDef().mag && g.reserve > 0) {
            g.setReloading(true);
            world.reloadTimer = g.weaponDef().reload;
          }
        }}
      >
        ric
      </button>
    </div>
  );
}
