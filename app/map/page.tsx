import { locations } from '@/lib/locations';
import { regions } from '@/lib/regions';
import { WorldMap } from '@/components/WorldMap';

export default function MapPage() {
  return <WorldMap locations={locations} regions={regions} seed={42} />;
}
