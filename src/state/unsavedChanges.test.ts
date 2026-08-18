import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isDraftDirty, reportDraftDirty, subscribeDraftDirty } from './unsavedChanges';

beforeEach(() => {
  reportDraftDirty(false);
});

describe('unsavedChanges draft-dirty bridge', () => {
  it('reports dirtiness and notifies subscribers on change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDraftDirty(listener);
    expect(listener).toHaveBeenCalledWith(false);

    reportDraftDirty(true);
    expect(listener).toHaveBeenLastCalledWith(true);
    expect(isDraftDirty()).toBe(true);

    reportDraftDirty(false);
    expect(listener).toHaveBeenLastCalledWith(false);
    expect(isDraftDirty()).toBe(false);

    unsubscribe();
  });

  it('does not re-notify when the value is unchanged', () => {
    const listener = vi.fn();
    subscribeDraftDirty(listener);
    reportDraftDirty(true);
    reportDraftDirty(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops notifying a subscriber after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDraftDirty(listener);
    unsubscribe();
    reportDraftDirty(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});