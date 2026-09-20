import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDoc } from './fixtures.mjs';
import { escapeHtml, weightDots, formatDate, relativeDays, daysBetween, pathLabel } from '../js/views/helpers.js';

test('escapeHtml neutralise les caractères spéciaux', () => {
  assert.equal(escapeHtml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('weightDots rend trois points ou un tiret', () => {
  assert.equal(weightDots(2), '<span class="dots" aria-label="Poids 2 sur 3">●●○</span>');
  assert.equal(weightDots(0), '<span class="dots dots-none" aria-label="Sans poids">—</span>');
});

test('formatDate en français court', () => {
  assert.equal(formatDate('2026-09-19T10:00:00.000Z'), '19 sept.');
});

test('daysBetween et relativeDays', () => {
  const now = '2026-09-20T23:00:00.000Z';
  assert.equal(daysBetween('2026-09-20T01:00:00.000Z', now), 0);
  assert.equal(daysBetween('2026-09-17T10:00:00.000Z', now), 3);
  assert.equal(relativeDays('2026-09-20T01:00:00.000Z', now), "aujourd'hui");
  assert.equal(relativeDays('2026-09-19T10:00:00.000Z', now), 'hier');
  assert.equal(relativeDays('2026-09-12T10:00:00.000Z', now), 'il y a 8 j');
});

test('pathLabel joint les ancêtres', () => {
  const doc = makeDoc();
  assert.equal(pathLabel(doc, 'communication'), 'Relations › Papa');
  assert.equal(pathLabel(doc, 'relations'), '');
});
