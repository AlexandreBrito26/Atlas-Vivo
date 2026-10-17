import Link from 'next/link';
import styles from '@/app/map/map.module.scss';
import { locations, typeIcon, type Location } from '@/lib/locations';

type Props = { loc: Location; variant?: 'panel' | 'page' };

export function LocationCard({ loc, variant = 'panel' }: Props) {
  const linked = locations.filter((l) => loc.links.includes(l.id));

  return (
    <article className={variant === 'page' ? styles.fullPage : styles.card}>
      {loc.image && <img src={loc.image} alt={loc.name} className={styles.image} />}
      <h2>
        {typeIcon[loc.type]} {loc.name}
      </h2>
      <p className={styles.region}>
        {loc.region} · {loc.type}
        {loc.year !== undefined && ` · ano ${loc.year}`}
      </p>
      <p>{loc.description}</p>

      {loc.events && loc.events.length > 0 && (
        <>
          <h3>Histórico</h3>
          <ol className={styles.events}>
            {[...loc.events]
              .sort((a, b) => a.year - b.year)
              .map((e) => (
                <li key={`${e.year}-${e.title}`}>
                  <strong>Ano {e.year}:</strong> {e.title}
                  {e.status && <em> ({e.status})</em>}
                </li>
              ))}
          </ol>
        </>
      )}

      {loc.tags.length > 0 && (
        <ul className={styles.tags}>
          {loc.tags.map((t) => (
            <li key={t}>#{t}</li>
          ))}
        </ul>
      )}

      {linked.length > 0 && (
        <>
          <h3>Conexões</h3>
          <ul className={styles.links}>
            {linked.map((l) => (
              <li key={l.id}>
                <Link href={`/location/${l.id}`} scroll={false}>
                  {typeIcon[l.type]} {l.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {variant === 'page' && <Link href="/map">← Voltar ao mapa</Link>}
    </article>
  );
}
