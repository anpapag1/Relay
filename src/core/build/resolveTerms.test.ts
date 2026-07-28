import { describe, expect, it } from 'vitest';
import { resolveArticleTerms } from './resolveTerms';
import type { TermMapping, TermRef, TermTable } from '../../types/domain';

const NEW_TABLES: TermTable[] = [
  { id: 'category', label: 'Categories', terms: [{ id: 'c1', name: 'News', slug: 'news' }, { id: 'c2', name: 'Press', slug: 'press' }] },
];

describe('resolveArticleTerms', () => {
  it('resolves a mapped term to the new-site table/term', () => {
    const terms: TermRef[] = [{ domain: 'category', nicename: 'news', name: 'News' }];
    const mappings: Record<string, TermMapping> = {
      'category:news': { oldDomain: 'category', oldNicename: 'news', targetTableId: 'category', targetTermIds: ['c1'], excluded: false, origin: 'user' },
    };
    expect(resolveArticleTerms(terms, mappings, NEW_TABLES)).toEqual([{ domain: 'category', nicename: 'news', name: 'News' }]);
  });

  it('resolves a term mapped to multiple destinations into multiple export refs', () => {
    const terms: TermRef[] = [{ domain: 'category', nicename: 'news', name: 'News' }];
    const mappings: Record<string, TermMapping> = {
      'category:news': { oldDomain: 'category', oldNicename: 'news', targetTableId: 'category', targetTermIds: ['c1', 'c2'], excluded: false, origin: 'user' },
    };
    expect(resolveArticleTerms(terms, mappings, NEW_TABLES)).toEqual([
      { domain: 'category', nicename: 'news', name: 'News' },
      { domain: 'category', nicename: 'press', name: 'Press' },
    ]);
  });

  it('falls back to the new term id as nicename when it has no slug', () => {
    const tables: TermTable[] = [{ id: 'category', label: 'Categories', terms: [{ id: 'c1', name: 'News' }] }];
    const terms: TermRef[] = [{ domain: 'category', nicename: 'news', name: 'News' }];
    const mappings: Record<string, TermMapping> = {
      'category:news': { oldDomain: 'category', oldNicename: 'news', targetTableId: 'category', targetTermIds: ['c1'], excluded: false, origin: 'user' },
    };
    expect(resolveArticleTerms(terms, mappings, tables)[0].nicename).toBe('c1');
  });

  it('drops a term with no mapping', () => {
    const terms: TermRef[] = [{ domain: 'category', nicename: 'unmapped', name: 'Unmapped' }];
    expect(resolveArticleTerms(terms, {}, NEW_TABLES)).toEqual([]);
  });

  it('drops a mapping whose target table or term no longer exists', () => {
    const terms: TermRef[] = [{ domain: 'category', nicename: 'news', name: 'News' }];
    const mappings: Record<string, TermMapping> = {
      'category:news': { oldDomain: 'category', oldNicename: 'news', targetTableId: 'category', targetTermIds: ['gone'], excluded: false, origin: 'user' },
    };
    expect(resolveArticleTerms(terms, mappings, NEW_TABLES)).toEqual([]);
  });

  it('drops an excluded mapping even if it has destination terms', () => {
    const terms: TermRef[] = [{ domain: 'category', nicename: 'news', name: 'News' }];
    const mappings: Record<string, TermMapping> = {
      'category:news': { oldDomain: 'category', oldNicename: 'news', targetTableId: 'category', targetTermIds: ['c1'], excluded: true, origin: 'user' },
    };
    expect(resolveArticleTerms(terms, mappings, NEW_TABLES)).toEqual([]);
  });
});
