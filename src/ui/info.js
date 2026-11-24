// Dokumenty (Regulamin, Polityka prywatności), „Co nowego” i ogłoszenia
import { h, btn, fill } from './dom.js';
import { TERMS, PRIVACY, LEGAL_VERSION } from '../data/legal.js';
import { APP_VERSION, CHANGELOG } from '../version.js';
import { LIVE_EVENTS } from '../data/live.js';
import { splitLive, upcomingLive, evStart, evEnd, fmtIn, fmtRange } from '../core/schedule.js';

export function openDocs(app, which = 'terms') {
  let cur = which;
  const body = h('div', { class: 'docs' });
  const draw = () => {
    const doc = cur === 'terms' ? TERMS : PRIVACY;
    fill(body, 
      h('div', { class: 'subtabs' }, [['terms', 'Regulamin'], ['privacy', 'Polityka prywatności']].map(([id, n]) => h('button', { class: 'st' + (cur === id ? ' sel' : ''), onclick: () => { cur = id; draw(); } }, n))),
      h('h3', {}, doc.title),
      doc.sections.map(([t, paras]) => h('div', { class: 'doc-sec' }, h('b', {}, t), paras.map((p) => h('p', {}, p)))),
      h('div', { class: 'muted' }, `Wersja dokumentów: ${LEGAL_VERSION} · wersja gry ${APP_VERSION}`));
  };
  draw();
  return app.modal('Dokumenty', body, { cls: 'narrow' });
}

export function openChangelog(app, onClose) {
  const body = h('div', { class: 'changelog' },
    CHANGELOG.map((c) => h('div', { class: 'cl-entry' },
      h('div', { class: 'cl-head' }, h('span', { class: 'cl-v' }, `v${c.v}`), h('b', {}, c.title), h('span', { class: 'muted' }, c.date)),
      h('ul', {}, c.items.map((x) => h('li', {}, x))))));
  let m;
  body.append(h('div', { class: 'row center' }, btn('Do gry!', () => m.close(), 'primary')));
  m = app.modal('Co nowego', body, { cls: 'narrow', onClose });
  return m;
}

// lista ogłoszeń i aktywnych eventów (ekran startowy, panel w grze)
export function newsView(news, live, opts = {}) {
  const now = Date.now();
  const { active: act } = splitLive(live, now);
  const soon = upcomingLive(live, now).slice(0, opts.compact ? 3 : 6);
  if (!act.length && !soon.length && !(news || []).length) return null;
  return h('div', { class: 'news' + (opts.compact ? ' compact' : '') },
    act.map((e) => { const ev = LIVE_EVENTS[e.kind]; return h('div', { class: 'news-ev', style: { background: ev.color } }, h('b', {}, '⚡ ', ev.name), ` – ${ev.short} · jeszcze ${fmtIn(evEnd(e) - now)}`); }),
    soon.map((e) => {
      const ev = LIVE_EVENTS[e.kind];
      return h('div', { class: 'news-soon', style: { '--ec': ev.color }, 'data-soon': e.kind },
        h('div', { class: 'news-soon-h' }, h('span', { class: 'news-soon-tag' }, '📅 Zapowiedź'), h('b', {}, ev.name), h('span', { class: 'news-soon-in' }, `za ${fmtIn(evStart(e) - now)}`)),
        h('div', {}, `${ev.short} · ${fmtRange(evStart(e), evEnd(e))}`));
    }),
    (news || []).slice(0, opts.compact ? 2 : 5).map((n) => h('div', { class: 'news-item' },
      h('b', {}, '📢 ', n.title), h('div', { class: 'news-body' }, n.body), h('div', { class: 'muted' }, new Date(n.created_at).toLocaleDateString('pl-PL')))));
}
