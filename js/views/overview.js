import * as q from '../queries.js';
import { escapeHtml, weightDots, relativeDays } from './helpers.js';

// État d'écran : branches dépliées (les thèmes le sont toujours), affichage des posés.
const expanded = new Set();
let showRested = false;

function node(doc, s, nowIso, depth) {
  const isRoot = s.parentId === null;
  const kids = q.children(doc, s.id, { includeRested: showRested });
  const open = isRoot || expanded.has(s.id);
  const rested = s.restedAt !== null;
  const count = kids.length;
  const toggle = count && !isRoot
    ? `<button class="tree-toggle" data-toggle="${escapeHtml(s.id)}" aria-expanded="${open}" aria-label="${open ? 'Replier' : 'Déplier'}">▸</button>`
    : (isRoot ? '' : '<span class="tree-toggle"></span>');
  const aside = isRoot
    ? `<span class="row-aside">${count} sujet${count > 1 ? 's' : ''}</span>`
    : `${weightDots(s.weight)}<span class="row-aside">${rested ? 'posé' : relativeDays(q.lastUpdatedAt(doc, s.id), nowIso)}</span>`;
  const children = open && count
    ? `<ul>${kids.map(c => node(doc, c, nowIso, depth + 1)).join('')}</ul>`
    : (!open && count ? `<ul><li class="tree-row"><span class="tree-toggle"></span><button class="row-main btn-text" data-toggle="${escapeHtml(s.id)}">▸ ${count} sujet${count > 1 ? 's' : ''}</button></li></ul>` : '');
  return `<li class="${isRoot ? 'tree-root' : ''} ${rested ? 'tree-rested' : ''}">
    <div class="tree-row">
      ${toggle}
      <button class="row-main" data-go="${escapeHtml(s.id)}"><span class="row-title">${escapeHtml(s.title)}</span></button>
      ${aside}
    </div>
    ${children}
  </li>`;
}

export function render(root, { store, navigate }) {
  const doc = store.doc;
  const nowIso = store.now();
  const roots = q.children(doc, null, { includeRested: showRested });
  root.innerHTML = `
    <nav class="crumbs"><button data-home>‹ Accueil</button></nav>
    <h1 class="title"><span>Vue d'ensemble</span></h1>
    <ul class="tree">${roots.map(r => node(doc, r, nowIso, 0)).join('') || '<li class="empty">Aucun thème.</li>'}</ul>
    <button class="btn-text" data-toggle-rested>${showRested ? 'Masquer les sujets posés' : 'Afficher les sujets posés'}</button>
  `;
  root.onclick = e => {
    if (e.target.closest('[data-home]')) return navigate({ name: 'home' });
    const t = e.target.closest('[data-toggle]');
    if (t) {
      const id = t.dataset.toggle;
      if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
      return render(root, { store, navigate });
    }
    if (e.target.closest('[data-toggle-rested]')) { showRested = !showRested; return render(root, { store, navigate }); }
    const go = e.target.closest('[data-go]');
    if (go) navigate({ name: 'subject', id: go.dataset.go });
  };
}
