import { useRef, useEffect } from 'react';
import type { DerivedArticle } from '../../state/types';

export interface UseScrollManagementResult {
  mainScrollRef: React.RefObject<HTMLDivElement>;
  sidebarScrollRef: React.RefObject<HTMLDivElement>;
  scrollToTop: (behavior?: ScrollBehavior) => void;
}

export function useScrollManagement(article: DerivedArticle | null): UseScrollManagementResult {
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);

  const scrollToTop = (behavior: ScrollBehavior = 'smooth') => {
    for (const el of [mainScrollRef.current, sidebarScrollRef.current]) {
      if (!el) continue;
      // jsdom (unit tests) doesn't implement Element.scrollTo — falls back
      // to a plain scrollTop assignment there; real browsers take the
      // smooth/instant path.
      if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0, behavior });
      else el.scrollTop = 0;
    }
  };

  // Jumps both scroll panes back to the top on every article change —
  // otherwise Prev/Next keeps whatever scroll position the previous
  // article was left at, landing you mid-way (or at the bottom) of the
  // next article instead of its start.
  useEffect(() => {
    scrollToTop('instant');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.id]);

  // Locks page scroll while the drawer is open — otherwise scrolling the
  // mouse/trackpad over the dimmed backdrop still scrolls the Articles
  // list underneath, which is disorienting with the drawer overlaid on top.
  useEffect(() => {
    if (!article) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [article]);

  return { mainScrollRef, sidebarScrollRef, scrollToTop };
}
