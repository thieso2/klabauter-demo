export type Rarity = 'common' | 'uncommon' | 'rare';
export type Tier = 'easy' | 'medium' | 'hard';

export interface WordEntry {
  word: string;
  rarity: Rarity;
}

export const TIERS: readonly Tier[] = ['easy', 'medium', 'hard'];

// Tier membership is computed from length + rarity, not an ad-hoc length cutoff: a longer word
// pulls toward Hard, a rarer word pulls the same way, and the two combine additively so a short
// rare word (e.g. "lynx") and a long common one (e.g. "strawberry") both land in Medium rather
// than at the extremes their single dimension would suggest.
const RARITY_WEIGHT: Record<Rarity, number> = { common: 0, uncommon: 4, rare: 8 };
const EASY_MAX_SCORE = 8;
const MEDIUM_MAX_SCORE = 13;

export function tierScore(entry: WordEntry): number {
  return entry.word.length + RARITY_WEIGHT[entry.rarity];
}

export function tierOf(entry: WordEntry): Tier {
  const score = tierScore(entry);
  if (score <= EASY_MAX_SCORE) return 'easy';
  if (score <= MEDIUM_MAX_SCORE) return 'medium';
  return 'hard';
}

const common = (word: string): WordEntry => ({ word, rarity: 'common' });
const uncommon = (word: string): WordEntry => ({ word, rarity: 'uncommon' });
const rare = (word: string): WordEntry => ({ word, rarity: 'rare' });

// Common, short everyday words: length + 0 <= 8, always Easy.
const EASY_COMMON = [
  'cat', 'dog', 'sun', 'run', 'big', 'red', 'box', 'cup', 'pen', 'map',
  'bed', 'fan', 'jar', 'key', 'log', 'mud', 'net', 'owl', 'pig', 'rug',
  'tree', 'frog', 'lamp', 'book', 'fish', 'bird', 'star', 'moon', 'rain', 'snow',
  'wind', 'leaf', 'hand', 'foot', 'head', 'door', 'gate', 'road', 'path', 'park',
  'apple', 'table', 'chair', 'water', 'mouse', 'house', 'horse', 'plant', 'cloud', 'beach',
];

// Uncommon words of moderate length: length + 4 lands in [9, 13], Medium.
const MEDIUM_UNCOMMON = [
  'puzzle', 'dragon', 'castle', 'forest', 'garden', 'island', 'jungle', 'mirror', 'pillow', 'planet',
  'pocket', 'rocket', 'sailor', 'shadow', 'shovel', 'silver', 'sponge', 'statue', 'temple', 'thunder',
  'tunnel', 'turtle', 'valley', 'velvet', 'violin', 'walnut', 'whisker', 'wonder', 'zephyr', 'amulet',
];
// Common but longer words: length + 0 lands in [9, 13], Medium.
const MEDIUM_COMMON = [
  'chocolate', 'butterfly', 'waterfall', 'telephone', 'newspaper',
  'strawberry', 'basketball', 'skateboard', 'television', 'helicopter',
];
// Rare but short words: length + 8 lands in [9, 13], Medium.
const MEDIUM_RARE = ['lynx', 'ibex', 'newt', 'gnat', 'wren', 'auk', 'yak', 'emu', 'koi', 'orc'];

// Uncommon, long words: length + 4 >= 14, Hard.
const HARD_UNCOMMON = [
  'parliament', 'chandelier', 'caterpillar', 'kaleidoscope', 'hippopotamus',
  'metamorphosis', 'extraordinary', 'claustrophobia', 'onomatopoeia', 'circumference',
  'discombobulate', 'perpendicular', 'unconventional', 'disproportionate', 'incomprehensible',
  'notwithstanding', 'straightforward', 'underestimate', 'overwhelming', 'refrigerator',
  'investigation', 'illustration', 'constellation', 'imagination', 'civilization',
];
// Rare words of at least moderate length: length + 8 >= 14, Hard.
const HARD_RARE = [
  'quixotic', 'ephemeral', 'solitude', 'labyrinth', 'obsidian',
  'nebulous', 'quandary', 'cacophony', 'melancholy', 'serendipity',
  'obfuscate', 'perspicacious', 'sesquipedalian', 'antediluvian', 'pusillanimous',
  'grandiloquent', 'recalcitrant', 'vicissitude', 'perfunctory', 'surreptitious',
  'idiosyncrasy', 'vainglorious', 'mellifluous', 'pernicious', 'salubrious',
];

export const WORDS: readonly WordEntry[] = [
  ...EASY_COMMON.map(common),
  ...MEDIUM_UNCOMMON.map(uncommon),
  ...MEDIUM_COMMON.map(common),
  ...MEDIUM_RARE.map(rare),
  ...HARD_UNCOMMON.map(uncommon),
  ...HARD_RARE.map(rare),
];

export function wordsInTier(tier: Tier): WordEntry[] {
  return WORDS.filter((entry) => tierOf(entry) === tier);
}

/** Draws a random word from the given tier's pool. `rng` returns [0, 1) — injectable for tests. */
export function randomWord(tier: Tier, rng: () => number = Math.random): string {
  const pool = wordsInTier(tier);
  const index = Math.floor(rng() * pool.length);
  return pool[index]!.word;
}
