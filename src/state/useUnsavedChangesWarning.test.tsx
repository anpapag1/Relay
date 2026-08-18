/** @jsxImportSource react */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AppStateProvider } from './AppStateContext';
import { useUnsavedChangesWarning } from './useUnsavedChangesWarning';
import { reportDraftDirty } from './unsavedChanges';
import type { ArticleOverride } from './types';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  reportDraftDirty(false);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  document.body.removeChild(container);
  reportDraftDirty(false);
});

function fireBeforeUnload(): BeforeUnloadEvent {
  const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return event;
}

function Harness() {
  useUnsavedChangesWarning();
  return null;
}

function renderWarning(articles?: Record<number, ArticleOverride>) {
  return act(async () => {
    root.render(
      <AppStateProvider enableAutosave={false} initialStateOverride={articles ? { articles } : undefined}>
        <Harness />
      </AppStateProvider>,
    );
  });
}

async function remount(articles?: Record<number, ArticleOverride>) {
  await act(async () => {
    root.unmount();
  });
  root = createRoot(container);
  await renderWarning(articles);
}

describe('useUnsavedChangesWarning', () => {
  it('does not guard beforeunload when nothing is dirty', async () => {
    await renderWarning();
    const event = fireBeforeUnload();
    expect(event.defaultPrevented).toBe(false);
  });

  it('guards beforeunload when a manual article override exists', async () => {
    await renderWarning({ 1: { excluded: true, auto: false, reason: 'skip' } });
    const event = fireBeforeUnload();
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not guard beforeunload when only auto-exclusions exist', async () => {
    await renderWarning({ 1: { excluded: true, auto: true, reason: 'Duplicate link' } });
    const event = fireBeforeUnload();
    expect(event.defaultPrevented).toBe(false);
  });

  it('guards beforeunload for a saved edit, and stops once reverted', async () => {
    await renderWarning({ 1: { editedHtml: '<p>v2</p>' } });
    expect(fireBeforeUnload().defaultPrevented).toBe(true);

    await remount({ 1: {} });
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('guards beforeunload while the drawer draft is dirty and stops once it clears', async () => {
    await renderWarning();
    await act(async () => {
      reportDraftDirty(true);
    });
    const dirtyEvent = fireBeforeUnload();
    expect(dirtyEvent.defaultPrevented).toBe(true);

    await act(async () => {
      reportDraftDirty(false);
    });
    const cleanEvent = fireBeforeUnload();
    expect(cleanEvent.defaultPrevented).toBe(false);
  });
});