import { mulberry32 } from './rng';

export type Pt = [number, number];

export type World = {
  coast: string;
  mountains: { x: number; y: number; d: string }[];
  forests: { x: number; y: number; r: number }[];
  lakes: { x: number; y: number; rx: number; ry: number }[];
  rivers: string[];
};

const W = 1000;
const H = 700;
const CX = W / 2;
const CY = H / 2;
const RX = 420;
const RY = 270;

function insideLand(x: number, y: number, margin = 1) {
  return ((x - CX) / (RX * margin)) ** 2 + ((y - CY) / (RY * margin)) ** 2 < 1;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function generateWorld(seed: number): World {
  const rnd = mulberry32(seed);

  // Costa: soma de senos com fases aleatórias
  const phases = Array.from({ length: 4 }, () => rnd() * Math.PI * 2);
  const amps = [0.12, 0.08, 0.05, 0.03];
  const freqs = [3, 5, 8, 13];
  const coastPts: Pt[] = [];
  const STEPS = 90;
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * Math.PI * 2;
    let r = 1;
    for (let k = 0; k < 4; k++) r += amps[k] * Math.sin(freqs[k] * a + phases[k]);
    coastPts.push([CX + Math.cos(a) * RX * r, CY + Math.sin(a) * RY * r]);
  }
  const coast = 'M' + coastPts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z';

  // Montanhas
  const mountains: World['mountains'] = [];
  let tries = 0;
  while (mountains.length < 28 && tries++ < 2000) {
    const x = 120 + rnd() * (W - 240);
    const y = 90 + rnd() * (H - 180);
    if (!insideLand(x, y, 0.8)) continue;
    const s = 10 + rnd() * 8;
    const d =
      `M${(x - s).toFixed(1)} ${(y + s * 0.6).toFixed(1)}` +
      `L${x.toFixed(1)} ${(y - s).toFixed(1)}` +
      `L${(x + s).toFixed(1)} ${(y + s * 0.6).toFixed(1)}Z`;
    mountains.push({ x, y, d });
  }

  // Florestas
  const forests: World['forests'] = [];
  tries = 0;
  while (forests.length < 45 && tries++ < 2000) {
    const x = 120 + rnd() * (W - 240);
    const y = 90 + rnd() * (H - 180);
    if (!insideLand(x, y, 0.85)) continue;
    forests.push({ x, y, r: 6 + rnd() * 6 });
  }

  // Lagos
  const lakes: World['lakes'] = [];
  for (let i = 0; i < 3; i++) {
    const x = 250 + rnd() * 500;
    const y = 200 + rnd() * 300;
    if (!insideLand(x, y, 0.6)) continue;
    lakes.push({ x, y, rx: 14 + rnd() * 12, ry: 8 + rnd() * 6 });
  }

  // Rios: nascem nas montanhas e descem até a costa, sem sair da terra
  const rivers: string[] = [];
  for (let i = 0; i < 3 && mountains.length; i++) {
    const src = mountains[Math.floor(rnd() * mountains.length)];
    let x = src.x;
    let y = src.y;
    const target = coastPts.reduce((best, p) => (dist(p, [x, y]) < dist(best, [x, y]) ? p : best), coastPts[0]);
    const pts: Pt[] = [[x, y]];
    for (let s = 0; s < 80; s++) {
      const dx = target[0] - x;
      const dy = target[1] - y;
      const d = Math.hypot(dx, dy);
      if (d < 8) break;
      x += (dx / d) * 10 + (rnd() - 0.5) * 8;
      y += (dy / d) * 10 + (rnd() - 0.5) * 8;
      if (!insideLand(x, y, 1)) break;
      pts.push([x, y]);
    }
    if (pts.length > 2) {
      rivers.push('M' + pts.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join('L'));
    }
  }

  return { coast, mountains, forests, lakes, rivers };
}
