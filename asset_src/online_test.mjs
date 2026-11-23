// Test logiki trybu online z podstawionym stanem sieci (bez prawdziwego serwera)
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = v; }, removeItem(k) { delete this._s[k]; } };
const G = await import('../src/core/game.js');
const F = await import('../src/core/formulas.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  ', m); };

G.newPlayer({ name: 'Tester', cls: 'paladin', look: 0, hue: 0, aura: 0 });
const N = G.Net.Net;
// 1) offline: brak graczy online
assert(!G.Net.isOnline(), 'domyślnie offline');
assert(G.leaderboard('lvl').every((r) => !r.online), 'ranking offline bez graczy online');
// świat bez botów
assert(G.leaderboard('lvl').length === 1 && G.leaderboard('lvl')[0].me, 'offline ranking zawiera tylko gracza (brak botów)');
assert(G.arenaOpponents().length === 0, 'offline arena nie proponuje botów');
assert(G.wbContributors().length === 1, 'offline boss światowy: tylko własny wkład');
assert(G.wbMaxHp() === Math.round(G.power() * 40), 'offline pula PŻ bossa światowego dopasowana do gracza');
G.P.gold = 5000; G.createGuild('Testowa');
assert(G.P.guild.id === null && G.P.gold === 5000, 'offline nie da się założyć gildii (bez opłaty)');
assert(G.Net.getConfig() || !G.P.daily.missions.some((m) => m.id === 'arena'), 'bez konfiguracji serwera brak misji areny');

// 2) podstawiony stan online
const prof = G.netProfile();
assert(prof.fighter.maxHp > 0 && Array.isArray(prof.fighter.skills), 'profil zawiera snapshot walczącego');
N.status = 'on';
const gid = '11111111-2222-3333-4444-555555555555';
N.players = [
  { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'RealOne', cls: 'mage', look: 1, hue: 2, skin: 'default', lvl: 1, power: G.power(), rating: 1010, guild_id: gid, fighter: prof.fighter },
  { id: 'aaaaaaaa-0000-0000-0000-000000000002', name: 'RealTwo', cls: 'archer', look: 0, hue: 0, skin: 'golden', lvl: 2, power: G.power() * 1.1, rating: 990, guild_id: null, fighter: { ...prof.fighter, crit: 999, dodge: 999 } },
];
N.guilds = [{ id: gid, name: 'Prawdziwa Gildia', owner: 'x', members: 1 }];
N.boss = { worldTotal: 5000, worldOwnServer: 0, guildOthers: 777, contributors: [{ name: 'RealOne', cls: 'mage', dmg: 5000, online: true }] };

const lb = G.leaderboard('power');
assert(lb.some((r) => r.online && r.name === 'RealOne'), 'ranking zawiera graczy online');
const fr = G.Net.fighterFromRow(N.players[1]);
assert(fr.crit <= 65 && fr.dodge <= 42, 'snapshot rywala ma ograniczone statystyki (anty‑oszustwo)');

G.P.arena.opp = [];
let found = false;
for (let i = 0; i < 20 && !found; i++) { G.P.arena.opp = []; found = G.arenaOpponents().some((o) => o.online); }
assert(found, 'arena proponuje prawdziwych graczy');
const opp = G.arenaOpponents().find((o) => o.online) || G.arenaOpponents()[0];
const spec = G.arenaBattle(opp.id);
assert(spec && spec.sim.events.length > 0, 'walka areny z graczem online działa (' + (spec && spec.title) + ')');

assert(G.wbContributors().some((c) => c.online), 'boss światowy: lista zawiera graczy online');

// gildia online (bez wywołań sieci – ustawiamy stan jak po dołączeniu)
G.P.guild = { id: 'net:' + gid, netName: 'Prawdziwa Gildia', joined: Date.now(), own: null, gb: null };
G.tick();
assert(G.guildName() === 'Prawdziwa Gildia', 'nazwa gildii online');
assert(G.guildMembersInfo().length === 1 && G.guildMembersInfo()[0].online, 'członkowie gildii online');
const gi = G.guildBossInfo();
assert(gi.dealt === 777, 'boss gildii sumuje obrażenia innych członków');
assert(G.guildLevel() >= 1, 'poziom gildii online');

// 3) samouczek
G.wipe(); G.newPlayer({ name: 'Nowy', cls: 'warrior', look: 0, hue: 0, aura: 0 });
N.status = 'off';
assert(G.P.tut === 0, 'nowa postać zaczyna samouczek');
G.startQuest(0);
assert(G.skipQuestCost() === 0, 'pierwsze przyspieszenie gratis');
G.skipQuest();
const q = G.questBattle();
assert(q.win && q.rew.items.length === 2 && G.P.lvl >= 2, `pierwsza przygoda: wygrana, 2 przedmioty, awans (poz. ${G.P.lvl})`);
G.autoEquip();
assert(G.P.tutAuto, 'flaga „załóż najlepsze”');
const it = G.claimTutorialReward();
assert(it && G.P.tut === 'done', 'nagroda za samouczek');
G.startQuest(0);
assert(G.skipQuestCost() > 0, 'po samouczku przyspieszenie płatne');
