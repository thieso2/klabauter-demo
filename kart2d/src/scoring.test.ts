import { describe, expect, it } from 'vitest';
import { computeCupStandings, scoreRace } from './scoring';

describe('scoreRace', () => {
  it('awards 4/3/2/1 points by finish order', () => {
    expect(scoreRace(['a', 'b', 'c', 'd'])).toEqual({ a: 4, b: 3, c: 2, d: 1 });
  });
});

describe('computeCupStandings', () => {
  it('sums per-race points into cumulative totals and orders by total descending', () => {
    const standings = computeCupStandings([
      ['a', 'b', 'c', 'd'],
      ['a', 'b', 'c', 'd'],
      ['a', 'b', 'c', 'd'],
    ]);
    expect(standings.map((s) => [s.racerId, s.total])).toEqual([
      ['a', 12],
      ['b', 9],
      ['c', 6],
      ['d', 3],
    ]);
    const a = standings.find((s) => s.racerId === 'a')!;
    expect(a.points).toEqual([4, 4, 4]);
    expect(a.placements).toEqual([1, 1, 1]);
  });

  it('breaks a total-points tie using the race-three placement', () => {
    // Race 1: x 3rd(2), y 1st(4). Race 2: x 1st(4), y 2nd(3). Race 3: x 1st(4), y 2nd(3).
    // Totals: x = 2+4+4 = 10, y = 4+3+3 = 10 -- tied overall; x placed better in race three.
    const standings = computeCupStandings([
      ['y', 'z', 'x', 'w'],
      ['x', 'y', 'z', 'w'],
      ['x', 'y', 'z', 'w'],
    ]);
    const x = standings.find((s) => s.racerId === 'x')!;
    const y = standings.find((s) => s.racerId === 'y')!;
    expect(x.total).toBe(y.total);
    expect(standings[0].racerId).toBe('x');
    expect(standings[1].racerId).toBe('y');
  });

  it('picks the other racer when the race-three placements are swapped', () => {
    // Same fixture with x and y's roles swapped: y now places better in race three.
    const standings = computeCupStandings([
      ['x', 'z', 'y', 'w'],
      ['y', 'x', 'z', 'w'],
      ['y', 'x', 'z', 'w'],
    ]);
    const x = standings.find((s) => s.racerId === 'x')!;
    const y = standings.find((s) => s.racerId === 'y')!;
    expect(x.total).toBe(y.total);
    expect(standings[0].racerId).toBe('y');
    expect(standings[1].racerId).toBe('x');
  });
});
