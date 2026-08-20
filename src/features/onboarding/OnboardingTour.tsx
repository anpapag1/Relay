import React, { useEffect } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { actions } from '../../state/actions';

export const ONBOARDING_SEEN_KEY = 'relay_onboarding_seen';

const STEP_COPY: { title: string; body: string }[] = [
  {
    title: 'Import your old site',
    body: "Load your old site's data two ways: upload its WordPress XML export, or live-scrape the site's REST API or RSS feed. Relay reads the articles and fills the old- and new-site taxonomy tables (categories, tags) as it imports.",
  },
  {
    title: 'Map categories and tags',
    body: 'The Mappings tab pairs each old-site category and tag with its new-site equivalent. Relay suggests matches and flags anything it cannot match, so nothing is silently dropped.',
  },
  {
    title: 'Tune conversion settings',
    body: 'Settings control how the conversion behaves — image sizes, gallery layout, links, spacing. The live preview shows the effect on a real article as you change them.',
  },
  {
    title: 'Review and fix articles',
    body: 'Every article is listed in the Articles tab. Exclude what should not migrate, flag the rest for review, and use the drawer to edit an article’s converted content and metadata.',
  },
  {
    title: 'Build and export',
    body: 'The Build & Export tab runs a pre-flight check for problems, converts every article to Gutenberg blocks, and produces a WordPress eXtended RSS (WXR) file ready to import into the new site.',
  },
  {
    title: 'Everything is saved locally',
    body: 'Your taxonomies, mappings and settings are saved on this machine — nothing leaves your browser. Next time you work on the same site, open the Saved sites button and load its articles: your saved setup comes back, so you don’t have to map and configure everything again.',
  },
];

export const ONBOARDING_STEP_COUNT = STEP_COPY.length;

const ChevronRightIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const CheckIcon: React.FC<{ size?: number }> = ({ size = 10 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const DocumentIcon: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

const GlobeIcon: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);

const DatabaseIcon: React.FC<{ size?: number }> = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14a9 3 0 0 0 18 0V5" />
    <path d="M3 12a9 3 0 0 0 18 0" />
  </svg>
);

const ROW_HEIGHT = 24;

function ColHeader({ label }: { label: string }) {
  return (
    <div style={{ height: 12, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--relay-text-muted)' }}>
      {label}
    </div>
  );
}

function ImportIllustration() {
  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: 'XML export', icon: <DocumentIcon />, delay: 0.15 },
          { label: 'Live scrape', icon: <GlobeIcon />, delay: 0.35 },
        ].map((source) => (
          <div
            key={source.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10,
              padding: '5px 10px',
              borderRadius: 6,
              background: 'var(--relay-surface)',
              border: '1px solid var(--relay-border-soft)',
              animation: `relay-row-in 0.4s ease-out ${source.delay}s backwards`,
            }}
          >
            <span style={{ display: 'flex', color: 'var(--relay-accent)' }}>{source.icon}</span>
            {source.label}
          </div>
        ))}
      </div>
      <div style={{ color: 'var(--relay-accent)', animation: 'relay-arrow-right 1.2s ease-in-out infinite' }}>
        <ChevronRightIcon size={18} />
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        {(['Old', 'New'] as const).map((label, col) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <ColHeader label={`${label} site`} />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 58,
                  height: 10,
                  borderRadius: 4,
                  background: col === 1 ? 'var(--relay-accent-soft)' : 'var(--relay-surface)',
                  border: '1px solid var(--relay-border-soft)',
                  animation: `relay-row-in 0.35s ease-out ${0.55 + col * 0.4 + i * 0.12}s backwards`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MappingsIllustration() {
  const rows = [
    { old: 'Category', match: true },
    { old: 'Tag', match: true },
    { old: 'Topic', match: false },
  ];
  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ColHeader label="Old site" />
        {rows.map((row, i) => (
          <div
            key={row.old}
            style={{
              display: 'flex',
              alignItems: 'center',
              minHeight: ROW_HEIGHT,
              fontSize: 10,
              padding: '4px 10px',
              borderRadius: 5,
              background: 'var(--relay-surface-subtle)',
              border: '1px solid var(--relay-border)',
              animation: `relay-row-in 0.35s ease-out ${i * 0.15}s backwards`,
            }}
          >
            {row.old}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 12 }} />
        {rows.map((row, i) => (
          <div
            key={row.old}
            style={{
              height: ROW_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              color: row.match ? 'var(--relay-accent)' : '#f59e0b',
              animation: `relay-arrow-right 1.2s ease-in-out ${i * 0.3}s infinite`,
            }}
          >
            <ChevronRightIcon size={16} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ColHeader label="New site" />
        {rows.map((row, i) =>
          row.match ? (
            <div
              key={row.old}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minHeight: ROW_HEIGHT,
                fontSize: 10,
                padding: '4px 10px',
                borderRadius: 5,
                background: 'var(--relay-accent-soft)',
                border: '1px solid var(--relay-accent-border)',
                color: 'var(--relay-accent-hover)',
                animation: `relay-row-in 0.35s ease-out ${0.5 + i * 0.15}s backwards`,
              }}
            >
              {row.old}
              <span style={{ display: 'flex' }}>
                <CheckIcon size={10} />
              </span>
            </div>
          ) : (
            <div
              key={row.old}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minHeight: ROW_HEIGHT,
                fontSize: 10,
                padding: '4px 10px',
                borderRadius: 5,
                background: 'var(--relay-surface)',
                border: '1px solid #f59e0b',
                color: 'var(--relay-text-2)',
                animation: `relay-row-in 0.35s ease-out ${0.5 + i * 0.15}s backwards`,
              }}
            >
              {row.old}
              <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '1px 5px', borderRadius: 3, background: '#f59e0b', color: 'white' }}>
                unmatched
              </span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function SettingsIllustration() {
  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { label: 'Image', control: 'slider', animation: 'relay-toggle 4.4s ease-in-out 0.4s infinite' },
          { label: 'Text', control: 'slider', animation: 'relay-toggle 3.8s ease-in-out 1.7s infinite' },
          { label: 'Button', control: 'toggle', animation: 'relay-toggle 4.8s ease-in-out 2.9s infinite' },
        ].map((row) => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--relay-text-2)' }}>
            <span style={{ width: 40 }}>{row.label}</span>
            {row.control === 'slider' ? (
              <div style={{ width: 54, height: 4, borderRadius: 2, background: 'var(--relay-surface-subtle)', border: '1px solid var(--relay-border-soft)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: -3, left: 2, width: 10, height: 10, borderRadius: '50%', background: 'var(--relay-accent)', animation: row.animation }} />
              </div>
            ) : (
              <div style={{ width: 30, height: 16, borderRadius: 8, background: 'var(--relay-accent)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 2, left: 2, width: 12, height: 12, borderRadius: '50%', background: 'white', animation: row.animation }} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderRadius: 8, background: 'var(--relay-surface)', border: '1px solid var(--relay-border-soft)' }}>
        <div
          style={{
            height: 34,
            borderRadius: 4,
            background: 'var(--relay-surface-subtle)',
            border: '1px solid var(--relay-border-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--relay-text-muted)',
            animation: 'relay-grow-shrink 4.2s ease-in-out 0.2s infinite',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--relay-border)', animation: 'relay-grow-shrink 3.6s ease-in-out 1.2s infinite' }} />
        <div style={{ height: 6, borderRadius: 3, background: 'var(--relay-border)', animation: 'relay-grow-shrink 4.4s ease-in-out 2.4s infinite' }} />
        <div style={{ position: 'relative', width: 66, height: 22, marginTop: 2 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--relay-accent-hover)',
              textDecoration: 'underline',
              textUnderlineOffset: 2,
              animation: 'relay-chip-2-first 4.4s ease-in-out 0.9s infinite',
            }}
          >
            Link
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: 'white',
              background: 'var(--relay-accent)',
              borderRadius: 6,
              animation: 'relay-chip-2-last 4.4s ease-in-out 0.9s infinite',
            }}
          >
            Embed
          </div>
        </div>
      </div>
    </div>
  );
}

function ArticlesIllustration() {
  const states = [
    { label: 'Included', color: '#22c55e', keyframe: 'relay-chip-3-first' },
    { label: 'Needs review', color: '#f59e0b', keyframe: 'relay-chip-3-mid' },
    { label: 'Excluded', color: '#ef4444', keyframe: 'relay-chip-3-last' },
  ];
  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
      <div
        style={{
          width: 74,
          aspectRatio: '210 / 297',
          borderRadius: 6,
          border: '2px solid #22c55e',
          animation: 'relay-status-cycle 3s ease-in-out infinite',
          background: 'var(--relay-surface)',
          padding: 10,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ height: 8, width: '70%', borderRadius: 4, background: 'var(--relay-text)' }} />
        <div style={{ flex: 1, borderRadius: 4, background: 'var(--relay-surface-subtle)' }} />
        <div style={{ height: 6, width: '100%', borderRadius: 3, background: 'var(--relay-border)' }} />
        <div style={{ height: 6, width: '80%', borderRadius: 3, background: 'var(--relay-border)' }} />
        <div style={{ height: 6, width: '60%', borderRadius: 3, background: 'var(--relay-border)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {['Title', 'Published', 'Status'].map((label) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--relay-text-2)' }}>
            <span style={{ width: 52 }}>{label}</span>
            <span style={{ width: 54, height: 8, borderRadius: 4, background: 'var(--relay-surface-subtle)', border: '1px solid var(--relay-border-soft)' }} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, paddingTop: 2 }}>
          {states.map((state) => (
            <div
              key={state.label}
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 999,
                border: `1px solid ${state.color}`,
                color: state.color,
                background: 'var(--relay-surface)',
                animation: `${state.keyframe} 3s ease-in-out infinite`,
              }}
            >
              {state.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BuildIllustration() {
  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px 4px 8px',
              borderRadius: 6,
              background: 'var(--relay-surface)',
              border: '1px solid var(--relay-border-soft)',
              animation: `relay-row-in 0.4s ease ${i * 0.15}s both`,
            }}
          >
            <span style={{ display: 'inline-flex', color: '#22c55e', animation: 'relay-check-in 0.3s ease 0.3s both' }}>
              <CheckIcon />
            </span>
            <span style={{ fontSize: 10, color: 'var(--relay-text-2)' }}>Article</span>
            <span style={{ width: 24, height: 5, borderRadius: 2.5, background: 'var(--relay-border)' }} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: 'var(--relay-surface-subtle)',
            border: '1px solid var(--relay-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--relay-accent)',
            animation: 'relay-spin 1.6s linear infinite',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </div>
        <div style={{ width: 46, height: 4, borderRadius: 2, background: 'var(--relay-surface-subtle)', border: '1px solid var(--relay-border-soft)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 2, background: 'var(--relay-accent)', animation: 'relay-fill 1.4s ease-in-out infinite' }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            width: 42,
            height: 44,
            borderRadius: 8,
            background: 'var(--relay-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            animation: 'relay-arrow-down 1.6s ease-in-out infinite',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="m7 10 5 5 5-5" />
            <path d="M12 15V3" />
          </svg>
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--relay-accent-hover)' }}>export.wxr</div>
      </div>
    </div>
  );
}

function ReusabilityIllustration() {
  const saved = ['Taxonomies', 'Mappings', 'Settings'];
  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: 12, borderRadius: 8, background: 'var(--relay-surface)', border: '1px solid var(--relay-border-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: 'var(--relay-accent-hover)' }}>
          <DatabaseIcon />
          Saved locally
        </div>
        {saved.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--relay-text-2)', animation: `relay-row-in 0.4s ease ${0.2 + i * 0.15}s both` }}>
            <span style={{ display: 'inline-flex', color: '#22c55e', animation: 'relay-check-in 0.3s ease 0.35s both' }}>
              <CheckIcon />
            </span>
            {label}
          </div>
        ))}
      </div>
      <div style={{ animation: 'relay-arrow-right 1.6s ease-in-out infinite', color: 'var(--relay-text-muted)', display: 'flex' }}>
        <ChevronRightIcon size={20} />
      </div>
      <div
        style={{
          width: 150,
          borderRadius: 8,
          background: 'var(--relay-surface)',
          border: '1px solid var(--relay-border)',
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          animation: 'relay-glow 1.6s ease-in-out infinite',
        }}
      >
        <div style={{ display: 'flex', gap: 4, marginBottom: 1 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--relay-border)' }} />
          ))}
        </div>
        <div style={{ height: 6, width: '75%', borderRadius: 3, background: 'var(--relay-border)' }} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 9, width: '100%', borderRadius: 4, background: 'var(--relay-surface-subtle)', border: '1px solid var(--relay-border-soft)', animation: `relay-row-in 0.4s ease ${0.5 + i * 0.2}s both` }} />
        ))}
        <div style={{ fontSize: 9, textAlign: 'center', color: 'var(--relay-text-muted)', paddingTop: 2 }}>Articles loaded</div>
      </div>
    </div>
  );
}

function StepIllustration({ step }: { step: number }) {
  if (step === 0) return <ImportIllustration />;
  if (step === 1) return <MappingsIllustration />;
  if (step === 2) return <SettingsIllustration />;
  if (step === 3) return <ArticlesIllustration />;
  if (step === 4) return <BuildIllustration />;
  return <ReusabilityIllustration />;
}

/** A non-blocking floating-card tour (one step per tab) that never changes
 * the active tab, so the background stays put. Auto-opens once on first
 * load; the header's help button reopens it any time. Rendered as a card
 * rather than a full-screen modal so the app stays visible behind it. */
export const OnboardingTour: React.FC = () => {
  const { state, dispatch } = useAppState();
  const step = state.ui.onboardingStep;

  const close = () => {
    dispatch(actions.setOnboardingStep(null));
    try {
      window.localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
    } catch {
      // ignore
    }
  };

  const goTo = (next: number) => dispatch(actions.setOnboardingStep(Math.min(Math.max(next, 0), STEP_COPY.length - 1)));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!window.localStorage.getItem(ONBOARDING_SEEN_KEY)) {
        dispatch(actions.setOnboardingStep(0));
      }
    } catch {
      // ignore — a locked-down localStorage shouldn't block the tour
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigate with the keyboard: Left/Right arrows step back/forward and
  // Escape (or Right on the last step) closes the tour. Mounted as a window
  // listener only while the tour is open so it never hijacks typing in the
  // app behind it.
  useEffect(() => {
    if (step === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        if (step >= STEP_COPY.length - 1) close();
        else goTo(step + 1);
      } else if (event.key === 'ArrowLeft') {
        if (step > 0) goTo(step - 1);
      } else if (event.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (step === null) return null;

  const copy = STEP_COPY[step];
  const isLast = step === STEP_COPY.length - 1;

  const navButton: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 6,
    padding: '6px 12px',
    cursor: 'pointer',
    border: '1px solid var(--relay-border)',
    background: 'var(--relay-surface)',
    color: 'var(--relay-text)',
  };
  const primaryButton: React.CSSProperties = {
    ...navButton,
    border: 'none',
    background: 'var(--relay-accent)',
    color: 'white',
  };

  return (
    <div
      role="dialog"
      aria-label="Relay tour"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 40,
        width: 'min(500px, calc(100vw - 40px))',
        height: 460,
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--relay-surface)',
        border: '1px solid var(--relay-border)',
        borderRadius: 14,
        boxShadow: '0 25px 50px -12px oklch(0% 0 0 / 0.25)',
      }}
    >
      <div
        style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--relay-border-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--relay-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2.5, background: 'white' }} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Welcome to Relay</div>
          <div style={{ fontSize: 12, color: 'var(--relay-text-muted)' }}>
            {step + 1}/{STEP_COPY.length}
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close the tour"
          style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--relay-text-muted)' }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: '24px 24px 16px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <div
          style={{
            minHeight: 140,
            borderRadius: 10,
            background: 'var(--relay-surface-subtle)',
            border: '1px solid var(--relay-border-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px 20px',
            boxSizing: 'border-box',
          }}
        >
          <StepIllustration key={step} step={step} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{copy.title}</div>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--relay-text-2)' }}>{copy.body}</div>
      </div>

      <div style={{ padding: '14px 24px 18px', borderTop: '1px solid var(--relay-border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" onClick={close} style={{ ...navButton, border: 'none', background: 'transparent', color: 'var(--relay-text-muted)' }}>
          Skip
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 && (
            <button type="button" onClick={() => goTo(step - 1)} style={navButton}>
              Back
            </button>
          )}
          <button type="button" onClick={isLast ? close : () => goTo(step + 1)} style={primaryButton}>
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};