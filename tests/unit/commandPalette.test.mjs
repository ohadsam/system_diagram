import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterCommands } from '../../js/toolbar/commandPalette.js';

const commands = [
  { id: 'export-png', label: '🖼️ Export PNG', keywords: ['export', 'png', 'image', 'picture'] },
  { id: 'auto-arrange', label: '🗺️ Auto-arrange', keywords: ['arrange', 'layout', 'tidy', 'order', 'sort'] },
  { id: 'export-pdf', label: '📄 Export PDF', keywords: ['export', 'pdf', 'print', 'document'] },
];

test('filterCommands returns everything for an empty/blank query', () => {
  assert.equal(filterCommands(commands, '').length, 3);
  assert.equal(filterCommands(commands, '   ').length, 3);
});

test('filterCommands matches on label text, case-insensitively', () => {
  const result = filterCommands(commands, 'AUTO-ARRANGE');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'auto-arrange');
});

test('filterCommands matches on a keyword not present in the label', () => {
  const result = filterCommands(commands, 'print');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'export-pdf');
});

test('filterCommands matches multiple commands sharing a keyword', () => {
  const result = filterCommands(commands, 'export');
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((c) => c.id).sort(), ['export-pdf', 'export-png']);
});

test('filterCommands returns nothing for a query matching neither label nor keywords', () => {
  assert.equal(filterCommands(commands, 'zzz-nonexistent').length, 0);
});

test('filterCommands tolerates commands with no keywords array', () => {
  const noKeywords = [{ id: 'plain', label: 'Plain Action' }];
  assert.equal(filterCommands(noKeywords, 'plain').length, 1);
  assert.equal(filterCommands(noKeywords, 'nomatch').length, 0);
});
