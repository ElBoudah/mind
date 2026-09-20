import { Store } from './store.js';
import { onRoute, navigate } from './router.js';
import * as home from './views/home.js';
import * as subject from './views/subject.js';
import * as search from './views/search.js';
import * as settings from './views/settings.js';

const THEME_KEY = 'mind.theme';
const views = { home, subject, search, settings };

export function applyTheme(pref) {
  const p = ['light', 'dark'].includes(pref) ? pref : 'system';
  if (p === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = p;
  try { localStorage.setItem(THEME_KEY, p); } catch { /* stockage indisponible */ }
}

export function currentTheme() {
  try { return localStorage.getItem(THEME_KEY) ?? 'system'; } catch { return 'system'; }
}

const store = new Store(localStorage);
store.load();
applyTheme(currentTheme());

const root = document.getElementById('app');
let route = { name: 'home' };

function draw() {
  const view = views[route.name] ?? home;
  view.render(root, { store, route, navigate, applyTheme, currentTheme });
}

onRoute(r => {
  route = r;
  document.querySelector('.sheet-backdrop')?.remove();
  window.scrollTo(0, 0);
  draw();
});
store.subscribe(() => draw());

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* hors ligne indisponible, l'app fonctionne quand même */ });
}
