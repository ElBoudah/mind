import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDoc } from './fixtures.mjs';
import { Store, emptyDoc, validateDoc, migrate, SCHEMA_VERSION, STORAGE_KEY } from '../js/store.js';

export function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), _map: m };
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
