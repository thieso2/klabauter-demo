export type RacerId = string;

export const PLACE_POINTS = [4, 3, 2, 1];

export interface RacerCupScore {
  racerId: RacerId;
  points: number[]; // per-race points, index-aligned to the input races
  placements: number[]; // per-race 1-indexed placement, index-aligned to the input races
  total: number;
}

/** Points a single race's finish order (1st..last) awards, keyed by racer id. */
export function scoreRace(finishOrder: RacerId[]): Record<RacerId, number> {
  const points: Record<RacerId, number> = {};
  finishOrder.forEach((racerId, i) => {
    points[racerId] = PLACE_POINTS[i] ?? 0;
  });
  return points;
}

/**
 * Cup standings across a sequence of races: per-racer per-race points, cumulative totals, and the
 * final order (highest total first). Ties are broken by the better placement in the latest race,
 * then the next-latest, and so on back to the first.
 */
export function computeCupStandings(raceFinishOrders: RacerId[][]): RacerCupScore[] {
  const scores = new Map<RacerId, RacerCupScore>();
  for (const finishOrder of raceFinishOrders) {
    finishOrder.forEach((racerId, i) => {
      const place = i + 1;
      const points = PLACE_POINTS[i] ?? 0;
      const existing = scores.get(racerId) ?? { racerId, points: [], placements: [], total: 0 };
      existing.points.push(points);
      existing.placements.push(place);
      existing.total += points;
      scores.set(racerId, existing);
    });
  }

  return [...scores.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    for (let i = a.placements.length - 1; i >= 0; i--) {
      if (a.placements[i] !== b.placements[i]) return a.placements[i] - b.placements[i];
    }
    return 0;
  });
}
