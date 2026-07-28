import { describe, expect, it } from 'vitest';
import { suggestTerms, matchAllTerms } from './suggestTerms';
import type { TermRef, TermTable } from '../../types/domain';

const NEW_TABLES: TermTable[] = [
  { id: 'category', label: 'Categories', terms: [{ id: 'c1', name: 'News' }, { id: 'c2', name: 'Photography' }] },
  { id: 'post_tag', label: 'Tags', terms: [{ id: 't1', name: 'Case Study' }] },
];

describe('suggestTerms', () => {
  it('suggests the best-matching term above the threshold, tagged with its source table', () => {
    const oldTerms: TermRef[] = [{ domain: 'category', nicename: 'news', name: 'News' }];
    const result = suggestTerms(oldTerms, NEW_TABLES);
    expect(result['category:news']).toMatchObject({
      targetTableId: 'category',
      targetTermIds: ['c1'],
      excluded: false,
      origin: 'suggested',
    });
    expect(result['category:news'].score).toBeGreaterThanOrEqual(0.55);
  });

  it('a tag-domain old term can suggest a category-table match if that scores best', () => {
    const oldTerms: TermRef[] = [{ domain: 'post_tag', nicename: 'case-studies', name: 'Case Studies' }];
    const result = suggestTerms(oldTerms, NEW_TABLES);
    expect(result['post_tag:case-studies'].targetTableId).toBe('post_tag');
  });

  it('leaves a term unmapped rather than guessing when nothing scores above the threshold', () => {
    const oldTerms: TermRef[] = [{ domain: 'category', nicename: 'unrelated', name: 'Completely Unrelated Topic' }];
    const result = suggestTerms(oldTerms, NEW_TABLES);
    expect(result['category:unrelated']).toBeUndefined();
  });

  it('is total: an empty newTables list yields no suggestions, never an error', () => {
    const oldTerms: TermRef[] = [{ domain: 'category', nicename: 'news', name: 'News' }];
    expect(() => suggestTerms(oldTerms, [])).not.toThrow();
    expect(suggestTerms(oldTerms, [])).toEqual({});
  });

  it('is total: a table with no terms yields no suggestions for it', () => {
    const oldTerms: TermRef[] = [{ domain: 'category', nicename: 'news', name: 'News' }];
    const result = suggestTerms(oldTerms, [{ id: 'category', label: 'Categories', terms: [] }]);
    expect(result).toEqual({});
  });
});

describe('matchAllTerms', () => {
  it('maps a term above the threshold exactly like suggestTerms does', () => {
    const oldTerms: TermRef[] = [{ domain: 'category', nicename: 'news', name: 'News' }];
    const result = matchAllTerms(oldTerms, NEW_TABLES);
    expect(result['category:news']).toMatchObject({
      targetTableId: 'category',
      targetTermIds: ['c1'],
      excluded: false,
      origin: 'suggested',
    });
  });

  it('explicitly excludes a term with no match above the threshold, instead of omitting it', () => {
    const oldTerms: TermRef[] = [{ domain: 'category', nicename: 'unrelated', name: 'Completely Unrelated Topic' }];
    const result = matchAllTerms(oldTerms, NEW_TABLES);
    expect(result['category:unrelated']).toEqual({
      oldDomain: 'category',
      oldNicename: 'unrelated',
      targetTableId: null,
      targetTermIds: [],
      excluded: true,
      origin: 'suggested',
    });
  });

  it('is total: every input term appears in the output, matched or excluded', () => {
    const oldTerms: TermRef[] = [
      { domain: 'category', nicename: 'news', name: 'News' },
      { domain: 'category', nicename: 'unrelated', name: 'Completely Unrelated Topic' },
      { domain: 'post_tag', nicename: 'case-studies', name: 'Case Studies' },
    ];
    const result = matchAllTerms(oldTerms, NEW_TABLES);
    expect(Object.keys(result)).toHaveLength(3);
    expect(result['category:news'].excluded).toBe(false);
    expect(result['category:unrelated'].excluded).toBe(true);
    expect(result['post_tag:case-studies'].excluded).toBe(false);
  });

  it('excludes every term when newTables is empty, rather than throwing', () => {
    const oldTerms: TermRef[] = [{ domain: 'category', nicename: 'news', name: 'News' }];
    const result = matchAllTerms(oldTerms, []);
    expect(result['category:news']).toMatchObject({ excluded: true, targetTableId: null, targetTermIds: [] });
  });
});
