// Panele szybkiego dostępu (modale): Idle, Dzienne, Sklep, Wydarzenie, Rankingi, Czat, Ustawienia
import { h, icon, uiIcon, itemSlotEl, itemDetails, bar, btn, clsBadge } from './dom.js';
import { sfx, setMusic, setSound } from './audio.js';
import * as G from '../core/game.js';
import * as Acc from '../core/accounts.js';
import { SKINS, CLASSES } from '../data/classes.js';
import { RARITIES } from '../data/items.js';
import { fmt, fmtTime, weekEnd, nextMidnight } from '../core/util.js';
import { buyPrice } from '../core/formulas.js';
import { LEAGUES } from '../core/world.js';

export function openIdle(app) {
  const body = h('div', { class: 'idle' });
  let m;
  const draw = () => {
    const p = G.idlePending();
    const r = G.idleRates();
    body.replaceChildren(
      h('div', { class: 'idle-top' }, uiIcon('hourglass', 'big-ico'),
        h('div', {}, h('div', { class: 'muted' }, 'Twój bohater pracuje, nawet gdy Ciebie nie ma (maks. 12 godzin).'),
          h('div', { class: 'idle-time' }, fmtTime(p.ms), ' / 12g 00m'), bar(p.ms / G.IDLE_CAP_MS, 'idle'))),
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
    body.replaceChildren(
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
    body.replaceChildren(tabs, content);
  };
  draw();
  m = app.modal('Sklep', body);
}

export function openEvent(app) {
  const P = G.P;
  const ev = G.currentEvent();
  const body = h('div', {});
  const draw = () => {
    const end = weekEnd();
    const max = G.EVENT_TIERS[G.EVENT_TIERS.length - 1];
    const names = ['Wór złota', '20 💎', 'Epicki przedmiot', '40 💎', 'Skórka „Łowca Smoków”'];
    body.replaceChildren(
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
  const key = kind === 'power' ? 'power' : kind === 'arena' ? 'rating' : 'lvl';
  const label = { lvl: 'Poziom', power: 'Siła', rating: 'Ranking' }[key];
  const top = rows.slice(0, 50);
  return h('div', {},
    h('div', { class: 'subtabs' }, [['arena', 'Arena'], ['lvl', 'Poziom'], ['power', 'Siła']].map(([id, n]) => h('button', { class: 'st' + (kind === id ? ' sel' : ''), onclick: () => onKind(id) }, n))),
    h('div', { class: 'pts-box' }, 'Twoja pozycja: ', h('b', {}, `#${meIdx + 1}`), ` z ${rows.length} graczy`),
    h('div', { class: 'lb' }, top.map((r, i) => h('div', { class: 'lb-row' + (r.me ? ' me' : '') }, h('span', { class: 'lb-pos' }, i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1), clsBadge(r.cls),
      h('span', { class: 'lb-name' }, r.name, r.online ? h('span', { class: 'online-dot', title: 'Prawdziwy gracz online' }) : null, h('small', { class: 'muted' }, ' ' + r.guild)), kind !== 'lvl' ? h('span', { class: 'muted' }, `poz. ${r.lvl}`) : null, h('b', {}, fmt(r[key])))),
      meIdx >= 50 ? h('div', { class: 'lb-row me' }, h('span', { class: 'lb-pos' }, meIdx + 1), clsBadge(rows[meIdx].cls), h('span', { class: 'lb-name' }, rows[meIdx].name), h('b', {}, fmt(rows[meIdx][key]))) : null),
    h('div', { class: 'muted center' }, label));
}
export function openRankings(app) {
  let kind = 'lvl';
  const body = h('div', {});
  const draw = () => body.replaceChildren(leaderboardView(app, kind, (k) => { kind = k; draw(); }));
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
    list, h('div', { class: 'row gap' }, inp, btn('Wyślij', send, 'primary small', { disabled: !online || undefined })));
  app.chatEl = wrap;
  fillChat(list, channel);
  return wrap;
}
function fillChat(list, channel) {
  const P = G.P;
  const msgs = channel === 'guild' ? P.chat.guild : P.chat.global;
  list.replaceChildren(...(msgs.length ? msgs.slice(-40).map((m) => h('div', { class: 'msg' + (m.me ? ' me' : '') }, clsBadge(m.cls), h('b', {}, m.from, m.online && !m.me ? h('span', { class: 'online-dot' }) : null, ': '), h('span', {}, m.text)))
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
  const draw = () => body.replaceChildren(
    h('div', { class: 'subtabs' }, h('button', { class: 'st' + (ch === 'global' ? ' sel' : ''), onclick: () => { ch = 'global'; draw(); } }, 'Globalny'),
      h('button', { class: 'st' + (ch === 'guild' ? ' sel' : ''), onclick: () => { if (P.guild.id === null) return app.toast('Najpierw dołącz do gildii.', 'bad'); ch = 'guild'; draw(); } }, 'Gildia')),
    chatView(app, ch));
  draw();
  app.modal('Czat', body, { cls: 'narrow', onClose: () => { app.chatEl = null; } });
}

export function openSettings(app) {
  const P = G.P;
  const body = h('div', { class: 'settings' },
    h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: P.settings.music || undefined, onchange: (e) => { P.settings.music = e.target.checked; setMusic(e.target.checked); G.save(); } }), ' Muzyka'),
    h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: P.settings.sound || undefined, onchange: (e) => { P.settings.sound = e.target.checked; setSound(e.target.checked); G.save(); } }), ' Efekty dźwiękowe'),
    h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: P.settings.fast || undefined, onchange: (e) => { P.settings.fast = e.target.checked; G.save(); } }), ' Szybsze animacje walki (×2)'),
    h('div', { class: 'muted' }, `Postać: ${P.name} · ${CLASSES[P.cls].name} · utworzona ${new Date(P.created).toLocaleDateString('pl-PL')}`),
    h('div', { class: 'muted' }, `Walki: ${P.stats.fights} · Wygrane: ${P.stats.wins} · Przygody: ${P.stats.quests} · Bossowie: ${P.stats.bosses} · Legendy: ${P.stats.legendaries}`),
    accountSection(app),
    onlineSection(app),
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
      btn('Pobierz plik postaci', download, 'small', { id: 'acc-export' }),
      btn('Wczytaj plik postaci', () => file.click(), 'small', { id: 'acc-import' })),
    file,
    h('div', { class: 'row gap wrap' },
      btn('Wyloguj', () => app.doLogout(), 'primary small', { id: 'acc-logout' }),
      !cloud ? btn('Usuń konto', () => openDeleteAccount(app), 'ghost small') : null));
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
