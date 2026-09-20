import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDoc } from './fixtures.mjs';
import * as q from '../js/queries.js';

test('subjectById retourne le sujet ou undefined', () => {
  const doc = makeDoc();
  assert.equal(q.subjectById(doc, 'papa').title, 'Papa');
  assert.equal(q.subjectById(doc, 'nope'), undefined);
});

test('children exclut les posés par défaut et trie par order', () => {
  const doc = makeDoc();
  assert.deepEqual(q.children(doc, 'papa').map(s => s.id), ['communication']);
  assert.deepEqual(q.children(doc, 'papa', { includeRested: true }).map(s => s.id), ['communication', 'vacances']);
  assert.deepEqual(q.children(doc, 'relations').map(s => s.id), ['papa', 'laura']);
});

test('roots retourne les racines actives triées', () => {
  assert.deepEqual(q.roots(makeDoc()).map(s => s.id), ['relations', 'travail']);
});

test('ancestors va de la racine au parent direct', () => {
  const doc = makeDoc();
  assert.deepEqual(q.ancestors(doc, 'communication').map(s => s.id), ['relations', 'papa']);
  assert.deepEqual(q.ancestors(doc, 'relations'), []);
});

test('descendantIds liste tout le sous-arbre sans le sujet lui-même', () => {
  const doc = makeDoc();
  assert.deepEqual(q.descendantIds(doc, 'relations').sort(), ['communication', 'laura', 'papa', 'vacances']);
  assert.deepEqual(q.descendantIds(doc, 'laura'), []);
});

test('isActive tient compte des ancêtres posés', () => {
  const doc = makeDoc();
  assert.equal(q.isActive(doc, 'papa'), true);
  assert.equal(q.isActive(doc, 'vacances'), false);
  assert.equal(q.isActive(doc, 'trail'), false);
  assert.equal(q.isActive(doc, 'moi'), false);
});
