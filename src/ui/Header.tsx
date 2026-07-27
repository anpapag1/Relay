import React from 'react';
import { useAppState } from '../state/AppStateContext';

type TabId = 'import' | 'mappings' | 'settings' | 'articles' | 'build';

const TABS: { id: TabId; label: string }[] = [
  { id: 'import', label: 'Import' },
  { id: 'mappings', label: 'Mappings' },
  { id: 'settings', label: 'Settings' },
  { id: 'articles', label: 'Articles' },
  { id: 'build', label: 'Build & Export' },
];

export const Header: React.FC = () => {
  const { state, dispatch } = useAppState();
  const { activeTab } = state.ui;
  const hasImport = state.source !== null;

  // Extract domain from link or title if available
  let domain = 'old-site.com';
  if (state.source?.siteUrl) {
    try {
      domain = new URL(state.source.siteUrl).hostname;
    } catch {
      domain = state.source.siteUrl;
    }
  }

  return (
    <div
      style={{
        background: 'white',
        borderBottom: '1px solid oklch(90% 0.005 250)',
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
                  background: 'oklch(50% 0.16 265)',
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
                  color: 'oklch(50% 0.01 250)',
                  padding: '3px 8px',
                  border: '1px solid oklch(88% 0.005 250)',
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
                      color: isActive ? 'oklch(50% 0.16 265)' : 'oklch(55% 0.01 250)',
                      cursor: 'pointer',
                      borderBottom: isActive ? '2px solid oklch(50% 0.16 265)' : '2px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {hasImport && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'oklch(45% 0.01 250)',
                background: 'oklch(97% 0.004 250)',
                border: '1px solid oklch(90% 0.005 250)',
                borderRadius: '6px',
                padding: '6px 10px',
                marginBottom: '14px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span>{domain}</span>
              <span style={{ color: 'oklch(65% 0.005 250)' }}>→</span>
              <span>new site</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
