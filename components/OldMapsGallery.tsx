'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { categories, oldMaps, type OldMap, type OldMapCategory } from '@/lib/oldMaps';
import styles from './OldMapsGallery.module.scss';

type Filter = OldMapCategory | 'todos';

// As imagens vêm da Wikimedia: pedimos o resumo do artigo na Wikipédia e usamos a miniatura.
// O resultado fica em cache para não repetir a mesma consulta.
const imageCache = new Map<string, Promise<string | null>>();

function loadThumb(title: string): Promise<string | null> {
  let p = imageCache.get(title);
  if (!p) {
    p = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.thumbnail?.source as string | undefined) ?? null)
      .catch(() => null);
    imageCache.set(title, p);
  }
  return p;
}

// Troca a largura da miniatura (a Wikimedia só serve larguras padrão: 500, 1280...).
function withWidth(url: string, width: number) {
  return url.replace(/\/(\d+)px-/, `/${width}px-`);
}

function useThumb(title?: string) {
  // undefined = carregando, null = sem imagem
  const [thumb, setThumb] = useState<string | null | undefined>(title ? undefined : null);
  useEffect(() => {
    if (!title) return;
    let alive = true;
    loadThumb(title).then((t) => alive && setThumb(t));
    return () => {
      alive = false;
    };
  }, [title]);
  return thumb;
}

function categoryOf(id: OldMapCategory) {
  return categories.find((c) => c.id === id)!;
}

function MapPicture({ map, width, className }: { map: OldMap; width: number; className?: string }) {
  const thumb = useThumb(map.wiki);
  const wanted = thumb ? withWidth(thumb, width) : null;
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    setSrc(wanted);
  }, [wanted]);

  if (thumb === undefined) {
    return <div className={`${styles.placeholder} ${className ?? ''}`} aria-busy="true" />;
  }
  if (!src) {
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
      src={src}
      alt={`${map.name}, ${map.year}`}
      loading="lazy"
      // Se o tamanho pedido não existir, volta para a miniatura original
      onError={() => thumb && src !== thumb && setSrc(thumb)}
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
          Imagem: Wikimedia Commons, via Wikipédia ·{' '}
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

  const list = useMemo(
    () => (filter === 'todos' ? oldMaps : oldMaps.filter((m) => m.category === filter)),
    [filter],
  );

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
          <p>{currentLabel}</p>
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

      <main className={styles.grid}>
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
