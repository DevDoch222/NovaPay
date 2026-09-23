/** Client-side card face themes (PAN never stored). */

export type CardDesignId =
  | 'harbor'
  | 'atlantic'
  | 'graphite'
  | 'frost'
  | 'lagoon';

export type CardDesign = {
  id: CardDesignId;
  name: string;
  blurb: string;
  colors: [string, string, string];
  textPrimary: string;
  textMuted: string;
  chip: string;
  border: string;
};

export const CARD_DESIGNS: CardDesign[] = [
  {
    id: 'harbor',
    name: 'Harbor',
    blurb: 'Classic NovaPay navy',
    colors: ['#163A63', '#0D2B4E', '#081C33'],
    textPrimary: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.68)',
    chip: 'rgba(255,255,255,0.16)',
    border: 'rgba(255,255,255,0.2)',
  },
  {
    id: 'atlantic',
    name: 'Atlantic',
    blurb: 'Ocean depth to signal blue',
    colors: ['#1A73C1', '#0F4C81', '#0D2B4E'],
    textPrimary: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.7)',
    chip: 'rgba(255,255,255,0.18)',
    border: 'rgba(255,255,255,0.22)',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    blurb: 'Quiet executive slate',
    colors: ['#2A3340', '#1A222C', '#0D2B4E'],
    textPrimary: '#F7F9FB',
    textMuted: 'rgba(247,249,251,0.65)',
    chip: 'rgba(255,255,255,0.12)',
    border: 'rgba(255,255,255,0.14)',
  },
  {
    id: 'frost',
    name: 'Frost',
    blurb: 'Glass light for day spend',
    colors: ['#F7FBFF', '#D8E6F5', '#B8CFE6'],
    textPrimary: '#0D2B4E',
    textMuted: 'rgba(13,43,78,0.55)',
    chip: 'rgba(13,43,78,0.08)',
    border: 'rgba(13,43,78,0.12)',
  },
  {
    id: 'lagoon',
    name: 'Lagoon',
    blurb: 'Teal coastal reserve',
    colors: ['#0E6B70', '#0A4D5C', '#0D2B4E'],
    textPrimary: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.68)',
    chip: 'rgba(255,255,255,0.16)',
    border: 'rgba(255,255,255,0.2)',
  },
];

export function getCardDesign(id?: string | null): CardDesign {
  return CARD_DESIGNS.find((d) => d.id === id) ?? CARD_DESIGNS[0];
}
