"""Obróbka nowych efektów: przycięcie ciszy, płynne wygaszenie (koniec bez urwania), normalizacja -> public/assets/audio/*.mp3"""
import json, subprocess, wave
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / 'public' / 'assets' / 'audio'
RAW = HERE / 'raw'
RAW.mkdir(exist_ok=True)
SR = 44100
# nazwa: maks. długość [s], docelowy szczyt [dBFS]
SPEC = {
    'hit': (0.7, -1.5), 'crit': (1.0, -1.0), 'magic': (1.2, -2.0), 'miss': (0.6, -4.0), 'coin': (1.0, -3.0),
    'levelup': (1.8, -2.0), 'lose': (2.6, -2.5), 'click': (0.25, -6.0), 'tick': (0.12, -6.0), 'chest': (1.4, -3.0),
}


def load_json(p):
    b = p.read_bytes()
    for enc in ('utf-8-sig', 'utf-16'):
        try:
            return json.loads(b.decode(enc))
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
    raise ValueError(p)


def read_wav(p):
    w = wave.open(str(p))
    ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
    if sw != 2:
        raise ValueError(f'{p}: obsługiwane tylko 16-bit')
    x = np.frombuffer(w.readframes(n), dtype='<i2').astype(np.float32) / 32768
    x = x.reshape(-1, ch).mean(axis=1)
    if sr != SR:
        raise ValueError(f'{p}: oczekiwano {SR} Hz, jest {sr}')
    return x


def rms_db(seg):
    return 20 * np.log10(max(1e-6, float(np.sqrt(np.mean(seg * seg)))))


def process(name, x, max_len, peak_db):
    win = int(SR * 0.01)
    env = np.array([rms_db(x[i:i + win]) for i in range(0, len(x) - win, win)])
    top = env.max()
    if top < -45:
        raise RuntimeError(f'{name}: za cichy ({top:.1f} dB) – wymaga ponownej generacji')
    on = np.where(env > top - 30)[0]
    start = max(0, on[0] - 1) * win                    # początek zdarzenia (z 10 ms zapasu)
    # koniec: ostatni moment powyżej -42 dB względem szczytu, ale nie dłużej niż max_len
    loud = np.where(env > top - 42)[0]
    end = min(len(x), (loud[-1] + 2) * win, start + int(SR * max_len))
    y = x[start:end].copy()
    if len(y) < int(SR * 0.05):
        raise RuntimeError(f'{name}: zdarzenie krótsze niż 50 ms')
    fade_in = int(SR * 0.003)
    y[:fade_in] *= np.linspace(0, 1, fade_in)
    fo = max(int(SR * 0.06), int(len(y) * 0.22))      # wygaszenie końca – brak urwania
    y[-fo:] *= np.linspace(1, 0, fo) ** 2
    y *= (10 ** (peak_db / 20)) / max(1e-6, float(np.abs(y).max()))
    tail = rms_db(y[-int(SR * 0.02):])
    return y, tail


def write_wav(p, y):
    w = wave.open(str(p), 'wb')
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes())
    w.close()


report = []
for name, (max_len, peak) in SPEC.items():
    res = load_json(HERE / f'res_{name}.json')
    if not res.get('success') or res.get('audio_check', {}).get('silent'):
        raise RuntimeError(f'{name}: brak poprawnego wyniku generacji')
    src = RAW / f'{name}.wav'
    if not src.exists():
        r = subprocess.run(['curl.exe', '-sSL', '--ssl-no-revoke', '--retry', '3', '-o', str(src), res['url']])
        if r.returncode != 0:
            raise RuntimeError(f'{name}: pobieranie nieudane')
    y, tail = process(name, read_wav(src), max_len, peak)
    tmp = RAW / f'{name}_final.wav'
    write_wav(tmp, y)
    dest = OUT / f'sfx_{name}.mp3'
    r = subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(tmp), '-ac', '1', '-ar', str(SR),
                        '-c:a', 'libmp3lame', '-b:a', '128k', str(dest)])
    if r.returncode != 0:
        raise RuntimeError(f'{name}: kodowanie mp3 nieudane')
    report.append(f'sfx_{name}.mp3  {len(y) / SR:4.2f}s  koniec20ms={tail:6.1f} dB  {dest.stat().st_size // 1024} KB')
print('\n'.join(report))
