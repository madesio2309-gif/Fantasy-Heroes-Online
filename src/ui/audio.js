// Dźwięk: Web Audio API – zdekodowane bufory efektów, tor głośności (ogólna → muzyka / efekty), płynne przejścia muzyki.
// Wcześniej każdy efekt klonował element <audio> (ponowne dekodowanie, limity odtwarzaczy, na iOS przerywanie muzyki),
// a muzyka była przełączana przez pause() – stąd „urywany” dźwięk walk.
const SFX = ['hit', 'crit', 'magic', 'coin', 'levelup', 'click', 'miss', 'lose', 'tick', 'chest'];
const MUSIC_FILES = { hub: 'bgm_hub', battle: 'bgm_battle', jingle: 'jingle_win' };
const MUSIC_LEVEL = { hub: 0.55, battle: 0.62, jingle: 0.7 };
const VOL_KEY = 'fho_audio_v1';
const DEFAULTS = { master: 0.8, music: 0.6, sfx: 0.85, musicOn: true, sfxOn: true };
const MAX_VOICES_PER_SFX = 3;
const MAX_VOICES = 16;
const MIN_GAP = 0.03; // ten sam efekt częściej niż co 30 ms tylko wzmacnia szum
const FADE = 0.6;

// zgodność wstecz: flagi czytane przez inne moduły
export const audioState = { music: true, sound: true };

let vol = loadVolumes();
const listeners = new Set();
let ctx = null, master = null, musicBus = null, sfxBus = null;
const raw = {}; // nazwa -> Promise<ArrayBuffer>
const buffers = {}; // nazwa -> AudioBuffer
const voices = [];
const lastPlay = {};
const tracks = {}; // nazwa muzyki -> { el, gain }
let musicName = null;

function loadVolumes() {
  let v = { ...DEFAULTS };
  try {
    const s = JSON.parse(localStorage.getItem(VOL_KEY) || 'null');
    if (s && typeof s === 'object') for (const k of Object.keys(DEFAULTS)) if (typeof s[k] === typeof DEFAULTS[k]) v[k] = s[k];
  } catch (e) { console.error('Uszkodzone ustawienia dźwięku', e); }
  for (const k of ['master', 'music', 'sfx']) v[k] = Math.min(1, Math.max(0, Number(v[k]) || 0));
  audioState.music = v.musicOn; audioState.sound = v.sfxOn;
  return v;
}
function saveVolumes() { localStorage.setItem(VOL_KEY, JSON.stringify(vol)); }
export const getVolumes = () => ({ ...vol });
export function onVolumeChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC({ latencyHint: 'interactive' });
  master = ctx.createGain(); musicBus = ctx.createGain(); sfxBus = ctx.createGain();
  // łagodny limiter na efektach – nakładające się trafienia nie przesterowują
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -8; comp.knee.value = 6; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.12;
  sfxBus.connect(comp); comp.connect(master);
  musicBus.connect(master);
  master.connect(ctx.destination);
  applyVolumes(true);
  for (const n of SFX) decodeSfx(n);
  return ctx;
}
function decode(buf) {
  // Safari < 14.1 obsługuje tylko wersję z callbackami
  return new Promise((res, rej) => { const p = ctx.decodeAudioData(buf, res, rej); if (p && p.catch) p.catch(rej); });
}
function decodeSfx(n) {
  if (buffers[n] || !raw[n]) return;
  raw[n].then((ab) => decode(ab.slice(0))).then((b) => { buffers[n] = b; }).catch((e) => console.error(`Nie udało się wczytać dźwięku ${n}`, e));
}
function applyVolumes(instant = false) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const set = (param, v) => { if (instant) param.value = v; else param.setTargetAtTime(v, t, 0.04); };
  set(master.gain, vol.master);
  set(musicBus.gain, vol.musicOn ? vol.music : 0);
  set(sfxBus.gain, vol.sfxOn ? vol.sfx : 0);
}

// Przeglądarki wymagają gestu użytkownika przed odtworzeniem dźwięku
function unlock() {
  if (!ensureCtx()) return;
  if (ctx.state !== 'running') ctx.resume().then(() => { if (musicName) startTrack(musicName, true); }).catch((e) => console.error('Odblokowanie dźwięku', e));
}
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.visibilityState === 'hidden') ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
}

export function preloadAudio() {
  for (const s of SFX) {
    if (raw[s]) continue;
    raw[s] = fetch(`./assets/audio/sfx_${s}.mp3`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); });
    raw[s].catch((e) => console.error(`Brak pliku dźwięku ${s}`, e));
  }
}

export function sfx(name, volume = 0.6) {
  if (!vol.sfxOn || vol.sfx <= 0 || !ctx || ctx.state !== 'running') return;
  const buf = buffers[name];
  if (!buf) { decodeSfx(name); return; }
  const now = ctx.currentTime;
  if (lastPlay[name] !== undefined && now - lastPlay[name] < MIN_GAP) return;
  lastPlay[name] = now;
  // limit głosów: najstarszy głos tego samego efektu (lub ogólnie) wygasa w 30 ms zamiast ucinać się w pół
  for (let i = voices.length - 1; i >= 0; i--) if (voices[i].done) voices.splice(i, 1);
  const same = voices.filter((v) => v.name === name);
  if (same.length >= MAX_VOICES_PER_SFX) stopVoice(same[0]);
  if (voices.length >= MAX_VOICES) stopVoice(voices[0]);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = Math.max(0, Math.min(1.5, volume));
  src.connect(g); g.connect(sfxBus);
  const v = { name, src, g, done: false };
  src.onended = () => { v.done = true; src.disconnect(); g.disconnect(); };
  src.start(now);
  voices.push(v);
}
function stopVoice(v) {
  if (v.done) return;
  v.done = true;
  const t = ctx.currentTime;
  v.g.gain.cancelScheduledValues(t);
  v.g.gain.setValueAtTime(v.g.gain.value, t);
  v.g.gain.linearRampToValueAtTime(0, t + 0.03);
  v.src.stop(t + 0.035);
}

// ——— Muzyka: jeden element <audio> na utwór (strumieniowanie), wpięty w tor Web Audio ———
function track(name) {
  if (tracks[name]) return tracks[name];
  const el = new Audio(`./assets/audio/${MUSIC_FILES[name]}.mp3`);
  el.preload = 'auto';
  el.loop = name !== 'jingle';
  const node = ctx.createMediaElementSource(el);
  const gain = ctx.createGain();
  gain.gain.value = 0;
  node.connect(gain); gain.connect(musicBus);
  tracks[name] = { el, gain };
  return tracks[name];
}
function startTrack(name, restart = false) {
  if (!ctx || ctx.state !== 'running' || !MUSIC_FILES[name]) return;
  const t = ctx.currentTime;
  for (const [n, tr] of Object.entries(tracks)) {
    if (n === name) continue;
    tr.gain.gain.cancelScheduledValues(t);
    tr.gain.gain.setValueAtTime(tr.gain.gain.value, t);
    tr.gain.gain.linearRampToValueAtTime(0, t + FADE);
    const el = tr.el;
    setTimeout(() => { if (musicName !== n) el.pause(); }, FADE * 1000 + 60);
  }
  const tr = track(name);
  if (restart || name === 'jingle' || tr.el.ended) tr.el.currentTime = 0;
  tr.gain.gain.cancelScheduledValues(t);
  tr.gain.gain.setValueAtTime(tr.gain.gain.value, t);
  tr.gain.gain.linearRampToValueAtTime(MUSIC_LEVEL[name], t + (name === 'jingle' ? 0.15 : FADE));
  const p = tr.el.play();
  if (p && p.catch) p.catch((e) => { if (e.name !== 'AbortError') console.error(`Muzyka ${name}`, e); });
}
export function playMusic(name) {
  if (musicName === name && name !== 'jingle' && tracks[name] && !tracks[name].el.paused) return;
  musicName = name;
  if (!vol.musicOn) return;
  startTrack(name, name === 'jingle');
}

// ——— Ustawienia ———
export function setVolume(kind, v) {
  if (!['master', 'music', 'sfx'].includes(kind)) throw new Error('Nieznany kanał dźwięku: ' + kind);
  vol[kind] = Math.min(1, Math.max(0, Number(v) || 0));
  saveVolumes(); applyVolumes();
  for (const fn of listeners) fn(getVolumes());
}
export function setMusic(on) {
  vol.musicOn = !!on; audioState.music = vol.musicOn;
  saveVolumes(); applyVolumes();
  if (on && musicName) { const n = musicName; startTrack(n); }
  for (const fn of listeners) fn(getVolumes());
}
export function setSound(on) {
  vol.sfxOn = !!on; audioState.sound = vol.sfxOn;
  saveVolumes(); applyVolumes();
  for (const fn of listeners) fn(getVolumes());
}
// stan diagnostyczny (testy w przeglądarce)
export const audioDebug = () => ({ ctx: ctx ? ctx.state : 'none', loaded: Object.keys(buffers).length, voices: voices.filter((v) => !v.done).length, music: musicName, vol: getVolumes() });
