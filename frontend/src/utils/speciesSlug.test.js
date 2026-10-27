import test from 'node:test';
import assert from 'node:assert/strict';
import { speciesSlug } from './speciesSlug.js';

test('uses matching, URL-safe names for species photos', () => {
  assert.equal(speciesSlug('Smallmouth bass'), 'smallmouth-bass');
  assert.equal(speciesSlug('Lake sturgeon'), 'lake-sturgeon');
  assert.equal(speciesSlug('  Brown___Trout  '), 'brown-trout');
  assert.equal(speciesSlug(''), '');
});
