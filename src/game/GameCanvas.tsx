import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { City } from "./City";
import { Player } from "./Player";
import { ZombieSystem } from "./Zombies";
import { Atmosphere, Station, Tracers, Pickups, MysteryBox, PerkMachines } from "./Effects";
import { HUD, TouchControls } from "./HUD";
import { input, world } from "./world";
import { useGame, PERKS } from "./store";
import { useUi } from "./ui-store";

function useInputBindings() {
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      input.keys.add(e.code);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      const g = useGame.getState();
      if (g.phase !== "playing") return;
      if (e.code === "KeyR" && !g.reloading && g.ammo < g.weaponDef().mag && g.reserve > 0) {
        g.setReloading(true);
        world.reloadTimer = g.weaponDef().reload;
      }
      if (e.code === "Space") input.firing = true;
      const { zone, perk: nearPerk } = useUi.getState();
      if (zone === "station") {
        if (e.code === "Digit1") g.buyAmmo();
        if (e.code === "Digit2") g.buyHeal();
      } else if (zone === "box") {
        if (e.code === "Digit1" || e.code === "KeyE" || e.code === "KeyF") g.buyBox();
      } else if (zone === "perks" && nearPerk) {
        if (e.code === "Digit1" || e.code === "KeyE" || e.code === "KeyF") g.buyPerk(nearPerk);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      input.keys.delete(e.code);
      if (e.code === "Space") input.firing = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);
}

export function GameCanvas() {
  useInputBindings();

  useEffect(() => {
    const onBlur = () => {
      input.keys.clear();
      input.firing = false;
      input.moveX = 0;
      input.moveY = 0;
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  return (
    <div className="fixed inset-0 bg-background">
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={(e) => {
          const g = useGame.getState();
          if (g.phase !== "playing") return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          if (e.pointerType === "mouse") input.firing = true;
        }}
        onPointerUp={() => {
          input.firing = false;
        }}
        onPointerMove={(e) => {
          if (useGame.getState().phase !== "playing") return;
          if (e.pointerType === "mouse") {
            if (document.pointerLockElement) input.yawDelta += e.movementX;
            else if (e.buttons > 0) input.yawDelta += e.movementX * 1.6;
            else input.yawDelta += e.movementX * 0.75;
          } else if (e.buttons > 0 && e.clientX > window.innerWidth * 0.45) {
            input.yawDelta += e.movementX * 2.2;
          }
        }}
      >
        <Canvas
          shadows
          dpr={[1, 1.7]}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          camera={{ position: [0, 3, 6], fov: 68, near: 0.1, far: 300 }}
          onCreated={({ gl, scene }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.15;
            scene.background = new THREE.Color("#0b0e13");
            scene.fog = new THREE.FogExp2("#0b0e13", 0.018);
          }}
        >
          <Atmosphere />
          <City />
          <Station />
          <MysteryBox />
          <PerkMachines />
          <Pickups />
          <Player />
          <ZombieSystem />
          <Tracers />
        </Canvas>
      </div>
      <HUD />
      <TouchControls />
    </div>
  );
}
