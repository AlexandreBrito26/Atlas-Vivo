// Sons ambiente gerados por código (Web Audio API): não precisa de arquivos de áudio.

export type SoundKind = 'vento' | 'montanha' | 'ondas' | 'floresta';

export const SOUND_LABELS: Record<SoundKind, string> = {
  vento: 'Vento',
  montanha: 'Montanha',
  ondas: 'Ondas',
  floresta: 'Floresta',
};

export type Ambient = {
  setScene: (kind: SoundKind | null) => void;
  setVolume: (v: number) => void;
  dispose: () => void;
};

type Scene = { out: GainNode; stop: () => void };

export function createAmbient(volume = 0.5): Ambient | null {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;

  const ctx = new Ctx();
  void ctx.resume();

  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);

  // Ruído marrom (grave e suave), em loop de 2 segundos
  const noise = (() => {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    return buf;
  })();

  // Canto de pássaro curto
  const chirp = (dest: AudioNode) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const f0 = 2200 + Math.random() * 1800;
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.4, t + 0.09);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + 0.25);
  };

  const build = (kind: SoundKind): Scene => {
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(master);
    const stoppers: (() => void)[] = [];

    // Camada de ruído filtrado
    const layer = (type: BiquadFilterType, freq: number, q: number, level: number) => {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = level;
      s.connect(f);
      f.connect(g);
      g.connect(out);
      s.start();
      stoppers.push(() => s.stop());
      return g;
    };

    // Oscilador lento que faz o volume subir e descer
    const lfo = (freq: number, depth: number, target: AudioParam) => {
      const o = ctx.createOscillator();
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = depth;
      o.connect(g);
      g.connect(target);
      o.start();
      stoppers.push(() => o.stop());
    };

    switch (kind) {
      case 'vento': {
        const g = layer('bandpass', 500, 0.6, 0.35);
        lfo(0.12, 0.2, g.gain);
        lfo(0.31, 0.08, g.gain);
        break;
      }
      case 'montanha': {
        const g = layer('lowpass', 350, 1.2, 0.8);
        lfo(0.07, 0.35, g.gain);
        const h = layer('bandpass', 1200, 2, 0.05);
        lfo(0.05, 0.04, h.gain);
        break;
      }
      case 'ondas': {
        const g = layer('lowpass', 800, 0.7, 0.5);
        lfo(0.11, 0.4, g.gain);
        const h = layer('highpass', 2500, 0.5, 0.04);
        lfo(0.11, 0.035, h.gain);
        break;
      }
      case 'floresta': {
        const g = layer('lowpass', 600, 0.7, 0.25);
        lfo(0.09, 0.1, g.gain);
        let alive = true;
        let timer = 0;
        const loop = () => {
          if (!alive) return;
          chirp(out);
          timer = window.setTimeout(loop, 1200 + Math.random() * 3500);
        };
        timer = window.setTimeout(loop, 800);
        stoppers.push(() => {
          alive = false;
          window.clearTimeout(timer);
        });
        break;
      }
    }

    return {
      out,
      stop: () => {
        stoppers.forEach((fn) => {
          try {
            fn();
          } catch {
            /* já parado */
          }
        });
      },
    };
  };

  let current: { kind: SoundKind; scene: Scene } | null = null;

  const fadeOut = (scene: Scene) => {
    const t = ctx.currentTime;
    scene.out.gain.cancelScheduledValues(t);
    scene.out.gain.setValueAtTime(scene.out.gain.value, t);
    scene.out.gain.linearRampToValueAtTime(0, t + 1.5);
    window.setTimeout(() => {
      scene.stop();
      scene.out.disconnect();
    }, 1700);
  };

  return {
    setScene: (kind) => {
      if ((current?.kind ?? null) === kind) return;
      if (current) fadeOut(current.scene);
      current = null;
      if (kind) {
        const scene = build(kind);
        scene.out.gain.setValueAtTime(0, ctx.currentTime);
        scene.out.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
        current = { kind, scene };
      }
    },
    setVolume: (v) => master.gain.setTargetAtTime(v, ctx.currentTime, 0.1),
    dispose: () => {
      if (current) fadeOut(current.scene);
      current = null;
      window.setTimeout(() => void ctx.close(), 1800);
    },
  };
}
