import * as q from '../queries.js';
import { escapeHtml, weightDots, pathLabel, openSheet, closeSheet, notice } from './helpers.js';

function subjectRow(doc, s) {
  return `<button class="row" data-go="${escapeHtml(s.id)}">
    ${weightDots(s.weight)}
    <span class="row-main">
      <span class="row-title">${escapeHtml(s.title)}</span>
      <span class="row-sub">${escapeHtml(pathLabel(doc, s.id))}</span>
    </span>
  </button>`;
}

function actionRow(doc, e) {
  const s = q.subjectById(doc, e.subjectId);
  // Pas de <label> : un tap sur le texte doit naviguer, pas cocher.
  return `<div class="row">
    <input type="checkbox" class="check" data-done="${escapeHtml(e.id)}" aria-label="Fait : ${escapeHtml(e.content)}">
    <button class="row-main" data-go="${escapeHtml(s.id)}">
      <span class="row-title">${escapeHtml(e.content)}</span>
      <span class="row-sub">${escapeHtml(s.title)}</span>
    </button>
  </div>`;
}

function themeRow(doc, s) {
  const n = q.activeCount(doc, s.id);
  return `<button class="row" data-go="${escapeHtml(s.id)}">
    <span class="row-main"><span class="row-title">${escapeHtml(s.title)}</span></span>
    <span class="row-aside">${n} sujet${n > 1 ? 's' : ''}</span>
  </button>`;
}

export function render(root, { store, navigate }) {
  const doc = store.doc;
  const weighing = q.weighing(doc);
  const actions = q.openActions(doc);
  const roots = q.roots(doc);

  root.innerHTML = `
    <section class="section">
      <h2 class="section-title">Ce qui pèse</h2>
      ${weighing.length ? weighing.map(s => subjectRow(doc, s)).join('') : '<p class="empty">Rien ne pèse en ce moment.</p>'}
    </section>
    <section class="section">
      <h2 class="section-title"><span>À faire</span><span>${actions.length || ''}</span></h2>
      ${actions.length ? actions.map(e => actionRow(doc, e)).join('') : '<p class="empty">Rien à faire pour l\'instant.</p>'}
    </section>
    <section class="section">
      <h2 class="section-title">Thèmes</h2>
      ${roots.map(s => themeRow(doc, s)).join('')}
    </section>
    <div class="footer-icons">
      <button data-nav="search" aria-label="Rechercher">🔍</button>
      <button data-nav="settings" aria-label="Réglages">⚙</button>
    </div>
    <button class="fab" id="fab" aria-label="Nouveau sujet">+</button>
  `;

  root.onclick = e => {
    const go = e.target.closest('[data-go]');
    if (go && !e.target.closest('input')) { e.preventDefault(); navigate({ name: 'subject', id: go.dataset.go }); return; }
    const nav = e.target.closest('[data-nav]');
    if (nav) { navigate({ name: nav.dataset.nav }); return; }
    if (e.target.closest('#fab')) openNewSubjectSheet(store, navigate);
  };

  root.onchange = e => {
    const box = e.target.closest('[data-done]');
    if (box && box.checked) {
      const id = box.dataset.done;
      setTimeout(() => { store.completeAction(id); notice('Fait.'); }, 150);
    }
  };
}

export function openNewSubjectSheet(store, navigate, defaultParentId = null) {
  const doc = store.doc;
  const parents = q.activeSubjectsByPath(doc);
  const selected = defaultParentId ?? parents[0]?.id ?? '';
  const sheet = openSheet(`
    <h2>Nouveau sujet</h2>
    <form id="new-subject">
      <input type="text" name="title" placeholder="Titre" autocomplete="off" required>
      <select name="parent">
        ${parents.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === selected ? 'selected' : ''}>${escapeHtml(q.pathTitles(doc, p.id).join(' › '))}</option>`).join('')}
      </select>
      <div class="sheet-actions">
        <button type="button" class="btn-text" data-cancel>Annuler</button>
        <button type="submit" class="btn">Créer</button>
      </div>
    </form>
  `);
  sheet.querySelector('[data-cancel]').onclick = closeSheet;
  sheet.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const s = store.createSubject({ title: fd.get('title'), parentId: fd.get('parent') || null });
      closeSheet();
      navigate({ name: 'subject', id: s.id });
    } catch (err) { notice(err.message); }
  };
}
