import * as q from '../queries.js';

export function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function weightDots(weight) {
  if (!weight) return '<span class="dots dots-none" aria-label="Sans poids">—</span>';
  return `<span class="dots" aria-label="Poids ${weight} sur 3">${'●'.repeat(weight)}${'○'.repeat(3 - weight)}</span>`;
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
export function formatDate(iso) {
  return dateFmt.format(new Date(iso));
}

export function daysBetween(isoA, isoB) {
  const day = 86_400_000;
  const a = Math.floor(new Date(isoA).getTime() / day);
  const b = Math.floor(new Date(isoB).getTime() / day);
  return b - a;
}

export function relativeDays(iso, nowIso = new Date().toISOString()) {
  const d = daysBetween(iso, nowIso);
  if (d <= 0) return "aujourd'hui";
  if (d === 1) return 'hier';
  return `il y a ${d} j`;
}

export function pathLabel(doc, id) {
  return q.ancestors(doc, id).map(s => s.title).join(' › ');
}

// --- DOM (non testé en Node) ---

export function closeSheet() {
  document.querySelector('.sheet-backdrop')?.remove();
}

export function openSheet(innerHtml) {
  closeSheet();
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.innerHTML = `<div class="sheet" role="dialog">${innerHtml}</div>`;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeSheet(); });
  document.body.appendChild(backdrop);
  backdrop.querySelector('input, textarea, select')?.focus();
  return backdrop.firstElementChild;
}

export function notice(message) {
  document.querySelector('.notice')?.remove();
  const el = document.createElement('div');
  el.className = 'notice';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function longPress(element, selector, handler, delayMs = 500) {
  let timer = null;
  let target = null;
  const cancel = () => { clearTimeout(timer); timer = null; target = null; };
  element.addEventListener('pointerdown', e => {
    target = e.target.closest(selector);
    if (!target) return;
    timer = setTimeout(() => { const t = target; cancel(); handler(t); }, delayMs);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave', 'scroll']) element.addEventListener(ev, cancel, { passive: true });
  element.addEventListener('pointermove', e => { if (timer && (Math.abs(e.movementX) > 6 || Math.abs(e.movementY) > 6)) cancel(); });
  element.addEventListener('contextmenu', e => {
    const t = e.target.closest(selector);
    if (t) { e.preventDefault(); cancel(); handler(t); }
  });
}
