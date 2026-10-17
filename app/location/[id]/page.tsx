import { notFound } from 'next/navigation';
import { getLocation } from '@/lib/locations';
import { LocationCard } from '@/components/LocationCard';
import { NoteEditor } from '@/components/NoteEditor';

// Acesso direto (link novo, F5, compartilhado): página completa.
export default async function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loc = getLocation(Number(id));
  if (!loc) notFound();

  return (
    <>
      <LocationCard loc={loc} variant="page" />
      <NoteEditor id={loc.id} />
    </>
  );
}
