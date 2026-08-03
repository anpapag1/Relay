import { useState, useEffect } from 'react';
import type { DerivedArticle } from '../../state/types';

export type PendingAction = 'close' | 'prev' | 'next' | null;

export interface UseDrawerNavigationGuardArgs {
  article: DerivedArticle | null;
  isDirty: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export interface UseDrawerNavigationGuardResult {
  pendingAction: PendingAction;
  requestClose: () => void;
  requestPrev: () => void;
  requestNext: () => void;
  confirmDiscard: () => void;
  cancelDiscard: () => void;
}

export function useDrawerNavigationGuard({
  article,
  isDirty,
  hasPrev,
  hasNext,
  onClose,
  onPrev,
  onNext,
}: UseDrawerNavigationGuardArgs): UseDrawerNavigationGuardResult {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const requestClose = () => {
    if (isDirty) setPendingAction('close');
    else onClose();
  };

  const requestPrev = () => {
    if (!hasPrev) return;
    if (isDirty) setPendingAction('prev');
    else onPrev();
  };

  const requestNext = () => {
    if (!hasNext) return;
    if (isDirty) setPendingAction('next');
    else onNext();
  };

  const confirmDiscard = () => {
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'close') onClose();
    else if (action === 'prev') onPrev();
    else if (action === 'next') onNext();
  };

  const cancelDiscard = () => setPendingAction(null);

  useEffect(() => {
    if (!article) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const tag = active?.tagName;
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (active instanceof HTMLElement && active.isContentEditable);
      if (isEditable) return;
      if (e.key === 'ArrowLeft') requestPrev();
      else if (e.key === 'ArrowRight') requestNext();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article, requestPrev, requestNext]);

  return { pendingAction, requestClose, requestPrev, requestNext, confirmDiscard, cancelDiscard };
}
