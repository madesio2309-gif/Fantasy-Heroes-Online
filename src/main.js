import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/700.css';
import './style.css';
import { App } from './ui/app.js';
import * as G from './core/game.js';

const app = new App(document.getElementById('app'));
window.__fho = { app, G };
app.boot().catch((e) => {
  console.error(e);
  app.toast('Błąd ładowania gry: ' + e.message, 'bad');
});
window.addEventListener('beforeunload', () => G.save());
document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
