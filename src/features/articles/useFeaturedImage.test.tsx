/** @jsxImportSource react */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useMemo } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useFeaturedImage } from './useFeaturedImage';
import { buildAttachmentIndex } from '../../core/media/attachmentIndex';
import type { DerivedArticle } from '../../state/types';

vi.mock('../../core/media/resolveFeaturedImage', () => ({
  resolveFeaturedImage: vi.fn(),
}));
import { resolveFeaturedImage } from '../../core/media/resolveFeaturedImage';

function makeArticle(overrides: Partial<DerivedArticle> = {}): DerivedArticle {
  return {
    id: 1,
    postId: 1,
    postType: 'post',
    status: 'ready',
    title: 'Test',
    link: 'https://old.example/a/',
    postDate: '',
    postName: '',
    creator: '',
    contentHtml: '',
    excerptHtml: '',
    terms: [],
    postmeta: {},
    warnings: [],
    infoWarnings: [],
    mediaCount: 0,
    isEdited: false,
    isExcluded: false,
    isManualReview: false,
    destinationTerms: [],
    ...overrides,
  } as DerivedArticle;
}

let container: HTMLDivElement;
let root: Root;
let lastResult: { featuredImageUrl: string | null; featuredImageLoading: boolean } | null = null;
let resolveMock: (value: any) => void;

function Harness({ article, fallbackUrl, fallbackDataUrl }: { article: DerivedArticle | null; fallbackUrl?: string; fallbackDataUrl?: string }) {
  const attachmentIndex = useMemo(() => buildAttachmentIndex([]), []);
  lastResult = useFeaturedImage(article, attachmentIndex, fallbackUrl ?? null, fallbackDataUrl ?? null);
  return null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  lastResult = null;
  vi.mocked(resolveFeaturedImage).mockReset();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  document.body.removeChild(container);
});

describe('useFeaturedImage', () => {
  it('uses article.featuredImageUrl directly when present (matches build precedence)', async () => {
    await act(async () => {
      root.render(<Harness article={makeArticle({ featuredImageUrl: 'https://cdn.example/f.jpg', postmeta: {} })} />);
    });
    expect(lastResult).toEqual({ featuredImageUrl: 'https://cdn.example/f.jpg', featuredImageLoading: false });
    expect(resolveFeaturedImage).not.toHaveBeenCalled();
  });

  it('returns null immediately when the article has no thumbnail id', async () => {
    await act(async () => {
      root.render(<Harness article={makeArticle({ postmeta: {} })} />);
    });
    expect(lastResult).toEqual({ featuredImageUrl: null, featuredImageLoading: false });
    expect(resolveFeaturedImage).not.toHaveBeenCalled();
  });

  it('uses the fallback link when the article has no featured image at all', async () => {
    await act(async () => {
      root.render(<Harness article={makeArticle({ postmeta: {} })} fallbackUrl="https://fallback.example/default.jpg" />);
    });
    expect(lastResult).toEqual({ featuredImageUrl: 'https://fallback.example/default.jpg', featuredImageLoading: false });
    expect(resolveFeaturedImage).not.toHaveBeenCalled();
  });

  it('prefers the fallback link over the fallback data URL', async () => {
    await act(async () => {
      root.render(
        <Harness
          article={makeArticle({ postmeta: {} })}
          fallbackUrl="https://fallback.example/default.jpg"
          fallbackDataUrl="data:image/png;base64,AAA"
        />,
      );
    });
    expect(lastResult).toEqual({ featuredImageUrl: 'https://fallback.example/default.jpg', featuredImageLoading: false });
  });

  it('uses the fallback data URL when no fallback link is set', async () => {
    await act(async () => {
      root.render(<Harness article={makeArticle({ postmeta: {} })} fallbackDataUrl="data:image/png;base64,AAA" />);
    });
    expect(lastResult).toEqual({ featuredImageUrl: 'data:image/png;base64,AAA', featuredImageLoading: false });
  });

  it('ignores the fallback when the article has its own featured image', async () => {
    await act(async () => {
      root.render(
        <Harness
          article={makeArticle({ featuredImageUrl: 'https://cdn.example/f.jpg', postmeta: {} })}
          fallbackUrl="https://fallback.example/default.jpg"
        />,
      );
    });
    expect(lastResult).toEqual({ featuredImageUrl: 'https://cdn.example/f.jpg', featuredImageLoading: false });
    expect(resolveFeaturedImage).not.toHaveBeenCalled();
  });

  it('falls back to an async fetch and resolves the URL when not in the local attachment index', async () => {
    vi.mocked(resolveFeaturedImage).mockImplementation(
      () => new Promise((resolve) => {
        resolveMock = resolve;
      }),
    );

    await act(async () => {
      root.render(<Harness article={makeArticle({ postmeta: { _thumbnail_id: '99' } })} />);
    });
    expect(lastResult?.featuredImageLoading).toBe(true);

    await act(async () => {
      resolveMock({ outcome: 'matched-remote', url: 'https://cdn.example/photo.jpg' });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(lastResult).toEqual({ featuredImageUrl: 'https://cdn.example/photo.jpg', featuredImageLoading: false });
  });
});
