// Profil gracza: podgląd ekwipunku, statystyk, peta i skórki innego gracza (dane z serwera, oczyszczane przy odczycie)
import { h, uiIcon, itemSlotEl, itemDetails, btn, skinPreview, clsBadge, fill } from './dom.js';
import * as G from '../core/game.js';
import { CLASSES } from '../data/classes.js';
import { SLOT_NAMES } from '../data/items.js';
import { PET_BY_ID, petBonusText } from '../data/pets.js';
import { leagueOf, LEAGUES } from '../core/world.js';
import { fmt } from '../core/util.js';
import { fighterPower, HP_MULT } from '../core/formulas.js';

const DOLL_LEFT = ['helmet', 'armor', 'gloves', 'boots'];
const DOLL_RIGHT = ['weapon', 'ring', 'amulet'];

// id gracza z serwera albo 'me' (jak widzą Cię inni)
export async function openProfile(app, id) {
  const body = h('div', { class: 'pv' }, h('div', { class: 'muted center' }, 'Wczytywanie profilu…'));
  const m = app.modal('Profil gracza', body, { cls: 'wide' });
  let row, items, pet, fighter;
  try {
    if (id === 'me') {
      const p = G.netProfile();
      row = { id: 'me', ...p, guild_id: null };
      items = Object.fromEntries(Object.entries(G.P.equip).filter(([, it]) => it));
      pet = p.pet;
      fighter = G.Net.fighterFromRow({ ...row, fighter: p.fighter });
    } else {
      row = await G.Net.getPlayerProfile(id);
      items = G.Net.itemsFromRow(row);
      pet = G.Net.petFromRow(row);
      fighter = G.Net.fighterFromRow(row);
    }
  } catch (e) {
    console.error('Profil gracza', e);
    body.replaceChildren(h('div', { class: 'arena-empty' }, h('b', {}, 'Nie udało się wczytać profilu'), h('div', { class: 'muted' }, e.message)));
    return m;
  }
  if (!m.el.isConnected) return m;
  const C = CLASSES[row.cls] || CLASSES.warrior;
  const lg = LEAGUES[leagueOf(Number(row.rating) || 1000)];
  const guild = row.guild_id ? (G.Net.Net.guilds.find((g) => g.id === row.guild_id)?.name || 'gildia') : null;
  const showItem = (it) => {
    const mine = G.P.equip[it.slot];
    app.modal(SLOT_NAMES[it.slot], h('div', { class: 'cmp-grid' },
      h('div', {}, h('div', { class: 'cmp-lbl' }, `Przedmiot gracza ${row.name}`), itemDetails(it, id === 'me' ? null : G.compare(it))),
      mine && id !== 'me' ? h('div', { class: 'cmp' }, h('div', { class: 'cmp-lbl' }, 'Twój założony:'), itemDetails(mine)) : null), { cls: 'narrow' });
  };
  const slotEl = (slot) => {
    const it = items[slot];
    return h('div', { class: 'doll-slot' },
      itemSlotEl(it || null, { ghost: slot, empty: SLOT_NAMES[slot], noTitle: true, compare: id !== 'me', onclick: () => it && showItem(it) }),
      h('span', { class: 'doll-lbl' }, SLOT_NAMES[slot]));
  };
  const P = pet && PET_BY_ID[pet.id];
  const hero = h('div', { class: 'doll-hero', style: { backgroundImage: 'url(./assets/bg/armory.jpg)' } },
    h('div', { class: 'doll-plate' }, h('span', { class: 'doll-lv' }, row.lvl), C.name),
    h('div', { class: 'pv-skin' }, skinPreview(row.cls, row.look, row.hue, row.skin, 300)),
    P ? h('img', { class: 'doll-pet', src: `./assets/pets/${P.img}.webp`, alt: P.name, title: `${P.name} (poz. ${pet.lvl})` }) : null,
    h('div', { class: 'doll-pow' }, uiIcon('swords', 'ico'), 'Siła ', h('b', {}, fmt(Number(row.power) || fighterPower(fighter)))));
  const doll = h('div', { class: 'doll' },
    h('div', { class: 'doll-col' }, DOLL_LEFT.map(slotEl)),
    hero,
    h('div', { class: 'doll-col' }, DOLL_RIGHT.map(slotEl), h('div', { class: 'doll-slot spacer' })));
  const tile = (label, v, cls = '') => h('div', { class: 'stile ' + cls }, h('span', {}, label), h('b', {}, v));
  const hp = Math.round(fighter.maxHp / HP_MULT);
  fill(body, 
    h('div', { class: 'pv-head' },
      clsBadge(row.cls),
      h('div', {}, h('h3', {}, row.name), h('div', { class: 'muted' }, `${C.name} · poziom ${row.lvl}${guild ? ' · ' + guild : ''}`)),
      h('div', { class: 'pv-tags' },
        h('span', { class: 'league small', style: { background: lg.color } }, lg.name),
        h('span', { class: 'pv-tag' }, '🏆 ', fmt(Number(row.rating) || 1000)),
        h('span', { class: 'pv-tag' }, '🌀 Otchłań: ', fmt(Number(row.abyss) || 0)),
        fighter.aw ? h('span', { class: 'pv-tag awk' }, `✦ Przebudzenia: ${Math.min(6, Math.floor(Number(row.fighter?.awak) || 0))}`) : null)),
    h('div', { class: 'eqv' }, doll),
    h('div', { class: 'stiles' },
      tile('Życie', fmt(hp), 'hp'), tile('Obrażenia', `${fmt(fighter.dmgMin)}–${fmt(fighter.dmgMax)}`, 'dmg'), tile('Pancerz', fmt(fighter.armor), 'arm'),
      tile('Krytyk', fighter.crit.toFixed(1) + '%'), tile('Unik', fighter.dodge.toFixed(1) + '%'), fighter.block ? tile('Blok', fighter.block + '%') : tile('Odporność', (fighter.resist || 0).toFixed(0) + '%')),
    P ? h('div', { class: 'pv-pet' }, h('img', { src: `./assets/pets/${P.img}.webp`, alt: '' }), h('div', {}, h('b', {}, `${P.name} · poz. ${pet.lvl}`), h('div', { class: 'muted' }, petBonusText(pet.id, pet.lvl)))) : null,
    h('div', { class: 'tip' }, id === 'me' ? 'Tak widzą Cię inni gracze (dane odświeżają się co minutę).' : '💡 Najedź na przedmiot, aby porównać go ze swoim ekwipunkiem; kliknij, aby zobaczyć szczegóły.'),
    id !== 'me' && G.Net.isOnline() ? h('div', { class: 'row center gap' }, btn(G.isMuted(row.id) ? 'Cofnij wyciszenie' : 'Wycisz na czacie', () => { G.toggleMute(row.id, row.name); m.close(); }, 'ghost small')) : null);
  return m;
}
