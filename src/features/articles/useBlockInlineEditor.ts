/* global MouseEvent, FocusEvent */
import { useEffect, useRef, type RefObject } from 'react';
import { EDITABLE_SELECTOR, singleOccurrenceIndex, replaceNth } from './blockEditing';

export interface UseBlockInlineEditorOptions {
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  draftHtml: string;
  onCommit: (html: string) => void;
}

interface EditingSession {
  block: HTMLElement;
  editHtml: string;
  needle: string;
  occIndex: number;
}

// The editing affordances (data-editable, is-editing, contenteditable) live on
// the DOM but must never leak into the committed draft, which round-trips
// verbatim into the WXR export. They are deterministic substrings added by this
// hook, so they are removed at the string boundary. Stripping is scoped to the
// opening tag so block text can never be corrupted.
function stripEditingArtifacts(outerHTML: string): string {
  const tagEnd = outerHTML.indexOf('>');
  const tag = tagEnd === -1 ? outerHTML : outerHTML.slice(0, tagEnd);
  const rest = tagEnd === -1 ? '' : outerHTML.slice(tagEnd);
  const cleanedTag = tag
    .split(' data-editable="true"').join('')
    .split(' class="is-editing"').join('')
    .split(' is-editing').join('')
    .split(' class=""').join('')
    .split(' contenteditable="true"').join('');
  return cleanedTag + rest;
}

export function useBlockInlineEditor({
  containerRef,
  enabled,
  draftHtml,
  onCommit,
}: UseBlockInlineEditorOptions): void {
  const sessionRef = useRef<EditingSession | null>(null);
  const pendingIndexRef = useRef<number | null>(null);
  const cleanBaseRef = useRef<string>('');
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const editableBlocks = Array.from(container.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR));
    cleanBaseRef.current = container.innerHTML;
    editableBlocks.forEach((block) => {
      block.dataset.editable = 'true';
    });

    // The session never round-trips through React while editing: re-rendering
    // mid-keystroke would re-run dangerouslySetInnerHTML and destroy the caret.
    // Edits accumulate in session.editHtml and only leave via onCommit on exit.
    const beginEditing = (block: HTMLElement) => {
      const editHtml = cleanBaseRef.current;
      sessionRef.current = {
        block,
        editHtml,
        needle: stripEditingArtifacts(block.outerHTML),
        occIndex: singleOccurrenceIndex(container, block),
      };
      block.contentEditable = 'true';
      block.setAttribute('contenteditable', 'true');
      block.classList.add('is-editing');
      container.dataset.editing = 'true';
      block.focus();
    };

    const commit = () => {
      const session = sessionRef.current;
      if (!session) return;
      session.block.contentEditable = 'false';
      session.block.setAttribute('contenteditable', 'false');
      session.block.classList.remove('is-editing');
      delete container.dataset.editing;
      sessionRef.current = null;
      onCommitRef.current(session.editHtml);
    };

    // A block clicked while another was being edited commits first; the body
    // re-renders on that commit, so the old element reference is stale and we
    // re-enter by re-querying the recorded index against the fresh DOM.
    if (pendingIndexRef.current !== null) {
      const target = editableBlocks[pendingIndexRef.current];
      pendingIndexRef.current = null;
      if (target) beginEditing(target);
    }

    const handleMousedown = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const block = target.closest<HTMLElement>('[data-editable]');
      if (!block) {
        commit();
        return;
      }
      const session = sessionRef.current;
      if (session) {
        if (session.block === block) return;
        const pendingIndex = editableBlocks.indexOf(block);
        commit();
        pendingIndexRef.current = pendingIndex === -1 ? null : pendingIndex;
        return;
      }
      beginEditing(block);
    };

    const handleInput = () => {
      const session = sessionRef.current;
      if (!session) return;
      const newOuter = stripEditingArtifacts(session.block.outerHTML);
      session.editHtml = replaceNth(session.editHtml, session.needle, session.occIndex, newOuter);
      session.needle = newOuter;
    };

    const handleBlur = (e: FocusEvent) => {
      const session = sessionRef.current;
      if (!session) return;
      const relatedTarget = e.relatedTarget;
      if (relatedTarget instanceof Element && container.contains(relatedTarget)) return;
      commit();
    };

    const handleKeydown = (e: KeyboardEvent) => {
      const session = sessionRef.current;
      if (!session) return;
      if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || e.key === 'Escape') {
        e.preventDefault();
        commit();
      }
    };

    container.addEventListener('mousedown', handleMousedown, true);
    container.addEventListener('input', handleInput, true);
    container.addEventListener('blur', handleBlur, true);
    container.addEventListener('keydown', handleKeydown);

    return () => {
      container.removeEventListener('mousedown', handleMousedown, true);
      container.removeEventListener('input', handleInput, true);
      container.removeEventListener('blur', handleBlur, true);
      container.removeEventListener('keydown', handleKeydown);

      editableBlocks.forEach((block) => {
        delete block.dataset.editable;
      });
      commit();
    };
  }, [enabled, draftHtml, containerRef]);
}