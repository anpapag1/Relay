import React, { useState } from 'react';
import { useAppState } from '../state/AppStateContext';
import { domainForState } from '../state/siteProfiles';
import { SitesDrawer } from '../features/sites/SitesDrawer';
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

export const Header: React.FC = () => {
  const { state, dispatch } = useAppState();
  const { activeTab } = state.ui;
  const [sitesOpen, setSitesOpen] = useState(false);
  const domain = domainForState(state) ?? 'Sites';
  const { preference, setTheme } = useTheme();

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
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '7px',
                    background: 'var(--relay-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ width: '11px', height: '11px', borderRadius: '2.5px', background: 'white' }} />
                </div>
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
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={cycleTheme}
                aria-label={`Theme: ${THEME_LABELS[preference]} (click to cycle light, dark, auto)`}
                title={`Theme: ${THEME_LABELS[preference]} — click to cycle`}
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
                {THEME_LABELS[preference]}
              </button>
              <button
                type="button"
                onClick={() => setSitesOpen(true)}
                aria-label="Open saved site preferences"
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
