import * as q from '../queries.js';
import { escapeHtml, weightDots, formatDate, relativeDays, daysBetween, openSheet, closeSheet, notice, downloadText, longPress } from './helpers.js';
import { openNewSubjectSheet } from './home.js';

const TYPE_LABEL = { thought: 'Pensée', action: 'Action', decision: 'Décision' };

function crumbs(doc, s) {
  const parts = q.ancestors(doc, s.id).map(a => `<button data-go="${escapeHtml(a.id)}">${escapeHtml(a.title)}</button><span>›</span>`);
  return `<nav class="crumbs"><button data-home aria-label="Accueil">‹ Accueil</button><span>›</span>${parts.join('')}</nav>`;
}

function actionRow(doc, s, e) {
  const owner = q.subjectById(doc, e.subjectId);
  const sub = owner.id === s.id ? '' : `<span class="row-sub">${escapeHtml(owner.title)}</span>`;
  return `<div class="row">
    <input type="checkbox" class="check" data-done="${escapeHtml(e.id)}" aria-label="Fait : ${escapeHtml(e.content)}">
    <span class="row-main"><span class="row-title">${escapeHtml(e.content)}</span>${sub}</span>
  </div>`;
}

function childRow(doc, c, nowIso) {
  return `<button class="row" data-go="${escapeHtml(c.id)}">
    <span class="row-main"><span class="row-title">${escapeHtml(c.title)}</span></span>
    ${weightDots(c.weight)}
    <span class="row-aside">${relativeDays(q.lastUpdatedAt(doc, c.id), nowIso)}</span>
  </button>`;
}

function journalItem(e) {
  let body = escapeHtml(e.content);
  if (e.type === 'weight') body = `Poids → ${escapeHtml(e.content)}`;
  if (e.type === 'action') body = `Fait : ${body}`;
  const date = e.type === 'action' ? e.doneAt : e.createdAt;
  return `<li class="journal-item ${e.type}" data-entry="${escapeHtml(e.id)}">
    <span class="journal-date">${formatDate(date)}</span>
    <span class="journal-body">${body}</span>
  </li>`;
}

export function render(root, { store, route, navigate }) {
  const doc = store.doc;
  const s = q.subjectById(doc, route.id);
  if (!s) {
    root.innerHTML = `<p class="empty">Sujet introuvable.</p><button class="btn-text" data-home>‹ Accueil</button>`;
    root.onclick = () => navigate({ name: 'home' });
    return;
  }
  const nowIso = store.now();
  const isRoot = s.parentId === null;
  const rested = s.restedAt !== null;
  const actions = q.openActions(doc, s.id);
  const kids = q.children(doc, s.id);
  const entries = q.journal(doc, s.id);

  const subjectsSection = `
    <section class="section">
      <h2 class="section-title">Sous-sujets</h2>
      ${kids.map(c => childRow(doc, c, nowIso)).join('') || '<p class="empty">Aucun sous-sujet.</p>'}
      ${rested ? '' : '<button class="btn-text" data-new-child>+ sous-sujet</button>'}
    </section>`;

  const actionsSection = `
    <section class="section">
      <h2 class="section-title">À faire</h2>
      ${actions.map(e => actionRow(doc, s, e)).join('') || '<p class="empty">Rien à faire.</p>'}
    </section>`;

  root.innerHTML = `
    ${crumbs(doc, s)}
    ${rested ? `<div class="banner"><span>Posé depuis ${daysBetween(s.restedAt, nowIso)} j</span><button class="btn-quiet" data-resume>Reprendre</button></div>` : ''}
    <h1 class="title">
      <span>${escapeHtml(s.title)}</span>
      ${isRoot ? '' : `<button class="dots-btn" data-weight aria-label="Changer le poids">${weightDots(s.weight)}</button>`}
    </h1>
    <textarea class="intent" data-intent placeholder="${isRoot ? 'Quelques mots sur ce thème…' : 'Ce que je veux, où j\'en suis…'}" rows="3">${escapeHtml(s.intent)}</textarea>
    ${isRoot ? subjectsSection + actionsSection : actionsSection + subjectsSection}
    <section class="section">
      <h2 class="section-title">Journal</h2>
      <ul class="journal">${entries.map(journalItem).join('') || '<li class="empty">Rien encore.</li>'}</ul>
    </section>
    <div class="bottom-bar">
      ${rested ? '<span></span>' : '<button class="btn" data-compose>+ pensée</button>'}
      <button class="btn-menu" data-menu aria-label="Plus">⋯</button>
    </div>
  `;

  const intent = root.querySelector('[data-intent]');
  const autosize = () => { intent.style.height = 'auto'; intent.style.height = `${intent.scrollHeight}px`; };
  autosize();
  intent.oninput = autosize;
  intent.onblur = () => { if (intent.value !== s.intent) store.setIntent(s.id, intent.value); };

  root.onclick = e => {
    if (e.target.closest('[data-home]')) return navigate({ name: 'home' });
    const go = e.target.closest('[data-go]');
    if (go) return navigate({ name: 'subject', id: go.dataset.go });
    if (e.target.closest('[data-weight]')) return store.setWeight(s.id, (s.weight + 1) % 4);
    if (e.target.closest('[data-resume]')) { store.resumeSubject(s.id); return notice('Repris.'); }
    if (e.target.closest('[data-new-child]')) return openNewSubjectSheet(store, navigate, s.id);
    if (e.target.closest('[data-compose]')) return openComposer(store, s.id);
    if (e.target.closest('[data-menu]')) return openMenu(store, navigate, s);
  };

  root.onchange = e => {
    const box = e.target.closest('[data-done]');
    if (box && box.checked) setTimeout(() => { store.completeAction(box.dataset.done); notice('Fait.'); }, 150);
  };

  // L'écouteur d'appui long est posé une seule fois sur root (qui survit aux rendus) ;
  // le handler courant est stocké sur root pour toujours viser le bon store.
  root._entryMenu = el => openEntryMenu(store, el.dataset.entry);
  if (!root._longPressBound) {
    longPress(root, '[data-entry]', el => root._entryMenu?.(el));
    root._longPressBound = true;
  }
}

function openComposer(store, subjectId, type = 'thought') {
  const sheet = openSheet(`
    <div class="sheet-tabs" role="tablist">
      ${Object.entries(TYPE_LABEL).map(([k, v]) => `<button role="tab" data-type="${k}" aria-selected="${k === type}">${v}</button>`).join('')}
    </div>
    <form>
      <textarea name="content" placeholder="${type === 'action' ? 'Quelque chose que je peux faire…' : type === 'decision' ? 'Ce que je décide…' : 'Ce qui me traverse…'}"></textarea>
      <div class="sheet-actions">
        <button type="button" class="btn-text" data-cancel>Annuler</button>
        <button type="submit" class="btn">Ajouter</button>
      </div>
    </form>
  `);
  let current = type;
  sheet.querySelector('.sheet-tabs').onclick = e => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    current = b.dataset.type;
    sheet.querySelectorAll('[data-type]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    sheet.querySelector('textarea').placeholder = current === 'action' ? 'Quelque chose que je peux faire…' : current === 'decision' ? 'Ce que je décide…' : 'Ce qui me traverse…';
  };
  sheet.querySelector('[data-cancel]').onclick = closeSheet;
  sheet.querySelector('form').onsubmit = e => {
    e.preventDefault();
    try {
      store.addEntry(subjectId, current, new FormData(e.target).get('content'));
      closeSheet();
    } catch (err) { notice(err.message); }
  };
}

function openEntryMenu(store, entryId) {
  const e = store.doc.entries.find(x => x.id === entryId);
  if (!e || e.type === 'weight') return;
  const sheet = openSheet(`
    <ul class="menu-list">
      <li><button data-edit>Modifier</button></li>
      <li><button data-delete>Supprimer</button></li>
    </ul>
  `);
  sheet.querySelector('[data-edit]').onclick = () => {
    const s2 = openSheet(`
      <form>
        <textarea name="content">${escapeHtml(e.content)}</textarea>
        <div class="sheet-actions">
          <button type="button" class="btn-text" data-cancel>Annuler</button>
          <button type="submit" class="btn">Enregistrer</button>
        </div>
      </form>`);
    s2.querySelector('[data-cancel]').onclick = closeSheet;
    s2.querySelector('form').onsubmit = ev => {
      ev.preventDefault();
      try { store.updateEntry(entryId, new FormData(ev.target).get('content')); closeSheet(); } catch (err) { notice(err.message); }
    };
  };
  sheet.querySelector('[data-delete]').onclick = () => {
    if (confirm('Supprimer cette entrée ?')) { store.deleteEntry(entryId); closeSheet(); }
  };
}

function openMenu(store, navigate, s) {
  const sheet = openSheet(`
    <ul class="menu-list">
      <li><button data-rename>Renommer</button></li>
      <li><button data-move>Déplacer</button></li>
      ${s.restedAt === null ? '<li><button data-rest>Poser</button></li>' : ''}
      <li><button data-delete>Supprimer</button></li>
    </ul>
  `);
  sheet.querySelector('[data-rename]').onclick = () => {
    const t = prompt('Nouveau titre', s.title);
    if (t === null) return;
    try { store.renameSubject(s.id, t); closeSheet(); } catch (err) { notice(err.message); }
  };
  sheet.querySelector('[data-move]').onclick = () => openMoveSheet(store, s);
  sheet.querySelector('[data-rest]')?.addEventListener('click', () => openRestSheet(store, navigate, s));
  sheet.querySelector('[data-delete]').onclick = () => openDeleteSheet(store, navigate, s);
}

function openMoveSheet(store, s) {
  const doc = store.doc;
  const targets = q.moveTargets(doc, s.id);
  const sheet = openSheet(`
    <h2>Déplacer « ${escapeHtml(s.title)} »</h2>
    <form>
      <select name="parent">
        <option value="">— À la racine (devient un thème) —</option>
        ${targets.map(t => `<option value="${escapeHtml(t.id)}" ${t.id === s.parentId ? 'selected' : ''}>${escapeHtml(q.pathTitles(doc, t.id).join(' › '))}</option>`).join('')}
      </select>
      <div class="sheet-actions">
        <button type="button" class="btn-text" data-cancel>Annuler</button>
        <button type="submit" class="btn">Déplacer</button>
      </div>
    </form>
  `);
  sheet.querySelector('[data-cancel]').onclick = closeSheet;
  sheet.querySelector('form').onsubmit = e => {
    e.preventDefault();
    try { store.moveSubject(s.id, new FormData(e.target).get('parent') || null); closeSheet(); notice('Déplacé.'); } catch (err) { notice(err.message); }
  };
}

function openRestSheet(store, navigate, s) {
  const sheet = openSheet(`
    <h2>Poser « ${escapeHtml(s.title)} »</h2>
    <p class="empty">Le sujet quitte l'accueil, son histoire reste.</p>
    <form>
      <textarea name="word" placeholder="Un dernier mot ? (optionnel)"></textarea>
      <div class="sheet-actions">
        <button type="button" class="btn-text" data-cancel>Annuler</button>
        <button type="submit" class="btn">Poser</button>
      </div>
    </form>
  `);
  sheet.querySelector('[data-cancel]').onclick = closeSheet;
  sheet.querySelector('form').onsubmit = e => {
    e.preventDefault();
    store.restSubject(s.id, new FormData(e.target).get('word'));
    closeSheet();
    notice('Posé.');
    navigate({ name: 'home' });
  };
}

function openDeleteSheet(store, navigate, s) {
  const impact = store.deletionImpact(s.id);
  const parentId = s.parentId;
  const sheet = openSheet(`
    <h2>Supprimer « ${escapeHtml(s.title)} » ?</h2>
    <p class="empty">${impact.subjects} sujet${impact.subjects > 1 ? 's' : ''} et ${impact.entries} entrée${impact.entries > 1 ? 's' : ''} seront supprimés. C'est irréversible.</p>
    <div class="sheet-actions">
      ${impact.entries > 5 ? '<button class="btn-quiet" data-export>Exporter d\'abord</button>' : ''}
      <button class="btn-text" data-cancel>Annuler</button>
      <button class="btn" data-confirm>Supprimer</button>
    </div>
  `);
  sheet.querySelector('[data-cancel]').onclick = closeSheet;
  sheet.querySelector('[data-export]')?.addEventListener('click', () => downloadText(store.exportFilename(), store.exportJson()));
  sheet.querySelector('[data-confirm]').onclick = () => {
    store.deleteSubject(s.id);
    closeSheet();
    notice('Supprimé.');
    if (parentId) navigate({ name: 'subject', id: parentId }); else navigate({ name: 'home' });
  };
}
