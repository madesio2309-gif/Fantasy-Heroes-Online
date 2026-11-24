// VIP (nadawany przez administratora): wygoda i kosmetyka – bez przewagi w walce.
// Paczkę kryształów wylicza serwer przy nadaniu (admin_grant_vip: 10 💎 za dzień, maks. 1000).
export const VIP = { bag: 10, idleHours: 16, abyssKeys: 1, crystalsPerDay: 10, crystalsMax: 1000, skin: 'vip' };
export const VIP_DAY_PRESETS = [7, 30, 90];
export const VIP_PERKS = [
  ['🎒', `Plecak większy o ${VIP.bag} miejsc`],
  ['⏳', `Nagrody Idle zbierają się do ${VIP.idleHours} godz. (zamiast 12)`],
  ['🌀', `+${VIP.abyssKeys} klucz Otchłani dziennie`],
  ['🏷', 'Złota plakietka VIP przy nicku: czat, rankingi, gildia i profil'],
  ['✨', 'Skórka „Królewski VIP” na czas trwania VIP-a'],
  ['💎', `Paczka kryształów przy każdym nadaniu: ${VIP.crystalsPerDay} 💎 za dzień VIP-a`],
];
export const vipBonusFor = (days) => Math.min(VIP.crystalsMax, Math.max(0, Math.floor(days)) * VIP.crystalsPerDay);
