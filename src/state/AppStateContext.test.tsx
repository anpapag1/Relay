/** @jsxImportSource react */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AppStateProvider, useAppState } from './AppStateContext';
import { saveSiteProfile } from './siteProfiles';
import type { ConversionSettings, ParseResult, TermTable } from '../types/domain';

const MOCK_RESULT: ParseResult = {
  ok: true,
  siteUrl: 'https://old.example',
  totalItems: 1,
  articles: [
    {
      postId: 1,
      postType: 'post',
      status: 'publish',
      title: 'Hello',
      link: 'https://old.example/hello/',
      postDate: '2026-01-01',
      postName: 'hello',
      creator: '',
      contentHtml: '<p>Hi</p>',
      excerptHtml: '',
      terms: [],
      postmeta: {},
    },
  ],
  attachments: [],
  taxonomies: {},
  authors: [],
  statusCounts: { publish: 1 },
};

const TABLE: TermTable = { id: 'cats', label: 'Categories', terms: [{ id: 'cat-news', name: 'News', slug: 'news' }] };

function Harness() {
  const { state, dispatch } = useAppState();
  useEffect(() => {
    dispatch({ type: 'LOAD_SOURCE', result: MOCK_RESULT, defaultBuilder: 'plainHtml', confidence: 90 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div>
      <span data-testid="tables">{Object.keys(state.target.tables).join(',')}</span>
      <span data-testid="settings">{state.settings.imageAlign}</span>
    </div>
  );
}

function HarnessWithEdit() {
  const { state, dispatch } = useAppState();
  useEffect(() => {
    dispatch({ type: 'LOAD_SOURCE', result: MOCK_RESULT, defaultBuilder: 'plainHtml', confidence: 90 });
    dispatch({ type: 'UPDATE_SETTINGS', settings: { imageAlign: 'left' } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div data-testid="tables">{Object.keys(state.target.tables).join(',')}</div>;
}

async function renderHarness(harness: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<AppStateProvider enableAutosave>{harness}</AppStateProvider>);
  });
  return { container, root };
}

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 550)); });

beforeEach(() => {
  window.localStorage.clear();
});

describe('AppStateProvider autosave', () => {
  it('auto-loads a saved profile when the detected domain matches', async () => {
    const settings: ConversionSettings = { ...initialStateSettings(), imageAlign: 'right' };
    const backup = {
      targetTables: { cats: TABLE },
      oldTables: {},
      mappings: {},
      settings,
    };
    saveSiteProfile('old.example', backup);

    const { container, root } = await renderHarness(<Harness />);
    await tick();
    expect(container.querySelector('[data-testid="tables"]')?.textContent).toBe('cats');
    expect(container.querySelector('[data-testid="settings"]')?.textContent).toBe('right');
    root.unmount();
  });

  it('does not load anything when no profile exists for the detected domain', async () => {
    const { container, root } = await renderHarness(<Harness />);
    await tick();
    expect(container.querySelector('[data-testid="tables"]')?.textContent).toBe('');
    root.unmount();
  });

  it('persists config-slice edits to the active domain profile', async () => {
    const { root } = await renderHarness(<HarnessWithEdit />);
    await tick();
    const loaded = loadProfile('old.example');
    expect(loaded?.data.settings.imageAlign).toBe('left');
    root.unmount();
  });

  it('sweeps the legacy global session key on mount', async () => {
    window.localStorage.setItem('relay_session_backup_v1', '{old}');
    const { root } = await renderHarness(<Harness />);
    expect(window.localStorage.getItem('relay_session_backup_v1')).toBeNull();
    root.unmount();
  });
});

function initialStateSettings(): ConversionSettings {
  return { imageSize: 'large', imageAlign: 'center', autoSpacing: true, spacerSize: 30, combineConsecutiveImages: false, galleryColumns: 3, galleryAspectRatio: 'none', pdfRender: 'embed', buttonRender: 'button', headingShift: 0, linksNewTab: false };
}

function loadProfile(domain: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const raw = window.localStorage.getItem(`relay_site_v1_${domain}`);
  return raw ? JSON.parse(raw) : null;
}
