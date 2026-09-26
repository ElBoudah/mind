// Backup automatique de Mind — deux couches, zéro action au quotidien :
// 1) local : un fichier daté dans Téléchargements, au premier lancement du jour ;
// 2) cloud : le même document, chiffré côté client (AES-256-GCM), poussé sur un
//    Gist GitHub privé. Push-only : le cloud est un backup, jamais une synchro.
// La config (token + passphrase + gistId) vit dans le localStorage, PARTAGÉ
// entre les apps du même domaine *.github.io : configurée une fois (Suivi,
// Rappel ou ici), elle sert partout.

import { STORAGE_KEY, validateDoc, migrate } from './store.js';

/* ---------- Bundle complet ---------- */
export function mindBundleJson() {
  let doc = null;
  try { doc = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* vide */ }
  return JSON.stringify(
    { format: 'mind-export-1', exportedAt: new Date().toISOString(), doc },
    null, 1
  );
}

/* ---------- Helpers base64 ---------- */
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const ub64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

/* ---------- Chiffrement (PBKDF2 -> AES-256-GCM) ---------- */
async function deriveKey(pass, salt) {
  const km = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptText(pass, text) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return JSON.stringify({ v: 1, kdf: 'PBKDF2-150k', salt: b64(salt), iv: b64(iv), data: b64(ct) });
}
async function decryptText(pass, packed) {
  const p = JSON.parse(packed);
  const key = await deriveKey(pass, ub64(p.salt));
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ub64(p.iv) }, key, ub64(p.data));
  return new TextDecoder().decode(pt);
}

/* ---------- Config partagée + API Gist ---------- */
function cloudConfig(interactive) {
  let token = localStorage.getItem('cloud_token');
  let pass = localStorage.getItem('cloud_pass');
  if ((!token || !pass) && interactive) {
    token = (prompt('Token GitHub (portée Gists uniquement) :') || '').trim();
    pass = (prompt('Passphrase de chiffrement (à noter précieusement !) :') || '').trim();
    if (token && pass) {
      localStorage.setItem('cloud_token', token);
      localStorage.setItem('cloud_pass', pass);
    }
  }
  return token && pass
    ? { token, pass, gistId: localStorage.getItem('cloud_gist') }
    : null;
}
async function gistApi(method, path, token, body) {
  const r = await fetch('https://api.github.com' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error('Gist API ' + r.status);
  return r.json();
}

/* ---------- Backup cloud quotidien (best-effort, jamais bloquant) ---------- */
const sessionDone = {};
export async function cloudBackup(appName, getJson, opts = {}) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const mark = 'cloud_last_' + appName;
    if (sessionDone[appName] && !opts.force) return 'déjà fait';
    if (localStorage.getItem(mark) === today && !opts.force) return 'déjà fait';
    const cfg = cloudConfig(!!opts.interactive);
    if (!cfg) return 'non configuré';
    const enc = await encryptText(cfg.pass, getJson());
    const file = appName + '.enc.json';
    if (!cfg.gistId) {
      const g = await gistApi('POST', '/gists', cfg.token, {
        description: 'Backups chiffrés PWA (AES-GCM, illisible sans passphrase)',
        public: false,
        files: { [file]: { content: enc } },
      });
      localStorage.setItem('cloud_gist', g.id);
    } else {
      await gistApi('PATCH', '/gists/' + cfg.gistId, cfg.token, {
        files: { [file]: { content: enc } },
      });
    }
    localStorage.setItem(mark, today);
    sessionDone[appName] = true;
    return 'ok';
  } catch (e) {
    console.warn('[cloud] backup échoué :', e);
    return 'erreur : ' + e.message;
  }
}

/* ---------- Restauration bas niveau ---------- */
export async function cloudRestore(appName) {
  const cfg = cloudConfig(true);
  if (!cfg) throw new Error('cloud non configuré');
  let gid = cfg.gistId;
  if (!gid) {
    gid = (prompt("ID du gist de backup (visible dans l'URL du gist) :") || '').trim();
    if (!gid) throw new Error("pas d'ID de gist");
    localStorage.setItem('cloud_gist', gid);
  }
  const g = await gistApi('GET', '/gists/' + gid, cfg.token);
  const f = g.files[appName + '.enc.json'];
  if (!f) throw new Error('aucun backup ' + appName + ' dans ce gist');
  const content = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
  return decryptText(cfg.pass, content);
}

/* ---------- Backup local quotidien (fichier daté dans Téléchargements) ---------- */
export function autoBackup(appName, getJson) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const mark = appName + '_lastBk';
    if (localStorage.getItem(mark) === today) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([getJson()], { type: 'application/json' }));
    a.download = appName + '_' + today + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    localStorage.setItem(mark, today);
  } catch { /* jamais bloquant */ }
}

/* ---------- Actions prêtes pour la vue Réglages ---------- */
export function cloudSetupMind() {
  return cloudBackup('mind', mindBundleJson, { interactive: true, force: true })
    .then(r => (r === 'ok' ? 'Cloud configuré — premier backup poussé.' : 'Cloud : ' + r));
}
export async function cloudRestoreMind() {
  if (!confirm('Restaurer Mind depuis le cloud ? Le document actuel de ce téléphone sera remplacé.')) return;
  try {
    const json = await cloudRestore('mind');
    const parsed = JSON.parse(json);
    const rawDoc = parsed && parsed.doc ? parsed.doc : parsed;   // bundle ou doc nu
    const v = validateDoc(rawDoc);
    if (!v.ok) throw new Error(v.error);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrate(v.doc)));
    location.reload();
  } catch (e) {
    alert('Restauration échouée : ' + e.message);
  }
}
export function cloudStatus() {
  const cfg = localStorage.getItem('cloud_token') && localStorage.getItem('cloud_pass');
  const last = localStorage.getItem('cloud_last_mind');
  return cfg
    ? (last ? 'cloud ✓ dernier push ' + last : 'cloud configuré, pas encore de push')
    : 'cloud non configuré';
}

/* ---------- Anti-éviction silencieuse d'Android ---------- */
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
