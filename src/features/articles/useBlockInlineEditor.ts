/* global MouseEvent, FocusEvent */
import { useEffect, useRef, type RefObject } from 'react';
import {
  EDITABLE_SELECTOR,
  caretOffsetIn,
  classifyBlock,
  collapsedAtStart,
  elementOccurrenceIndex,
  singleOccurrenceIndex,
  replaceNth,
} from './blockEditing';

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
    .split(' contenteditable="true"').join('')
    .split(' contenteditable="false"').join('');
  return cleanedTag + rest;
}

// Like singleOccurrenceIndex but compares artifact-stripped markup, so it stays
// correct once the active block carries contenteditable/is-editing attributes
// that identical siblings lack.
function strippedOccurrenceIndex(root: Element, blockEl: HTMLElement, needle: string): number {
  let n = 0;
  for (const el of root.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR)) {
    if (el === blockEl) return n;
    if (stripEditingArtifacts(el.outerHTML) === needle) n += 1;
  }
  return n;
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
      pendingIndexRef.current = null;
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
      session.occIndex = strippedOccurrenceIndex(container, session.block, newOuter);
    };

    const handleBlur = (e: FocusEvent) => {
      const session = sessionRef.current;
      if (!session) return;
      const relatedTarget = e.relatedTarget;
      if (relatedTarget instanceof Element && container.contains(relatedTarget)) return;
      commit();
    };

    // Re-points the session at a different block: moves the editing affordances
    // across, refreshes needle/occIndex against the container, and leaves the
    // caret at the end of the new block.
    const retarget = (nextEl: HTMLElement) => {
      const session = sessionRef.current;
      if (!session) return;
      session.block.contentEditable = 'false';
      session.block.setAttribute('contenteditable', 'false');
      session.block.classList.remove('is-editing');

      nextEl.dataset.editable = 'true';
      nextEl.contentEditable = 'true';
      nextEl.setAttribute('contenteditable', 'true');
      nextEl.classList.add('is-editing');

      session.block = nextEl;
      session.needle = stripEditingArtifacts(nextEl.outerHTML);
      session.occIndex = strippedOccurrenceIndex(container, nextEl, session.needle);

      const range = document.createRange();
      range.selectNodeContents(nextEl);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      nextEl.focus();
    };

    // Enter splits the block at the caret: the first half stays in place and
    // the second half moves into a fresh sibling element chosen by block kind
    // (heading → new paragraph, li → new li in the same ul, quote-p → new p in
    // the same blockquote). The replacement is spliced into editHtml before
    // the editing affordances are reshuffled, so the stripped needle still
    // matches what the string store holds.
    const handleEnter = () => {
      const session = sessionRef.current;
      if (!session) return;
      const block = session.block;
      const kind = classifyBlock(block);
      if (!kind) return;
      const offset = caretOffsetIn(block);
      const text = block.textContent ?? '';
      const second = text.slice(offset);
      block.textContent = text.slice(0, offset);

      const newEl = document.createElement(kind === 'li' ? 'li' : 'p');
      newEl.textContent = second;
      block.insertAdjacentElement('afterend', newEl);

      session.editHtml = replaceNth(
        session.editHtml,
        session.needle,
        session.occIndex,
        stripEditingArtifacts(block.outerHTML) + stripEditingArtifacts(newEl.outerHTML),
      );

      block.contentEditable = 'false';
      block.setAttribute('contenteditable', 'false');
      block.classList.remove('is-editing');

      newEl.dataset.editable = 'true';
      newEl.contentEditable = 'true';
      newEl.setAttribute('contenteditable', 'true');
      newEl.classList.add('is-editing');

      session.block = newEl;
      session.needle = stripEditingArtifacts(newEl.outerHTML);
      session.occIndex = strippedOccurrenceIndex(container, newEl, session.needle);

      const range = document.createRange();
      if (newEl.firstChild) range.setStart(newEl.firstChild, 0);
      else range.setStart(newEl, 0);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      newEl.focus();
    };

    // Backspace at the very start of a block joins it into the previous block
    // (only in the same list/quote context) or, for an empty block, deletes it —
    // removing the wrapping ul/blockquote once its last child is gone. jsdom
    // performs no default deletion, so the DOM and string store are updated here.
    const handleBackspace = (e: KeyboardEvent) => {
      const session = sessionRef.current;
      if (!session) return;
      const block = session.block;
      if (!collapsedAtStart(block)) return;

      const blocks = Array.from(container.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR));
      const prev = blocks[blocks.indexOf(block) - 1];
      if (!prev) {
        e.preventDefault();
        return;
      }

      if ((block.textContent ?? '').trim() === '') {
        const kind = classifyBlock(block);
        const wrapper = block.parentElement;
        block.remove();
        session.editHtml = replaceNth(session.editHtml, session.needle, session.occIndex, '');

        if ((kind === 'li' || kind === 'quote-p') && wrapper) {
          const orphaned =
            kind === 'li'
              ? wrapper.tagName.toLowerCase() === 'ul' && !wrapper.querySelector('li')
              : wrapper.classList.contains('wp-block-quote') && !wrapper.querySelector('p');
          if (orphaned) {
            const wrapperOuter = wrapper.outerHTML;
            const wrapperIndex = elementOccurrenceIndex(container, wrapper);
            wrapper.remove();
            session.editHtml = replaceNth(session.editHtml, wrapperOuter, wrapperIndex, '');
          }
        }

        if (!container.querySelector(EDITABLE_SELECTOR)) {
          session.editHtml = '';
          commit();
          return;
        }
        retarget(prev);
        return;
      }

      if (block.parentElement !== prev.parentElement) {
        e.preventDefault();
        return;
      }

      const prevNeedle = stripEditingArtifacts(prev.outerHTML);
      const prevIndex = strippedOccurrenceIndex(container, prev, prevNeedle);
      prev.textContent = (prev.textContent ?? '') + (block.textContent ?? '');
      block.remove();
      session.editHtml = replaceNth(session.editHtml, session.needle, session.occIndex, '');
      session.editHtml = replaceNth(session.editHtml, prevNeedle, prevIndex, stripEditingArtifacts(prev.outerHTML));
      retarget(prev);
    };

    const handleKeydown = (e: KeyboardEvent) => {
      const session = sessionRef.current;
      if (!session) return;
      if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || e.key === 'Escape') {
        e.preventDefault();
        commit();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleEnter();
      }
      if (e.key === 'Backspace') {
        handleBackspace(e);
      }
    };

    container.addEventListener('mousedown', handleMousedown, true);
    container.addEventListener('input', handleInput, true);
    container.addEventListener('blur', handleBlur, true);
    container.addEventListener('keydown', handleKeydown);

    return () => {
      pendingIndexRef.current = null;
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