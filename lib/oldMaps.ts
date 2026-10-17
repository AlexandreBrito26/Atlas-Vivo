import raw from '@/data/old-maps.json';

export type OldMapCategory =
  | 'china'
  | 'japao'
  | 'coreia'
  | 'europa'
  | 'islamico'
  | 'descobrimentos';

export type OldMap = {
  id: string;
  name: string;
  category: OldMapCategory;
  year: string; // texto exibido (ex.: "c. 1389")
  sortYear: number; // usado só para ordenar
  place: string; // onde o mapa (ou a cópia) está guardado
  description: string;
  wiki?: string; // título do artigo na Wikipédia: a imagem vem da Wikimedia
  sourceUrl: string;
  sourceLabel: string;
};

// Dados vêm de data/old-maps.json: edite o JSON sem mexer no código.
export const oldMaps = (raw as unknown as OldMap[])
  .slice()
  .sort((a, b) => a.sortYear - b.sortYear);

export const categories: { id: OldMapCategory; label: string; icon: string }[] = [
  { id: 'china', label: 'China', icon: '🏮' },
  { id: 'japao', label: 'Japão', icon: '⛩️' },
  { id: 'coreia', label: 'Coreia', icon: '🧭' },
  { id: 'europa', label: 'Europa', icon: '🏰' },
  { id: 'islamico', label: 'Mundo islâmico', icon: '🌙' },
  { id: 'descobrimentos', label: 'Descobrimentos', icon: '⚓' },
];
