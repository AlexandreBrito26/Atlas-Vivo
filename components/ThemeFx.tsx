import { useMemo, type CSSProperties } from 'react';
import { mulberry32 } from '@/lib/rng';
import type { World } from '@/lib/terrain';
import styles from './ThemeFx.module.scss';

export type Theme = 'dia' | 'noite';

type Vars = CSSProperties & Record<`--${string}`, string | number>;

const W = 1000;
const H = 700;

// Cores do mar em cada tema (o WorldMap usa a mesma tabela)
export const SEA: Record<Theme, string> = { dia: '#2e5d7a', noite: '#14264a' };

// Defs compartilhados (gradientes dos efeitos)
function Defs() {
  return (
    <defs>
      <radialGradient id="fxSunGlare" cx="62%" cy="6%" r="75%">
        <stop offset="0%" stopColor="#fff2b8" stopOpacity="0.5" />
        <stop offset="45%" stopColor="#ffd98a" stopOpacity="0.14" />
        <stop offset="100%" stopColor="#ffd98a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="fxMoonGlow" cx="62%" cy="6%" r="70%">
        <stop offset="0%" stopColor="#b9c8ff" stopOpacity="0.38" />
        <stop offset="50%" stopColor="#7d93e0" stopOpacity="0.1" />
        <stop offset="100%" stopColor="#7d93e0" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="fxHaloSun">
        <stop offset="0%" stopColor="#fff3b0" stopOpacity="0.95" />
        <stop offset="100%" stopColor="#ffd36b" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="fxHaloMoon">
        <stop offset="0%" stopColor="#dfe8ff" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#8fa6ff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="fxCloud">
        <stop offset="0%" stopColor="#0d2233" stopOpacity="0.32" />
        <stop offset="100%" stopColor="#0d2233" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="fxFirefly">
        <stop offset="0%" stopColor="#ffe680" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#ffe680" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/**
 * Camada de cor: escurece o mapa à noite e acende o brilho do sol/lua.
 * Usa só atributos (sem classes) para sair certa na exportação de PNG.
 * Fica ANTES dos nomes das regiões, para eles continuarem legíveis.
 */
export function TintLayer({ theme }: { theme: Theme }) {
  const night = theme === 'noite';
  return (
    <g pointerEvents="none">
      <Defs />
      <rect width={W} height={H} fill="#0a1232" opacity={night ? 0.5 : 0} className={styles.fade} />
      <g opacity={night ? 0 : 1} className={styles.fade}>
        <rect width={W} height={H} fill="url(#fxSunGlare)" className={styles.glare} />
      </g>
      <g opacity={night ? 1 : 0} className={styles.fade}>
        <rect width={W} height={H} fill="url(#fxMoonGlow)" />
      </g>
    </g>
  );
}

type FxData = {
  stars: { x: number; y: number; r: number; dur: number; delay: number }[];
  flies: { x: number; y: number; dx: number; dy: number; dur: number; delay: number }[];
  clouds: { y: number; sx: number; sy: number; dur: number; delay: number }[];
  birds: { y0: number; y1: number; dur: number; delay: number }[];
  sparkles: { x: number; y: number; dur: number; delay: number }[];
};

function buildFx(world: World): FxData {
  const rnd = mulberry32(7);
  const between = (a: number, b: number) => a + rnd() * (b - a);

  const stars = Array.from({ length: 80 }, () => ({
    x: between(10, W - 10),
    y: between(10, H - 10),
    r: between(0.5, 1.7),
    dur: between(2, 5.5),
    delay: -between(0, 5),
  }));

  // Vaga-lumes nascem perto das florestas
  const flies = world.forests.slice(0, 16).map((f) => ({
    x: f.x + between(-8, 8),
    y: f.y + between(-8, 8),
    dx: between(-26, 26),
    dy: between(-22, 22),
    dur: between(5, 9),
    delay: -between(0, 8),
  }));

  const clouds = Array.from({ length: 4 }, (_, i) => ({
    y: 110 + i * 150 + between(-30, 30),
    sx: between(110, 170),
    sy: between(34, 52),
    dur: between(70, 110),
    delay: -between(0, 100),
  }));

  const birds = Array.from({ length: 3 }, () => ({
    y0: between(80, 520),
    y1: between(60, 560),
    dur: between(26, 40),
    delay: -between(0, 30),
  }));

  const sparkles = world.lakes.flatMap((l) =>
    Array.from({ length: 4 }, () => ({
      x: l.x + between(-l.rx * 0.7, l.rx * 0.7),
      y: l.y + between(-l.ry * 0.6, l.ry * 0.6),
      dur: between(2.4, 4.2),
      delay: -between(0, 4),
    }))
  );

  return { stars, flies, clouds, birds, sparkles };
}

/**
 * Efeitos animados (nuvens, pássaros, brilho na água / estrelas, vaga-lumes).
 * Tudo marcado com data-fx: a exportação de PNG remove esta camada.
 */
export function EffectsLayer({ theme, world }: { theme: Theme; world: World }) {
  const fx = useMemo(() => buildFx(world), [world]);
  const night = theme === 'noite';

  return (
    <g data-fx="" className={styles.fx} pointerEvents="none">
      <defs>
        {/* Estrelas só aparecem sobre o mar */}
        <mask id="fxSeaMask">
          <rect width={W} height={H} fill="#fff" />
          <path d={world.coast} fill="#000" />
        </mask>
      </defs>

      {/* ---------- DIA ---------- */}
      <g opacity={night ? 0 : 1} className={styles.fade}>
        <circle cx="620" cy="46" r="34" fill="url(#fxHaloSun)" className={styles.glare} />
        <circle cx="620" cy="46" r="11" fill="#fff1a8" />

        {world.rivers.map((d, i) => (
          <path key={`dr${i}`} d={d} className={styles.flow} fill="none" stroke="#e3f5ff" strokeOpacity="0.7" strokeWidth="1.6" strokeDasharray="4 18" strokeLinecap="round" />
        ))}

        {fx.sparkles.map((s, i) => (
          <circle key={`ds${i}`} cx={s.x} cy={s.y} r="1.8" fill="#fff" className={styles.sparkle} style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }} />
        ))}

        {fx.clouds.map((c, i) => (
          <g key={`c${i}`} className={styles.cloud} style={{ animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}>
            <ellipse cx="0" cy={c.y} rx={c.sx} ry={c.sy} fill="url(#fxCloud)" />
            <ellipse cx={c.sx * 0.7} cy={c.y + 12} rx={c.sx * 0.6} ry={c.sy * 0.7} fill="url(#fxCloud)" />
          </g>
        ))}

        {fx.birds.map((b, i) => (
          <g key={`b${i}`} className={styles.bird} style={{ animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s`, '--y0': `${b.y0}px`, '--y1': `${b.y1}px` } as Vars}>
            <path className={styles.wing} d="M0 0 q4 -5 8 0 q4 -5 8 0" fill="none" stroke="#2b2118" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        ))}
      </g>

      {/* ---------- NOITE ---------- */}
      <g opacity={night ? 1 : 0} className={styles.fade}>
        <g mask="url(#fxSeaMask)">
          {fx.stars.map((s, i) => (
            <circle key={`st${i}`} cx={s.x} cy={s.y} r={s.r} fill="#eef2ff" className={styles.twinkle} style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }} />
          ))}
        </g>

        <circle cx="620" cy="46" r="38" fill="url(#fxHaloMoon)" className={styles.glare} />
        <circle cx="620" cy="46" r="11" fill="#eaf0ff" />
        <circle cx="625" cy="43" r="10" fill={SEA.noite} />

        {world.rivers.map((d, i) => (
          <path key={`nr${i}`} d={d} className={styles.flow} fill="none" stroke="#a9c0ff" strokeOpacity="0.6" strokeWidth="1.6" strokeDasharray="4 18" strokeLinecap="round" />
        ))}

        {world.lakes.map((l, i) => (
          <ellipse key={`nl${i}`} cx={l.x} cy={l.y} rx={l.rx * 0.5} ry={l.ry * 0.35} fill="#dfe8ff" opacity="0.25" className={styles.glare} />
        ))}
        {fx.sparkles.map((s, i) => (
          <circle key={`ns${i}`} cx={s.x} cy={s.y} r="1.6" fill="#cfe0ff" className={styles.sparkle} style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }} />
        ))}

        {fx.flies.map((f, i) => (
          <g key={`f${i}`} className={styles.firefly} style={{ animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`, '--dx': `${f.dx}px`, '--dy': `${f.dy}px` } as Vars}>
            <g className={styles.blink} style={{ animationDuration: `${f.dur / 2}s`, animationDelay: `${f.delay}s` }}>
              <circle cx={f.x} cy={f.y} r="8" fill="url(#fxFirefly)" />
              <circle cx={f.x} cy={f.y} r="1.7" fill="#fff6b0" />
            </g>
          </g>
        ))}
      </g>
    </g>
  );
}
