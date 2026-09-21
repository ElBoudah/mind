// Routage par fragment d'URL : le bouton retour du téléphone fonctionne naturellement.

export function parseRoute(hash) {
  const h = (hash ?? '').replace(/^#/, '');
  if (h === '/search') return { name: 'search' };
  if (h === '/settings') return { name: 'settings' };
  if (h === '/tree') return { name: 'tree' };
  const m = h.match(/^\/s\/(.+)$/);
  if (m) return { name: 'subject', id: decodeURIComponent(m[1]) };
  return { name: 'home' };
}

export function routeHash(route) {
  switch (route.name) {
    case 'subject': return `#/s/${encodeURIComponent(route.id)}`;
    case 'search': return '#/search';
    case 'settings': return '#/settings';
    case 'tree': return '#/tree';
    default: return '#/';
  }
}

export function navigate(route) {
  location.hash = routeHash(route);
}

export function onRoute(fn) {
  const fire = () => fn(parseRoute(location.hash));
  window.addEventListener('hashchange', fire);
  fire();
}
