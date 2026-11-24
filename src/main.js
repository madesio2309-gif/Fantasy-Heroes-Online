import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/700.css';
import './style.css';
import { App } from './ui/app.js';
import * as G from './core/game.js';
import { audioDebug } from './ui/audio.js';
import { openAdmin } from './ui/admin.js';

const app = new App(document.getElementById('app'));
// punkt diagnostyczny testów w przeglądarce (uprawnienia administratora i tak sprawdza serwer)
window.__fho = { app, G, audio: audioDebug, openAdmin: () => openAdmin(app) };
app.boot().catch((e) => {
  console.error(e);
  app.toast('Błąd ładowania gry: ' + e.message, 'bad');
});
window.addEventListener('beforeunload', () => G.save());
document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
