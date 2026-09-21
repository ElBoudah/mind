import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, routeHash } from '../js/router.js';

test('parseRoute reconnaît les quatre écrans', () => {
  assert.deepEqual(parseRoute(''), { name: 'home' });
  assert.deepEqual(parseRoute('#/'), { name: 'home' });
  assert.deepEqual(parseRoute('#/s/abc-123'), { name: 'subject', id: 'abc-123' });
  assert.deepEqual(parseRoute('#/search'), { name: 'search' });
  assert.deepEqual(parseRoute('#/settings'), { name: 'settings' });
  assert.deepEqual(parseRoute('#/nimporte'), { name: 'home' });
  assert.deepEqual(parseRoute('#/s/'), { name: 'home' });
});

test('routeHash est l\'inverse de parseRoute', () => {
  for (const r of [{ name: 'home' }, { name: 'subject', id: 'x1' }, { name: 'search' }, { name: 'settings' }]) {
    assert.deepEqual(parseRoute(routeHash(r)), r);
  }
});

test('parseRoute reconnaît la vue d\'ensemble', () => {
  assert.deepEqual(parseRoute('#/tree'), { name: 'tree' });
  assert.equal(routeHash({ name: 'tree' }), '#/tree');
});
