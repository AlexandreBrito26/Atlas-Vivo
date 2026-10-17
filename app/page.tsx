import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: 48 }}>
      <h1>Atlas Vivo</h1>
      <p><Link href="/map">Abrir o mapa →</Link></p>
      <p><Link href="/mapas-antigos">Ver mapas antigos →</Link></p>
    </main>
  );
}
