// Prezenty od administratora (złoto i kryształy) – limity zgodne z supabase/gifts_1.8.3.sql
export const GIFT = { maxGold: 100000000, maxCrystals: 10000, maxRecipients: 5000, maxMessage: 200, maxReason: 120 };
export const GIFT_GOLD_PRESETS = [1000, 10000, 100000];
export const GIFT_CRYSTAL_PRESETS = [50, 100, 500];
const int = (v) => (v === '' || v == null ? 0 : Number(v));

// sprawdzenie wysyłki przed wywołaniem serwera; recipients – liczba odbiorców; zwraca komunikat błędu albo null
export function validateGift({ gold, crystals, recipients }) {
  const g = int(gold), c = int(crystals);
  if (!Number.isInteger(g) || g < 0 || g > GIFT.maxGold) return `Złoto: liczba całkowita od 0 do ${GIFT.maxGold.toLocaleString('pl-PL')}.`;
  if (!Number.isInteger(c) || c < 0 || c > GIFT.maxCrystals) return `Kryształy: liczba całkowita od 0 do ${GIFT.maxCrystals.toLocaleString('pl-PL')}.`;
  if (g === 0 && c === 0) return 'Podaj ilość złota lub kryształów.';
  if (!Number.isInteger(recipients) || recipients < 1) return 'Wybierz co najmniej jednego gracza (albo „Wszyscy gracze”).';
  if (recipients > GIFT.maxRecipients) return `Najwyżej ${GIFT.maxRecipients} odbiorców w jednej wysyłce.`;
  return null;
}
// „1 000 zł + 100 💎”
export function giftLabel(gold, crystals) {
  const parts = [];
  if (Number(gold) > 0) parts.push(`${Number(gold).toLocaleString('pl-PL')} zł`);
  if (Number(crystals) > 0) parts.push(`${Number(crystals).toLocaleString('pl-PL')} 💎`);
  return parts.join(' + ') || '—';
}
// suma odebranych prezentów
export function giftTotals(rows) {
  return (rows || []).reduce((t, r) => ({ gold: t.gold + Math.max(0, Math.floor(Number(r.gold) || 0)), crystals: t.crystals + Math.max(0, Math.floor(Number(r.crystals) || 0)), count: t.count + 1 }), { gold: 0, crystals: 0, count: 0 });
}
