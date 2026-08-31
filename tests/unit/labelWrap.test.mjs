import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTextWidth, wrapLabelLines, estimateWrappedBlockSize, DEFAULT_LABEL_MAX_WIDTH } from '../../js/core/labelWrap.js';

test('estimateTextWidth grows with text length and is 0 for empty/nullish text', () => {
  assert.equal(estimateTextWidth(''), 0);
  assert.equal(estimateTextWidth(null), 0);
  assert.ok(estimateTextWidth('hello') > 0);
  assert.ok(estimateTextWidth('hello world') > estimateTextWidth('hello'));
});

test('wrapLabelLines returns an empty array for empty/nullish/whitespace-only text', () => {
  assert.deepEqual(wrapLabelLines(''), []);
  assert.deepEqual(wrapLabelLines(null), []);
  assert.deepEqual(wrapLabelLines('   '), []);
});

test('wrapLabelLines keeps short text on one line', () => {
  assert.deepEqual(wrapLabelLines('short'), ['short']);
});

test('wrapLabelLines splits long text into multiple lines at word boundaries', () => {
  const text = 'This is a fairly long label that should wrap across several lines';
  const lines = wrapLabelLines(text, 100);
  assert.ok(lines.length > 1);
  // No word should be split mid-word: every line should be a substring of words joined by spaces.
  for (const line of lines) {
    assert.ok(text.includes(line));
  }
  assert.equal(lines.join(' '), text);
});

test('wrapLabelLines never leaves a line empty', () => {
  const lines = wrapLabelLines('a b c d e f g h i j k l m n o p', 30);
  for (const line of lines) assert.ok(line.length > 0);
});

test('wrapLabelLines keeps an unbreakable single long word on its own line rather than dropping it', () => {
  const lines = wrapLabelLines('supercalifragilisticexpialidocious', 20);
  assert.deepEqual(lines, ['supercalifragilisticexpialidocious']);
});

test('estimateWrappedBlockSize returns zero size for empty text', () => {
  const result = estimateWrappedBlockSize('');
  assert.deepEqual(result, { width: 0, height: 0, lines: [] });
});

test('estimateWrappedBlockSize height scales with number of wrapped lines', () => {
  const single = estimateWrappedBlockSize('short', DEFAULT_LABEL_MAX_WIDTH, 12);
  const multi = estimateWrappedBlockSize('a very long label that will definitely wrap onto multiple lines here', DEFAULT_LABEL_MAX_WIDTH, 12);
  assert.equal(single.height, 12);
  assert.ok(multi.lines.length > 1);
  assert.equal(multi.height, multi.lines.length * 12);
});

test('estimateWrappedBlockSize width is the widest wrapped line, not the whole text', () => {
  const text = 'a very long label that will definitely wrap onto multiple lines here';
  const { width, lines } = estimateWrappedBlockSize(text, 100);
  const maxLineWidth = Math.max(...lines.map((l) => estimateTextWidth(l)));
  assert.equal(width, maxLineWidth);
  assert.ok(width < estimateTextWidth(text));
});
