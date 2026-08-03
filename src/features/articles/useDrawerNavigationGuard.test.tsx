/** @jsxImportSource react */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useDrawerNavigationGuard, type UseDrawerNavigationGuardResult } from './useDrawerNavigationGuard';
import type { DerivedArticle } from '../../state/types';

function makeArticle(): DerivedArticle {
  return {
    id: 1,
    postId: 1,
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
let lastResult: UseDrawerNavigationGuardResult | null = null;

function Harness(props: {
  isDirty: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  lastResult = useDrawerNavigationGuard({ article: makeArticle(), ...props });
  return null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  lastResult = null;
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  document.body.removeChild(container);
});

describe('useDrawerNavigationGuard', () => {
  it('navigates immediately when not dirty', async () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <Harness isDirty={false} hasPrev={true} hasNext={true} onClose={onClose} onPrev={onPrev} onNext={onNext} />,
      );
    });
    await act(async () => {
      lastResult!.requestNext();
    });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(lastResult?.pendingAction).toBe(null);
  });

  it('holds navigation behind a confirmation when dirty, and proceeds only after confirmDiscard', async () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <Harness isDirty={true} hasPrev={true} hasNext={true} onClose={onClose} onPrev={onPrev} onNext={onNext} />,
      );
    });
    await act(async () => {
      lastResult!.requestNext();
    });
    expect(onNext).not.toHaveBeenCalled();
    expect(lastResult?.pendingAction).toBe('next');

    await act(async () => {
      lastResult!.confirmDiscard();
    });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(lastResult?.pendingAction).toBe(null);
  });

  it('cancelDiscard clears the pending action without navigating', async () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <Harness isDirty={true} hasPrev={true} hasNext={true} onClose={onClose} onPrev={onPrev} onNext={onNext} />,
      );
    });
    await act(async () => {
      lastResult!.requestPrev();
    });
    expect(lastResult?.pendingAction).toBe('prev');

    await act(async () => {
      lastResult!.cancelDiscard();
    });
    expect(lastResult?.pendingAction).toBe(null);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('does nothing when requesting prev/next past the ends', async () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <Harness isDirty={false} hasPrev={false} hasNext={false} onClose={onClose} onPrev={onPrev} onNext={onNext} />,
      );
    });
    await act(async () => {
      lastResult!.requestPrev();
    });
    await act(async () => {
      lastResult!.requestNext();
    });
    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });
});
