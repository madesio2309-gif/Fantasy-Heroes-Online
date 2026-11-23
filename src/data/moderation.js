// Filtr wulgaryzmów (czat, nazwy). Ten sam rdzeń listy działa po stronie serwera (supabase/schema.sql: fho_clean_text).
// Dopasowanie po rdzeniach z uwzględnieniem popularnych podmian znaków (0→o, @→a, 1→i, $→s …).
const ROOTS = [
  'kurw', 'kurew', 'chuj', 'huj', 'pierdol', 'pierdal', 'jeba', 'jebi', 'jebn', 'jebe', 'jebc', 'zajeb', 'wyjeb', 'pizd', 'skurw',
  'cipa', 'cipy', 'cipe', 'fiut', 'kutas', 'dziwk', 'szmat', 'cwel', 'ciota', 'spierd', 'wypierd', 'zjeb', 'debil',
  'fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fagg', 'whore', 'dick', 'asshole',
];
const MAP = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', 'ą': 'a', 'ę': 'e', 'ó': 'o', 'ś': 's', 'ł': 'l', 'ż': 'z', 'ź': 'z', 'ć': 'c', 'ń': 'n' };
const norm = (s) => s.toLowerCase().split('').map((c) => MAP[c] || c).join('');

// zwraca tekst z zamaskowanymi wulgaryzmami (słowo → pierwsza litera + gwiazdki)
export function cleanText(text) {
  return String(text).replace(/[\p{L}\p{N}@$!]+/gu, (w) => {
    const n = norm(w).replace(/[^a-z]/g, '');
    return ROOTS.some((r) => n.includes(r)) ? w[0] + '*'.repeat(Math.max(2, w.length - 1)) : w;
  });
}
export const hasProfanity = (text) => cleanText(text) !== String(text);
export const PROFANITY_ROOTS = ROOTS;
