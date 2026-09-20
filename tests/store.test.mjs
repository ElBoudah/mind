import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDoc } from './fixtures.mjs';
import { Store, emptyDoc, validateDoc, migrate, SCHEMA_VERSION, STORAGE_KEY, CORRUPT_KEY } from '../js/store.js';
import * as q from '../js/queries.js';

export function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k), _map: m };
}

let tick = 0;
export function fakeNow() { tick += 1; return `2026-09-20T10:${String(tick).padStart(2, '0')}:00.000Z`; }
let idc = 0;
export function fakeId() { idc += 1; return `id${idc}`; }

export function newStore(doc) {
  tick = 0; idc = 0;
  const storage = memoryStorage(doc ? { [STORAGE_KEY]: JSON.stringify(doc) } : {});
  const store = new Store(storage, { now: fakeNow, makeId: fakeId });
  store.load();
  return { store, storage };
}

test('emptyDoc crée trois thèmes', () => {
  const doc = emptyDoc(fakeNow, fakeId);
  assert.equal(doc.version, SCHEMA_VERSION);
  assert.deepEqual(doc.subjects.map(s => s.title), ['Relations', 'Travail', 'Moi']);
  assert.ok(doc.subjects.every(s => s.parentId === null && s.weight === 0 && s.restedAt === null));
  assert.deepEqual(doc.entries, []);
});

test('validateDoc accepte un document correct', () => {
  const r = validateDoc(makeDoc());
  assert.equal(r.ok, true);
});

test('validateDoc refuse les documents incohérents avec un message français', () => {
  assert.equal(validateDoc(null).ok, false);
  assert.equal(validateDoc({ version: 99, subjects: [], entries: [] }).ok, false);
  const dupId = makeDoc(); dupId.subjects[1].id = dupId.subjects[0].id;
  assert.match(validateDoc(dupId).error, /identifiant/i);
  const orphan = makeDoc(); orphan.subjects[1].parentId = 'inexistant';
  assert.match(validateDoc(orphan).error, /parent/i);
  const badEntry = makeDoc(); badEntry.entries[0].subjectId = 'inexistant';
  assert.match(validateDoc(badEntry).error, /sujet/i);
  const cycle = makeDoc(); cycle.subjects.find(s => s.id === 'relations').parentId = 'papa';
  assert.match(validateDoc(cycle).error, /cycle/i);
  const badType = makeDoc(); badType.entries[0].type = 'note';
  assert.match(validateDoc(badType).error, /type/i);
  const badWeight = makeDoc(); badWeight.subjects[1].weight = 7;
  assert.match(validateDoc(badWeight).error, /poids/i);
  const rootWeight = makeDoc(); rootWeight.subjects.find(s => s.id === 'relations').weight = 2;
  assert.match(validateDoc(rootWeight).error, /racine|thème/i);
  assert.equal(validateDoc({ version: 1, subjects: [null], entries: [] }).ok, false);
  assert.equal(validateDoc({ version: 1, subjects: [], entries: [null] }).ok, false);
});

test('migrate laisse un document courant inchangé', () => {
  const doc = makeDoc();
  assert.deepEqual(migrate(doc), doc);
});

test('load sans données crée un document vide et le sauvegarde', () => {
  const { store, storage } = newStore();
  assert.equal(store.doc.subjects.length, 3);
  assert.ok(storage.getItem(STORAGE_KEY));
});

test('load avec données valides les restitue', () => {
  const { store } = newStore(makeDoc());
  assert.equal(store.doc.subjects.length, 9);
  assert.equal(store.corrupt, null);
});

test('load avec données corrompues repart à vide et garde le brut', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{pas du json' });
  const store = new Store(storage, { now: fakeNow, makeId: fakeId });
  store.load();
  assert.equal(store.doc.subjects.length, 3);
  assert.equal(store.corrupt, '{pas du json');
});

test('subscribe notifie après une opération et se désabonne', () => {
  const { store } = newStore(makeDoc());
  let calls = 0;
  const off = store.subscribe(() => { calls += 1; });
  store._commit(() => {});
  assert.equal(calls, 1);
  off();
  store._commit(() => {});
  assert.equal(calls, 1);
});

test('load avec un document JSON valide mais mal formé repart à vide', () => {
  const raw = JSON.stringify({ version: 1, subjects: [null], entries: [] });
  const storage = memoryStorage({ [STORAGE_KEY]: raw });
  const store = new Store(storage, { now: fakeNow, makeId: fakeId });
  store.load();
  assert.equal(store.doc.subjects.length, 3);
  assert.equal(store.corrupt, raw);
});

test('un document corrompu survit au rechargement dans une clé de secours', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{pas du json' });
  const first = new Store(storage, { now: fakeNow, makeId: fakeId });
  first.load();
  const second = new Store(storage, { now: fakeNow, makeId: fakeId });
  second.load();
  assert.equal(second.corrupt, '{pas du json');
  assert.equal(second.doc.subjects.length, 3);
  second.clearCorrupt();
  assert.equal(second.corrupt, null);
  const third = new Store(storage, { now: fakeNow, makeId: fakeId }); third.load();
  assert.equal(third.corrupt, null);
});

test('un échec de sauvegarde est signalé sans casser la notification', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(makeDoc()) });
  const store = new Store(storage, { now: fakeNow, makeId: fakeId });
  store.load();
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  let notified = 0, reported = null;
  store.subscribe(() => { notified += 1; });
  store.onSaveError = m => { reported = m; };
  store.setWeight('laura', 1);
  assert.equal(notified, 1);
  assert.match(reported, /stockage/i);
  assert.match(store.saveError, /stockage/i);
  assert.equal(store.doc.subjects.find(s => s.id === 'laura').weight, 1);
});

test('setIntent sauvegarde sans notifier (évite le re-rendu pendant le blur)', () => {
  const { store, storage } = newStore(makeDoc());
  let notified = 0;
  store.subscribe(() => { notified += 1; });
  store.setIntent('papa', 'Nouvelle intention');
  assert.equal(notified, 0);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).subjects.find(s => s.id === 'papa').intent, 'Nouvelle intention');
});

test('createSubject ajoute un enfant avec le bon order', () => {
  const { store } = newStore(makeDoc());
  const s = store.createSubject({ title: '  Alice ', parentId: 'relations' });
  assert.equal(s.title, 'Alice');
  assert.equal(s.parentId, 'relations');
  assert.equal(s.order, 3); // papa 1, laura 2
  assert.equal(s.weight, 0);
  assert.throws(() => store.createSubject({ title: '   ', parentId: 'relations' }), /titre/i);
  assert.throws(() => store.createSubject({ title: 'X', parentId: 'inexistant' }), /parent/i);
});

test('renameSubject et setIntent', () => {
  const { store } = newStore(makeDoc());
  store.renameSubject('papa', ' Mon père ');
  store.setIntent('papa', 'Retrouver de la complicité.');
  assert.equal(store.doc.subjects.find(s => s.id === 'papa').title, 'Mon père');
  assert.equal(store.doc.subjects.find(s => s.id === 'papa').intent, 'Retrouver de la complicité.');
  assert.throws(() => store.renameSubject('papa', ''), /titre/i);
});

test('setWeight change le poids et trace une entrée', () => {
  const { store } = newStore(makeDoc());
  const before = store.doc.entries.length;
  store.setWeight('laura', 2);
  assert.equal(store.doc.subjects.find(s => s.id === 'laura').weight, 2);
  const last = store.doc.entries.at(-1);
  assert.equal(last.type, 'weight');
  assert.equal(last.content, '2');
  assert.equal(last.subjectId, 'laura');
  store.setWeight('laura', 2); // inchangé
  assert.equal(store.doc.entries.length, before + 1);
  assert.throws(() => store.setWeight('relations', 1), /racine|thème/i);
  assert.throws(() => store.setWeight('laura', 4), /poids/i);
});

test('moveSubject refuse un descendant et une cible posée', () => {
  const { store } = newStore(makeDoc());
  assert.throws(() => store.moveSubject('papa', 'communication'), /descendant/i);
  assert.throws(() => store.moveSubject('papa', 'papa'), /lui-même/i);
  assert.throws(() => store.moveSubject('papa', 'moi'), /posé/i);
  store.moveSubject('laura', 'travail');
  const laura = store.doc.subjects.find(s => s.id === 'laura');
  assert.equal(laura.parentId, 'travail');
  assert.equal(laura.order, 2); // job est order 1
});

test('moveSubject vers la racine remet le poids à 0', () => {
  const { store } = newStore(makeDoc());
  store.moveSubject('papa', null);
  const papa = store.doc.subjects.find(s => s.id === 'papa');
  assert.equal(papa.parentId, null);
  assert.equal(papa.weight, 0);
  assert.equal(papa.order, 4);
});

test('restSubject pose et note un dernier mot ; resumeSubject reprend', () => {
  const { store } = newStore(makeDoc());
  store.restSubject('papa', ' On en est là. ');
  const papa = store.doc.subjects.find(s => s.id === 'papa');
  assert.ok(papa.restedAt);
  const last = store.doc.entries.at(-1);
  assert.equal(last.type, 'thought');
  assert.equal(last.content, 'On en est là.');
  store.resumeSubject('papa');
  assert.equal(store.doc.subjects.find(s => s.id === 'papa').restedAt, null);
  const n = store.doc.entries.length;
  store.restSubject('papa');
  assert.equal(store.doc.entries.length, n); // pas d'entrée vide
});

test('deletionImpact et deleteSubject suppriment le sous-arbre', () => {
  const { store } = newStore(makeDoc());
  assert.deepEqual(store.deletionImpact('papa'), { subjects: 3, entries: 6 });
  const r = store.deleteSubject('papa');
  assert.deepEqual(r, { subjects: 3, entries: 6 });
  assert.ok(!store.doc.subjects.some(s => ['papa', 'communication', 'vacances'].includes(s.id)));
  assert.ok(!store.doc.entries.some(e => ['papa', 'communication', 'vacances'].includes(e.subjectId)));
  assert.equal(store.doc.subjects.length, 6);
});

test('addEntry crée pensée, décision ou action ouverte', () => {
  const { store } = newStore(makeDoc());
  const a = store.addEntry('laura', 'action', ' Proposer une rando ');
  assert.equal(a.content, 'Proposer une rando');
  assert.equal(a.doneAt, null);
  assert.equal(a.subjectId, 'laura');
  const d = store.addEntry('laura', 'decision', 'Je propose une activité, pas un café.');
  assert.equal(d.type, 'decision');
  assert.throws(() => store.addEntry('laura', 'weight', '2'), /type/i);
  assert.throws(() => store.addEntry('laura', 'thought', '  '), /vide/i);
  assert.throws(() => store.addEntry('inexistant', 'thought', 'x'), /sujet/i);
});

test('updateEntry et deleteEntry', () => {
  const { store } = newStore(makeDoc());
  store.updateEntry('e-papa-1', ' Corrigé ');
  assert.equal(store.doc.entries.find(e => e.id === 'e-papa-1').content, 'Corrigé');
  assert.throws(() => store.updateEntry('e-papa-1', ''), /vide/i);
  store.deleteEntry('e-papa-1');
  assert.ok(!store.doc.entries.some(e => e.id === 'e-papa-1'));
  assert.throws(() => store.deleteEntry('e-papa-1'), /introuvable/i);
});

test('completeAction remplit doneAt et la fait passer au journal', () => {
  const { store } = newStore(makeDoc());
  store.completeAction('e-papa-3');
  const e = store.doc.entries.find(x => x.id === 'e-papa-3');
  assert.ok(e.doneAt);
  assert.ok(!q.openActions(store.doc, 'papa').some(x => x.id === 'e-papa-3'));
  assert.ok(q.journal(store.doc, 'papa').some(x => x.id === 'e-papa-3'));
  assert.throws(() => store.completeAction('e-papa-3'), /déjà/i);
  assert.throws(() => store.completeAction('e-papa-1'), /action/i);
});

test('exportJson et exportFilename', () => {
  const { store } = newStore(makeDoc());
  const text = store.exportJson();
  assert.deepEqual(JSON.parse(text), makeDoc());
  assert.ok(text.includes('\n  '));
  assert.equal(store.exportFilename('2026-09-20T15:04:05.000Z'), 'mind-2026-09-20.json');
});

test('importJson remplace tout si valide, ne touche rien sinon', () => {
  const { store, storage } = newStore(makeDoc());
  let notified = 0;
  store.subscribe(() => { notified += 1; });
  assert.throws(() => store.importJson('{pas du json'), /valide|JSON/i);
  assert.throws(() => store.importJson(JSON.stringify({ version: 1, subjects: [], entries: [{ id: 'x' }] })), /entrée|sujet/i);
  assert.equal(store.doc.subjects.length, 9);
  assert.equal(notified, 0);
  const fresh = emptyDoc(fakeNow, fakeId);
  store.importJson(JSON.stringify(fresh));
  assert.equal(store.doc.subjects.length, 3);
  assert.equal(notified, 1);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).subjects.length, 3);
});

test('setWeight ne garde qu\'une entrée de poids par jour, la dernière', () => {
  const { store } = newStore(makeDoc());
  store.setWeight('laura', 1);
  store.setWeight('laura', 2);
  store.setWeight('laura', 3);
  const weights = store.doc.entries.filter(e => e.subjectId === 'laura' && e.type === 'weight');
  assert.equal(weights.length, 1);
  assert.equal(weights[0].content, '3');
  assert.equal(store.doc.subjects.find(s => s.id === 'laura').weight, 3);
  // une entrée de poids d'un autre jour (e-job-2, le 18/09) n'est pas écrasée : fakeNow est le 20/09
  store.setWeight('job', 3);
  const jobWeights = store.doc.entries.filter(e => e.subjectId === 'job' && e.type === 'weight');
  assert.equal(jobWeights.length, 2);
  assert.equal(jobWeights.at(-1).content, '3');
});
