import { describe, expect, it, beforeEach } from 'vitest';
import {
  deleteSiteProfile,
  domainForState,
  listSiteProfiles,
  loadSiteProfile,
  normalizeDomain,
  renameSiteProfile,
  saveSiteProfile,
} from './siteProfiles';
import { initialState } from './reducer';
import type { SiteDataBackup } from './session';

const DATA: SiteDataBackup = {
  targetTables: {},
  oldTables: {},
  mappings: {},
  settings: initialState.settings,
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('siteProfiles storage', () => {
  it('normalizes domains: strips protocol, www, path, lowercases', () => {
    expect(normalizeDomain('https://www.Example.com/blog/post')).toBe('example.com');
    expect(normalizeDomain('  HTTP://OLD-SITE.org/ ')).toBe('old-site.org');
    expect(normalizeDomain('')).toBe('');
  });

  it('round-trips a profile through save and load', () => {
    saveSiteProfile('old.example', DATA);
    const loaded = loadSiteProfile('old.example');
    expect(loaded?.domain).toBe('old.example');
    expect(loaded?.version).toBe(1);
    expect(loaded?.savedAt).toBeTruthy();
    expect(loaded?.data.settings).toEqual(initialState.settings);
  });

  it('load returns null for an unknown or corrupt domain', () => {
    expect(loadSiteProfile('nope.example')).toBeNull();
    window.localStorage.setItem('relay_site_v1_corrupt.example', '{not json');
    expect(loadSiteProfile('corrupt.example')).toBeNull();
  });

  it('lists only site-profile keys, sorted by savedAt descending', async () => {
    window.localStorage.setItem('unrelated_key', 'x');
    saveSiteProfile('a.example', DATA);
    await new Promise((r) => setTimeout(r, 5));
    saveSiteProfile('b.example', DATA);
    const listed = listSiteProfiles();
    expect(listed.map((p) => p.domain)).toEqual(['b.example', 'a.example']);
  });

  it('deletes a profile', () => {
    saveSiteProfile('a.example', DATA);
    deleteSiteProfile('a.example');
    expect(loadSiteProfile('a.example')).toBeNull();
  });

  it('renames a profile and returns false when the source is missing', () => {
    saveSiteProfile('a.example', DATA);
    expect(renameSiteProfile('a.example', 'renamed.example')).toBe(true);
    expect(loadSiteProfile('a.example')).toBeNull();
    expect(loadSiteProfile('renamed.example')?.domain).toBe('renamed.example');
    expect(renameSiteProfile('nope.example', 'x.example')).toBe(false);
  });

  it('does not save or rename onto an empty normalized domain', () => {
    saveSiteProfile('http://', DATA);
    expect(loadSiteProfile('http://')).toBeNull();
    expect(window.localStorage.getItem('relay_site_v1_')).toBeNull();
    saveSiteProfile('a.example', DATA);
    expect(renameSiteProfile('a.example', 'http://')).toBe(false);
    expect(loadSiteProfile('a.example')?.domain).toBe('a.example');
  });

  it('resolves the effective domain from source.siteUrl first, then ui.sourceDomain, then null', () => {
    expect(domainForState(initialState)).toBeNull();
    expect(domainForState({ ...initialState, ui: { ...initialState.ui, sourceDomain: 'typed.example' } })).toBe('typed.example');
    expect(
      domainForState({
        ...initialState,
        source: { ok: true, siteUrl: 'https://www.real.example/path', totalItems: 0, articles: [], attachments: [], taxonomies: {}, authors: [], statusCounts: {} },
      }),
    ).toBe('real.example');
  });
});
