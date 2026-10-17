import type { ReactNode } from 'react';
import styles from './map.module.scss';

// `panel` é o slot paralelo @panel: pode ser o default.tsx ou a rota interceptada.
export default function MapLayout({
  children,
  panel,
}: {
  children: ReactNode;
  panel: ReactNode;
}) {
  return (
    <div className={styles.wrapper}>
      <main className={styles.map}>{children}</main>
      <aside className={styles.panel}>{panel}</aside>
    </div>
  );
}
