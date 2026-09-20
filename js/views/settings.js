import * as q from '../queries.js';
import { validateDoc } from '../store.js';
import { escapeHtml, pathLabel, formatDate, downloadText, notice } from './helpers.js';

const APP_VERSION = '1.0.1';

export function render(root, { store, navigate, applyTheme, currentTheme }) {
  const doc = store.doc;
  const rested = q.restedSubjects(doc);
  const theme = currentTheme();
  root.innerHTML = `
    <nav class="crumbs"><button data-home>‹ Accueil</button></nav>
    <h1 class="title"><span>Réglages</span></h1>

    <section class="section">
      <h2 class="section-title">Apparence</h2>
      <div class="sheet-tabs">
        ${[['system', 'Système'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, v]) =>
          `<button data-theme-pref="${k}" aria-selected="${k === theme}">${v}</button>`).join('')}
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Mes données</h2>
      <button class="row" data-export><span class="row-main"><span class="row-title">Exporter mes données</span><span class="row-sub">Télécharge un fichier JSON</span></span></button>
      <button class="row" data-import><span class="row-main"><span class="row-title">Importer des données</span><span class="row-sub">Remplace tout par un fichier exporté</span></span></button>
      <input type="file" accept="application/json,.json" hidden>
      ${store.corrupt ? '<button class="row" data-recover><span class="row-main"><span class="row-title">Récupérer les données illisibles</span><span class="row-sub">Télécharge le contenu brut trouvé au démarrage</span></span></button>' : ''}
      ${store.corrupt ? '<button class="row" data-forget-corrupt><span class="row-main"><span class="row-title">Oublier les données illisibles</span><span class="row-sub">Après les avoir téléchargées</span></span></button>' : ''}
    </section>

    <section class="section">
      <h2 class="section-title">Sujets posés</h2>
      ${rested.map(s => `<button class="row" data-go="${escapeHtml(s.id)}">
          <span class="row-main"><span class="row-title">${escapeHtml(s.title)}</span><span class="row-sub">${escapeHtml(pathLabel(doc, s.id))}</span></span>
          <span class="row-aside">posé le ${formatDate(s.restedAt)}</span>
        </button>`).join('') || '<p class="empty">Rien de posé pour l\'instant.</p>'}
    </section>

    <p class="empty">Mind ${APP_VERSION}</p>
  `;

  const fileInput = root.querySelector('input[type="file"]');
  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { notice('Le fichier n\'est pas du JSON valide.'); fileInput.value = ''; return; }
    const v = validateDoc(parsed);
    if (!v.ok) { notice(v.error); fileInput.value = ''; return; }
    if (!confirm('Remplacer toutes les données actuelles par ce fichier ?')) { fileInput.value = ''; return; }
    try { store.importJson(text); notice('Données importées.'); } catch (err) { notice(err.message); }
    fileInput.value = '';
  };

  root.onclick = e => {
    if (e.target.closest('[data-home]')) return navigate({ name: 'home' });
    const go = e.target.closest('[data-go]');
    if (go) return navigate({ name: 'subject', id: go.dataset.go });
    const pref = e.target.closest('[data-theme-pref]');
    if (pref) { applyTheme(pref.dataset.themePref); root.querySelectorAll('[data-theme-pref]').forEach(b => b.setAttribute('aria-selected', String(b === pref))); return; }
    if (e.target.closest('[data-export]')) return downloadText(store.exportFilename(), store.exportJson());
    if (e.target.closest('[data-import]')) return fileInput.click();
    if (e.target.closest('[data-recover]')) return downloadText('mind-illisible.json', store.corrupt);
    if (e.target.closest('[data-forget-corrupt]')) {
      if (confirm('Oublier définitivement les données illisibles ?')) { store.clearCorrupt(); notice('Oublié.'); }
      return;
    }
  };
}
