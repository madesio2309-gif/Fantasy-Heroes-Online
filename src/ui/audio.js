// Dźwięk: muzyka w tle i efekty
const SFX = ['hit', 'crit', 'magic', 'coin', 'levelup', 'click', 'miss', 'lose'];
const cache = {};
let music = null, musicName = null;
export const audioState = { music: true, sound: true };

export function preloadAudio() {
  for (const s of SFX) { const a = new Audio(`./assets/audio/sfx_${s}.mp3`); a.preload = 'auto'; cache[s] = a; }
}
export function sfx(name, vol = 0.6) {
  if (!audioState.sound) return;
  const base = cache[name];
  if (!base) return;
  const a = base.cloneNode();
  a.volume = vol;
  a.play().catch(() => {});
}
export function playMusic(name) {
  if (musicName === name && music && !music.paused) return;
  musicName = name;
  if (music) { music.pause(); music = null; }
  if (!audioState.music) return;
  const file = name === 'jingle' ? 'jingle_win' : name === 'battle' ? 'bgm_battle' : 'bgm_hub';
  music = new Audio(`./assets/audio/${file}.mp3`);
  music.loop = name !== 'jingle';
  music.volume = name === 'battle' ? 0.35 : 0.3;
  music.play().catch(() => {});
}
export function setMusic(on) {
  audioState.music = on;
  if (!on && music) { music.pause(); }
  else if (on) { const n = musicName || 'hub'; musicName = null; playMusic(n); }
}
export function setSound(on) { audioState.sound = on; }
