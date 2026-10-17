import raw from '@/data/locations.json';

export type LocationType = 'vila' | 'torre' | 'porto' | 'ruina' | 'fortaleza' | 'santuario' | 'floresta';

export type EventStatus = 'destruido' | 'abandonado';

export type Location = {
  id: number;
  name: string;
  region: string;
  type: LocationType;
  description: string;
  x: number; // posição em % do mapa
  y: number;
  tags: string[];
  links: number[]; // ids de locais conectados
  image?: string;
  year?: number; // ano de fundação (filtra a linha do tempo)
  events?: { year: number; title: string; status?: EventStatus }[]; // histórico do local
};

// Dados vêm de data/locations.json: edite o JSON sem mexer no código.
export const locations = raw as unknown as Location[];

export function getLocation(id: number) {
  return locations.find((l) => l.id === id);
}

export const typeIcon: Record<LocationType, string> = {
  vila: '🏘️',
  torre: '🗼',
  porto: '⚓',
  ruina: '🏛️',
  fortaleza: '🏰',
  santuario: '⛩️',
  floresta: '🌲',
};
