export type RacerShape = 'wedge' | 'delta' | 'hex' | 'chevron';

export interface RacerDesign {
  id: string;
  name: string;
  bodyColor: string;
  accentColor: string;
  shape: RacerShape;
}

/**
 * Four original, abstract geometric kart/pilot designs. The racer-select screen offers the first
 * three as player choices; whichever three the player does not drive fill the AI field, so every
 * race always seats four visually distinct racers.
 */
export const RACER_DESIGNS: RacerDesign[] = [
  { id: 'vector', name: 'Vector', bodyColor: '#e63946', accentColor: '#ffe8d6', shape: 'wedge' },
  { id: 'prism', name: 'Prism', bodyColor: '#457b9d', accentColor: '#a8dadc', shape: 'delta' },
  { id: 'nova', name: 'Nova', bodyColor: '#2a9d8f', accentColor: '#e9c46a', shape: 'hex' },
  { id: 'ember', name: 'Ember', bodyColor: '#f4a261', accentColor: '#264653', shape: 'chevron' },
];

export function selectableDesigns(): RacerDesign[] {
  return RACER_DESIGNS.slice(0, 3);
}

/** The three designs an AI field uses for a given player pick: every design except the one taken. */
export function aiDesignsFor(playerDesignId: string): RacerDesign[] {
  return RACER_DESIGNS.filter((d) => d.id !== playerDesignId);
}
