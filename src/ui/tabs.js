// Pięć głównych zakładek
import { h, icon, uiIcon, itemSlotEl, itemDetails, bar, btn, heroLook, clsBadge, skinPreview, vipTag } from './dom.js';
import { VIP } from '../data/vip.js';
import { sfx } from './audio.js';
import * as G from '../core/game.js';
import * as Panels from './panels.js';
import { openProfile } from './profile.js';
import { CLASSES, STATS, STAT_NAMES, STAT_HINT, SKILLS, TALENTS, TALENT_MAX, OUTFIT_HUES, AURA_COLORS, SKINS, outfitSwatch } from '../data/classes.js';
import { SLOTS, SLOT_NAMES, RARITIES } from '../data/items.js';
import { PETS, PET_BY_ID, PET_MAX_LVL, petBonusText } from '../data/pets.js';
import { ENEMIES, BOSSES, DUNGEONS, LOCATIONS } from '../data/enemies.js';
import { fmt, fmtTime, weekEnd, nextMidnight } from '../core/util.js';
import { AWAKEN_LEVELS, ROMAN, TRIALS, TRIAL_PHASES, TRIAL_ATTEMPTS } from '../data/awakening.js';
import { enemyFighter, botFighter, powerOf, HP_MULT, playerFighter, fighterPower } from '../core/formulas.js';
import { leagueOf, LEAGUES, worldBossInfo } from '../core/world.js';

export const TABS = [
  { id: 'adventures', name: 'Przygody', icon: 'ui_07' },
  { id: 'character', name: 'Postać', icon: 'armor_05' },
  { id: 'dungeons', name: 'Lochy', icon: 'ui_08' },
  { id: 'arena', name: 'Arena', icon: 'ui_09' },
  { id: 'guild', name: 'Gildia', icon: 'ui_10' },
];

const fPower = (f) => fighterPower(f);
const onlineDot = () => h('span', { class: 'online-dot', title: 'Prawdziwy gracz online' });
const skipLabel = () => { const c = G.skipQuestCost(); return c ? `Przyspiesz (${c} 💎)` : 'Przyspiesz (gratis!)'; };
function difficulty(enemyPow) {
  const r = enemyPow / Math.max(1, G.power());
  if (r < 0.75) return { t: 'Łatwy', c: 'easy' };
  if (r < 1.0) return { t: 'Wyrównany', c: 'mid' };
  if (r < 1.25) return { t: 'Trudny', c: 'hard' };
  return { t: 'Bardzo trudny', c: 'vhard' };
}
const diffTag = (pow) => { const d = difficulty(pow); return h('span', { class: 'diff ' + d.c }, `${d.t} · ${fmt(pow)}`); };
const subtabs = (app, tab, list, def) => {
  const cur = app.sub[tab] || def;
  return { cur, el: h('div', { class: 'subtabs' }, list.map(([id, name]) => h('button', { class: 'st' + (id === cur ? ' sel' : ''), onclick: () => { sfx('click', 0.3); app.setSub(tab, id); } }, name))) };
};
const head = (title, sub, extra) => h('div', { class: 'ph' }, h('div', { class: 'ph-row' }, h('h2', {}, title), extra || null), sub || null);

export function renderTab(app, id) {
  switch (id) {
    case 'adventures': return adventures(app);
    case 'character': return character(app);
    case 'dungeons': return dungeons(app);
    case 'arena': return arena(app);
    case 'guild': return guild(app);
  }
}

// ——— PRZYGODY ———
function adventures(app) {
  const P = G.P;
  const q = P.quest.active;
  const body = h('div', { class: 'tab-adv' });
  let live = null;
  if (q) {
    const e = ENEMIES[q.enemy];
    const prog = h('div', { class: 'qprog' }, bar(0, 'quest'), h('div', { class: 'qtime' }));
    const actions = h('div', { class: 'row gap wrap' });
    const card = h('div', { class: 'qcard active', style: { backgroundImage: `url(./assets/bg/${q.loc}.jpg)` } },
      h('div', { class: 'qc-shade' }),
      h('div', { class: 'qc-in' },
        h('div', { class: 'qc-loc' }, LOCATIONS[q.loc]),
        h('h3', {}, q.title), h('p', {}, q.desc),
        h('div', { class: 'qc-enemy' }, h('img', { src: `./assets/enemies/${e.img}.webp` }), h('div', {}, h('b', {}, 'Na końcu czeka: ', e.name), h('div', { class: 'muted' }, e.desc))),
        prog, actions));
    const upd = () => {
      const now = Date.now();
      const f = Math.min(1, (now - q.start) / (q.end - q.start));
      prog.querySelector('.bar-fill').style.width = f * 100 + '%';
      const done = now >= q.end;
      prog.querySelector('.qtime').textContent = done ? 'Przygoda ukończona! Czas na walkę.' : `Pozostało: ${fmtTime(q.end - now)}`;
      if (done !== upd.done) {
        upd.done = done;
        actions.replaceChildren(...(done
          ? [btn('⚔ Walcz i odbierz nagrody', () => app.fight(() => G.questBattle()), 'primary big', { id: 'btn-quest-fight' })]
          : [btn(skipLabel(), () => G.skipQuest(), 'gold', { id: 'btn-quest-skip' }), btn('Anuluj', () => G.cancelQuest(), 'ghost')]));
      } else if (!done) {
        const sb = actions.querySelector('#btn-quest-skip'); if (sb) sb.textContent = skipLabel();
      }
    };
    upd(); live = upd;
    body.append(card, h('div', { class: 'tip' }, '💡 Przygoda trwa dalej, nawet gdy zamkniesz grę. Wróć i odbierz łupy!'),
      h('div', { class: 'reward-line' }, h('span', {}, uiIcon('star', 'ico'), fmt(q.exp), ' EXP'), h('span', {}, uiIcon('gold', 'ico'), fmt(q.gold), ' zł'), h('span', {}, uiIcon('chest', 'ico'), Math.round(q.itemChance * 100), '% łup'), q.rare ? h('span', { class: 'rare' }, '★ ', q.rare.cr ? `${q.rare.cr} kryształów` : 'Epicki przedmiot') : null));
  } else {
    body.append(h('div', { class: 'qlist' }, P.quest.offers.map((o, i) => {
      const e = ENEMIES[o.enemy];
      const ef = G.questEnemy(o);
      return h('div', { class: 'qcard', style: { backgroundImage: `url(./assets/bg/${o.loc}.jpg)` } },
        h('div', { class: 'qc-shade' }),
        h('div', { class: 'qc-in' },
          h('div', { class: 'qc-top' }, h('span', { class: 'qc-loc' }, LOCATIONS[o.loc]), h('span', { class: 'qc-time' }, uiIcon('hourglass', 'ico'), fmtTime(G.questDuration(o)))),
          h('h3', {}, o.title, o.rare ? h('span', { class: 'rare' }, ' ★') : null),
          h('p', {}, o.desc),
          h('div', { class: 'reward-line' },
            h('span', {}, uiIcon('star', 'ico'), fmt(o.exp), ' EXP'), h('span', {}, uiIcon('gold', 'ico'), fmt(o.gold)),
            h('span', {}, uiIcon('chest', 'ico'), Math.round(o.itemChance * 100), '%'),
            o.rare ? h('span', { class: 'rare' }, '★ ', o.rare.cr ? `+${o.rare.cr} 💎` : 'Epicki łup') : null),
          h('div', { class: 'qc-bottom' },
            h('div', { class: 'qc-foe' }, h('img', { src: `./assets/enemies/${e.img}.webp` }), h('span', {}, e.name), diffTag(fPower(ef))),
            btn(h('span', {}, 'Wyrusz ', h('small', {}, `⚡${o.energy}`)), () => { sfx('click'); G.startQuest(i); }, 'primary', { 'data-quest': i }))));
    })),
    h('div', { class: 'row gap wrap center' },
      btn(`Nowe zlecenia (${fmt(G.rerollCost())} zł)`, () => G.rerollOffers(), 'ghost small'),
      P.energy < 30 ? btn('Uzupełnij energię (20 💎)', () => G.buyEnergy(), 'gold small') : null),
    h('div', { class: 'tip' }, '💡 Krótkie przygody (1–3 min) dają szybkie nagrody, długie (6–10 min) – większe łupy. Energia odnawia się 1 pkt / 6 min.'));
  }
  return { head: head('Przygody', null, h('div', { class: 'energy-pill' }, uiIcon('energy', 'ico'), `${P.energy}/${G.ENERGY_MAX}`)), body, live };
}

// ——— POSTAĆ ———
function character(app) {
  const P = G.P;
  const awkReady = G.trialUnlocked() && G.trialAttemptsLeft() > 0;
  const st = subtabs(app, 'character', [['equip', 'Ekwipunek'], ['stats', 'Statystyki'], ['talents', 'Talenty'], ['skills', 'Umiejętności'], ['awaken', awkReady ? 'Przebudzenie ⚔' : 'Przebudzenie'], ['pets', P.pets.eggs > 0 ? `Pety 🥚${P.pets.eggs}` : 'Pety'], ['look', 'Wygląd']], 'equip');
  let body, live = null;
  if (st.cur === 'equip') body = equipView(app);
  else if (st.cur === 'stats') body = statsView(app);
  else if (st.cur === 'talents') body = talentsView(app);
  else if (st.cur === 'skills') body = skillsView(app);
  else if (st.cur === 'awaken') ({ body, live } = awakenView(app));
  else if (st.cur === 'pets') body = petsView(app);
  else body = lookView(app);
  return { head: head(`${P.name}`, st.el, h('div', { class: 'pow-pill' }, uiIcon('swords', 'ico'), 'Siła ', h('b', {}, fmt(G.power())))), body, live };
}
// ——— Przebudzenia: oś 6 progów + boss Próby z pulą PŻ rozłożoną na kilka dni ———
function awakenView(app) {
  const P = G.P;
  const k = G.nextAwakening();
  const trial = G.ensureTrial();
  const skills = G.awakeningSkills();
  const awak = P.awak || 0;
  const track = h('div', { class: 'awk-track' }, AWAKEN_LEVELS.map((L, i) => {
    const s = skills[i];
    const state = s.owned ? 'done' : i === k ? (P.lvl >= L ? 'ready' : 'next') : 'locked';
    const status = { done: '✔ Zdobyte', ready: '⚔ Próba trwa', next: `🔒 poz. ${L}`, locked: `🔒 poz. ${L}` }[state];
    return h('div', { class: 'awk-node ' + state },
      h('div', { class: 'awk-rn', style: state === 'done' || state === 'ready' ? { background: TRIALS[i].glow } : {} }, ROMAN[i]),
      h('div', { class: 'awk-lv' }, `Poz. ${L}`),
      h('b', {}, s.name),
      h('span', { class: 'awk-st' }, status));
  }));
  const intro = h('div', { class: 'pts-box awk-intro' },
    h('div', {}, h('b', {}, `Przebudzenia: ${awak}/${AWAKEN_LEVELS.length}`), h('div', { class: 'muted' }, Number.isFinite(G.levelCap(P)) ? `Limit poziomu: ${G.levelCap(P)}` : 'Limit poziomu: brak – rozwój bez końca')),
    h('div', { class: 'muted' }, 'Każde Przebudzenie: nowa umiejętność klasy, +7% siły i +10 do limitu poziomu.'));
  const blocked = G.expBlocked()
    ? h('div', { class: 'awk-block' }, '⛔ ', h('b', {}, `Poziom ${P.lvl} – próg Przebudzenia. `), P.exp >= G.expNext(P.lvl) ? 'Pasek EXP jest pełny – nadmiar przepada. ' : 'EXP zbiera się tylko do pełnego paska. ', 'Pokonaj bossa Próby, aby awansować dalej.')
    : null;
  let card, reward = null, log = null, live = null;
  if (k === null) {
    card = h('div', { class: 'awk-done' }, h('div', { class: 'awk-rn big', style: { background: TRIALS[5].glow } }, 'VI'),
      h('div', {}, h('h3', {}, 'Wszystkie Przebudzenia ukończone!'), h('div', { class: 'muted' }, 'Osiągnąłeś pełnię mocy Przebudzeń – od teraz poziomy rosną bez limitu, a Otchłań (Lochy) czeka z 2000 piętrami. Skórka „Przebudzony” czeka w zakładce Wygląd.')));
  } else {
    const T = TRIALS[k], B = BOSSES[T.boss], S = skills[k];
    const glowImg = { filter: `drop-shadow(0 0 14px ${T.glow}) drop-shadow(0 0 4px ${T.glow}) drop-shadow(3px 3px 0 #000)` };
    if (trial) {
      const frac = trial.hp / trial.maxHp;
      const ph = G.trialPhase();
      const left = G.trialAttemptsLeft();
      const eta = G.trialEtaDays();
      const resetEl = h('b', {});
      live = () => { resetEl.textContent = fmtTime(nextMidnight() - Date.now()); };
      live();
      card = h('div', { class: 'wb-card trial-card', style: { backgroundImage: `url(./assets/bg/${B.bg}.jpg)` } },
        h('div', { class: 'qc-shade' }),
        h('img', { class: 'wb-img trial-boss', src: `./assets/bosses/${B.img}.webp`, style: glowImg }),
        h('div', { class: 'wb-in' },
          h('div', { class: 'qc-loc' }, `Przebudzenie ${ROMAN[k]} · ${T.name}`),
          h('h3', {}, T.title),
          h('div', { class: 'muted' }, `„${B.quote}”`),
          h('div', { class: 'wb-hp' }, bar(frac, 'boss trial'), h('span', {}, `${fmt(trial.hp)} / ${fmt(trial.maxHp)} PŻ · ${Math.ceil(frac * 100)}%`)),
          h('div', { class: 'trial-phase ph' + ph }, TRIAL_PHASES[ph].name, ph > 0 ? ` · boss zadaje +${Math.round((TRIAL_PHASES[ph].dmg - 1) * 100)}% obrażeń` : ' · PŻ bossa nie odnawiają się'),
          h('div', { class: 'row gap wrap' }, h('span', { class: 'trial-att' }, `Ataki dziś: ${left}/${TRIAL_ATTEMPTS}`), h('span', {}, 'Odnowa za: ', resetEl)),
          h('div', { class: 'muted' }, `🛡 Bariera Próby: maks. ${fmt(G.trialAttackCap())} obrażeń zaliczanych na atak`),
          h('div', { class: 'muted' }, eta === 0 ? 'Dzisiejsze ataki mogą wystarczyć, by go pokonać!' : `Szacowany czas: ~${eta} ${eta === 1 ? 'dzień' : 'dni'} (${TRIAL_ATTEMPTS} ataki dziennie)`),
          btn(left > 0 ? `⚔ Atakuj (${left}/${TRIAL_ATTEMPTS})` : 'Wróć jutro', () => app.fight(() => G.trialAttack()), 'primary', { disabled: left <= 0 || undefined, id: 'btn-trial' })));
      const recent = trial.log.slice(-5).reverse();
      log = recent.length ? h('div', {}, h('div', { class: 'sec-head' }, h('h4', {}, 'Twoje ostatnie ataki')),
        h('div', { class: 'lb small' }, recent.map((x) => h('div', { class: 'lb-row' },
          h('span', { class: 'muted' }, new Date(x.t).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })),
          h('span', { class: 'lb-name' }, `${Math.max(0.1, (x.dmg / trial.maxHp) * 100).toFixed(1)}% PŻ bossa`), h('b', {}, fmt(x.dmg)))))) : null;
    } else {
      const L = AWAKEN_LEVELS[k];
      card = h('div', { class: 'wb-card trial-card locked', style: { backgroundImage: `url(./assets/bg/${B.bg}.jpg)` } },
        h('div', { class: 'qc-shade' }),
        h('img', { class: 'wb-img trial-boss', src: `./assets/bosses/${B.img}.webp` }),
        h('div', { class: 'wb-in' },
          h('div', { class: 'qc-loc' }, `Przebudzenie ${ROMAN[k]} · ${T.name}`),
          h('h3', {}, T.title),
          h('div', { class: 'muted' }, `Próba otworzy się na ${L} poziomie. Brakuje Ci ${L - P.lvl} ${L - P.lvl === 1 ? 'poziomu' : 'poziomów'}.`),
          h('div', { class: 'wb-hp' }, bar(P.lvl / L, 'exp'), h('span', {}, `Poziom ${P.lvl} / ${L}`)),
          h('div', { class: 'muted' }, `Boss Próby ma ogromną pulę PŻ – pokonanie go zajmie kilka dni (ok. ${T.days}–${T.days + 1}).`)));
    }
    reward = h('div', {},
      h('div', { class: 'sec-head' }, h('h4', {}, `Nagroda za Przebudzenie ${ROMAN[k]}`)),
      h('div', { class: 'awk-reward' },
        h('div', { class: 'awk-skill' }, h('div', { class: 'awk-rn', style: { background: T.glow } }, ROMAN[k]),
          h('div', {}, h('div', { class: 'muted' }, `Umiejętność klasy: ${CLASSES[P.cls].name}`), h('b', {}, S.name), h('div', {}, S.desc))),
        h('div', { class: 'reward-line' },
          h('span', {}, uiIcon('swords', 'ico'), '+7% siły'),
          k < AWAKEN_LEVELS.length - 1 ? h('span', {}, uiIcon('star', 'ico'), `limit poziomu ${AWAKEN_LEVELS[k] + 10}`) : null,
          h('span', {}, uiIcon('crystal', 'ico'), T.cr),
          h('span', {}, uiIcon('legendChest', 'ico'), 'legendarny łup'),
          k === AWAKEN_LEVELS.length - 1 ? h('span', { class: 'rare' }, '★ skórka „Przebudzony”') : null)));
  }
  const body = h('div', { class: 'awk' }, intro, blocked, track, card, reward, log,
    h('div', { class: 'tip' }, `💡 Boss Próby nie odzyskuje PŻ między walkami. Masz ${TRIAL_ATTEMPTS} ataki dziennie (odnowa o północy). W każdej walce liczą się zadane obrażenia – przy 75%, 50% i 25% PŻ boss wchodzi w kolejne, groźniejsze fazy. Lepszy ekwipunek i talenty skracają Próbę.`));
  return { body, live };
}
// „Lalka postaci”: sloty po bokach portretu, kafelki statystyk, plecak; wszystko obsługuje przeciąganie (dragdrop.js)
const DOLL_LEFT = ['helmet', 'armor', 'gloves', 'boots'];
const DOLL_RIGHT = ['weapon', 'ring', 'amulet'];
function equipView(app) {
  const P = G.P;
  const s = G.stats();
  const slotEl = (slot) => {
    const it = P.equip[slot];
    return h('div', { class: 'doll-slot' + (app.justEquipped === slot ? ' just' : ''), 'data-drop': 'slot', 'data-slot': slot },
      itemSlotEl(it, { ghost: slot, empty: SLOT_NAMES[slot], onclick: () => it && !app.dragBlock && app.showItem(it), attrs: it ? { 'data-uid': it.uid, 'data-src': 'equip', 'data-slot': slot } : {} }),
      h('span', { class: 'doll-lbl' }, SLOT_NAMES[slot]));
  };
  app.justEquipped = null;
  const C = CLASSES[P.cls];
  const look = C.looks[P.look || 0];
  const hue = OUTFIT_HUES[P.hue || 0]?.hue || 0;
  const pet = P.pets.active && PET_BY_ID[P.pets.active];
  const doll = h('div', { class: 'doll' },
    h('div', { class: 'doll-col' }, DOLL_LEFT.map(slotEl)),
    h('div', { class: 'doll-hero', style: { backgroundImage: 'url(./assets/bg/armory.jpg)' } },
      h('div', { class: 'doll-plate' }, h('span', { class: 'doll-lv' }, P.lvl), C.name),
      h('img', { class: 'doll-img', src: `./assets/heroes/${look}.webp`, alt: '', draggable: 'false', style: { filter: hue ? `hue-rotate(${Math.round(hue * 360)}deg)` : '' } }),
      pet ? h('img', { class: 'doll-pet', src: `./assets/pets/${pet.img}.webp`, alt: pet.name, title: `${pet.name} (poz. ${P.pets.owned[pet.id]}) · ${petBonusText(pet.id, P.pets.owned[pet.id])}`, draggable: 'false', onclick: () => app.setSub('character', 'pets') }) : null,
      h('div', { class: 'doll-pow' }, uiIcon('swords', 'ico'), 'Siła ', h('b', {}, fmt(G.power())))),
    h('div', { class: 'doll-col' }, DOLL_RIGHT.map(slotEl), h('div', { class: 'doll-slot spacer' })));
  const tile = (label, v, cls = '') => h('div', { class: 'stile ' + cls }, h('span', {}, label), h('b', {}, v));
  const tiles = h('div', { class: 'stiles' },
    tile('Życie', fmt(s.hp), 'hp'), tile('Obrażenia', `${fmt(s.dmgMin)}–${fmt(s.dmgMax)}`, 'dmg'), tile('Pancerz', fmt(s.armor), 'arm'),
    tile('Krytyk', s.crit.toFixed(1) + '%'), tile('Unik', s.dodge.toFixed(1) + '%'), s.block ? tile('Blok', s.block + '%') : tile('Odporność', s.resist.toFixed(0) + '%'));
  const bag = h('div', { class: 'bag', 'data-drop': 'bag' },
    P.bag.map((it) => itemSlotEl(it, { onclick: () => !app.dragBlock && app.showItem(it), delta: G.compare(it), attrs: { 'data-uid': it.uid, 'data-src': 'bag', 'data-slot': it.slot } })),
    Array.from({ length: Math.max(0, G.bagSize() - P.bag.length) }, () => h('div', { class: 'islot rx empty' })));
  return h('div', { class: 'eqv' },
    doll, tiles,
    h('div', { class: 'sec-head' }, h('h4', {}, `Plecak ${P.bag.length}/${G.bagSize()}`, G.isVip() ? h('span', { class: 'vip-tag', title: `VIP: +${VIP.bag} miejsc w plecaku` }, `VIP +${VIP.bag}`) : null),
      h('div', { class: 'row gap' }, btn('Załóż najlepsze', () => G.autoEquip(), 'primary small', { id: 'btn-autoequip' }), btn('Sprzedaj zbędne', () => G.sellJunk(), 'ghost small'))),
    bag,
    h('div', { class: 'drop-sell', 'data-drop': 'sell' }, uiIcon('gold', 'ico'), 'Upuść tutaj, aby sprzedać'),
    h('div', { class: 'tip' }, '✋ Przeciągnij przedmiot na slot postaci, aby go założyć (na telefonie: przytrzymaj i przesuń). Przeciągnij założony przedmiot do plecaka, aby go zdjąć. ▲ = zwiększy Twoją siłę. 🖱 Najedź myszą na przedmiot, aby porównać go z założonym.'));
}
// ——— Pety: kolekcja, aktywny towarzysz, wykluwanie jaj ———
function petsView(app) {
  const P = G.P;
  const active = P.pets.active && PET_BY_ID[P.pets.active];
  const hatch = () => {
    const r = G.hatchEgg();
    if (!r) return;
    const R = RARITIES[r.pet.rarity];
    sfx(r.pet.rarity >= 4 ? 'levelup' : 'chest', 0.8);
    let m;
    m = app.modal('Wykluwanie!', h('div', { class: 'center hatch' },
      h('div', { class: 'hatch-burst', style: { '--rc': R.color } }, h('img', { class: 'hatch-pet', src: `./assets/pets/${r.pet.img}.webp`, alt: r.pet.name })),
      h('div', { class: 'loot-tag', style: { background: R.color } }, R.name),
      h('h3', {}, r.pet.name),
      h('div', {}, r.isNew ? 'Nowy towarzysz w kolekcji!' : r.up ? `Duplikat – ${r.pet.name} awansuje na poziom ${r.lvl}!` : `Duplikat na maks. poziomie – otrzymujesz ${r.cr} 💎.`),
      h('div', { class: 'muted' }, petBonusText(r.pet.id, r.lvl)),
      h('div', { class: 'row center gap' },
        P.pets.active !== r.pet.id ? btn('Ustaw jako aktywnego', () => { G.setActivePet(r.pet.id); m.close(); }, 'primary') : null,
        btn('Super!', () => m.close(), P.pets.active === r.pet.id ? 'primary' : ''))), { cls: 'narrow' });
  };
  return h('div', { class: 'pets' },
    h('div', { class: 'pts-box pet-top' },
      h('div', { class: 'row gap' }, uiIcon('egg', 'big-ico'), h('div', {}, h('b', {}, `Jaja: ${P.pets.eggs}`), h('div', { class: 'muted' }, 'Jaja zdobywasz w Otchłani (co 50 pięter), z koła fortuny i w sklepie.'))),
      h('div', { class: 'row gap' },
        btn('🥚 Wykluj', hatch, 'primary', { disabled: P.pets.eggs <= 0 || undefined, id: 'btn-hatch' }),
        btn('Sklep', () => Panels.openShop(app, 'crystal'), 'ghost small'))),
    active ? h('div', { class: 'pet-active' }, h('img', { src: `./assets/pets/${active.img}.webp`, alt: '' }),
      h('div', {}, h('div', { class: 'muted' }, 'Aktywny towarzysz'), h('b', {}, `${active.name} · poz. ${P.pets.owned[active.id]}/${PET_MAX_LVL}`), h('div', {}, petBonusText(active.id, P.pets.owned[active.id])))) : h('div', { class: 'tip' }, 'Nie masz jeszcze aktywnego peta – wykluj jajo!'),
    h('div', { class: 'pet-grid' }, PETS.map((p) => {
      const lvl = P.pets.owned[p.id] || 0;
      const R = RARITIES[p.rarity];
      return h('div', { class: 'pet-card' + (lvl ? '' : ' locked') + (P.pets.active === p.id ? ' sel' : ''), style: { '--rc': R.color } },
        h('div', { class: 'pet-img' }, h('img', { src: `./assets/pets/${p.img}.webp`, alt: p.name })),
        h('div', { class: 'pet-rar', style: { color: R.color } }, R.name),
        h('b', {}, p.name),
        h('div', { class: 'muted' }, lvl ? `Poziom ${lvl}/${PET_MAX_LVL}` : '??? – nieodkryty'),
        h('div', { class: 'pet-bonus' }, petBonusText(p.id, Math.max(1, lvl))),
        lvl ? (P.pets.active === p.id ? btn('Aktywny', () => G.setActivePet(null), 'small', { title: 'Kliknij, aby schować peta' }) : btn('Wybierz', () => { G.setActivePet(p.id); sfx('click'); }, 'primary small', { 'data-pet': p.id })) : h('div', { class: 'muted pet-desc' }, p.desc));
    })),
    h('div', { class: 'tip' }, '💡 Pety dają wyłącznie bonusy pasywne (nie walczą). Duplikat z jaja podnosi poziom peta (+20% bonusu za poziom, maks. 10). Pet chodzi obok bohatera i widzą go inni gracze.'));
}
const row = (k, v) => h('div', { class: 'srow' }, h('span', {}, k), h('b', {}, v));
function statsView(app) {
  const P = G.P;
  const s = G.stats();
  const C = CLASSES[P.cls];
  return h('div', {},
    h('div', { class: 'pts-box' }, h('div', {}, 'Wolne punkty: ', h('b', { class: P.pts ? 'hl' : '' }, P.pts)),
      h('div', { class: 'row gap' }, btn('Rozdaj automatycznie', () => G.autoAllocate(), 'primary small', { disabled: !P.pts || undefined }),
        h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: P.autoStats || undefined, onchange: (e) => { P.autoStats = e.target.checked; G.save(); if (P.autoStats) G.autoAllocate(); } }), ' Auto przy awansie'))),
    h('div', { class: 'stat-list' }, STATS.map((k) => h('div', { class: 'stat' + (k === C.main ? ' main' : '') },
      h('div', { class: 'stat-n' }, h('b', {}, STAT_NAMES[k]), k === C.main ? h('span', { class: 'tag' }, 'główna') : null, h('div', { class: 'muted' }, STAT_HINT[k])),
      h('div', { class: 'stat-v' }, fmt(s.tot[k])),
      h('div', { class: 'row gap' }, btn('+1', () => G.allocate(k, 1), 'small', { disabled: !P.pts || undefined }), btn('+5', () => G.allocate(k, 5), 'small ghost', { disabled: P.pts < 5 || undefined }))))),
    h('div', { class: 'sum two' },
      row('Punkty życia', fmt(s.hp)), row('Obrażenia', `${fmt(s.dmgMin)}–${fmt(s.dmgMax)}`), row('Pancerz', fmt(s.armor)), row('Szansa na krytyk', s.crit.toFixed(1) + '%'),
      row('Obrażenia kryt.', Math.round(s.critDmg * 100) + '%'), row('Unik', s.dodge.toFixed(1) + '%'), row('Odporność na magię', s.resist.toFixed(1) + '%'),
      s.leech ? row('Kradzież życia', s.leech + '%') : null, row('Bonus złota', '+' + Math.round(s.goldPct) + '%'), row('Bonus EXP', '+' + Math.round(s.expPct) + '%')),
    h('div', { class: 'row center' }, btn('Resetuj statystyki (20 💎)', () => G.resetStats(), 'ghost small')));
}
function talentsView(app) {
  const P = G.P;
  const used = G.talentPointsUsed(), tot = G.talentPointsTotal();
  const branches = ['Atak', 'Obrona', 'Fortuna'];
  return h('div', {},
    h('div', { class: 'pts-box' }, h('div', {}, 'Punkty talentów: ', h('b', { class: tot - used ? 'hl' : '' }, `${tot - used}`), ` / ${tot}`, h('span', { class: 'muted' }, ' (1 punkt co 2 poziomy)')),
      btn(`Reset (${fmt(200 + P.lvl * 20)} zł)`, () => G.resetTalents(), 'ghost small')),
    h('div', { class: 'tal-grid' }, branches.map((b) => h('div', { class: 'tal-col' }, h('h4', {}, b),
      TALENTS.filter((t) => t.branch === b).map((t) => {
        const r = P.talents[t.id] || 0;
        return h('button', { class: 'tal' + (r ? ' on' : '') + (r >= TALENT_MAX ? ' max' : ''), onclick: () => { G.learnTalent(t.id); sfx('click', 0.4); } },
          h('div', { class: 'tal-n' }, t.name), h('div', { class: 'tal-d' }, `+${t.per}${t.unit} / rangę`),
          h('div', { class: 'tal-r' }, Array.from({ length: TALENT_MAX }, (_, i) => h('i', { class: i < r ? 'on' : '' }))));
      })))));
}
function skillsView(app) {
  const P = G.P;
  return h('div', { class: 'skill-list' }, SKILLS[P.cls].map((s) => h('div', { class: 'skill' + (P.lvl >= s.lvl ? ' on' : '') },
    h('div', { class: 'sk-lvl' }, P.lvl >= s.lvl ? '✔' : s.lvl),
    h('div', {}, h('b', {}, s.name), h('div', { class: 'muted' }, s.desc), P.lvl < s.lvl ? h('div', { class: 'lock' }, `Odblokowanie na ${s.lvl} poziomie`) : null))),
    h('div', { class: 'sec-head' }, h('h4', {}, `Umiejętności Przebudzenia (${P.awak || 0}/${AWAKEN_LEVELS.length})`),
      btn('Próby Przebudzenia →', () => app.setSub('character', 'awaken'), 'ghost small')),
    G.awakeningSkills().map((s, i) => h('div', { class: 'skill awk-sk' + (s.owned ? ' on' : '') },
      h('div', { class: 'sk-lvl', style: s.owned ? { background: TRIALS[i].glow, color: '#1e1b24' } : {} }, s.roman),
      h('div', {}, h('b', {}, s.name), h('div', { class: 'muted' }, s.desc), s.owned ? null : h('div', { class: 'lock' }, `Przebudzenie ${s.roman}: Próba od ${s.lvl} poziomu`)))),
    h('div', { class: 'tip' }, '💡 Umiejętności używane są automatycznie podczas walki.'));
}
function lookView(app) {
  const P = G.P;
  const tier = G.appearanceTier();
  const tiers = [[10, 'Iskry aury'], [25, 'Krąg run pod stopami'], [50, 'Kolumna światła'], [80, 'Złota poświata legendy']];
  return h('div', {},
    h('label', { class: 'lbl' }, 'Wariant'),
    h('div', { class: 'row gap' }, [0, 1].map((i) => h('button', { class: 'chip' + (P.look === i ? ' sel' : ''), onclick: () => G.setAppearance({ look: i }) }, i ? 'Wariant II' : 'Wariant I'))),
    h('label', { class: 'lbl' }, 'Kolor stroju'),
    h('div', { class: 'swatches' }, OUTFIT_HUES.map((o, i) => h('button', { class: 'sw' + (P.hue === i ? ' sel' : ''), title: o.name, style: { background: outfitSwatch(P.cls, P.look, i) }, onclick: () => G.setAppearance({ hue: i }) }))),
    h('label', { class: 'lbl' }, 'Kolor aury'),
    h('div', { class: 'swatches' }, AURA_COLORS.map((o, i) => h('button', { class: 'sw' + (P.aura === i ? ' sel' : ''), title: o.name, style: { background: o.c }, onclick: () => G.setAppearance({ aura: i }) }))),
    h('label', { class: 'lbl' }, 'Skórki (kosmetyczne – bez wpływu na siłę)'),
    h('div', { class: 'skins' }, Object.entries(SKINS).map(([id, s]) => {
      const vipSkin = s.src === 'vip';
      const own = vipSkin ? G.isVip() : P.skinsOwned.includes(id);
      return h('div', { class: 'skin' + (P.skin === id ? ' sel' : '') + (own ? '' : ' locked') + (vipSkin ? ' vip' : ''), 'data-skin': id },
        h('div', { class: 'skin-pv' }, skinPreview(P.cls, P.look, P.hue, id, 130), own ? null : h('span', { class: 'skin-lock' }, '🔒'), vipSkin ? h('span', { class: 'vip-tag skin-vip' }, 'VIP') : null),
        h('b', {}, s.name), h('div', { class: 'muted' }, s.desc),
        h('div', { class: 'row gap wrap' },
          own ? btn(P.skin === id ? 'Założona' : 'Załóż', () => G.buySkin(id), 'small', { disabled: P.skin === id || undefined })
            : s.src === 'shop' ? btn(`${s.cost} 💎`, () => G.buySkin(id), 'gold small') : h('span', { class: 'lock' }, vipSkin ? '🔒 Tylko dla VIP' : '🔒 Do zdobycia'),
          P.skin !== id ? btn('👁 Przymierz', () => app.trySkin(id), 'ghost small', { title: 'Podgląd na scenie przez kilka sekund', 'data-try': id }) : null));
    })),
    h('label', { class: 'lbl' }, 'Ewolucja wyglądu wraz z poziomem'),
    h('div', { class: 'tiers' }, tiers.map(([l, t], i) => h('div', { class: 'tierx' + (tier > i ? ' on' : '') }, h('b', {}, `Poz. ${l}`), t))),
    h('div', { class: 'tip' }, 'Broń epicka lub legendarna dodaje poświatę w kolorze rzadkości.'));
}

// ——— LOCHY ———
// Otchłań: nieskończony loch – 2000 pięter od 100 poziomu
function abyssView(app) {
  const P = G.P;
  const A = P.abyss;
  const unlocked = G.abyssUnlocked();
  const f = Math.min(G.ABYSS_FLOORS, A.floor + 1);
  const done = A.floor >= G.ABYSS_FLOORS;
  let foe = null;
  if (unlocked && !done) {
    const { s, B } = G.abyssEnemy(f);
    foe = h('div', { class: 'd-next abyss-foe' }, h('img', { src: `./assets/${s.img}` }),
      h('div', {}, h('div', { class: 'muted' }, `Piętro ${f}${s.boss ? ' – BOSS' : ''} · poziom wroga ${s.L}`), h('b', {}, s.name), diffTag(fPower(B))));
  }
  const ms = G.nextAbyssMilestone();
  // pasek 10 pięter bieżącej dziesiątki
  const base = Math.floor(A.floor / 10) * 10;
  const floors = h('div', { class: 'floors abyss-floors' }, Array.from({ length: 10 }, (_, i) => h('i', { class: (base + i + 1 <= A.floor ? 'on' : '') + (i === 9 ? ' boss' : '') })));
  return h('div', { class: 'abyss' },
    h('div', { class: 'abyss-card' + (unlocked ? '' : ' locked'), style: { backgroundImage: 'url(./assets/bg/abyss.jpg)' } },
      h('div', { class: 'qc-shade' }),
      h('div', { class: 'abyss-in' },
        h('div', { class: 'qc-loc' }, 'Nieskończony Loch'),
        h('h3', {}, 'Otchłań'),
        h('div', { class: 'abyss-floor' }, h('b', {}, fmt(A.floor)), h('span', {}, ` / ${fmt(G.ABYSS_FLOORS)} pięter`)),
        bar(A.floor / G.ABYSS_FLOORS, 'abyss'),
        unlocked ? floors : null,
        unlocked ? foe : h('div', { class: 'muted' }, `Otchłań otwiera się na ${G.ABYSS_REQ} poziomie. Brakuje Ci ${G.ABYSS_REQ - P.lvl} poz.`),
        unlocked ? h('div', { class: 'row gap wrap' },
          done ? h('span', { class: 'done-tag' }, '✔ Otchłań zdobyta!') : btn(`⚔ Walcz (🌀${A.keys})`, () => app.fight(() => G.abyssBattle()), 'primary', { disabled: A.keys <= 0 || undefined, id: 'btn-abyss' }),
          h('span', { class: 'muted' }, `Klucze Otchłani: ${A.keys}/${G.abyssKeysMax()}${G.isVip() ? ` (w tym +${VIP.abyssKeys} VIP)` : ''} (odnowa o północy)`)) : null)),
    ms ? h('div', { class: 'abyss-ms' }, uiIcon('legendChest', 'ico'), h('div', {}, h('b', {}, `Nagroda na piętrze ${ms.floor}: `), ms.rewards.join(' · '))) : null,
    h('div', { class: 'sec-head' }, h('h4', {}, 'Kamienie milowe')),
    h('div', { class: 'abyss-list' },
      [[10, 'co 10 pięter', '5 💎 + epicki łup'], [50, 'co 50 pięter', 'jajo peta'], [100, 'co 100 pięter', 'legendarny łup + 50 💎'], [500, 'od 500. piętra', '35% szans na mityczny co 100 pięter'],
        [1000, 'od 1000. piętra', 'gwarantowany mityczny co 250 pięter'], [500, 'piętro 500', 'skórka „Wędrowiec Otchłani”'], [2000, 'piętro 2000', 'skórka „Władca Otchłani”']]
        .map(([fl, a, b]) => h('div', { class: 'abyss-li' + (A.best >= fl ? ' ok' : '') }, h('b', {}, a), h('span', {}, b)))),
    h('div', { class: 'tip' }, `💡 Każde piętro jest trudniejsze (poziom wroga = 100 + 0,45 × piętro). Przegrana kosztuje tylko klucz – postęp zostaje. Twój rekord: ${fmt(A.best || 0)}. Ranking Otchłani znajdziesz w Rankingach.`));
}
function dungeons(app) {
  const P = G.P;
  const st = subtabs(app, 'dungeons', [['dungeons', 'Lochy'], ['abyss', G.abyssUnlocked() ? `Otchłań 🌀${P.abyss.keys}` : 'Otchłań 🔒'], ['challenges', 'Wyzwania dnia'], ['wboss', 'Boss Światowy']], 'dungeons');
  let body, live = null;
  if (st.cur === 'abyss') {
    body = abyssView(app);
  } else if (st.cur === 'dungeons') {
    body = h('div', { class: 'dlist' }, DUNGEONS.map((D, d) => {
      const unlocked = G.dungeonUnlocked(d);
      const prog = P.dungeon.progress[d];
      const B = BOSSES[d];
      let foe = null;
      if (unlocked && prog < 10) {
        const { s, B: f } = G.dungeonEnemy(d, prog + 1);
        foe = h('div', { class: 'd-next' }, h('img', { src: `./assets/${s.img}` }), h('div', {}, h('div', { class: 'muted' }, `Piętro ${prog + 1}${s.boss ? ' – BOSS' : ''}`), h('b', {}, s.name), diffTag(fPower(f))));
      }
      return h('div', { class: 'dcard' + (unlocked ? '' : ' locked') + (prog >= 10 ? ' cleared' : ''), style: { backgroundImage: `url(./assets/bg/${D.bg}.jpg)` } },
        h('div', { class: 'qc-shade' }),
        h('div', { class: 'dc-in' },
          h('img', { class: 'd-boss', src: `./assets/bosses/${B.img}.webp` }),
          h('div', { class: 'dc-info' },
            h('h3', {}, `${d + 1}. ${D.name}`),
            h('div', { class: 'muted' }, unlocked ? `Boss: ${B.name} – ${B.title}` : `Wymaga poz. ${D.reqLvl}${d > 0 ? ' i ukończenia poprzedniego lochu' : ''}`),
            h('div', { class: 'floors' }, Array.from({ length: 10 }, (_, i) => h('i', { class: (i < prog ? 'on' : '') + (i === 9 ? ' boss' : '') }))),
            foe,
            unlocked ? h('div', { class: 'row gap wrap' },
              prog < 10 ? btn(`⚔ Walcz (🔑1)`, () => app.fight(() => G.dungeonBattle(d)), 'primary small', { 'data-dungeon': d }) : h('span', { class: 'done-tag' }, '✔ Ukończony'),
              prog > 0 ? btn('Zamiataj (🔑1)', () => G.sweepDungeon(d), 'ghost small', { title: 'Szybkie powtórzenie ukończonego piętra bez walki' }) : null) : null)));
    }));
  } else if (st.cur === 'challenges') {
    body = h('div', { class: 'clist' }, P.challenges.list.map((c, i) => {
      const m = G.CHALLENGE_MODS.find((x) => x.id === c.mod);
      const e = ENEMIES[c.enemy];
      return h('div', { class: 'ccard' + (c.done ? ' done' : '') },
        h('img', { src: `./assets/enemies/${e.img}.webp` }),
        h('div', { class: 'cc-in' },
          h('div', { class: 'cc-tier' }, ['Brązowe', 'Srebrne', 'Złote'][c.tier], ' wyzwanie'),
          h('h3', {}, m.name, ': ', e.name), h('div', { class: 'muted' }, m.desc),
          h('div', { class: 'reward-line' }, h('span', {}, uiIcon('crystal', 'ico'), [8, 12, 20][c.tier]), h('span', {}, uiIcon('gold', 'ico'), 'złoto'), c.tier === 2 ? h('span', {}, uiIcon('chest', 'ico'), 'rzadki łup') : null),
          c.done ? h('span', { class: 'done-tag' }, '✔ Ukończone') : btn('⚔ Podejmij', () => app.fight(() => G.challengeBattle(i)), 'primary small')));
    }), h('div', { class: 'tip' }, '💡 Nowe wyzwania codziennie o północy. Przegrana nic nie kosztuje – spróbuj ponownie po ulepszeniu postaci.'));
  } else {
    const info = worldBossInfo();
    const B = BOSSES[info.bossIdx];
    const prog = G.wbProgress();
    const contrib = G.wbContributors();
    const myRank = contrib.findIndex((x) => x.me) + 1;
    const timeEl = h('span', {});
    live = () => { timeEl.textContent = fmtTime(info.ends - Date.now()); };
    live();
    body = h('div', { class: 'wb' },
      h('div', { class: 'wb-card', style: { backgroundImage: `url(./assets/bg/${B.bg}.jpg)` } },
        h('div', { class: 'qc-shade' }),
        h('img', { class: 'wb-img', src: `./assets/bosses/${B.img}.webp` }),
        h('div', { class: 'wb-in' }, h('div', { class: 'qc-loc' }, G.Net.isOnline() ? 'Boss tygodnia – walczą wszyscy gracze' : 'Boss tygodnia – offline walczysz sam'),
          h('h3', {}, B.name), h('div', { class: 'muted' }, `„${B.quote}”`),
          h('div', { class: 'wb-hp' }, bar(1 - prog, 'boss'), h('span', {}, `${Math.round((1 - prog) * 100)}% PŻ · ${fmt(G.wbMaxHp() * (1 - prog))}`)),
          h('div', { class: 'muted' }, 'Pula PŻ rośnie z liczbą aktywnych graczy.'),
          h('div', { class: 'row gap wrap' }, h('span', {}, prog >= 1 ? 'Nowy boss za: ' : 'Koniec za: ', timeEl), h('span', {}, `Ataki dziś: ${G.WB_ATTACKS - P.wb.attacks}/${G.WB_ATTACKS}`)),
          prog >= 1 ? h('div', { class: 'qc-loc' }, '☠ Pokonany przez graczy! Odbierz nagrody poniżej.') : null,
          btn('⚔ Atakuj bossa', () => app.fight(() => G.wbAttack()), 'primary', { disabled: P.wb.attacks >= G.WB_ATTACKS || prog >= 1 || undefined, id: 'btn-wb' }))),
      h('div', { class: 'sec-head' }, h('h4', {}, 'Wspólne nagrody (wymagany min. 1 atak)')),
      h('div', { class: 'milestones' }, G.WB_MILESTONES.map((m, k) => {
        const ok = prog >= m && P.wb.dmg > 0; const got = P.wb.claimed.includes(k);
        return h('button', { class: 'ms' + (ok ? ' ok' : '') + (got ? ' got' : ''), onclick: () => G.wbClaim(k), disabled: !ok || got || undefined },
          h('b', {}, `${Math.round(m * 100)}%`), h('span', {}, k === 3 ? 'Epicki łup + 30💎' : `${[10, 15, 20][k]}💎 + złoto`), got ? '✔' : '');
      })),
      h('div', { class: 'sec-head' }, h('h4', {}, `Najwięcej obrażeń · Ty: #${myRank} (${fmt(P.wb.dmg)})`)),
      h('div', { class: 'lb small' }, contrib.slice(0, 10).map((c, i) => h('div', { class: 'lb-row' + (c.me ? ' me' : '') }, h('span', { class: 'lb-pos' }, i + 1), c.cls ? clsBadge(c.cls) : clsBadge(P.cls), h('span', { class: 'lb-name' }, c.name, c.online ? onlineDot() : null), h('b', {}, fmt(c.dmg))))));
  }
  return { head: head('Lochy i bossowie', st.el, h('div', { class: 'energy-pill' }, uiIcon('key', 'ico'), `${P.dungeon.keys}/${G.DUNGEON_KEYS}`)), body, live };
}

// ——— ARENA ———
function arena(app) {
  const P = G.P;
  const st = subtabs(app, 'arena', [['fight', 'Walki'], ['rank', 'Ranking'], ['season', 'Sezon']], 'fight');
  const lg = leagueOf(P.arena.rating);
  const L = LEAGUES[lg];
  let body, live = null;
  if (st.cur === 'fight') {
    const opps = G.arenaOpponents();
    const online = G.Net.isOnline();
    const empty = opps.length ? null : h('div', { class: 'arena-empty' },
      h('b', {}, online ? 'Brak innych graczy na serwerze' : 'Arena działa w trybie online'),
      h('div', { class: 'muted' }, online ? 'Walczysz z kopiami postaci prawdziwych graczy. Zaproś testerów – gdy tylko ktoś stworzy postać, pojawi się tutaj.' : 'Rywalami są wyłącznie prawdziwi gracze. Połącz grę z serwerem w ⚙ Ustawieniach (instrukcja: ONLINE.md).'),
      online ? null : btn('⚙ Ustawienia', () => Panels.openSettings(app), 'small'));
    body = h('div', {},
      h('div', { class: 'arena-me' },
        h('div', { class: 'league', style: { background: L.color } }, L.name),
        h('div', {}, h('div', {}, 'Ranking: ', h('b', {}, P.arena.rating)), h('div', { class: 'muted' }, `Bilans: ${P.arena.wins}W / ${P.arena.losses}P · Najlepszy w sezonie: ${P.arena.best}`)),
        h('div', { class: 'energy-pill' }, uiIcon('swords', 'ico'), `Bilety: ${P.arena.tickets}`)),
      h('div', { class: 'opps' }, opps.map((b) => {
        const lv = b.lvl;
        const f = b.fighter();
        const look = CLASSES[b.cls].looks[b.look];
        return h('div', { class: 'opp' },
          h('div', { class: 'opp-img' }, h('img', { src: `./assets/heroes/${look}.webp`, style: { filter: b.hue ? `hue-rotate(${OUTFIT_HUES[b.hue].hue * 360}deg)` : '' } })),
          h('div', { class: 'opp-in' },
            h('b', {}, b.name, onlineDot()), h('div', { class: 'muted' }, `${CLASSES[b.cls].name} · poz. ${lv}`),
            h('div', {}, '🏆 ', b.rating), diffTag(fPower(f)),
            h('div', { class: 'row gap wrap' },
              btn('⚔ Walcz', () => app.fight(() => G.arenaBattle(b.id)), 'primary small', { disabled: P.arena.tickets <= 0 || undefined, 'data-opp': b.id }),
              btn('👁 Ekwipunek', () => openProfile(app, b.id.slice(4)), 'ghost small', { 'data-profile': b.id }))));
      })),
      empty,
      online ? h('div', { class: 'row center' }, btn('Odśwież rywali', () => { P.arena.opp = []; app.render(); }, 'ghost small')) : null,
      h('div', { class: 'tip' }, '💡 Siła zależy tylko od ekwipunku, statystyk i talentów – żadnych płatnych przewag.'));
  } else if (st.cur === 'rank') {
    const kind = app.sub.rankKind || 'arena';
    body = Panels.leaderboardView(app, kind, (k) => { app.sub.rankKind = k; app.render(); });
  } else {
    const timeEl = h('b', {});
    const end = weekEnd();
    live = () => { timeEl.textContent = fmtTime(end - Date.now()); };
    live();
    body = h('div', {},
      h('div', { class: 'pts-box' }, h('div', {}, 'Sezon kończy się za: ', timeEl), h('div', { class: 'muted' }, 'Nagroda zależy od najlepszej ligi osiągniętej w sezonie.')),
      h('div', { class: 'leagues' }, LEAGUES.map((x, i) => h('div', { class: 'lgrow' + (i === leagueOf(P.arena.best) ? ' me' : '') },
        h('span', { class: 'league', style: { background: x.color } }, x.name), h('span', {}, `od ${x.min} pkt`),
        h('span', {}, `${x.reward} 💎`, i >= 2 ? ' + skórka „Piekielny Czempion”' : '')))),
      h('div', { class: 'tip' }, 'Po sezonie ranking zostaje częściowo zresetowany (połowa nadwyżki ponad 1000).'));
  }
  return { head: head('Arena PvP', st.el, h('div', { class: 'league small', style: { background: L.color } }, L.name)), body, live };
}

// ——— GILDIA ———
function guild(app) {
  const P = G.P;
  if (P.guild.id === null) {
    const nameInp = h('input', { class: 'inp', placeholder: 'Nazwa nowej gildii', maxlength: 28 });
    const online = G.Net.isOnline();
    const netList = online ? G.Net.Net.guilds : [];
    if (!online) {
      return {
        head: head('Gildie'),
        body: h('div', {},
          h('div', { class: 'arena-empty' }, h('b', {}, 'Gildie działają w trybie online'),
            h('div', { class: 'muted' }, 'Gildie, boss gildii i czat gildii łączą prawdziwych graczy. Połącz grę z serwerem w ⚙ Ustawieniach (instrukcja: ONLINE.md).'),
            btn('⚙ Ustawienia', () => Panels.openSettings(app), 'small'))),
      };
    }
    return {
      head: head('Gildie'),
      body: h('div', {},
        h('div', { class: 'tip' }, 'Dołącz do gildii, aby walczyć z bossem gildii, rozmawiać na czacie gildii i zdobywać bonus do złota i EXP.'),
        h('div', { class: 'sec-head' }, h('h4', {}, 'Gildie graczy'), onlineDot()),
        h('div', { class: 'glist' }, netList.length ? netList.map((g) => h('div', { class: 'gcard' },
          uiIcon('guild', 'gico'),
          h('div', { class: 'gc-in' }, h('b', {}, g.name, onlineDot()), h('div', { class: 'muted' }, `${g.members}/30 członków`)),
          btn('Dołącz', () => G.joinNetGuild(g.id), 'primary small', { disabled: g.members >= 30 || undefined })))
          : h('div', { class: 'muted' }, 'Brak gildii – załóż pierwszą!')),
        h('div', { class: 'sec-head' }, h('h4', {}, 'Załóż gildię (1000 zł)')),
        h('div', { class: 'row gap' }, nameInp, btn('Załóż', () => G.createGuild(nameInp.value), 'gold'))),
    };
  }
  const st = subtabs(app, 'guild', [['members', 'Członkowie'], ['boss', 'Boss gildii'], ['chat', 'Czat gildii']], 'members');
  const glvl = G.guildLevel();
  let body, live = null;
  if (st.cur === 'members') {
    const roster = G.guildMembersInfo();
    roster.push({ name: P.name, cls: P.cls, lvl: P.lvl, power: G.power(), me: true });
    roster.sort((a, b) => b.power - a.power);
    body = h('div', {},
      h('div', { class: 'pts-box' }, h('div', {}, 'Poziom gildii: ', h('b', {}, glvl), h('span', { class: 'muted' }, ` · Bonus: +${G.guildBonus()}% złota i EXP`)),
        h('div', {}, `${roster.length}/${G.GUILD_MAX} członków`)),
      h('div', { class: 'lb' }, roster.map((m, i) => h('div', { class: 'lb-row click' + (m.me ? ' me' : ''), title: 'Pokaż profil i ekwipunek', onclick: () => openProfile(app, m.me ? 'me' : m.id) }, h('span', { class: 'lb-pos' }, i + 1), clsBadge(m.cls), h('span', { class: 'lb-name' }, m.name, vipTag(G.isVipId(m.me ? 'me' : m.id)), i === 0 ? ' 👑' : '', m.online ? onlineDot() : null), h('span', { class: 'muted' }, `poz. ${m.lvl}`), h('b', {}, fmt(m.power))))),
      h('div', { class: 'row center' }, btn('Opuść gildię', () => { if (confirm('Na pewno opuścić gildię?')) G.leaveGuild(); }, 'ghost small')));
  } else if (st.cur === 'boss') {
    const gi = G.guildBossInfo();
    const B = gi.boss;
    body = h('div', { class: 'wb' },
      h('div', { class: 'wb-card', style: { backgroundImage: 'url(./assets/bg/guildhall.jpg)' } },
        h('div', { class: 'qc-shade' }),
        h('img', { class: 'wb-img', src: `./assets/bosses/${B.img}.webp` }),
        h('div', { class: 'wb-in' }, h('div', { class: 'qc-loc' }, 'Boss gildii – tygodniowy'), h('h3', {}, B.name),
          h('div', { class: 'wb-hp' }, bar(1 - gi.prog, 'boss'), h('span', {}, `${Math.round((1 - gi.prog) * 100)}% PŻ`)),
          h('div', { class: 'muted' }, `Twój wkład: ${fmt(P.guild.gb.dmg)} · Ataki dziś: ${G.GB_ATTACKS - P.guild.gb.attacks}/${G.GB_ATTACKS}`),
          btn('⚔ Atakuj', () => app.fight(() => G.gbAttack()), 'primary', { disabled: P.guild.gb.attacks >= G.GB_ATTACKS || gi.prog >= 1 || undefined }))),
      h('div', { class: 'sec-head' }, h('h4', {}, 'Nagrody za wspólną aktywność gildii')),
      h('div', { class: 'milestones' }, G.GB_TIERS.map((m, k) => {
        const ok = gi.prog >= m; const got = P.guild.gb.claimed.includes(k);
        return h('button', { class: 'ms' + (ok ? ' ok' : '') + (got ? ' got' : ''), onclick: () => G.gbClaim(k), disabled: !ok || got || undefined },
          h('b', {}, `${Math.round(m * 100)}%`), h('span', {}, k === 3 ? 'Epicki łup + 25💎' : `${[5, 10, 15][k]}💎 + złoto`), got ? '✔' : '');
      })),
      h('div', { class: 'tip' }, 'Każda odebrana nagroda podnosi poziom gildii w tym tygodniu (+1% bonusu).'));
  } else {
    body = Panels.chatView(app, 'guild');
  }
  return { head: head(G.guildName(), st.el, h('div', { class: 'league small', style: { background: '#2b3a78' } }, `Poz. ${glvl}`)), body, live };
}
