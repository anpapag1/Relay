// src/features/import/useImageHealthCheck.ts
import { useEffect, useRef } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { verifyResolvedImages } from '../../core/media/verifyImages';
import { getReader } from '../../core/builders';
import { collectMediaRefs } from '../../core/build/collectMediaRefs';

/** Runs once per newly-loaded WXR source: verifies every resolved inline
 * image URL — plus every bare absolute-URL ref that never got a resolution
 * entry at all (a literal `<img src>` whose URL never matched anything in
 * the WXR's own attachment list, so Stage 1 silently skipped it — see
 * verifyResolvedImages' doc comment) — and dispatches results back via the
 * existing SET_MEDIA_RESOLUTIONS action, which getArticleStatus already
 * reads. Keyed on `state.source` identity so it fires exactly once per
 * import, not on every unrelated re-render (including the re-render its own
 * dispatch causes). */
export function useImageHealthCheck(): void {
  const { state, dispatch } = useAppState();
  const checkedSourceRef = useRef<unknown>(null);

  useEffect(() => {
    if (!state.source || state.source === checkedSourceRef.current) return;
    checkedSourceRef.current = state.source;

    const reader = getReader(state.builderId ?? 'plainHtml');
    const allRefs: string[] = [];
    for (const article of state.source.articles) {
      const { nodes } = reader.read({ contentHtml: article.contentHtml, postmeta: article.postmeta });
      allRefs.push(...collectMediaRefs(nodes));
    }

    let cancelled = false;
    const fetchImpl = window.fetch ? window.fetch.bind(window) : ((async () => new Response()) as any);
    verifyResolvedImages(state.media.resolved, allRefs, fetchImpl).then((updates) => {
      if (cancelled || Object.keys(updates).length === 0) return;
      dispatch({ type: 'SET_MEDIA_RESOLUTIONS', resolutions: updates });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.source, state.media.resolved, state.builderId, dispatch]);
}
