import { describe, it, expect } from 'vitest';
import { buildDebugPayload, debugFileName } from './debugPayload';
import type { DerivedArticle } from '../../state/types';
import type { ConversionSettings } from '../../types/domain';

function makeArticle(overrides: Partial<DerivedArticle> = {}): DerivedArticle {
  return {
    id: 7,
    postId: 7,
    postType: 'post',
    status: 'review',
    statusReason: 'Unmapped taxonomy term: "Old Cat"',
    title: 'Broken Layout',
    link: 'https://old.example/broken/',
    postDate: '2026-01-01',
    postName: 'broken-layout',
    creator: 'alice',
    contentHtml: '<p>Original text</p>',
    excerptHtml: '',
    terms: [],
    postmeta: {},
    warnings: ['Unmapped taxonomy term: "Old Cat"'],
    infoWarnings: [],
    mediaCount: 2,
    isEdited: false,
    isExcluded: false,
    isManualReview: true,
    destinationTerms: [],
    ...overrides,
  };
}

const SETTINGS: ConversionSettings = {
  imageSize: 'large',
  imageAlign: 'center',
  autoSpacing: true,
  spacerSize: 30,
  combineConsecutiveImages: false,
  galleryColumns: 3,
  galleryAspectRatio: 'none',
  pdfRender: 'embed',
  buttonRender: 'button',
  headingShift: 0,
  linksNewTab: false,
};

describe('buildDebugPayload', () => {
  it('carries the article metadata, status and warnings', () => {
    const payload = buildDebugPayload({
      article: makeArticle(),
      afterHtml: '<p>Converted</p>',
      draftHtml: '<p>Converted</p>',
      problem: 'the heading is missing',
      builder: 'wpbakery',
      settings: SETTINGS,
    });
    expect(payload.article).toMatchObject({
      id: 7,
      postId: 7,
      postType: 'post',
      status: 'review',
      statusReason: 'Unmapped taxonomy term: "Old Cat"',
      title: 'Broken Layout',
      link: 'https://old.example/broken/',
      postDate: '2026-01-01',
      postName: 'broken-layout',
      creator: 'alice',
      warnings: ['Unmapped taxonomy term: "Old Cat"'],
      isEdited: false,
      isExcluded: false,
      isManualReview: true,
    });
  });

  it('includes before, after and draft content separately', () => {
    const payload = buildDebugPayload({
      article: makeArticle(),
      afterHtml: '<p>Converted</p>',
      draftHtml: '<p>Converted edited in the drawer</p>',
      problem: '',
      builder: 'wpbakery',
      settings: SETTINGS,
    });
    expect(payload.content).toEqual({
      before: '<p>Original text</p>',
      after: '<p>Converted</p>',
      draft: '<p>Converted edited in the drawer</p>',
    });
  });

  it('passes the problem description through and tags the payload as Relay debug output', () => {
    const payload = buildDebugPayload({
      article: makeArticle(),
      afterHtml: '<p>Converted</p>',
      draftHtml: '',
      problem: 'image does not load',
      builder: 'wpbakery',
      settings: SETTINGS,
    });
    expect(payload.problem).toBe('image does not load');
    expect(payload.app).toBe('Relay');
    expect(payload.builder).toBe('wpbakery');
    expect(payload.settings).toEqual(SETTINGS);
  });

  it('keeps the featured image url and destination terms when present', () => {
    const payload = buildDebugPayload({
      article: makeArticle({
        featuredImageUrl: 'https://new.example/img.jpg',
        destinationTerms: [{ domain: 'category', nicename: 'news', name: 'News', sourceDomain: 'category' }],
      }),
      afterHtml: '',
      draftHtml: '',
      problem: '',
      builder: null,
      settings: SETTINGS,
    });
    expect(payload.article.featuredImageUrl).toBe('https://new.example/img.jpg');
    expect(payload.article.destinationTerms).toEqual([
      { domain: 'category', nicename: 'news', name: 'News', sourceDomain: 'category' },
    ]);
  });
});

describe('debugFileName', () => {
  it('builds a name from the article slug and id', () => {
    expect(debugFileName('broken-layout', 7)).toBe('relay-debug-broken-layout-7.json');
  });

  it('falls back to the id when the slug is empty', () => {
    expect(debugFileName('', 7)).toBe('relay-debug-7.json');
  });
});