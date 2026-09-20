// État de l'application : un document JSON, persisté à chaque opération.
import * as q from './queries.js';

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'mind.doc';
export const ENTRY_TYPES = ['thought', 'decision', 'action', 'weight'];

const defaultNow = () => new Date().toISOString();
const defaultId = () => crypto.randomUUID();

export function emptyDoc(now = defaultNow, makeId = defaultId) {
  const createdAt = now();
  const subjects = ['Relations', 'Travail', 'Moi'].map((title, i) => ({
    id: makeId(), parentId: null, title, intent: '', weight: 0, order: i + 1, createdAt, restedAt: null,
  }));
  return { version: SCHEMA_VERSION, subjects, entries: [] };
}

const isStr = v => typeof v === 'string';
const isIsoOrNull = v => v === null || isStr(v);

export function validateDoc(raw) {
  const fail = error => ({ ok: false, error });
  if (!raw || typeof raw !== 'object') return fail("Le fichier n'est pas un document valide.");
  if (!Number.isInteger(raw.version) || raw.version < 1 || raw.version > SCHEMA_VERSION) {
    return fail(`Version de fichier inconnue (${raw.version}).`);
  }
  if (!Array.isArray(raw.subjects) || !Array.isArray(raw.entries)) return fail('Listes de sujets ou d\'entrées manquantes.');

  const ids = new Set();
  for (const s of raw.subjects) {
    if (!s || typeof s !== 'object') return fail('Sujet mal formé.');
    if (!isStr(s.id) || !isStr(s.title) || !isStr(s.intent) || !isStr(s.createdAt)
      || !(s.parentId === null || isStr(s.parentId)) || !isIsoOrNull(s.restedAt)
      || !Number.isInteger(s.order)) return fail(`Sujet mal formé (${s.id ?? '?'}).`);
    if (!Number.isInteger(s.weight) || s.weight < 0 || s.weight > 3) return fail(`Poids invalide sur « ${s.title} ».`);
    if (s.parentId === null && s.weight !== 0) return fail(`Un thème (racine) doit avoir un poids de 0 (« ${s.title} »).`);
    if (ids.has(s.id)) return fail(`Identifiant de sujet en double (${s.id}).`);
    ids.add(s.id);
  }
  for (const s of raw.subjects) {
    if (s.parentId !== null && !ids.has(s.parentId)) return fail(`Parent introuvable pour « ${s.title} ».`);
  }
  // cycles
  for (const s of raw.subjects) {
    const seen = new Set([s.id]);
    let cur = s;
    while (cur.parentId !== null) {
      if (seen.has(cur.parentId)) return fail(`Cycle détecté autour de « ${s.title} ».`);
      seen.add(cur.parentId);
      cur = raw.subjects.find(x => x.id === cur.parentId);
    }
  }
  const eids = new Set();
  for (const e of raw.entries) {
    if (!e || typeof e !== 'object') return fail('Entrée mal formée.');
    if (!isStr(e.id) || !isStr(e.content) || !isStr(e.createdAt) || !isIsoOrNull(e.doneAt)) return fail(`Entrée mal formée (${e.id ?? '?'}).`);
    if (!ENTRY_TYPES.includes(e.type)) return fail(`Type d'entrée inconnu (${e.type}).`);
    if (!ids.has(e.subjectId)) return fail(`Sujet introuvable pour une entrée (${e.id}).`);
    if (eids.has(e.id)) return fail(`Identifiant d'entrée en double (${e.id}).`);
    eids.add(e.id);
  }
  return { ok: true, doc: raw };
}

// Migrations séquentielles : MIGRATIONS[n] transforme la version n en n+1.
const MIGRATIONS = {};

export function migrate(doc) {
  let cur = doc;
  while (cur.version < SCHEMA_VERSION) {
    cur = MIGRATIONS[cur.version](cur);
  }
  return cur;
}

export class Store {
  constructor(storage, { now = defaultNow, makeId = defaultId } = {}) {
    this.storage = storage;
    this.now = now;
    this.makeId = makeId;
    this._doc = null;
    this.corrupt = null;
    this._subs = new Set();
  }

  get doc() { return this._doc; }

  load() {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw === null) {
      this._doc = emptyDoc(this.now, this.makeId);
      this._save();
      return;
    }
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = undefined; }
    const v = validateDoc(parsed);
    if (!v.ok) {
      this.corrupt = raw;
      this._doc = emptyDoc(this.now, this.makeId);
      this._save();
      return;
    }
    const before = v.doc.version;
    this._doc = migrate(v.doc);
    if (this._doc.version !== before) this._save();
  }

  subscribe(fn) {
    this._subs.add(fn);
    return () => this._subs.delete(fn);
  }

  _save() {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(this._doc));
  }

  _commit(mutator) {
    const result = mutator(this._doc);
    this._save();
    for (const fn of this._subs) fn(this._doc);
    return result;
  }

  _subject(id) {
    const s = q.subjectById(this._doc, id);
    if (!s) throw new Error(`Sujet introuvable (${id}).`);
    return s;
  }

  _entry(id) {
    const e = this._doc.entries.find(x => x.id === id);
    if (!e) throw new Error(`Entrée introuvable (${id}).`);
    return e;
  }

  _nextOrder(parentId) {
    const siblings = q.children(this._doc, parentId, { includeRested: true });
    return siblings.reduce((m, s) => Math.max(m, s.order), 0) + 1;
  }

  _cleanTitle(title) {
    const t = (title ?? '').trim();
    if (!t) throw new Error('Le titre ne peut pas être vide.');
    return t;
  }

  createSubject({ title, parentId = null }) {
    const t = this._cleanTitle(title);
    if (parentId !== null && !q.subjectById(this._doc, parentId)) throw new Error('Parent introuvable.');
    return this._commit(doc => {
      const s = {
        id: this.makeId(), parentId, title: t, intent: '', weight: 0,
        order: this._nextOrder(parentId), createdAt: this.now(), restedAt: null,
      };
      doc.subjects.push(s);
      return s;
    });
  }

  renameSubject(id, title) {
    const t = this._cleanTitle(title);
    const s = this._subject(id);
    this._commit(() => { s.title = t; });
  }

  setIntent(id, intent) {
    const s = this._subject(id);
    this._commit(() => { s.intent = intent ?? ''; });
  }

  setWeight(id, weight) {
    if (!Number.isInteger(weight) || weight < 0 || weight > 3) throw new Error('Poids invalide.');
    const s = this._subject(id);
    if (s.parentId === null) throw new Error('Un thème (racine) n\'a pas de poids.');
    if (s.weight === weight) return;
    this._commit(doc => {
      s.weight = weight;
      doc.entries.push({ id: this.makeId(), subjectId: id, type: 'weight', content: String(weight), createdAt: this.now(), doneAt: null });
    });
  }

  moveSubject(id, newParentId) {
    const s = this._subject(id);
    if (newParentId === id) throw new Error('Un sujet ne peut pas être déplacé dans lui-même.');
    if (newParentId !== null) {
      if (q.descendantIds(this._doc, id).includes(newParentId)) throw new Error('Impossible de déplacer un sujet dans un de ses descendants.');
      const target = this._subject(newParentId);
      if (!q.isActive(this._doc, target.id)) throw new Error('La cible est un sujet posé.');
    }
    const newOrder = this._nextOrder(newParentId);
    this._commit(() => {
      s.parentId = newParentId;
      s.order = newOrder;
      if (newParentId === null) s.weight = 0;
    });
  }


  restSubject(id, lastWord = '') {
    const s = this._subject(id);
    const word = (lastWord ?? '').trim();
    this._commit(doc => {
      if (word) doc.entries.push({ id: this.makeId(), subjectId: id, type: 'thought', content: word, createdAt: this.now(), doneAt: null });
      s.restedAt = this.now();
    });
  }

  resumeSubject(id) {
    const s = this._subject(id);
    this._commit(() => { s.restedAt = null; });
  }

  deletionImpact(id) {
    this._subject(id);
    const ids = new Set([id, ...q.descendantIds(this._doc, id)]);
    return { subjects: ids.size, entries: this._doc.entries.filter(e => ids.has(e.subjectId)).length };
  }

  deleteSubject(id) {
    const impact = this.deletionImpact(id);
    const ids = new Set([id, ...q.descendantIds(this._doc, id)]);
    this._commit(doc => {
      doc.subjects = doc.subjects.filter(s => !ids.has(s.id));
      doc.entries = doc.entries.filter(e => !ids.has(e.subjectId));
    });
    return impact;
  }

  addEntry(subjectId, type, content) {
    if (!['thought', 'decision', 'action'].includes(type)) throw new Error(`Type d'entrée non autorisé (${type}).`);
    const c = (content ?? '').trim();
    if (!c) throw new Error('Le contenu ne peut pas être vide.');
    this._subject(subjectId);
    return this._commit(doc => {
      const e = { id: this.makeId(), subjectId, type, content: c, createdAt: this.now(), doneAt: null };
      doc.entries.push(e);
      return e;
    });
  }

  updateEntry(id, content) {
    const c = (content ?? '').trim();
    if (!c) throw new Error('Le contenu ne peut pas être vide.');
    const e = this._entry(id);
    this._commit(() => { e.content = c; });
  }

  deleteEntry(id) {
    this._entry(id);
    this._commit(doc => { doc.entries = doc.entries.filter(x => x.id !== id); });
  }

  completeAction(id) {
    const e = this._entry(id);
    if (e.type !== 'action') throw new Error('Cette entrée n\'est pas une action.');
    if (e.doneAt !== null) throw new Error('Action déjà faite.');
    this._commit(() => { e.doneAt = this.now(); });
  }

  exportJson() {
    return JSON.stringify(this._doc, null, 2);
  }

  exportFilename(dateIso = this.now()) {
    return `mind-${dateIso.slice(0, 10)}.json`;
  }

  importJson(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error('Le fichier n\'est pas du JSON valide.'); }
    const v = validateDoc(parsed);
    if (!v.ok) throw new Error(v.error);
    const doc = migrate(v.doc);
    this._commit(() => { this._doc = doc; });
  }
}
