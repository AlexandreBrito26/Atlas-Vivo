import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ padding: 48 }}>
      <h1>Local não encontrado</h1>
      <p>Esse endereço não existe no mapa.</p>
      <Link href="/map">← Voltar ao mapa</Link>
    </main>
  );
}
