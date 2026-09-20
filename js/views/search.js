import * as q from '../queries.js';
import { escapeHtml, pathLabel, weightDots } from './helpers.js';

let lastQuery = '';

function resultRow(doc, s) {
  const path = pathLabel(doc, s.id);
  const rested = s.restedAt !== null ? ' · posé' : '';
  return `<button class="row" data-go="${escapeHtml(s.id)}">
    ${s.parentId === null ? '' : weightDots(s.weight)}
    <span class="row-main">
      <span class="row-title">${escapeHtml(s.title)}</span>
      <span class="row-sub">${escapeHtml(path)}${rested}</span>
    </span>
  </button>`;
}

export function render(root, { store, navigate }) {
  const doc = store.doc;
  root.innerHTML = `
    <nav class="crumbs"><button data-home>‹ Accueil</button></nav>
    <input type="search" class="search-input" placeholder="Rechercher un sujet" autocomplete="off" value="${escapeHtml(lastQuery)}">
    <div id="results"></div>
  `;
  const input = root.querySelector('input');
  const results = root.querySelector('#results');
  const draw = () => {
    lastQuery = input.value;
    const found = q.search(doc, lastQuery);
    results.innerHTML = found.map(s => resultRow(doc, s)).join('')
      || (lastQuery.trim() ? '<p class="empty">Aucun sujet ne correspond.</p>' : '');
  };
  input.oninput = draw;
  draw();
  input.focus();
  root.onclick = e => {
    if (e.target.closest('[data-home]')) return navigate({ name: 'home' });
    const go = e.target.closest('[data-go]');
    if (go) navigate({ name: 'subject', id: go.dataset.go });
  };
}
