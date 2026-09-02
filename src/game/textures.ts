import * as THREE from "three";

function makeCanvas(size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return { c, ctx: c.getContext("2d")! };
}

let asphalt: THREE.Texture | null = null;

/** Cracked, damp asphalt with faded road markings. */
export function asphaltTexture() {
  if (asphalt) return asphalt;
  const { c, ctx } = makeCanvas(512);
  ctx.fillStyle = "#15181d";
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const s = Math.random() * 2.2;
    const v = 20 + Math.random() * 40;
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 8},0.5)`;
    ctx.fillRect(x, y, s, s);
  }
  // damp patches
  for (let i = 0; i < 26; i++) {
    const g = ctx.createRadialGradient(
      Math.random() * 512,
      Math.random() * 512,
      2,
      Math.random() * 512,
      Math.random() * 512,
      40 + Math.random() * 70,
    );
    g.addColorStop(0, "rgba(10,14,20,0.55)");
    g.addColorStop(1, "rgba(10,14,20,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  }
  // cracks
  ctx.strokeStyle = "rgba(8,9,11,0.8)";
  for (let i = 0; i < 40; i++) {
    ctx.lineWidth = Math.random() * 1.6 + 0.3;
    ctx.beginPath();
    let x = Math.random() * 512;
    let y = Math.random() * 512;
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (Math.random() - 0.5) * 60;
      y += (Math.random() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // worn lane marking
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#d9d2bd";
  for (let y = 20; y < 512; y += 128) ctx.fillRect(250, y, 12, 64);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  asphalt = tex;
  return tex;
}

const facades = new Map<number, THREE.Texture>();

/** Concrete facade with a sparse grid of lit / dead windows. */
export function facadeTexture(variant: number) {
  const key = variant % 3;
  const cached = facades.get(key);
  if (cached) return cached;

  const { c, ctx } = makeCanvas(256);
  const base = ["#1a1f26", "#20202a", "#171c1f"][key] ?? "#1a1f26";
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const v = Math.random() * 30;
    ctx.fillStyle = `rgba(${v},${v},${v},0.25)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  // grime running down
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = "rgba(6,8,10,0.25)";
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 60);
  }
  const cols = 6;
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = 10 + col * 40;
      const y = 8 + r * 31;
      const lit = Math.random();
      if (lit > 0.82) {
        ctx.fillStyle = ["#e8c07a", "#d9a35a", "#c9d4c5"][Math.floor(Math.random() * 3)] ?? "#e8c07a";
      } else if (lit > 0.72) {
        ctx.fillStyle = "#3a4450";
      } else {
        ctx.fillStyle = "#0a0d11";
      }
      ctx.fillRect(x, y, 24, 20);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, 24, 20);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  facades.set(key, tex);
  return tex;
}
