'use client';
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';
import { generateWorld } from '@/lib/terrain';
import { typeIcon, type Location, type EventStatus } from '@/lib/locations';
import type { Region } from '@/lib/regions';
import { createAmbient, SOUND_LABELS, type Ambient, type SoundKind } from '@/lib/ambient';
import { MarkerLink } from './MarkerLink';
import { EffectsLayer, TintLayer, SEA, type Theme } from './ThemeFx';
import styles from './WorldMap.module.scss';

type Props = { locations: Location[]; regions?: Region[]; seed?: number };
type Group = { key: string; x: number; y: number; items: Location[] };
type Layers = { forests: boolean; lakes: boolean; rivers: boolean; mountains: boolean; regions: boolean };

type RegionEdit = Partial<Region> & { deleted?: boolean };

const DEFAULT_LAYERS: Layers = { forests: true, lakes: true, rivers: true, mountains: true, regions: true };
const LAYER_LABELS: Record<keyof Layers, string> = {
  forests: 'Florestas',
  lakes: 'Lagos',
  rivers: 'Rios',
  mountains: 'Montanhas',
  regions: 'Regiões',
};

const CLUSTER_PX = 56;
const MAX_SCALE = 4;
const LABEL_SCALE = 1.4;
const EXPORT_W = 2000;
const EXPORT_H = 1400;

function pointInPolygon(x: number, y: number, pts: [number, number][]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const toCanvas = (l: { x: number; y: number }) => ({ x: l.x * 10, y: l.y * 7 });
const round = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number) => Math.min(100, Math.max(0, n));

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function WorldMap({ locations: baseLocations, regions: baseRegions = [], seed = 42 }: Props) {
  const world = useMemo(() => generateWorld(seed), [seed]);
  const pathname = usePathname();
  const router = useRouter();
  const apiRef = useRef<ReactZoomPanPinchRef>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);

  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [scale, setScale] = useState(1);
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Record<number, Partial<Location>>>({});
  const [added, setAdded] = useState<Location[]>([]);
  const [removed, setRemoved] = useState<number[]>([]);
  const [editorLoaded, setEditorLoaded] = useState(false);
  const [drawn, setDrawn] = useState<Region[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [regionEdits, setRegionEdits] = useState<Record<string, RegionEdit>>({});
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [vertexDrag, setVertexDrag] = useState<{ id: string; i: number } | null>(null);
  const [touring, setTouring] = useState(false);
  const [tourIdx, setTourIdx] = useState(0);
  const [tourPlaying, setTourPlaying] = useState(true);
  const [theme, setTheme] = useState<Theme>('dia');
  const [soundOn, setSoundOn] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const ambientRef = useRef<Ambient | null>(null);
  const allRegions = useMemo(
    () =>
      [...baseRegions, ...drawn]
        .map((r) => ({ ...r, ...regionEdits[r.id] }))
        .filter((r) => !r.deleted),
    [baseRegions, drawn, regionEdits]
  );
  const regionsRef = useRef(allRegions);
  regionsRef.current = allRegions;
  const historyRef = useRef<
    { edits: Record<number, Partial<Location>>; added: Location[]; removed: number[]; drawn: Region[]; regionEdits: Record<string, RegionEdit> }[]
  >([]);

  // Guarda o estado atual antes de uma alteração, para poder desfazer
  const snapshot = () => {
    historyRef.current.push({ edits, added, removed, drawn, regionEdits });
    if (historyRef.current.length > 50) historyRef.current.shift();
  };
  const undo = () => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setEdits(prev.edits);
    setAdded(prev.added);
    setRemoved(prev.removed);
    setDrawn(prev.drawn);
    setRegionEdits(prev.regionEdits);
  };
  const [visited, setVisited] = useState<number[]>([]);
  const [routeMode, setRouteMode] = useState(false);
  const [routePicks, setRoutePicks] = useState<number[]>([]);
  const [view, setView] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const [dragId, setDragId] = useState<number | null>(null);

  // Locais base + edições + locais criados no editor
  const locations = useMemo(
    () =>
      [...baseLocations.map((l) => ({ ...l, ...edits[l.id] })), ...added].filter(
        (l) => !removed.includes(l.id)
      ),
    [baseLocations, edits, added, removed]
  );

  // Linha do tempo: intervalo de anos existentes nos dados
  const yearRange = useMemo(() => {
    const ys = locations.flatMap((l) => [
      ...(l.year !== undefined ? [l.year] : []),
      ...(l.events ?? []).map((e) => e.year),
    ]);
    return ys.length ? { min: Math.min(...ys), max: Math.max(...ys) } : null;
  }, [locations]);
  const currentYear = yearFilter ?? yearRange?.max ?? 0;

  // Status do local no ano escolhido (o último evento com status até lá)
  const statusOf = (l: Location): EventStatus | undefined => {
    const y = yearFilter ?? Infinity;
    const evs = (l.events ?? [])
      .filter((e) => e.status && e.year <= y)
      .sort((a, b) => a.year - b.year);
    return evs.length ? evs[evs.length - 1].status : undefined;
  };

  const pickRoute = (id: number) =>
    setRoutePicks((prev) => (prev.length >= 2 ? [id] : prev.includes(id) ? prev : [...prev, id]));

  // Linha e distância entre os dois locais escolhidos (escala: 120 px = 100 km)
  const routeInfo = useMemo(() => {
    if (routePicks.length !== 2) return null;
    const a = locations.find((l) => l.id === routePicks[0]);
    const b = locations.find((l) => l.id === routePicks[1]);
    if (!a || !b) return null;
    const x1 = a.x * 10, y1 = a.y * 7, x2 = b.x * 10, y2 = b.y * 7;
    const km = Math.round((Math.hypot(x2 - x1, y2 - y1) * 100) / 120);
    return { a, b, x1, y1, x2, y2, km };
  }, [routePicks, locations]);

  const selectedId = Number(pathname.match(/^\/location\/(\d+)/)?.[1]) || null;

  const regions = useMemo(() => [...new Set(locations.map((l) => l.region))].sort(), [locations]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return locations.filter(
      (l) =>
        (!region || l.region === region) &&
        (!q || l.name.toLowerCase().includes(q)) &&
        (yearFilter === null || l.year === undefined || l.year <= yearFilter)
    );
  }, [locations, region, query, yearFilter]);

  // Tour: percorre os locais visíveis em ordem cronológica (sem ano vão por último)
  const tourList = useMemo(
    () => [...visible].sort((a, b) => (a.year ?? 1e9) - (b.year ?? 1e9) || a.id - b.id),
    [visible]
  );

  const goTour = (i: number) => {
    if (!tourList.length) return;
    const n = (i + tourList.length) % tourList.length;
    setTourIdx(n);
    router.push(`/location/${tourList[n].id}`, { scroll: false });
  };
  const goTourRef = useRef(goTour);
  goTourRef.current = goTour;

  const startTour = () => {
    setTouring(true);
    setTourPlaying(true);
    goTour(0);
  };

  const stopTour = () => {
    setTouring(false);
    router.push('/map', { scroll: false });
  };

  // Avança sozinho a cada 6 segundos
  useEffect(() => {
    if (!touring || !tourPlaying) return;
    const t = setTimeout(() => goTourRef.current(tourIdx + 1), 6000);
    return () => clearTimeout(t);
  }, [touring, tourPlaying, tourIdx]);

  // Se a pessoa abrir outro local durante o tour, acompanha a posição
  useEffect(() => {
    if (!touring || !selectedId) return;
    const i = tourList.findIndex((l) => l.id === selectedId);
    if (i >= 0) setTourIdx(i);
  }, [selectedId, touring, tourList]);

  // No modo editor não agrupa, para que cada marcador possa ser arrastado
  const groups = useMemo<Group[]>(() => {
    if (editing || touring) {
      return visible.map((l) => {
        const p = toCanvas(l);
        return { key: `g${l.id}`, x: p.x, y: p.y, items: [l] };
      });
    }
    const threshold = CLUSTER_PX / scale;
    const out: Group[] = [];
    for (const l of visible) {
      const p = toCanvas(l);
      const g = out.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < threshold);
      if (g) {
        g.items.push(l);
        g.x = g.items.reduce((s, i) => s + toCanvas(i).x, 0) / g.items.length;
        g.y = g.items.reduce((s, i) => s + toCanvas(i).y, 0) / g.items.length;
      } else {
        out.push({ key: `g${l.id}`, x: p.x, y: p.y, items: [l] });
      }
    }
    return out;
  }, [visible, scale, editing, touring]);

  const labels = useMemo(() => {
    const polyNames = new Set(allRegions.map((r) => r.name));
    const fromPolys = allRegions.map((r) => ({
      name: r.name,
      x: (r.points.reduce((a, p) => a + p[0], 0) / r.points.length) * 10,
      y: (r.points.reduce((a, p) => a + p[1], 0) / r.points.length) * 7,
    }));
    const fromLocs = regions
      .filter((name) => !polyNames.has(name))
      .map((name) => {
        const ls = locations.filter((l) => l.region === name);
        return {
          name,
          x: (ls.reduce((a, l) => a + l.x, 0) / ls.length) * 10,
          y: (ls.reduce((a, l) => a + l.y, 0) / ls.length) * 7,
        };
      });
    return [...fromPolys, ...fromLocs];
  }, [allRegions, locations, regions]);

  // Ao abrir um local, centraliza e aproxima o marcador
  useEffect(() => {
    if (!selectedId) return;
    const el = document.getElementById(`marker-${selectedId}`);
    if (el) apiRef.current?.zoomToElement(el, 2, 400);
  }, [selectedId]);

  // Edição: grava alterações em um local (base ou criado)
  const patch = (id: number, p: Partial<Location>) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
    setAdded((prev) => prev.map((l) => (l.id === id ? { ...l, ...p } : l)));
  };

  // Arrastar marcador enquanto o ponteiro se move
  useEffect(() => {
    if (dragId === null) return;
    const move = (e: PointerEvent) => {
      const el = hitRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      draggedRef.current = true;
      patch(dragId, {
        x: round(clamp(((e.clientX - r.left) / r.width) * 100)),
        y: round(clamp(((e.clientY - r.top) / r.height) * 100)),
      });
    };
    const up = () => setDragId(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId]);

  // Clique no minimapa: centraliza o mapa naquele ponto
  const onMinimapClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const api = apiRef.current;
    const el = rootRef.current;
    if (!api || !el) return;
    const r = e.currentTarget.getBoundingClientRect();
    const cx = ((e.clientX - r.left) / r.width) * 1000;
    const cy = ((e.clientY - r.top) / r.height) * 700;
    const sc = api.instance.transformState.scale;
    api.setTransform(el.clientWidth / 2 - cx * sc, el.clientHeight / 2 - cy * sc, sc, 300);
  };

  const onCanvasClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!editing) return;
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    if (drawing) {
      setDraft((prev) => [
        ...prev,
        [round(clamp(((e.clientX - r.left) / r.width) * 100)), round(clamp(((e.clientY - r.top) / r.height) * 100))],
      ]);
      return;
    }
    const name = window.prompt('Nome do novo local:', 'Novo local');
    if (!name) return;
    // Considera também os ids removidos: reaproveitar um deles deixaria o local novo invisível
    const id = Math.max(0, ...baseLocations.map((l) => l.id), ...added.map((l) => l.id), ...removed) + 1;
    snapshot();
    setAdded((prev) => [
      ...prev,
      {
        id,
        name,
        region: region || regions[0] || 'Sem região',
        type: 'vila',
        description: '',
        x: round(clamp(((e.clientX - r.left) / r.width) * 100)),
        y: round(clamp(((e.clientY - r.top) / r.height) * 100)),
        tags: [],
        links: [],
      },
    ]);
  };

  const finishRegion = () => {
    if (draft.length < 3) {
      window.alert('Marque pelo menos 3 pontos no mapa.');
      return;
    }
    const name = window.prompt('Nome da região:', region || 'Nova região');
    if (!name) return;
    const palette = ['#c8842b', '#4f8a3a', '#3f7fa3', '#8a2e1e', '#6b4a8a', '#2e8a6b'];
    snapshot();
    setDrawn((prev) => [
      ...prev,
      { id: `r${Date.now()}`, name, color: palette[allRegions.length % palette.length], points: draft },
    ]);
    setDraft([]);
    setDrawing(false);
  };

  const patchRegion = (id: string, p: RegionEdit) => {
    snapshot();
    setRegionEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  };

  // Renomear também atualiza a região dos locais que a usavam
  const renameRegion = (r: Region) => {
    const n = window.prompt('Novo nome da região:', r.name);
    if (!n || n === r.name) return;
    patchRegion(r.id, { name: n });
    locations.filter((l) => l.region === r.name).forEach((l) => patch(l.id, { region: n }));
    if (region === r.name) setRegion(n);
  };

  const deleteRegion = (r: Region) => {
    if (window.confirm(`Apagar a região "${r.name}"?`)) patchRegion(r.id, { deleted: true });
  };

  const selectedRegion = allRegions.find((r) => r.id === selectedRegionId);

  // Insere um vértice no meio da aresta mais longa; depois é só arrastar
  const addVertex = (r: Region) => {
    const pts = r.points;
    let best = 0;
    let bestLen = -1;
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d > bestLen) {
        bestLen = d;
        best = i;
      }
    });
    const a = pts[best];
    const b = pts[(best + 1) % pts.length];
    const mid: [number, number] = [round((a[0] + b[0]) / 2), round((a[1] + b[1]) / 2)];
    patchRegion(r.id, { points: [...pts.slice(0, best + 1), mid, ...pts.slice(best + 1)] });
  };

  const removeVertex = (r: Region, i: number) => {
    if (r.points.length <= 3) {
      window.alert('Uma região precisa de pelo menos 3 vértices.');
      return;
    }
    patchRegion(r.id, { points: r.points.filter((_, idx) => idx !== i) });
  };

  const exportRegions = () => {
    const clean = allRegions.map(({ id, name, color, points, sound }) => ({
      id,
      name,
      color,
      points,
      ...(sound ? { sound } : {}),
    }));
    download(new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' }), 'regions.json');
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(locations, null, 2)], { type: 'application/json' });
    download(blob, 'locations.json');
  };

  const exportPng = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', '1000');
    clone.setAttribute('height', '700');
    clone.querySelectorAll('text[data-label]').forEach((t) => t.setAttribute('opacity', '0.75'));
    // Efeitos animados (nuvens, estrelas...) não entram no PNG; a cor do tema permanece
    clone.querySelectorAll('[data-fx]').forEach((n) => n.remove());

    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = EXPORT_W;
      canvas.height = EXPORT_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, EXPORT_W, EXPORT_H);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => b && download(b, 'mapa.png'), 'image/png');
    };
    img.src = url;
  };

  const toggleLayer = (k: keyof Layers) => setLayers((p) => ({ ...p, [k]: !p[k] }));

  // Tema dia/noite: o script do layout já aplicou data-theme antes da pintura; aqui só sincroniza o estado
  useEffect(() => {
    if (document.documentElement.dataset.theme === 'noite') setTheme('noite');
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === 'dia' ? 'noite' : 'dia';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('mapa:theme', next);
    } catch {
      /* armazenamento indisponível */
    }
  };
  // Histórico de visitas (localStorage)
  useEffect(() => {
    try {
      setVisited(JSON.parse(localStorage.getItem('mapa:visited') ?? '[]'));
    } catch {
      setVisited([]);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    try {
      const cur: number[] = JSON.parse(localStorage.getItem('mapa:visited') ?? '[]');
      if (cur.includes(selectedId)) return;
      const next = [...cur, selectedId];
      localStorage.setItem('mapa:visited', JSON.stringify(next));
      setVisited(next);
    } catch {
      /* armazenamento indisponível ou corrompido */
    }
  }, [selectedId]);

  // Setas para mover, +/- para zoom
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, select, textarea, [contenteditable="true"]')) return;
      const api = apiRef.current;
      if (!api) return;
      const st = api.instance.transformState;
      const step = 60;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [step, 0],
        ArrowRight: [-step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      if (moves[e.key]) {
        e.preventDefault();
        const [dx, dy] = moves[e.key];
        api.setTransform(st.positionX + dx, st.positionY + dy, st.scale, 120);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        api.zoomIn(0.3, 120);
      } else if (e.key === '-') {
        e.preventDefault();
        api.zoomOut(0.3, 120);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Abre o mapa conforme a URL (?x=&y=&z=&t=&l=)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);

    const t = q.get('t');
    if (t !== null && Number.isFinite(Number(t))) setYearFilter(Number(t));

    const hidden = (q.get('l') ?? '').split(',').filter(Boolean);
    if (hidden.length) {
      setLayers((prev) => {
        const next = { ...prev };
        for (const k of hidden) if (k in next) next[k as keyof Layers] = false;
        return next;
      });
    }

    const x = Number(q.get('x'));
    const y = Number(q.get('y'));
    const z = Number(q.get('z'));
    if (!q.has('z') || ![x, y, z].every(Number.isFinite)) return;
    const timer = setTimeout(() => {
      const el = rootRef.current;
      const api = apiRef.current;
      if (!el || !api) return;
      const sc = Math.min(MAX_SCALE, Math.max(0.6, z));
      api.setTransform(el.clientWidth / 2 - x * sc, el.clientHeight / 2 - y * sc, sc, 0);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const copyLink = async () => {
    const api = apiRef.current;
    const el = rootRef.current;
    if (!api || !el) return;
    const st = api.instance.transformState;
    const x = Math.round((el.clientWidth / 2 - st.positionX) / st.scale);
    const y = Math.round((el.clientHeight / 2 - st.positionY) / st.scale);
    const params = new URLSearchParams({ x: String(x), y: String(y), z: st.scale.toFixed(2) });
    if (yearFilter !== null) params.set('t', String(yearFilter));
    const hidden = (Object.keys(layers) as (keyof Layers)[]).filter((k) => !layers[k]);
    if (hidden.length) params.set('l', hidden.join(','));
    const url = `${window.location.origin}/map?${params}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copie o link:', url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Arrastar um vértice da região selecionada
  useEffect(() => {
    if (!vertexDrag) return;
    const move = (e: PointerEvent) => {
      const el = hitRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = round(clamp(((e.clientX - r.left) / r.width) * 100));
      const y = round(clamp(((e.clientY - r.top) / r.height) * 100));
      const cur = regionsRef.current.find((a) => a.id === vertexDrag.id);
      if (!cur) return;
      const pts = cur.points.map((p) => [...p] as [number, number]);
      pts[vertexDrag.i] = [x, y];
      setRegionEdits((prev) => ({ ...prev, [vertexDrag.id]: { ...prev[vertexDrag.id], points: pts } }));
    };
    const up = () => setVertexDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [vertexDrag]);

  // Edições do editor: carrega e salva no navegador
  useEffect(() => {
    try {
      const raw = localStorage.getItem('mapa:editor');
      if (raw) {
        const d = JSON.parse(raw);
        setEdits(d.edits ?? {});
        setAdded(d.added ?? []);
        setRemoved(d.removed ?? []);
        setDrawn(d.drawn ?? []);
        setRegionEdits(d.regionEdits ?? {});
      }
    } catch {
      /* dados corrompidos: começa limpo */
    }
    setEditorLoaded(true);
  }, []);

  useEffect(() => {
    if (!editorLoaded) return;
    try {
      localStorage.setItem('mapa:editor', JSON.stringify({ edits, added, removed, drawn, regionEdits }));
    } catch {
      /* armazenamento indisponível */
    }
  }, [edits, added, removed, drawn, regionEdits, editorLoaded]);

  // Ctrl/Cmd+Z desfaz no modo editor
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Som ambiente: segue a região do local aberto ou, sem local, a do centro da tela
  const activeRegion = useMemo(() => {
    const sel = selectedId ? locations.find((l) => l.id === selectedId) : undefined;
    if (sel) {
      const byName = allRegions.find((r) => r.name === sel.region);
      if (byName) return byName;
    }
    if (view.w > 0) {
      const cx = ((view.x + view.w / 2) / 1000) * 100;
      const cy = ((view.y + view.h / 2) / 700) * 100;
      return allRegions.find((r) => pointInPolygon(cx, cy, r.points));
    }
    return undefined;
  }, [selectedId, locations, allRegions, view]);

  const ambientKind: SoundKind = activeRegion?.sound ?? 'vento';

  useEffect(() => {
    if (soundOn) ambientRef.current?.setScene(ambientKind);
  }, [soundOn, ambientKind]);

  useEffect(() => {
    ambientRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => () => ambientRef.current?.dispose(), []);

  const toggleSound = () => {
    if (soundOn) {
      ambientRef.current?.dispose();
      ambientRef.current = null;
      setSoundOn(false);
      return;
    }
    const a = createAmbient(volume);
    if (!a) {
      window.alert('Este navegador não suporta áudio.');
      return;
    }
    ambientRef.current = a;
    setSoundOn(true);
  };

  const visitedCount = locations.filter((l) => visited.includes(l.id)).length;

  const results = query.trim() ? visible.slice(0, 5) : [];

  return (
    <TransformWrapper
      ref={apiRef}
      initialScale={1}
      minScale={0.6}
      maxScale={MAX_SCALE}
      limitToBounds
      centerOnInit
      doubleClick={{ mode: 'zoomIn', step: 0.7 }}
      panning={{ disabled: dragId !== null || vertexDrag !== null }}
      onTransformed={(_ref, state) => {
        setScale(state.scale);
        const el = rootRef.current;
        setView({
          x: -state.positionX / state.scale,
          y: -state.positionY / state.scale,
          w: (el?.clientWidth ?? 0) / state.scale,
          h: (el?.clientHeight ?? 0) / state.scale,
        });
      }}
    >
      {({ zoomIn, zoomOut, resetTransform }) => (
        <div className={styles.root} ref={rootRef}>
          <div className={styles.search}>
            <input
              type="search"
              placeholder="Buscar local..."
              aria-label="Buscar local"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results[0]) router.push(`/location/${results[0].id}`);
              }}
            />
            <select
              aria-label="Filtrar por região"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="">Todas as regiões</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {results.length > 0 && (
              <ul>
                {results.map((l) => (
                  <li key={l.id}>
                    <button onClick={() => router.push(`/location/${l.id}`)}>
                      {typeIcon[l.type]} {l.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.toolbar}>
            <fieldset className={styles.layers}>
              <legend>Camadas</legend>
              {(Object.keys(LAYER_LABELS) as (keyof Layers)[]).map((k) => (
                <label key={k}>
                  <input type="checkbox" checked={layers[k]} onChange={() => toggleLayer(k)} />
                  {LAYER_LABELS[k]}
                </label>
              ))}
            </fieldset>
            <span className={styles.progress}>
              Visitados: {visitedCount}/{locations.length}
            </span>
            {yearRange && yearRange.min !== yearRange.max && (
              <label className={styles.timeline}>
                Ano {currentYear}
                <input
                  type="range"
                  min={yearRange.min}
                  max={yearRange.max}
                  value={currentYear}
                  aria-label="Linha do tempo"
                  onChange={(e) => setYearFilter(Number(e.target.value))}
                />
                {yearFilter !== null && (
                  <button onClick={() => setYearFilter(null)}>Mostrar tudo</button>
                )}
              </label>
            )}
            {routeMode && (
              <span className={styles.progress}>
                {routeInfo
                  ? `${routeInfo.a.name} → ${routeInfo.b.name}: ≈ ${routeInfo.km} km`
                  : routePicks.length === 1
                    ? 'Escolha o segundo local'
                    : 'Escolha dois locais no mapa'}
              </span>
            )}
            <div className={styles.actions}>
              <button
                aria-pressed={editing}
                onClick={() => {
                  setEditing((v) => !v);
                  setDrawing(false);
                  setDraft([]);
                }}
                title="Clique no mapa para adicionar; arraste para mover; duplo clique para renomear; Delete para remover"
              >
                {editing ? 'Sair do editor' : 'Editor'}
              </button>
              {editing && (
                <>
                  {drawing ? (
                    <>
                      <button onClick={finishRegion}>Concluir região ({draft.length})</button>
                      <button
                        onClick={() => {
                          setDrawing(false);
                          setDraft([]);
                        }}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setDrawing(true)} title="Clique no mapa para marcar os vértices">
                      Desenhar região
                    </button>
                  )}
                  <button onClick={undo} title="Ctrl+Z">Desfazer</button>
                  <button
                    onClick={() => {
                      if (window.confirm('Descartar todas as edições do editor?')) {
                        snapshot();
                        setEdits({});
                        setAdded([]);
                        setRemoved([]);
                        setDrawn([]);
                        setRegionEdits({});
                      }
                    }}
                  >
                    Descartar edições
                  </button>
                </>
              )}
              <button
                aria-pressed={routeMode}
                onClick={() => {
                  setRouteMode((v) => !v);
                  setRoutePicks([]);
                }}
                title="Clique em dois locais para ver a distância entre eles"
              >
                Rota
              </button>
              {routePicks.length > 0 && (
                <button onClick={() => setRoutePicks([])}>Limpar rota</button>
              )}
              <button
                aria-pressed={touring}
                onClick={() => (touring ? stopTour() : startTour())}
                title="Percorre os locais em ordem cronológica"
              >
                {touring ? 'Parar tour' : 'Tour'}
              </button>
              <button
                aria-pressed={theme === 'noite'}
                onClick={toggleTheme}
                title="Alternar entre dia e noite"
              >
                {theme === 'noite' ? '☀ Dia' : '🌙 Noite'}
              </button>
              <button aria-pressed={soundOn} onClick={toggleSound} title="Som ambiente por região">
                {soundOn ? `♪ ${SOUND_LABELS[ambientKind]}` : 'Som'}
              </button>
              {soundOn && (
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  aria-label="Volume do som ambiente"
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
              )}
              <button onClick={copyLink}>{copied ? 'Link copiado!' : 'Copiar link'}</button>
              <button onClick={exportPng}>Exportar PNG</button>
              <button onClick={exportJson}>Exportar JSON</button>
              <button onClick={exportRegions}>Exportar regiões</button>
            </div>
          </div>

          {editing && allRegions.length > 0 && (
            <div className={styles.regionList}>
              <strong>Regiões</strong>
              <ul>
                {allRegions.map((r) => (
                  <li key={r.id}>
                    <input
                      type="color"
                      value={r.color}
                      aria-label={`Cor de ${r.name}`}
                      onFocus={() => snapshot()}
                      onChange={(e) =>
                        setRegionEdits((prev) => ({ ...prev, [r.id]: { ...prev[r.id], color: e.target.value } }))
                      }
                    />
                    <span>{r.name}</span>
                    <select
                      value={r.sound ?? 'vento'}
                      aria-label={`Som ambiente de ${r.name}`}
                      onChange={(e) => patchRegion(r.id, { sound: e.target.value as SoundKind })}
                    >
                      {(Object.keys(SOUND_LABELS) as SoundKind[]).map((k) => (
                        <option key={k} value={k}>{SOUND_LABELS[k]}</option>
                      ))}
                    </select>
                    <button
                      aria-pressed={selectedRegionId === r.id}
                      onClick={() => setSelectedRegionId((prev) => (prev === r.id ? null : r.id))}
                      title="Mostrar vértices para arrastar"
                    >
                      Vértices
                    </button>
                    {selectedRegionId === r.id && <button onClick={() => addVertex(r)}>+ vértice</button>}
                    <button onClick={() => renameRegion(r)}>Renomear</button>
                    <button onClick={() => deleteRegion(r)}>Apagar</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.minimap} onClick={onMinimapClick} title="Clique para ir até este ponto">
            <svg viewBox="0 0 1000 700" preserveAspectRatio="none">
              <path d={world.coast} fill="#cdb884" />
              {locations.map((l) => (
                <circle key={l.id} cx={l.x * 10} cy={l.y * 7} r="16" fill="#c8842b" />
              ))}
              <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="none" stroke="#f3e9d2" strokeWidth="14" />
            </svg>
          </div>

          {touring && tourList.length > 0 && (
            <div className={styles.tourBar} role="region" aria-label="Tour pelo mapa">
              <button onClick={() => goTour(tourIdx - 1)} aria-label="Local anterior">⏮</button>
              <span>
                {tourList[tourIdx]?.name} ({tourIdx + 1}/{tourList.length})
              </span>
              <button
                onClick={() => setTourPlaying((p) => !p)}
                aria-label={tourPlaying ? 'Pausar tour' : 'Continuar tour'}
              >
                {tourPlaying ? '⏸' : '▶'}
              </button>
              <button onClick={() => goTour(tourIdx + 1)} aria-label="Próximo local">⏭</button>
              <button onClick={stopTour}>Sair</button>
            </div>
          )}

          <div className={styles.zoomControls}>
            <button onClick={() => zoomIn()} aria-label="Aproximar">+</button>
            <button onClick={() => zoomOut()} aria-label="Afastar">−</button>
            <button onClick={() => resetTransform()} aria-label="Resetar zoom">⟲</button>
          </div>

          <TransformComponent wrapperClass={styles.viewport} contentClass={styles.canvas}>
            <svg
              ref={svgRef}
              className={styles.svg}
              viewBox="0 0 1000 700"
              preserveAspectRatio="none"
              role="img"
              aria-label="Mapa do mundo"
            >
              <title>Mapa do mundo</title>
              <defs>
                <radialGradient id="vignette" cx="50%" cy="50%" r="72%">
                  <stop offset="55%" stopColor="#000" stopOpacity="0" />
                  <stop offset="100%" stopColor="#000" stopOpacity="0.4" />
                </radialGradient>
              </defs>

              <rect width="1000" height="700" fill={SEA[theme]} style={{ transition: 'fill 0.9s ease' }} />
              <path d={world.coast} fill="#cdb884" stroke="#6b5a3a" strokeWidth="3" strokeLinejoin="round" />

              {layers.regions &&
                allRegions.map((r) => (
                  <polygon
                    key={r.id}
                    points={r.points.map(([x, y]) => `${x * 10},${y * 7}`).join(' ')}
                    fill={r.color}
                    fillOpacity="0.18"
                    stroke={r.color}
                    strokeOpacity="0.85"
                    strokeWidth="2"
                    strokeDasharray="8 6"
                    strokeLinejoin="round"
                  />
                ))}

              {drawing && draft.length > 0 && (
                <g>
                  <polyline
                    points={draft.map(([x, y]) => `${x * 10},${y * 7}`).join(' ')}
                    fill="none"
                    stroke="#c8842b"
                    strokeWidth="3"
                    strokeDasharray="6 4"
                  />
                  {draft.map(([x, y], i) => (
                    <circle key={i} cx={x * 10} cy={y * 7} r="5" fill="#c8842b" />
                  ))}
                </g>
              )}

              {layers.forests &&
                world.forests.map((f, i) => (
                  <circle key={`f${i}`} cx={f.x} cy={f.y} r={f.r} fill="#4f6b3a" opacity="0.85" />
                ))}

              {layers.lakes &&
                world.lakes.map((l, i) => (
                  <ellipse key={`l${i}`} cx={l.x} cy={l.y} rx={l.rx} ry={l.ry} fill="#3f7fa3" stroke="#23485e" />
                ))}

              {layers.rivers &&
                world.rivers.map((d, i) => (
                  <path key={`r${i}`} d={d} fill="none" stroke="#3f7fa3" strokeWidth="3" strokeLinecap="round" />
                ))}

              {layers.mountains &&
                world.mountains.map((m, i) => (
                  <path key={`m${i}`} d={m.d} fill="#8a7a6a" stroke="#3d342a" strokeWidth="1" />
                ))}

              <TintLayer theme={theme} />

              {layers.regions &&
                labels.map((lb) => (
                  <text
                    key={lb.name}
                    data-label=""
                    x={lb.x}
                    y={lb.y}
                    textAnchor="middle"
                    fontFamily="Georgia, serif"
                    fontSize="22"
                    letterSpacing="3"
                    fill={theme === 'noite' ? '#f3e9d2' : '#2b2118'}
                    opacity={scale >= LABEL_SCALE ? 0.75 : 0}
                    style={{ transition: 'opacity 0.2s' }}
                  >
                    {lb.name.toUpperCase()}
                  </text>
                ))}

              <EffectsLayer theme={theme} world={world} />

              {routeInfo && (
                <line
                  x1={routeInfo.x1}
                  y1={routeInfo.y1}
                  x2={routeInfo.x2}
                  y2={routeInfo.y2}
                  stroke="#c8842b"
                  strokeWidth="4"
                  strokeDasharray="12 8"
                  strokeLinecap="round"
                />
              )}

              <rect width="1000" height="700" fill="url(#vignette)" />
              <rect x="6" y="6" width="988" height="688" fill="none" stroke="#6b4a2a" strokeWidth="10" opacity="0.7" />

              <g transform="translate(920 90)">
                <circle r="34" fill="#f3e9d2" opacity="0.85" stroke="#6b5a3a" />
                <path d="M0 -28 L8 0 L0 28 L-8 0Z" fill="#8a2e1e" />
                <text y="-40" textAnchor="middle" fontFamily="Georgia, serif" fontSize="16" fontWeight="bold" fill="#2b2118">N</text>
              </g>

              <g transform="translate(40 650)">
                <rect width="120" height="6" fill="#f3e9d2" stroke="#2b2118" />
                <text y="-8" fontFamily="Georgia, serif" fontSize="13" fill="#f3e9d2">100 km</text>
              </g>
            </svg>

            {editing && <div ref={hitRef} className={styles.hitArea} onClick={onCanvasClick} />}

            {editing &&
              !drawing &&
              selectedRegion &&
              selectedRegion.points.map(([x, y], i) => (
                <button
                  key={`${selectedRegion.id}-${i}`}
                  className={styles.vertex}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  aria-label={`Vértice ${i + 1} de ${selectedRegion.name}, arraste para mover, Delete para remover`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    snapshot();
                    setVertexDrag({ id: selectedRegion.id, i });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                      e.preventDefault();
                      removeVertex(selectedRegion, i);
                    }
                  }}
                />
              ))}

            {groups.map((g) => {
              if (editing) {
                const l = g.items[0];
                return (
                  <button
                    key={g.key}
                    id={`marker-${l.id}`}
                    className={`${styles.marker} ${styles.editing}`}
                    style={{ left: `${l.x}%`, top: `${l.y}%` }}
                    aria-label={`${l.name}, arraste para mover, Delete para remover`}
                    onPointerDown={() => {
                      draggedRef.current = false;
                      snapshot();
                      setDragId(l.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Delete' || e.key === 'Backspace') {
                        e.preventDefault();
                        if (window.confirm(`Remover "${l.name}" do mapa?`)) {
                          snapshot();
                          setRemoved((prev) => [...prev, l.id]);
                        }
                      }
                    }}
                    onDoubleClick={() => {
                      const n = window.prompt('Novo nome:', l.name);
                      if (n) {
                        snapshot();
                        patch(l.id, { name: n });
                      }
                    }}
                  >
                    {typeIcon[l.type]}
                  </button>
                );
              }
              if (routeMode && g.items.length === 1) {
                const l = g.items[0];
                return (
                  <button
                    key={g.key}
                    className={`${styles.marker} ${routePicks.includes(l.id) ? styles.selected : ''}`}
                    style={{ left: `${g.x / 10}%`, top: `${g.y / 7}%` }}
                    aria-label={`Selecionar ${l.name} para a rota`}
                    onClick={() => pickRoute(l.id)}
                  >
                    {typeIcon[l.type]}
                  </button>
                );
              }
              return g.items.length === 1 ? (
                <MarkerLink
                  key={g.key}
                  id={g.items[0].id}
                  name={g.items[0].name}
                  icon={typeIcon[g.items[0].type]}
                  x={g.x / 10}
                  y={g.y / 7}
                  selected={selectedId === g.items[0].id}
                  visited={visited.includes(g.items[0].id)}
                  status={statusOf(g.items[0])}
                />
              ) : (
                <button
                  key={g.key}
                  id={`cluster-${g.key}`}
                  className={styles.cluster}
                  style={{ left: `${g.x / 10}%`, top: `${g.y / 7}%` }}
                  aria-label={`${g.items.length} locais agrupados, clique para aproximar`}
                  onClick={() =>
                    apiRef.current?.zoomToElement(`cluster-${g.key}`, Math.min(MAX_SCALE, scale * 2.2), 400)
                  }
                >
                  {g.items.length}
                </button>
              );
            })}
          </TransformComponent>
        </div>
      )}
    </TransformWrapper>
  );
}
