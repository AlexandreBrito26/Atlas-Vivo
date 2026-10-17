import Link from 'next/link';
import type { EventStatus } from '@/lib/locations';
import styles from './WorldMap.module.scss';

type Props = {
  id: number;
  name: string;
  icon: string;
  x: number; // %
  y: number; // %
  selected: boolean;
  visited?: boolean;
  status?: EventStatus;
};

export function MarkerLink({ id, name, icon, x, y, selected, visited, status }: Props) {
  const classes = [
    styles.marker,
    selected ? styles.selected : '',
    visited && !selected ? styles.visited : '',
    status ? styles.destroyed : '',
  ].join(' ');

  const label = [name, status, visited ? 'já visitado' : ''].filter(Boolean).join(', ');

  return (
    <Link
      id={`marker-${id}`}
      href={`/location/${id}`}
      scroll={false}
      title={label}
      aria-label={label}
      aria-current={selected ? 'page' : undefined}
      className={classes}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {icon}
    </Link>
  );
}
