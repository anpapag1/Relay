/** @jsxImportSource react */
import { describe, expect, it, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AppStateProvider, useAppState } from '../../state/AppStateContext';
import { initialState } from '../../state/reducer';
import type { AppState } from '../../state/types';
import { OnboardingTour, ONBOARDING_SEEN_KEY } from './OnboardingTour';

function tourUi(step: number | null): AppState['ui'] {
  return {
    ...initialState.ui,
    onboardingStep: step,
  };
}

function Probe() {
  const { state } = useAppState();
  return (
    <div>
      <span data-testid="active-tab">{state.ui.activeTab}</span>
      <span data-testid="step">{String(state.ui.onboardingStep)}</span>
      <OnboardingTour />
    </div>
  );
}

function renderTour(initialStep: number | null = null) {
  if (initialStep !== null) window.localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <AppStateProvider initialStateOverride={initialStep !== null ? { ui: tourUi(initialStep) } : undefined} enableAutosave={false}>
        <Probe />
      </AppStateProvider>,
    );
  });
  const text = () => container.textContent ?? '';
  const step = () => container.querySelector('[data-testid="step"]')?.textContent ?? 'null';
  const tab = () => container.querySelector('[data-testid="active-tab"]')?.textContent ?? '';
  const buttons = () => Array.from(container.querySelectorAll('button'));
  const buttonByText = (label: string) => buttons().find((b) => b.textContent?.trim() === label);
  return { container, root, text, step, tab, buttonByText };
}

function press(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('OnboardingTour', () => {
  it('renders nothing when the tour is closed', () => {
    window.localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
    const t = renderTour(null);
    expect(t.text()).not.toContain('Welcome to Relay');
    expect(t.container.querySelector('[role="dialog"]')).toBeNull();
    t.root.unmount();
  });

  it('shows the first step when opened', () => {
    const t = renderTour(0);
    expect(t.text()).toContain('Welcome to Relay');
    expect(t.text()).toContain('1/6');
    expect(t.text()).toContain('Import your old site');
    expect(t.text()).toContain('Next');
    t.root.unmount();
  });

  it('advances steps and navigates back', () => {
    const t = renderTour(0);

    act(() => {
      t.buttonByText('Next')?.click();
    });
    expect(t.step()).toBe('1');
    expect(t.text()).toContain('Map categories and tags');
    expect(t.text()).toContain('Back');

    act(() => {
      t.buttonByText('Back')?.click();
    });
    expect(t.step()).toBe('0');
    expect(t.text()).toContain('Import your old site');
    t.root.unmount();
  });

  it('walks to the last step and Done closes the tour and marks it seen', () => {
    const t = renderTour(0);
    for (let i = 0; i < 5; i += 1) {
      act(() => {
        t.buttonByText('Next')?.click();
      });
    }
    expect(t.text()).toContain('6/6');
    expect(t.text()).toContain('Everything is saved locally');

    act(() => {
      t.buttonByText('Done')?.click();
    });
    expect(t.step()).toBe('null');
    expect(t.text()).not.toContain('Welcome to Relay');
    expect(window.localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe('1');
    t.root.unmount();
  });

  it('Skip closes the tour and marks it seen', () => {
    const t = renderTour(0);
    act(() => {
      t.buttonByText('Skip')?.click();
    });
    expect(t.step()).toBe('null');
    expect(window.localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe('1');
    t.root.unmount();
  });

  it('auto-opens on first load when the seen flag is unset', () => {
    const t = renderTour(null);
    expect(t.step()).toBe('0');
    expect(t.text()).toContain('Import your old site');
    t.root.unmount();
  });

  it('does not auto-open when the seen flag is already set', () => {
    window.localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
    const t = renderTour(null);
    expect(t.step()).toBe('null');
    expect(t.text()).not.toContain('Welcome to Relay');
    t.root.unmount();
  });

  it('navigates steps with the arrow keys', () => {
    const t = renderTour(0);

    press('ArrowRight');
    expect(t.step()).toBe('1');
    expect(t.text()).toContain('Map categories and tags');

    press('ArrowRight');
    press('ArrowRight');
    expect(t.step()).toBe('3');

    press('ArrowLeft');
    expect(t.step()).toBe('2');
    expect(t.text()).toContain('Tune conversion settings');

    press('ArrowLeft');
    expect(t.step()).toBe('1');
    t.root.unmount();
  });

  it('does not go before the first step or ignore other keys', () => {
    const t = renderTour(0);
    press('ArrowLeft');
    expect(t.step()).toBe('0');
    press('Home');
    expect(t.step()).toBe('0');
    t.root.unmount();
  });

  it('Escape closes the tour and marks it seen', () => {
    const t = renderTour(2);
    press('Escape');
    expect(t.step()).toBe('null');
    expect(window.localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe('1');
    t.root.unmount();
  });

  it('ArrowRight on the last step closes the tour', () => {
    const t = renderTour(5);
    press('ArrowRight');
    expect(t.step()).toBe('null');
    expect(window.localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe('1');
    t.root.unmount();
  });

  it('does not respond to keys while the tour is closed', () => {
    window.localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
    const t = renderTour(null);
    press('ArrowRight');
    press('Escape');
    expect(t.step()).toBe('null');
    t.root.unmount();
  });
});