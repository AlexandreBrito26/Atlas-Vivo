'use client';
import { useEffect, useState } from 'react';
import styles from '@/app/map/map.module.scss';

// Notas pessoais por local, guardadas só neste navegador (localStorage).
export function NoteEditor({ id }: { id: number }) {
  const key = `mapa:note:${id}`;
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setText(localStorage.getItem(key) ?? '');
    } catch {
      setText('');
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, text);
    } catch {
      /* armazenamento indisponível */
    }
  }, [text, loaded, key]);

  return (
    <section className={styles.notes}>
      <h3>Minhas notas</h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Anotações só suas, salvas neste navegador"
        aria-label="Notas pessoais"
      />
    </section>
  );
}
