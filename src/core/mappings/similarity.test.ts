import { describe, expect, it } from 'vitest';
import { diceCoefficient, normalizeTermName, similarityScore, SUGGESTION_THRESHOLD } from './similarity';

describe('normalizeTermName', () => {
  it('lowercases, strips diacritics/punctuation, and collapses whitespace', () => {
    expect(normalizeTermName('  Café-Society!  ')).toBe('cafe society');
  });

  it('naively singularises a trailing s', () => {
    expect(normalizeTermName('Case Studies')).toBe('case studie');
    expect(normalizeTermName('News')).toBe('new');
  });
});

describe('diceCoefficient', () => {
  it('scores an exact match as 1', () => {
    expect(diceCoefficient('news', 'news')).toBe(1);
  });

  it('scores completely unrelated strings low', () => {
    expect(diceCoefficient('news', 'xyz')).toBeLessThan(SUGGESTION_THRESHOLD);
  });

  it('scores an empty string against anything as 0', () => {
    expect(diceCoefficient('', 'news')).toBe(0);
  });
});

describe('similarityScore', () => {
  it('scores case and punctuation differences highly', () => {
    expect(similarityScore('Case Study', 'case-study')).toBeGreaterThanOrEqual(SUGGESTION_THRESHOLD);
  });

  it('scores a singular/plural pair highly', () => {
    expect(similarityScore('Case Study', 'Case Studies')).toBeGreaterThanOrEqual(SUGGESTION_THRESHOLD);
  });

  it('scores unrelated terms below the threshold', () => {
    expect(similarityScore('News', 'Photography')).toBeLessThan(SUGGESTION_THRESHOLD);
  });
});
