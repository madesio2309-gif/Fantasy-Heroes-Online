"""Obwiednia głośności efektów (RMS w oknach 100 ms) – diagnoza urywanych dźwięków."""
import math, struct, wave
from pathlib import Path

RAW = Path(__file__).resolve().parent / 'raw'
for f in sorted(RAW.glob('sfx_*.wav')):
    w = wave.open(str(f))
    n, ch, sw, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
    data = w.readframes(n)
    s = struct.unpack('<%dh' % (len(data) // 2), data)[::ch]
    win = sr // 10
    env = []
    for i in range(0, len(s), win):
        seg = s[i:i + win]
        r = math.sqrt(sum(x * x for x in seg) / max(1, len(seg))) / 32768
        env.append('%4d' % round(20 * math.log10(max(r, 1e-5))))
    tail = s[-int(sr * 0.02):]
    tr = math.sqrt(sum(x * x for x in tail) / len(tail)) / 32768
    print(f'{f.name:16s} {len(s)/sr:4.2f}s koniec20ms={20*math.log10(max(tr,1e-5)):6.1f}dB | ' + ' '.join(env))
