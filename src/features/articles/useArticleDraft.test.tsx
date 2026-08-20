/** @jsxImportSource react */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useArticleDraft, type UseArticleDraftResult } from './useArticleDraft';
import { isDraftDirty } from '../../state/unsavedChanges';
import type { DerivedArticle } from '../../state/types';
import type { Action } from '../../state/actions';

function makeArticle(overrides: Partial<DerivedArticle> = {}): DerivedArticle {
  return {
    id: 1,
    postId: 1,
    postType: 'post',
    status: 'ready',
    title: 'Test',
    link: '',
    postDate: '',
    postName: '',
    creator: '',
    contentHtml: '<p>orig</p>',
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
let lastResult: UseArticleDraftResult | null = null;
let dispatched: Action[] = [];

function Harness({ article, previewHtml }: { article: DerivedArticle | null; previewHtml: string }) {
  lastResult = useArticleDraft(article, previewHtml, (a: Action) => {
    dispatched.push(a);
  });
  return null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  lastResult = null;
  dispatched = [];
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  document.body.removeChild(container);
});

describe('useArticleDraft', () => {
  it('seeds draftHtml from the converted preview and starts clean', async () => {
    await act(async () => {
      root.render(<Harness article={makeArticle()} previewHtml="<p>converted</p>" />);
    });
    expect(lastResult?.draftHtml).toBe('<p>converted</p>');
    expect(lastResult?.isDirty).toBe(false);
  });

  it('marks dirty when the draft diverges from the original content, and dispatches SAVE_ARTICLE_EDIT on save', async () => {
    await act(async () => {
      root.render(<Harness article={makeArticle()} previewHtml="<p>converted</p>" />);
    });
    await act(async () => {
      lastResult!.handleTextChange({ target: { value: '<p>edited</p>' } } as React.ChangeEvent<HTMLTextAreaElement>);
    });
    expect(lastResult?.isDirty).toBe(true);

    await act(async () => {
      lastResult!.handleSave();
    });
    expect(dispatched).toEqual([{ type: 'SAVE_ARTICLE_EDIT', articleId: 1, editedHtml: '<p>edited</p>' }]);
    expect(lastResult?.isDirty).toBe(false);
  });

  it('dispatches REVERT_ARTICLE_EDIT on revert', async () => {
    await act(async () => {
      root.render(<Harness article={makeArticle()} previewHtml="<p>converted</p>" />);
    });
    await act(async () => {
      lastResult!.handleRevert();
    });
    expect(dispatched).toEqual([{ type: 'REVERT_ARTICLE_EDIT', articleId: 1 }]);
  });

  it('setDraft updates draftHtml and marks dirty when the html diverges from the saved content', async () => {
    await act(async () => {
      root.render(<Harness article={makeArticle({ editedHtml: '<p>orig</p>' })} previewHtml="<p>orig</p>" />);
    });
    await act(async () => {
      lastResult!.setDraft('<p>changed</p>');
    });
    expect(lastResult?.draftHtml).toBe('<p>changed</p>');
    expect(lastResult?.isDirty).toBe(true);
  });

  it('setDraft marks the draft clean when the html equals the saved content', async () => {
    await act(async () => {
      root.render(<Harness article={makeArticle({ editedHtml: '<p>same</p>' })} previewHtml="<p>same</p>" />);
    });
    await act(async () => {
      lastResult!.setDraft('<p>same</p>');
    });
    expect(lastResult?.draftHtml).toBe('<p>same</p>');
    expect(lastResult?.isDirty).toBe(false);
  });

  it('keeps the draft when the parent re-renders with a fresh article object for the same article', async () => {
    const article = makeArticle();
    await act(async () => {
      root.render(<Harness article={article} previewHtml="<p>converted</p>" />);
    });
    await act(async () => {
      lastResult!.setDraft('<p>edited</p>');
    });
    expect(lastResult?.draftHtml).toBe('<p>edited</p>');

    await act(async () => {
      root.render(<Harness article={makeArticle()} previewHtml="<p>converted</p>" />);
    });
    expect(lastResult?.draftHtml).toBe('<p>edited</p>');
    expect(lastResult?.isDirty).toBe(true);
  });

  it('resets the draft when the selected article actually changes', async () => {
    await act(async () => {
      root.render(<Harness article={makeArticle({ id: 1 })} previewHtml="<p>one</p>" />);
    });
    await act(async () => {
      lastResult!.setDraft('<p>edited</p>');
    });
    await act(async () => {
      root.render(<Harness article={makeArticle({ id: 2 })} previewHtml="<p>two</p>" />);
    });
    expect(lastResult?.draftHtml).toBe('<p>two</p>');
    expect(lastResult?.isDirty).toBe(false);
  });

  it('reports draft dirtiness to the unsaved-changes bridge and clears it on unmount', async () => {
    await act(async () => {
      root.render(<Harness article={makeArticle()} previewHtml="<p>converted</p>" />);
    });
    expect(isDraftDirty()).toBe(false);

    await act(async () => {
      lastResult!.handleTextChange({ target: { value: '<p>edited</p>' } } as React.ChangeEvent<HTMLTextAreaElement>);
    });
    expect(isDraftDirty()).toBe(true);

    await act(async () => {
      lastResult!.handleSave();
    });
    expect(isDraftDirty()).toBe(false);

    await act(async () => {
      lastResult!.handleTextChange({ target: { value: '<p>edited again</p>' } } as React.ChangeEvent<HTMLTextAreaElement>);
    });
    expect(isDraftDirty()).toBe(true);

    await act(async () => {
      root.unmount();
    });
    expect(isDraftDirty()).toBe(false);
  });
});
