/** @jsxImportSource react */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AppStateProvider, useAppState } from '../../state/AppStateContext';
import { useImageHealthCheck } from './useImageHealthCheck';
import type { Action } from '../../state/actions';
import type { ParseResult } from '../../types/domain';

vi.mock('../../core/media/verifyImages', () => ({
  verifyResolvedImages: vi.fn(),
}));
import { verifyResolvedImages } from '../../core/media/verifyImages';

const MOCK_RESULT: ParseResult = {
  ok: true,
  siteUrl: 'https://old.example',
  totalItems: 0,
  articles: [],
  attachments: [],
  taxonomies: {},
  authors: [],
  statusCounts: {},
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.mocked(verifyResolvedImages).mockReset();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  document.body.removeChild(container);
});

describe('useImageHealthCheck', () => {
  it('dispatches SET_MEDIA_RESOLUTIONS once a new source loads and verification finds a broken image', async () => {
    vi.mocked(verifyResolvedImages).mockResolvedValue({
      'attachment:1': { outcome: 'matched-export', url: 'https://old.example/photo.jpg', verified: 'broken', verifiedReason: '404' },
    });

    let capturedDispatch: React.Dispatch<Action> | null = null;
    function Inner() {
      useImageHealthCheck();
      const { dispatch, state } = useAppState();
      capturedDispatch = dispatch;
      (Inner as any)._state = state;
      return null;
    }

    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false}>
          <Inner />
        </AppStateProvider>,
      );
    });

    await act(async () => {
      capturedDispatch!({ type: 'LOAD_SOURCE', result: MOCK_RESULT, defaultBuilder: 'plainHtml', confidence: 90 });
    });

    // Flush the mocked async verifyResolvedImages().then(...) chain.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(verifyResolvedImages).toHaveBeenCalledTimes(1);
    expect((Inner as any)._state.media.resolved['attachment:1']).toEqual({
      outcome: 'matched-export',
      url: 'https://old.example/photo.jpg',
      verified: 'broken',
      verifiedReason: '404',
    });
  });

  it('does not call verifyResolvedImages again on a re-render caused by its own dispatch', async () => {
    vi.mocked(verifyResolvedImages).mockResolvedValue({
      'attachment:1': { outcome: 'matched-export', url: 'https://old.example/photo.jpg', verified: 'ok' },
    });

    let capturedDispatch: React.Dispatch<Action> | null = null;
    function Inner() {
      useImageHealthCheck();
      const { dispatch } = useAppState();
      capturedDispatch = dispatch;
      return null;
    }

    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false}>
          <Inner />
        </AppStateProvider>,
      );
    });
    await act(async () => {
      capturedDispatch!({ type: 'LOAD_SOURCE', result: MOCK_RESULT, defaultBuilder: 'plainHtml', confidence: 90 });
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(verifyResolvedImages).toHaveBeenCalledTimes(1);

    // An unrelated dispatch causes a re-render; the hook must not re-fire
    // since state.source hasn't changed.
    await act(async () => {
      capturedDispatch!({ type: 'SET_ACTIVE_TAB', tab: 'articles' });
    });

    expect(verifyResolvedImages).toHaveBeenCalledTimes(1);
  });
});
