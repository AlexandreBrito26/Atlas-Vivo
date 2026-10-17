import raw from '@/data/regions.json';
import type { SoundKind } from './ambient';

export type Region = {
  id: string;
  name: string;
  color: string;
  points: [number, number][]; // vértices em % do mapa
  sound?: SoundKind; // som ambiente da região
};

// Dados vêm de data/regions.json: edite o JSON ou desenhe no modo editor.
export const regions = raw as unknown as Region[];
