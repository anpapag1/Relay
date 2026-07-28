import { describe, expect, it } from 'vitest';
import { applyMappings } from './applyMappings';
import type { TermMapping, TermRef, TermTable } from '../../types/domain';

const NEW_TABLES: TermTable[] = [
  { id: 'category', label: 'Categories', terms: [{ id: 'c1', name: 'News' }] },
];

const OLD_TERMS: TermRef[] = [{ domain: 'category', nicename: 'news', name: 'News' }];

describe('applyMappings', () => {
  it('adds a suggestion for a term with no existing mapping', () => {
    const result = applyMappings(OLD_TERMS, NEW_TABLES, {});
    expect(result['category:news']).toMatchObject({ targetTermIds: ['c1'], excluded: false, origin: 'suggested' });
  });

  it('overwrites a stale suggested mapping on recomputation', () => {
    const existing: Record<string, TermMapping> = {
      'category:news': { oldDomain: 'category', oldNicename: 'news', targetTableId: 'category', targetTermIds: ['old-stale-id'], excluded: false, origin: 'suggested', score: 0.6 },
    };
    const result = applyMappings(OLD_TERMS, NEW_TABLES, existing);
    expect(result['category:news'].targetTermIds).toEqual(['c1']);
  });

  it('never overwrites or removes a user-owned mapping, even if it no longer matches', () => {
    const existing: Record<string, TermMapping> = {
      'category:news': { oldDomain: 'category', oldNicename: 'news', targetTableId: 'post_tag', targetTermIds: ['manually-chosen'], excluded: false, origin: 'user' },
    };
    const result = applyMappings(OLD_TERMS, NEW_TABLES, existing);
    expect(result['category:news']).toEqual(existing['category:news']);
  });

  it('removes a suggested mapping that no longer matches anything', () => {
    const existing: Record<string, TermMapping> = {
      'category:news': { oldDomain: 'category', oldNicename: 'news', targetTableId: 'category', targetTermIds: ['c1'], excluded: false, origin: 'suggested', score: 0.9 },
    };
    const result = applyMappings(OLD_TERMS, [{ id: 'category', label: 'Categories', terms: [] }], existing);
    expect(result['category:news']).toBeUndefined();
  });

  it('leaves mappings for terms outside the current oldTerms list untouched', () => {
    const existing: Record<string, TermMapping> = {
      'post_tag:unrelated': { oldDomain: 'post_tag', oldNicename: 'unrelated', targetTableId: 'post_tag', targetTermIds: ['x'], excluded: false, origin: 'user' },
    };
    const result = applyMappings(OLD_TERMS, NEW_TABLES, existing);
    expect(result['post_tag:unrelated']).toEqual(existing['post_tag:unrelated']);
  });
});
