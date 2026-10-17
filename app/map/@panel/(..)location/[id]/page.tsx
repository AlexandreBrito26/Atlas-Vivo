import { notFound } from 'next/navigation';
import { getLocation } from '@/lib/locations';
import { LocationCard } from '@/components/LocationCard';
import { NoteEditor } from '@/components/NoteEditor';
import { CloseButton } from '@/app/map/CloseButton';

// Interceptada: quando a navegação vem do mapa, esta versão aparece no painel.
export default async function LocationPanel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loc = getLocation(Number(id));
  if (!loc) notFound();

  return (
    <>
      <CloseButton />
      <LocationCard loc={loc} />
      <NoteEditor id={loc.id} />
    </>
  );
}
