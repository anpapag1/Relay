import { describe, expect, it } from 'vitest';
import { findMissingOldTerms, mergeMissingIntoOldTables } from './reconcileOldTables';
import type { TaxonomyTermSummary, TermTable } from '../../types/domain';

describe('findMissingOldTerms', () => {
  it('reports every term as missing when oldTables is empty (fresh-import bootstrap)', () => {
    const taxonomies: Record<string, TaxonomyTermSummary[]> = {
      category: [{ nicename: 'news', name: 'News', count: 3 }],
    };
    const result = findMissingOldTerms(taxonomies, {});
    expect(result).toEqual([{ domain: 'category', nicename: 'news', name: 'News' }]);
  });

  it('reports only the terms not already present in a matching old table, by slug', () => {
    const taxonomies: Record<string, TaxonomyTermSummary[]> = {
      category: [
        { nicename: 'news', name: 'News', count: 3 },
        { nicename: 'tutorials', name: 'Tutorials', count: 1 },
      ],
    };
    const oldTables: Record<string, TermTable> = {
      category: { id: 'category', label: 'Category', terms: [{ id: 'category:news', name: 'News', slug: 'news' }] },
    };
    const result = findMissingOldTerms(taxonomies, oldTables);
    expect(result).toEqual([{ domain: 'category', nicename: 'tutorials', name: 'Tutorials' }]);
  });

  it('returns nothing when every XML term is already represented', () => {
    const taxonomies: Record<string, TaxonomyTermSummary[]> = {
      category: [{ nicename: 'news', name: 'News', count: 3 }],
    };
    const oldTables: Record<string, TermTable> = {
      category: { id: 'category', label: 'Category', terms: [{ id: 'category:news', name: 'News', slug: 'news' }] },
    };
    expect(findMissingOldTerms(taxonomies, oldTables)).toEqual([]);
  });

  it('reports every term of a domain that has no old table at all yet', () => {
    const taxonomies: Record<string, TaxonomyTermSummary[]> = {
      category: [{ nicename: 'news', name: 'News', count: 3 }],
      post_tag: [{ nicename: 'react', name: 'React', count: 2 }],
    };
    const oldTables: Record<string, TermTable> = {
      category: { id: 'category', label: 'Category', terms: [{ id: 'category:news', name: 'News', slug: 'news' }] },
    };
    const result = findMissingOldTerms(taxonomies, oldTables);
    expect(result).toEqual([{ domain: 'post_tag', nicename: 'react', name: 'React' }]);
  });
});

describe('mergeMissingIntoOldTables', () => {
  it('creates a new table for a domain with no existing old table', () => {
    const result = mergeMissingIntoOldTables({}, [{ domain: 'category', nicename: 'news', name: 'News' }]);
    expect(result).toEqual([
      { id: 'category', label: 'Category', terms: [{ id: 'category:news', name: 'News', slug: 'news' }] },
    ]);
  });

  it('appends into an existing table for that domain rather than duplicating it', () => {
    const oldTables: Record<string, TermTable> = {
      category: { id: 'category', label: 'Category', terms: [{ id: 'category:news', name: 'News', slug: 'news' }] },
    };
    const result = mergeMissingIntoOldTables(oldTables, [{ domain: 'category', nicename: 'tutorials', name: 'Tutorials' }]);
    expect(result).toEqual([
      {
        id: 'category',
        label: 'Category',
        terms: [
          { id: 'category:news', name: 'News', slug: 'news' },
          { id: 'category:tutorials', name: 'Tutorials', slug: 'tutorials' },
        ],
      },
    ]);
  });

  it('is a no-op (returns tables unchanged, as an array) when missing is empty', () => {
    const oldTables: Record<string, TermTable> = {
      category: { id: 'category', label: 'Category', terms: [] },
    };
    expect(mergeMissingIntoOldTables(oldTables, [])).toEqual([{ id: 'category', label: 'Category', terms: [] }]);
  });

  it('capitalizes the domain name for a newly-created table label, matching existing convention', () => {
    const result = mergeMissingIntoOldTables({}, [{ domain: 'category_type', nicename: 'synedriasi', name: 'Συνεδρίαση' }]);
    expect(result[0].label).toBe('Category_type');
  });
});
