import { describe, expect, it } from 'vitest';
import { cdataSafe, slugFromLink, slugify } from './xml';

describe('cdataSafe', () => {
  it('splits a ]]> sequence so it cannot close the CDATA section early', () => {
    expect(cdataSafe('before ]]> after')).toBe('before ]]]]><![CDATA[> after');
  });

  it('passes through text with no ]]> unchanged', () => {
    expect(cdataSafe('plain text')).toBe('plain text');
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('falls back to "item" for empty input', () => {
    expect(slugify('')).toBe('item');
    expect(slugify(null)).toBe('item');
  });

  it('strips diacritics', () => {
    expect(slugify('café')).toBe('cafe');
  });
});

describe('slugFromLink', () => {
  it('takes the last path segment of the URL', () => {
    expect(slugFromLink('https://old-site.example/some-article/')).toBe('some-article');
  });

  it('returns null for a missing or unparseable link', () => {
    expect(slugFromLink(null)).toBeNull();
    expect(slugFromLink('not a url')).toBeNull();
  });

  it('returns null when the path has no segments', () => {
    expect(slugFromLink('https://old-site.example/')).toBeNull();
  });
});
