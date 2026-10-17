'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { categories, oldMaps, type OldMap, type OldMapCategory } from '@/lib/oldMaps';
import styles from './OldMapsGallery.module.scss';

type Filter = OldMapCategory | 'todos';

// As imagens vêm do Wikimedia Commons: Special:FilePath redireciona para a miniatura
// do arquivo na largura pedida (a Wikimedia só serve larguras padrão: 500, 1280...).
function commonsFileUrl(file: string, width?: number) {
  const name = encodeURIComponent(file.replace(/ /g, '_'));
  const base = `https://commons.wikimedia.org/wiki/Special:FilePath/${name}`;
  return width ? `${base}?width=${width}` : base;
}

function commonsPageUrl(file: string) {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`;
}

// Busca sem acentos e sem diferenciar maiúsculas
function normalize(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function categoryOf(id: OldMapCategory) {
  return categories.find((c) => c.id === id)!;
}

function MapPicture({ map, width, className }: { map: OldMap; width: number; className?: string }) {
  // 0 = largura pedida, 1 = arquivo original (se a largura não existir), 2 = sem imagem
  const [stage, setStage] = useState(0);

  if (!map.file || stage > 1) {
    return (
      <div className={`${styles.placeholder} ${className ?? ''}`}>
        <span aria-hidden>{categoryOf(map.category).icon}</span>
        <small>Imagem no acervo de origem</small>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={commonsFileUrl(map.file, stage === 0 ? width : undefined)}
      alt={`${map.name}, ${map.year}`}
      loading="lazy"
      onError={() => setStage((v) => v + 1)}
    />
  );
}

function Viewer({ map, onClose }: { map: OldMap; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const cat = categoryOf(map.category);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div className={styles.viewer} role="dialog" aria-modal="true" aria-label={map.name}>
      <div className={styles.viewerTop}>
        <div>
          <h2>{map.name}</h2>
          <p>
            {cat.icon} {cat.label} · {map.year} · {map.place}
          </p>
        </div>
        <button ref={closeRef} onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <TransformWrapper minScale={1} maxScale={8} centerOnInit>
        {({ zoomIn, zoomOut, resetTransform }) => (
          <div className={styles.viewerBody}>
            <div className={styles.zoomBar}>
              <button onClick={() => zoomIn()} aria-label="Aproximar">
                +
              </button>
              <button onClick={() => zoomOut()} aria-label="Afastar">
                −
              </button>
              <button onClick={() => resetTransform()} aria-label="Restaurar zoom">
                ⟲
              </button>
            </div>
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
            >
              <MapPicture map={map} width={1280} className={styles.big} />
            </TransformComponent>
          </div>
        )}
      </TransformWrapper>

      <div className={styles.viewerInfo}>
        <p>{map.description}</p>
        <p className={styles.credit}>
          {map.file && (
            <>
              Imagem:{' '}
              <a href={commonsPageUrl(map.file)} target="_blank" rel="noreferrer">
                Wikimedia Commons
              </a>{' '}
              ·{' '}
            </>
          )}
          Fonte:{' '}
          <a href={map.sourceUrl} target="_blank" rel="noreferrer">
            {map.sourceLabel}
          </a>
        </p>
      </div>
    </div>
  );
}

export function OldMapsGallery() {
  const [filter, setFilter] = useState<Filter>('todos');
  const [menuOpen, setMenuOpen] = useState(false);
  const [opened, setOpened] = useState<OldMap | null>(null);
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<'antigos' | 'recentes'>('antigos');

  const list = useMemo(() => {
    const q = normalize(query.trim());
    const found = oldMaps.filter(
      (m) =>
        (filter === 'todos' || m.category === filter) &&
        (!q || normalize(`${m.name} ${m.year} ${m.place} ${m.description}`).includes(q)),
    );
    // oldMaps já vem ordenado do mais antigo para o mais recente
    return order === 'recentes' ? found.slice().reverse() : found;
  }, [filter, query, order]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: oldMaps.length };
    for (const m of oldMaps) c[m.category] = (c[m.category] ?? 0) + 1;
    return c;
  }, []);

  // Esc fecha primeiro o visualizador e, se não houver, o menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (opened) setOpened(null);
      else if (menuOpen) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opened, menuOpen]);

  const choose = (f: Filter) => {
    setFilter(f);
    setMenuOpen(false);
  };

  const currentLabel = filter === 'todos' ? 'Todos os mapas' : categoryOf(filter).label;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          className={styles.burger}
          aria-label="Abrir categorias"
          aria-expanded={menuOpen}
          aria-controls="categorias"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className={styles.headTitle}>
          <h1>Mapas antigos</h1>
          <p>
            {currentLabel} · {list.length} {list.length === 1 ? 'mapa' : 'mapas'}
          </p>
        </div>
        <Link href="/map" className={styles.back}>
          ← Atlas
        </Link>
      </header>

      {menuOpen && <div className={styles.backdrop} onClick={() => setMenuOpen(false)} />}
      <nav
        id="categorias"
        className={`${styles.drawer} ${menuOpen ? styles.drawerOpen : ''}`}
        aria-label="Categorias"
        aria-hidden={!menuOpen}
      >
        <h2>Categorias</h2>
        <ul>
          <li>
            <button
              tabIndex={menuOpen ? 0 : -1}
              aria-current={filter === 'todos'}
              onClick={() => choose('todos')}
            >
              <span>🗺️ Todos</span>
              <b>{counts.todos}</b>
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <button
                tabIndex={menuOpen ? 0 : -1}
                aria-current={filter === c.id}
                onClick={() => choose(c.id)}
              >
                <span>
                  {c.icon} {c.label}
                </span>
                <b>{counts[c.id] ?? 0}</b>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.tools}>
        <input
          type="search"
          className={styles.search}
          placeholder="Buscar por nome, época ou acervo"
          aria-label="Buscar mapa"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={styles.order}
          aria-label="Ordenar mapas"
          value={order}
          onChange={(e) => setOrder(e.target.value as 'antigos' | 'recentes')}
        >
          <option value="antigos">Mais antigos primeiro</option>
          <option value="recentes">Mais recentes primeiro</option>
        </select>
      </div>

      <main className={styles.grid}>
        {list.length === 0 && <p className={styles.empty}>Nenhum mapa encontrado.</p>}
        {list.map((m) => (
          <button key={m.id} className={styles.card} onClick={() => setOpened(m)}>
            <MapPicture map={m} width={500} className={styles.thumb} />
            <div className={styles.cardText}>
              <h3>{m.name}</h3>
              <p>
                {categoryOf(m.category).icon} {categoryOf(m.category).label} · {m.year}
              </p>
            </div>
          </button>
        ))}
      </main>

      {opened && <Viewer map={opened} onClose={() => setOpened(null)} />}
    </div>
  );
}
