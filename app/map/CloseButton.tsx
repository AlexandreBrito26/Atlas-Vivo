'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './map.module.scss';

export function CloseButton() {
  const router = useRouter();

  // Esc também fecha o painel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <button className={styles.close} onClick={() => router.back()} aria-label="Fechar painel">
      Fechar
    </button>
  );
}
