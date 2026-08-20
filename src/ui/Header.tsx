import React, { useState } from 'react';
import { useAppState } from '../state/AppStateContext';
import { actions } from '../state/actions';
import { domainForState } from '../state/siteProfiles';
import { SitesDrawer } from '../features/sites/SitesDrawer';
import { ONBOARDING_STEP_COUNT } from '../features/onboarding/OnboardingTour';
import { useTheme } from '../theme';

type TabId = 'import' | 'mappings' | 'settings' | 'articles' | 'build';

const TABS: { id: TabId; label: string }[] = [
  { id: 'import', label: 'Import' },
  { id: 'mappings', label: 'Mappings' },
  { id: 'settings', label: 'Settings' },
  { id: 'articles', label: 'Articles' },
  { id: 'build', label: 'Build & Export' },
];

const THEME_LABELS: Record<string, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Auto',
};

const ThemeIcon: React.FC<{ preference: string }> = ({ preference }) => {
  if (preference === 'dark') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  if (preference === 'light') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22" />
        <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
        <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
        <line x1="2" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22" y2="12" />
        <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
        <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
};

export const Header: React.FC = () => {
  const { state, dispatch } = useAppState();
  const { activeTab } = state.ui;
  const [sitesOpen, setSitesOpen] = useState(false);
  const domain = domainForState(state) ?? 'Sites';
  const { preference, setTheme } = useTheme();
  const tourStep = state.ui.onboardingStep;

  const cycleTheme = () => {
    const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(preference) + 1) % order.length];
    setTheme(next);
  };

  return (
    <>
      <div
        style={{
          background: 'var(--relay-surface)',
          borderBottom: '1px solid var(--relay-border)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          boxShadow: '0 1px 2px oklch(0% 0 0 / 0.02)',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 32px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '44px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '18px 0 16px' }}>
                <img
                  src="/icon.svg"
                  alt="Relay logo"
                  style={{ height: '26px', width: 'auto', display: 'block' }}
                />
                <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em' }}>Relay</div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--relay-text-muted)',
                    padding: '3px 8px',
                    border: '1px solid var(--relay-border)',
                    borderRadius: '5px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  WordPress Migration
                </div>
              </div>

              <div style={{ display: 'flex', gap: '26px' }}>
                {TABS.map((tab) => {
                  const isActive = tab.id === activeTab;
                  const isTourTarget = tourStep !== null && TABS.indexOf(tab) === tourStep;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: tab.id as any })}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '0 0 16px 0',
                        fontSize: '14px',
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? 'var(--relay-accent)' : 'var(--relay-text-muted)',
                        cursor: 'pointer',
                        borderBottom: isActive ? '2px solid var(--relay-accent)' : '2px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span className={isTourTarget ? 'tour-tab-pulse' : undefined}>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => dispatch(actions.setOnboardingStep(0))}
                aria-label="Start the onboarding tour"
                title="Start the onboarding tour"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--relay-text-2)',
                  background: 'var(--relay-surface-subtle)',
                  border: '1px solid var(--relay-border)',
                  borderRadius: '50%',
                  padding: '0',
                  marginBottom: '14px',
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              >
                ?
              </button>
              <button
                type="button"
                onClick={cycleTheme}
                aria-label={`Theme: ${THEME_LABELS[preference]} (click to cycle light, dark, auto)`}
                title={`Theme: ${THEME_LABELS[preference]} — click to cycle`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--relay-text-2)',
                  background: 'var(--relay-surface-subtle)',
                  border: '1px solid var(--relay-border)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  marginBottom: '14px',
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              >
                <ThemeIcon preference={preference} />
              </button>
              <button
                type="button"
                onClick={() => setSitesOpen(true)}
                aria-label="Open saved site preferences"
                className={tourStep !== null && tourStep === ONBOARDING_STEP_COUNT - 1 ? 'tour-btn-pulse' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--relay-text-2)',
                  background: 'var(--relay-surface-subtle)',
                  border: '1px solid var(--relay-border)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  marginBottom: '14px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              >
                {domain}
              </button>
            </div>
          </div>
        </div>
      </div>
      <SitesDrawer open={sitesOpen} onClose={() => setSitesOpen(false)} />
    </>
  );
};
