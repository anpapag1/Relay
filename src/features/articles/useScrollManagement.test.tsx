/** @jsxImportSource react */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useScrollManagement } from './useScrollManagement';
import type { DerivedArticle } from '../../state/types';

function makeArticle(id: number): DerivedArticle {
  return {
    id,
    postId: id,
    postType: 'post',
    status: 'ready',
    title: 'Test',
    link: null,
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
  } as DerivedArticle;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  document.body.removeChild(container);
});

describe('useScrollManagement', () => {
  it('resets both scroll panes to top when the article changes', async () => {
    function Harness({ articleId }: { articleId: number }) {
      const article = makeArticle(articleId);
      const { mainScrollRef, sidebarScrollRef } = useScrollManagement(article);
      return (
        <div>
          <div ref={mainScrollRef} style={{ height: '10px', overflow: 'auto' }}>
            <div style={{ height: '1000px' }} />
          </div>
          <div ref={sidebarScrollRef} style={{ height: '10px', overflow: 'auto' }}>
            <div style={{ height: '1000px' }} />
          </div>
        </div>
      );
    }

    await act(async () => {
      root.render(<Harness articleId={1} />);
    });
    const mainEl = container.querySelectorAll('div')[1] as HTMLDivElement;
    mainEl.scrollTop = 500;
    expect(mainEl.scrollTop).toBe(500);

    await act(async () => {
      root.render(<Harness articleId={2} />);
    });
    expect(mainEl.scrollTop).toBe(0);
  });

  it('locks body scroll while an article is present and restores it when the article becomes null', async () => {
    function Harness({ article }: { article: DerivedArticle | null }) {
      useScrollManagement(article);
      return null;
    }

    document.body.style.overflow = 'visible';
    await act(async () => {
      root.render(<Harness article={makeArticle(1)} />);
    });
    expect(document.body.style.overflow).toBe('hidden');

    await act(async () => {
      root.render(<Harness article={null} />);
    });
    expect(document.body.style.overflow).toBe('visible');
  });
});
