// Panele szybkiego dostępu (modale): Idle, Dzienne, Sklep, Wydarzenie, Rankingi, Czat, Ustawienia
import { h, icon, uiIcon, itemSlotEl, itemDetails, bar, btn, clsBadge, fill, vipTag } from './dom.js';
import { VIP, VIP_PERKS } from '../data/vip.js';
import { giftLabel, giftTotals } from '../data/gifts.js';
import { sfx, setMusic, setSound, getVolumes, setVolume, onVolumeChange } from './audio.js';
import * as G from '../core/game.js';
import * as Acc from '../core/accounts.js';
import { SKINS, CLASSES } from '../data/classes.js';
import { RARITIES } from '../data/items.js';
import { PET_EGG_COST } from '../data/pets.js';
import { APP_VERSION } from '../version.js';
import { fmt, fmtTime, weekEnd, nextMidnight } from '../core/util.js';
import { fmtIn } from '../core/schedule.js';
import { buyPrice } from '../core/formulas.js';
import { LEAGUES } from '../core/world.js';
import { openProfile } from './profile.js';
import { openDocs } from './info.js';

// ——— Głośność: ogólna, muzyka, efekty (+ wyciszanie) – zapis per urządzenie ———
export function audioControls() {
  const wrap = h('div', { class: 'audio-ctl' });
  const row = (kind, label, onKey) => {
    const v = getVolumes();
    const val = h('span', { class: 'vol-val' }, Math.round(v[kind] * 100) + '%');
    const inp = h('input', { type: 'range', min: 0, max: 100, step: 1, value: Math.round(v[kind] * 100), class: 'vol', 'data-vol': kind, 'aria-label': label,
      oninput: (e) => { setVolume(kind, e.target.value / 100); val.textContent = e.target.value + '%'; },
      onchange: () => { if (kind !== 'music') sfx('click', 0.7); } });
    const mute = onKey ? h('button', { class: 'vol-mute' + (v[onKey] ? '' : ' off'), title: v[onKey] ? 'Wycisz' : 'Włącz', 'data-mute': kind,
      onclick: () => { const on = !getVolumes()[onKey]; if (onKey === 'musicOn') setMusic(on); else setSound(on); draw(); } }, v[onKey] ? '🔊' : '🔇') : h('span', { class: 'vol-mute ph' }, '🔈');
    return h('div', { class: 'vol-row' }, mute, h('span', { class: 'vol-lbl' }, label), inp, val);
  };
  const draw = () => wrap.replaceChildren(row('master', 'Głośność ogólna'), row('music', 'Muzyka', 'musicOn'), row('sfx', 'Efekty', 'sfxOn'));
  draw();
  const off = onVolumeChange(() => { if (!wrap.isConnected) off(); });
  return wrap;
}

export function openIdle(app) {
  const body = h('div', { class: 'idle' });
  let m;
  const draw = () => {
    const p = G.idlePending();
    const r = G.idleRates();
    fill(body, 
      h('div', { class: 'idle-top' }, uiIcon('hourglass', 'big-ico'),
        h('div', {}, h('div', { class: 'muted' }, `Twój bohater pracuje, nawet gdy Ciebie nie ma (maks. ${Math.round(p.cap / 3600000)} godzin).`, G.isVip() ? h('span', { class: 'vip-tag', title: `VIP: Idle do ${VIP.idleHours} godz.` }, `VIP ${VIP.idleHours} h`) : null),
          h('div', { class: 'idle-time' }, fmtTime(p.ms), ' / ', fmtTime(p.cap)), bar(p.ms / p.cap, 'idle'))),
      h('div', { class: 'reward-line big' }, h('span', {}, uiIcon('gold', 'ico'), fmt(p.gold), ' zł'), h('span', {}, uiIcon('star', 'ico'), fmt(p.exp), ' EXP'), p.item ? h('span', {}, uiIcon('chest', 'ico'), 'przedmiot') : null),
      h('div', { class: 'muted center' }, `Tempo: ${fmt(r.gold * 60)} zł/h · ${fmt(r.exp * 60)} EXP/h${p.full ? ' · ⚠ Limit osiągnięty!' : ''} · Po 2h dodatkowy przedmiot`),
      btn('Odbierz jednym kliknięciem', () => {
        const res = G.claimIdle();
        if (res) { app.toast(`Idle: +${fmt(res.gold)} zł, +${fmt(res.exp)} EXP${res.it ? ', ' + res.it.name : ''}`, 'good'); m.close(); }
      }, 'primary big', { disabled: p.gold < 1 || undefined, id: 'btn-idle-claim' }));
  };
  draw();
  const iv = setInterval(draw, 1000);
  m = app.modal('Nagrody Idle', body, { onClose: () => clearInterval(iv), cls: 'narrow' });
}

export function openDaily(app) {
  const P = G.P;
  const body = h('div', { class: 'daily' });
  let m;
  const draw = () => {
    const idx = (P.login.streak - 1) % 7;
    fill(body, 
      h('div', { class: 'sec-head' }, h('h4', {}, `Nagroda za logowanie · dzień ${P.login.streak}`)),
      h('div', { class: 'login-row' }, G.LOGIN_REWARDS.map((r, i) => h('div', { class: 'lday' + (i < idx || (i === idx && P.login.claimed) ? ' got' : '') + (i === idx && !P.login.claimed ? ' now' : '') },
        h('b', {}, `Dz. ${i + 1}`), uiIcon(r.item ? (r.item >= 3 ? 'legendChest' : 'chest') : r.cr ? 'crystal' : 'gold', 'ico'), h('span', {}, r.t)))),
      !P.login.claimed ? btn('Odbierz nagrodę dnia', () => {
        const r = G.claimLogin();
        if (r) app.toast(`Nagroda: ${r.t}${r.item ? ' – ' + r.item.name : ''}`, 'good');
        draw();
      }, 'primary', { id: 'btn-login' }) : h('div', { class: 'muted center' }, 'Odebrano – wróć jutro!'),
      h('div', { class: 'sec-head' }, h('h4', {}, 'Misje dzienne'), h('span', { class: 'muted' }, `Reset za ${fmtTime(nextMidnight() - Date.now())}`)),
      h('div', { class: 'missions' }, P.daily.missions.map((ms, i) => h('div', { class: 'mission' + (ms.claimed ? ' done' : '') },
        h('div', { class: 'ms-t' }, ms.t, h('span', { class: 'muted' }, ` ${ms.prog}/${ms.goal}`)), bar(ms.prog / ms.goal, 'ms'),
        ms.claimed ? h('span', { class: 'done-tag' }, '✔') : btn('Odbierz', () => { G.claimMission(i); draw(); }, 'small' + (ms.prog >= ms.goal ? ' primary' : ''), { disabled: ms.prog < ms.goal || undefined })))),
      h('div', { class: 'daily-chest' + (G.allMissionsDone() ? ' ready' : '') },
        uiIcon('legendChest', 'big-ico'),
        h('div', {}, h('b', {}, 'Epicka Skrzynia Dnia'), h('div', { class: 'muted' }, 'Ukończ wszystkie misje: gwarantowany epicki przedmiot (szansa na legendarny) + 15 💎')),
        P.daily.chest ? h('span', { class: 'done-tag' }, '✔ Odebrano') : btn('Otwórz', () => {
          const it = G.claimDailyChest();
          if (it) { m.close(); app.modal('Epicka Skrzynia Dnia', h('div', { class: 'center' }, itemDetails(it, G.compare(it)), btn('Super!', () => { document.querySelectorAll('.modal-wrap').forEach((x) => x.remove()); }, 'primary')), { cls: 'narrow' }); }
        }, 'gold', { disabled: !G.allMissionsDone() || undefined })),
    );
  };
  draw();
  m = app.modal('Dzienne nagrody', body);
}

export function openShop(app, tab = 'items') {
  const P = G.P;
  const body = h('div', {});
  let m;
  let cur = tab;
  const draw = () => {
    const tabs = h('div', { class: 'subtabs' }, [['items', 'Ekwipunek'], ['crystal', 'Kryształy i skórki']].map(([id, n]) => h('button', { class: 'st' + (cur === id ? ' sel' : ''), onclick: () => { cur = id; draw(); } }, n)));
    let content;
    if (cur === 'items') {
      content = h('div', {},
        h('div', { class: 'shop-grid' }, P.shop.items.map((it) => h('div', { class: 'shop-item', onclick: () => { m.close(); app.showItem(it, { shop: true }); } },
          itemSlotEl(it, { delta: G.compare(it) }), h('div', { class: 'si-n', style: { color: RARITIES[it.rarity].color } }, it.name),
          h('div', { class: 'si-p' }, uiIcon('gold', 'ico'), fmt(buyPrice(it)))))),
        P.shop.items.length === 0 ? h('div', { class: 'muted center' }, 'Wyprzedane! Odśwież asortyment lub wróć jutro.') : null,
        h('div', { class: 'row center gap' }, btn(`Nowy asortyment (${fmt(G.shopRerollCost())} zł)`, () => { G.shopReroll(); draw(); }, 'ghost small')),
        h('div', { class: 'tip' }, 'Asortyment zmienia się codziennie i jest dopasowany do Twojej klasy.'));
    } else {
      content = h('div', {},
        h('div', { class: 'tip' }, '💎 Kryształy zdobywasz grając: misje dzienne, logowanie, wyzwania, bossowie, sezony areny i wydarzenia. Nie ma zakupów za prawdziwe pieniądze – nikt nie kupi sobie przewagi.'),
        h('div', { class: 'cshop' },
          h('div', { class: 'citem vipc' }, h('div', { class: 'vip-crown-big' }, '👑'), h('b', {}, 'VIP'), h('div', { class: 'muted' }, G.isVip() ? `Aktywny do ${new Date(G.vipUntil()).toLocaleDateString('pl-PL')}` : 'Wygoda i kosmetyka – bez przewagi w walce'),
            btn(G.isVip() ? 'Twoje korzyści' : 'Co daje VIP?', () => { m.close(); openVipInfo(app); }, 'small', { id: 'btn-vip-info' })),
          h('div', { class: 'citem mythic' }, uiIcon('mythicChest', 'big-ico'), h('b', {}, 'Skrzynia Mityczna'), h('div', { class: 'muted' }, `Legendarny przedmiot (90%) lub mityczny (10%) na Twoim poziomie`),
            btn(`${fmt(G.MYTHIC_CHEST_COST)} 💎`, () => { const it = G.buyMythicChest(); if (it) { m.close(); showLoot(app, 'Skrzynia Mityczna', it); } }, 'gold small', { id: 'btn-mythic-chest' })),
          h('div', { class: 'citem' }, uiIcon('egg', 'big-ico'), h('b', {}, 'Jajo Peta'), h('div', { class: 'muted' }, `Wykluj peta w zakładce Postać › Pety (masz: ${P.pets.eggs})`),
            btn(`${PET_EGG_COST} 💎`, () => { if (G.buyEgg()) { app.toast('Kupiono jajo peta! Wykluj je w zakładce Postać › Pety.', 'good'); draw(); } }, 'gold small', { id: 'btn-buy-egg' })),
          h('div', { class: 'citem' }, uiIcon('chest', 'big-ico'), h('b', {}, 'Skrzynia Bohatera'), h('div', { class: 'muted' }, 'Przedmiot rzadki lub lepszy'),
            btn('50 💎', () => { const it = G.buyChest(); if (it) { app.toast(`Skrzynia: ${it.name} (${RARITIES[it.rarity].name})`, 'good'); draw(); } }, 'gold small')),
          h('div', { class: 'citem' }, uiIcon('energy', 'big-ico'), h('b', {}, 'Pełna energia'), h('div', { class: 'muted' }, 'Raz dziennie'),
            btn('20 💎', () => { G.buyEnergy(); draw(); }, 'gold small', { disabled: P.daily.energyBuy || undefined }))),
        h('div', { class: 'sec-head' }, h('h4', {}, 'Skórki kosmetyczne')),
        h('div', { class: 'skins' }, Object.entries(SKINS).filter(([id, s]) => s.src === 'shop' || P.skinsOwned.includes(id)).map(([id, s]) => {
          const own = P.skinsOwned.includes(id);
          return h('div', { class: 'skin' + (P.skin === id ? ' sel' : '') },
            h('div', { class: 'skin-sw', style: { background: `linear-gradient(135deg, rgb(${s.tint.map((x) => Math.min(255, x * 170)).join(',')}), ${s.glow || '#555'})` } }),
            h('b', {}, s.name), h('div', { class: 'muted' }, s.desc),
            own ? btn(P.skin === id ? 'Założona' : 'Załóż', () => { G.buySkin(id); draw(); }, 'small') : btn(`${s.cost} 💎`, () => { G.buySkin(id); draw(); }, 'gold small'));
        })));
    }
    fill(body, tabs, content);
  };
  draw();
  m = app.modal('Sklep', body);
}
// okno z otrzymanym łupem (skrzynie): mityczny dostaje efekt „wielkiej wygranej”
export function showLoot(app, title, it) {
  const big = it.rarity >= 5;
  sfx(big ? 'levelup' : 'chest', big ? 0.9 : 0.7);
  let m;
  m = app.modal(title, h('div', { class: 'center loot' + (big ? ' mythic' : '') },
    h('div', { class: 'loot-tag', style: { background: RARITIES[it.rarity].color } }, big ? '✦ MITYCZNY! ✦' : RARITIES[it.rarity].name),
    itemDetails(it, G.compare(it)),
    btn('Super!', () => m.close(), 'primary')), { cls: 'narrow' });
  return m;
}

// ——— Prezenty od administracji (np. nagrody za eventy na Discordzie) ———
export function openGifts(app) {
  const body = h('div', { class: 'gifts-box' });
  let m;
  const draw = () => {
    const list = G.pendingGifts();
    const t = giftTotals(list);
    fill(body,
      list.length ? [
        h('div', { class: 'gift-head' }, h('div', { class: 'gift-ico' }, '🎁'),
          h('div', {}, h('b', {}, list.length === 1 ? 'Masz prezent od administracji!' : `Masz ${list.length} ${[2, 3, 4].includes(list.length % 10) && ![12, 13, 14].includes(list.length % 100) ? 'prezenty' : 'prezentów'} od administracji!`),
            h('div', { class: 'gift-total' }, t.gold ? h('span', {}, uiIcon('gold', 'ico'), t.gold.toLocaleString('pl-PL'), ' zł') : null, t.crystals ? h('span', {}, uiIcon('crystal', 'ico'), t.crystals.toLocaleString('pl-PL')) : null))),
        h('div', { class: 'gift-list' }, list.map((g) => h('div', { class: 'gift-item', 'data-gift': g.id },
          h('div', { class: 'gift-amt' }, giftLabel(g.gold, g.crystals)),
          g.message ? h('div', { class: 'gift-msg' }, `„${g.message}”`) : null,
          h('div', { class: 'muted' }, new Date(g.created_at).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }))))),
        btn('Odbierz wszystko', async (e) => {
          const b = e.currentTarget; b.disabled = true;
          try {
            const got = await G.claimGifts();
            if (got.count) app.toast(`🎁 Odebrano: ${giftLabel(got.gold, got.crystals)}`, 'good');
            else app.toast('Prezenty zostały już odebrane.', 'bad');
            m.close();
          } catch (err) { app.toast(err.message, 'bad'); b.disabled = false; }
        }, 'primary big', { id: 'btn-claim-gifts' }),
      ] : h('div', { class: 'muted center' }, 'Nie masz nieodebranych prezentów.'));
  };
  draw();
  m = app.modal('Prezenty', body, { cls: 'narrow' });
  return m;
}

// ——— VIP: status i korzyści ———
export function openVipInfo(app) {
  const on = G.isVip();
  const until = G.vipUntil();
  const body = h('div', { class: 'vip-info' },
    h('div', { class: 'vip-head' + (on ? ' on' : '') }, h('div', { class: 'vip-crown-big' }, '👑'),
      h('div', {}, h('b', {}, on ? 'Masz aktywnego VIP-a' : 'Nie masz aktywnego VIP-a'),
        h('div', { class: on ? '' : 'muted' }, on ? `do ${new Date(until).toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short' })} · zostało ${fmtIn(until - Date.now())}` : 'VIP przyznaje obecnie administracja gry, np. za konkursy i eventy na Discordzie.'))),
    h('div', { class: 'vip-perks' }, VIP_PERKS.map(([ic, txt]) => h('div', { class: 'vip-perk' + (on ? ' on' : '') }, h('span', { class: 'vip-perk-ic' }, ic), h('span', {}, txt)))),
    h('div', { class: 'tip' }, '💡 VIP nie zwiększa siły w walce. Po wygaśnięciu przedmioty z większego plecaka zostają, ale nowe trafiają do niego dopiero, gdy zwolni się miejsce.'));
  return app.modal('VIP', body, { cls: 'narrow' });
}

export function openEvent(app) {
  const P = G.P;
  const ev = G.currentEvent();
  const body = h('div', {});
  const draw = () => {
    const end = weekEnd();
    const max = G.EVENT_TIERS[G.EVENT_TIERS.length - 1];
    const names = ['Wór złota', '20 💎', 'Epicki przedmiot', '40 💎', 'Skórka „Łowca Smoków”'];
    fill(body, 
      h('div', { class: 'event-hero' }, uiIcon('star', 'big-ico'), h('div', {}, h('h3', {}, ev.name), h('div', {}, ev.desc), h('div', { class: 'muted' }, `Kończy się za ${fmtTime(end - Date.now())}`))),
      h('div', { class: 'ev-pts' }, 'Punkty wydarzenia: ', h('b', {}, P.event.points), ` / ${max}`), bar(P.event.points / max, 'event'),
      h('div', { class: 'muted' }, 'Punkty: przygoda 10 · loch 8 · misja 8 · arena 6 · boss 10 · ulepszenie 3'),
      h('div', { class: 'ev-tiers' }, G.EVENT_TIERS.map((t, k) => {
        const ok = P.event.points >= t, got = P.event.claimed.includes(k);
        return h('button', { class: 'ms' + (ok ? ' ok' : '') + (got ? ' got' : ''), disabled: !ok || got || undefined, onclick: () => { G.claimEventTier(k); draw(); } }, h('b', {}, t), h('span', {}, names[k]), got ? '✔' : '');
      })));
  };
  draw();
  app.modal('Wydarzenie tygodnia', body);
}

export function leaderboardView(app, kind, onKind) {
  const rows = G.leaderboard(kind);
  const meIdx = rows.findIndex((r) => r.me);
  const key = kind === 'power' ? 'power' : kind === 'arena' ? 'rating' : kind === 'abyss' ? 'abyss' : 'lvl';
  const label = { lvl: 'Poziom', power: 'Siła', rating: 'Ranking', abyss: 'Piętro Otchłani' }[key];
  const top = rows.slice(0, 50);
  const open = (r) => { if (r.me) openProfile(app, 'me'); else if (r.id) openProfile(app, r.id); };
  return h('div', {},
    h('div', { class: 'subtabs' }, [['arena', 'Arena'], ['lvl', 'Poziom'], ['power', 'Siła'], ['abyss', 'Otchłań']].map(([id, n]) => h('button', { class: 'st' + (kind === id ? ' sel' : ''), onclick: () => onKind(id) }, n))),
    h('div', { class: 'pts-box' }, 'Twoja pozycja: ', h('b', {}, `#${meIdx + 1}`), ` z ${rows.length} graczy`),
    h('div', { class: 'lb' }, top.map((r, i) => h('div', { class: 'lb-row click' + (r.me ? ' me' : ''), title: 'Pokaż profil i ekwipunek', 'data-pid': r.me ? 'me' : r.id, onclick: () => open(r) }, h('span', { class: 'lb-pos' }, i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1), clsBadge(r.cls),
      h('span', { class: 'lb-name' }, r.name, vipTag(G.isVipId(r.me ? 'me' : r.id)), r.online ? h('span', { class: 'online-dot', title: 'Prawdziwy gracz online' }) : null, h('small', { class: 'muted' }, ' ' + r.guild)), kind !== 'lvl' ? h('span', { class: 'muted' }, `poz. ${r.lvl}`) : null, h('b', {}, fmt(r[key])))),
      meIdx >= 50 ? h('div', { class: 'lb-row me click', onclick: () => open(rows[meIdx]) }, h('span', { class: 'lb-pos' }, meIdx + 1), clsBadge(rows[meIdx].cls), h('span', { class: 'lb-name' }, rows[meIdx].name, vipTag(G.isVip())), h('b', {}, fmt(rows[meIdx][key]))) : null),
    h('div', { class: 'muted center' }, `${label} · kliknij gracza, aby zobaczyć jego ekwipunek`));
}
export function openRankings(app) {
  let kind = 'lvl';
  const body = h('div', {});
  const draw = () => fill(body, leaderboardView(app, kind, (k) => { kind = k; draw(); }));
  draw();
  app.modal('Rankingi', body);
}

export function chatView(app, channel) {
  const P = G.P;
  const list = h('div', { class: 'chat-list' });
  const inp = h('input', { class: 'inp', placeholder: 'Napisz wiadomość…', maxlength: 140, onkeydown: (e) => { if (e.key === 'Enter') send(); } });
  const send = () => { G.sendChat(channel, inp.value); inp.value = ''; };
  const online = G.Net.isOnline();
  if (!online) inp.disabled = true;
  const wrap = h('div', { class: 'chat', 'data-ch': channel },
    online ? null : h('div', { class: 'tip' }, '💬 Czat łączy prawdziwych graczy i działa po połączeniu z serwerem (⚙ Ustawienia → Tryb online).'),
    list, h('div', { class: 'row gap' }, inp, btn('Wyślij', send, 'primary small', { disabled: !online || undefined })),
    online ? h('div', { class: 'muted chat-rules' }, 'Bądź miły: wulgaryzmy są maskowane, a wiadomości łamiące zasady można zgłosić (kliknij nazwę gracza).') : null);
  app.chatEl = wrap;
  list.__app = app;
  fillChat(list, channel);
  if (online) G.Net.myChatBan().then((b) => {
    if (!b || !wrap.isConnected) return;
    inp.disabled = true; inp.placeholder = `Czat zablokowany do ${new Date(b.until).toLocaleString('pl-PL')}`;
  }).catch((e) => console.error('Status blokady czatu', e));
  return wrap;
}
// menu gracza na czacie: profil, wyciszenie, zgłoszenie wiadomości
function chatMenu(app, msg, anchor) {
  document.querySelectorAll('.chat-menu').forEach((x) => x.remove());
  const outside = (e) => { if (!menu.contains(e.target)) close(); };
  const close = () => { menu.remove(); document.removeEventListener('pointerdown', outside, true); };
  const muted = G.isMuted(msg.author);
  const menu = h('div', { class: 'chat-menu' },
    h('b', {}, msg.from),
    btn('👁 Profil i ekwipunek', () => { close(); openProfile(app, msg.author); }, 'small'),
    btn(muted ? '🔊 Cofnij wyciszenie' : '🔇 Wycisz gracza', () => { close(); G.toggleMute(msg.author, msg.from); }, 'small'),
    btn('🚩 Zgłoś wiadomość', () => {
      close();
      const reason = h('input', { class: 'inp', maxlength: 200, placeholder: 'Powód (np. wulgaryzmy, obrażanie, spam)' });
      let m;
      m = app.modal('Zgłoś wiadomość', h('div', { class: 'settings' },
        h('div', { class: 'quote' }, h('b', {}, msg.from), ': ', msg.text), reason,
        btn('Wyślij zgłoszenie', async () => { if (await G.reportMessage(msg, reason.value)) m.close(); }, 'primary', { id: 'btn-report' })), { cls: 'narrow' });
    }, 'small'));
  const r = anchor.getBoundingClientRect();
  Object.assign(menu.style, { left: Math.min(window.innerWidth - 230, r.left) + 'px', top: Math.min(window.innerHeight - 170, r.bottom + 4) + 'px' });
  document.body.append(menu);
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
}
function fillChat(list, channel) {
  const P = G.P;
  const app = list.__app;
  const msgs = (channel === 'guild' ? P.chat.guild : P.chat.global).filter((m) => !G.isMuted(m.author));
  list.replaceChildren(...(msgs.length ? msgs.slice(-40).map((m) => h('div', { class: 'msg' + (m.me ? ' me' : '') }, clsBadge(m.cls),
    h('b', { class: m.me ? '' : 'msg-name', onclick: m.me || !app ? null : (e) => chatMenu(app, m, e.currentTarget) }, m.from, vipTag(G.isVipId(m.me ? 'me' : m.author)), m.online && !m.me ? h('span', { class: 'online-dot' }) : null, ': '),
    h('span', {}, m.text)))
    : [h('div', { class: 'muted center' }, 'Cisza… napisz coś pierwszy!')]));
  list.scrollTop = list.scrollHeight;
}
export function refreshChat(app) {
  if (!app.chatEl || !app.chatEl.isConnected) { app.chatEl = null; return; }
  fillChat(app.chatEl.querySelector('.chat-list'), app.chatEl.dataset.ch);
}
export function openChat(app) {
  const P = G.P;
  let ch = 'global';
  const body = h('div', {});
  const draw = () => fill(body, 
    h('div', { class: 'subtabs' }, h('button', { class: 'st' + (ch === 'global' ? ' sel' : ''), onclick: () => { ch = 'global'; draw(); } }, 'Globalny'),
      h('button', { class: 'st' + (ch === 'guild' ? ' sel' : ''), onclick: () => { if (P.guild.id === null) return app.toast('Najpierw dołącz do gildii.', 'bad'); ch = 'guild'; draw(); } }, 'Gildia')),
    chatView(app, ch));
  draw();
  app.modal('Czat', body, { cls: 'narrow', onClose: () => { app.chatEl = null; } });
}

export function openSettings(app) {
  const P = G.P;
  const body = h('div', { class: 'settings' },
    h('div', { class: 'sec' }, h('b', {}, 'Dźwięk'), audioControls()),
    h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: P.settings.fast || undefined, onchange: (e) => { P.settings.fast = e.target.checked; G.save(); } }), ' Szybsze animacje walki (×2)'),
    h('div', { class: 'muted' }, `Postać: ${P.name} · ${CLASSES[P.cls].name} · utworzona ${new Date(P.created).toLocaleDateString('pl-PL')}`),
    h('div', { class: 'muted' }, `Walki: ${P.stats.fights} · Wygrane: ${P.stats.wins} · Przygody: ${P.stats.quests} · Bossowie: ${P.stats.bosses} · Legendy: ${P.stats.legendaries} · Mityczne: ${P.stats.mythics || 0}`),
    accountSection(app),
    onlineSection(app),
    h('div', { class: 'row gap wrap' },
      btn('Regulamin', () => openDocs(app, 'terms'), 'ghost small'),
      btn('Polityka prywatności', () => openDocs(app, 'privacy'), 'ghost small'),
      h('span', { class: 'muted' }, `Wersja gry ${APP_VERSION}`)),
    btn('Usuń postać i zacznij od nowa', async () => {
      if (!confirm('Na pewno? Tego nie można cofnąć.')) return;
      try { await Acc.wipeCharacter(); } catch (e) { app.toast('Nie udało się usunąć postaci: ' + e.message, 'bad'); return; }
      location.reload();
    }, 'ghost small'));
  app.modal('Ustawienia', body, { cls: 'narrow' });
}

// ——— Konto gracza ———
function accountSection(app) {
  const A = Acc.Acc;
  const u = A.user;
  if (!u) return h('div', { class: 'muted' }, 'Postęp zapisuje się automatycznie w przeglądarce.');
  const cloud = u.mode === 'cloud';
  const status = h('div', { class: 'muted', id: 'acc-sync' });
  const draw = () => {
    status.textContent = !cloud ? 'Konto lokalne – bohater zapisuje się w tej przeglądarce. Aby przenieść go na inne urządzenie, pobierz plik postaci.'
      : A.syncError ? 'Błąd zapisu na serwerze: ' + A.syncError
        : A.syncing ? 'Zapisywanie na serwerze…'
          : A.lastSync ? `Bohater zapisany na serwerze (${new Date(A.lastSync).toLocaleTimeString('pl-PL')}). Zapis odbywa się automatycznie.`
            : 'Bohater zapisuje się na serwerze automatycznie.';
  };
  draw();
  const off = Acc.onAcc(() => { if (!status.isConnected) off(); else draw(); });
  const file = h('input', {
    type: 'file', accept: '.json,application/json', id: 'acc-file', style: { display: 'none' },
    onchange: async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (!confirm('Wczytać bohatera z pliku? Obecny bohater na tym koncie zostanie zastąpiony.')) return;
      try {
        const r = await Acc.importText(await f.text());
        sessionStorage.setItem('fho_flash', `Wczytano bohatera ${r.name} (poz. ${r.lvl}).`);
        location.reload();
      } catch (err) { app.toast(err.message, 'bad'); }
    },
  });
  const download = () => {
    const f = Acc.exportFile();
    const url = URL.createObjectURL(new Blob([f.text], { type: 'application/json' }));
    const a = h('a', { href: url, download: f.name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    app.toast('Pobrano plik postaci: ' + f.name, 'good');
  };
  return h('div', { class: 'sec acc-sec' },
    h('b', {}, 'Konto gracza'),
    h('div', { class: 'acc-pill small' }, uiIcon('key', 'acc-ico'), h('div', {}, h('small', {}, cloud ? 'Konto online' : 'Konto w tej przeglądarce'), h('b', {}, u.login))),
    status,
    h('div', { class: 'row gap wrap' },
      cloud ? btn('Zapisz teraz', async () => { G.save(); const ok = await Acc.pushCloud(true); app.toast(ok ? 'Zapisano na serwerze.' : 'Nie udało się zapisać: ' + A.syncError, ok ? 'good' : 'bad'); }, 'small') : null,
      btn('Zmień hasło', () => openPassword(app), 'small', { id: 'acc-pass' }),
      cloud ? btn('Zmień e-mail', () => openChangeEmail(app), 'small', { id: 'acc-email' }) : null,
      btn('Pobierz plik postaci', download, 'small', { id: 'acc-export' }),
      btn('Wczytaj plik postaci', () => file.click(), 'small', { id: 'acc-import' })),
    file,
    h('div', { class: 'row gap wrap' },
      btn('Wyloguj', () => app.doLogout(), 'primary small', { id: 'acc-logout' }),
      btn('Usuń konto', () => (cloud ? openDeleteCloud(app) : openDeleteAccount(app)), 'ghost small', { id: 'acc-delete' })));
}
function openChangeEmail(app) {
  const email = h('input', { class: 'inp', id: 'em-new', type: 'email', placeholder: 'nowy adres e-mail', autocomplete: 'email' });
  const pw = passField('em-pass', 'obecne hasło', 'current-password');
  const err = h('div', { class: 'auth-err', role: 'alert' });
  let m;
  const go = btn('Zmień e-mail', async () => {
    err.textContent = ''; go.disabled = true;
    try {
      const r = await Acc.changeEmail(email.value, pw.value);
      m.close();
      app.toast(r.changed ? 'Adres e-mail został zmieniony.' : 'Sprawdź skrzynkę – potwierdź zmianę linkiem z wiadomości.', 'good');
    } catch (e) { err.textContent = e.message; go.disabled = false; }
  }, 'primary');
  m = app.modal('Zmiana e-maila', h('div', { class: 'settings' }, h('div', { class: 'muted' }, `Obecny adres: ${Acc.Acc.user.email}`), email, pw, err, go), { cls: 'narrow' });
}
function openDeleteCloud(app) {
  const pw = passField('delc-pass', 'hasło do konta', 'current-password');
  const err = h('div', { class: 'auth-err', role: 'alert' });
  const confirmBox = h('input', { type: 'checkbox', id: 'delc-ok' });
  const go = btn('Usuń konto na zawsze', async () => {
    err.textContent = '';
    if (!confirmBox.checked) { err.textContent = 'Zaznacz potwierdzenie.'; return; }
    go.disabled = true;
    try {
      await Acc.deleteCloudAccount(pw.value);
      sessionStorage.setItem('fho_flash', 'Konto i wszystkie dane zostały usunięte z serwera.');
      location.reload();
    } catch (e) { err.textContent = e.message; go.disabled = false; }
  }, 'primary', { id: 'delc-go' });
  app.modal('Usuwanie konta online', h('div', { class: 'settings' },
    h('div', {}, 'Konto, bohater, profil w rankingach, wiadomości czatu i wpisy bossów zostaną trwale usunięte z serwera. Tej operacji nie można cofnąć.'),
    h('div', { class: 'muted' }, 'Wskazówka: przed usunięciem możesz pobrać plik postaci (kopia na Twoim urządzeniu).'),
    pw, h('label', { class: 'toggle' }, confirmBox, ' Rozumiem – usuń moje konto i dane'), err, go), { cls: 'narrow' });
}
function passField(id, ph, ac) { return h('input', { class: 'inp', id, type: 'password', placeholder: ph, autocomplete: ac }); }
function openPassword(app) {
  const old = passField('pw-old', 'obecne hasło', 'current-password');
  const p1 = passField('pw-new', `nowe hasło (min. ${Acc.MIN_PASSWORD} znaków)`, 'new-password');
  const p2 = passField('pw-new2', 'powtórz nowe hasło', 'new-password');
  const err = h('div', { class: 'auth-err', role: 'alert' });
  let m;
  const go = btn('Zmień hasło', async () => {
    err.textContent = ''; go.disabled = true;
    try {
      await Acc.changePassword({ old: old.value, password: p1.value, password2: p2.value });
      m.close(); app.toast('Hasło zostało zmienione.', 'good');
    } catch (e) { err.textContent = e.message; go.disabled = false; }
  }, 'primary', { id: 'pw-go' });
  m = app.modal('Zmiana hasła', h('div', { class: 'settings' }, old, p1, p2, err, go), { cls: 'narrow' });
}
function openDeleteAccount(app) {
  const pw = passField('del-pass', 'hasło do konta', 'current-password');
  const err = h('div', { class: 'auth-err', role: 'alert' });
  const go = btn('Usuń konto i bohatera', async () => {
    err.textContent = '';
    try {
      await Acc.deleteLocalAccount(pw.value);
      sessionStorage.setItem('fho_flash', 'Konto zostało usunięte.');
      location.reload();
    } catch (e) { err.textContent = e.message; }
  }, 'primary');
  app.modal('Usuwanie konta', h('div', { class: 'settings' },
    h('div', {}, 'Konto lokalne i zapisany na nim bohater zostaną trwale usunięte z tej przeglądarki.'), pw, err, go), { cls: 'narrow' });
}

// ——— Tryb online (Supabase) ———
function onlineSection(app) {
  const N = G.Net;
  const cfg = N.getConfig() || { url: '', anonKey: '' };
  const url = h('input', { class: 'inp', id: 'net-url', placeholder: 'https://twoj-projekt.supabase.co', value: cfg.url });
  const key = h('input', { class: 'inp', id: 'net-key', placeholder: 'Klucz publiczny (publishable / anon)', value: cfg.anonKey, type: 'password' });
  const status = h('div', { class: 'net-status', id: 'net-status' });
  const draw = () => {
    const s = N.Net.status;
    status.className = 'net-status ' + (s === 'on' ? 'on' : s === 'err' ? 'err' : 'off');
    status.textContent = s === 'on' ? `● Połączono – wspólny świat (${N.Net.players.length} innych graczy)`
      : s === 'connecting' ? 'Łączenie…' : s === 'err' ? 'Błąd: ' + N.Net.error : 'Offline – brak połączenia z serwerem (gra solo)';
  };
  draw();
  const off = N.onNet((t) => { if (t === 'status' || t === 'refresh') { if (!status.isConnected) off(); else draw(); } });
  const connectBtn = btn('Połącz', async () => {
    const c = { url: url.value.trim(), anonKey: key.value.trim() };
    if (!c.url || !c.anonKey) return app.toast('Podaj adres projektu i klucz anon.', 'bad');
    try {
      await G.connectOnline(c);
      N.saveConfig(c);
      app.toast('Połączono z serwerem gry!', 'good');
    } catch (e) { app.toast('Nie udało się połączyć: ' + e.message, 'bad'); }
    draw();
  }, 'primary small', { id: 'net-connect' });
  const discBtn = btn('Rozłącz', async () => { await N.disconnect(); N.saveConfig(null); app.toast('Rozłączono – grasz offline.'); draw(); app.render(); }, 'ghost small');
  return h('div', { class: 'sec' },
    h('b', {}, 'Tryb online (wspólny świat)'),
    h('div', { class: 'muted' }, 'Podłącz projekt Supabase, aby arena, rankingi, czat, gildie i boss światowy łączyły prawdziwych graczy. Instrukcja: plik ONLINE.md w projekcie gry.'),
    url, key, h('div', { class: 'row gap' }, connectBtn, discBtn), status);
}

export function openSeasonReward(app) {
  const r = G.P.seasonRewards[0];
  if (!r) return;
  const L = LEAGUES[r.league];
  const m = app.modal('Koniec sezonu areny!', h('div', { class: 'center' },
    h('div', { class: 'league', style: { background: L.color } }, L.name),
    h('p', {}, `Twoja najlepsza liga w sezonie: ${L.name}. Nagroda: ${r.cr} kryształów${r.skin ? ' + skórka „Piekielny Czempion”' : ''}.`),
    btn('Odbierz', () => { G.claimSeasonReward(); m.close(); app.toast('Nagroda sezonu odebrana!', 'good'); if (G.P.seasonRewards.length) openSeasonReward(app); }, 'primary')), { cls: 'narrow' });
}
