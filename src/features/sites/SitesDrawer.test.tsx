/** @jsxImportSource react */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AppStateProvider } from '../../state/AppStateContext';
import { SitesDrawer } from './SitesDrawer';
import { saveSiteProfile } from '../../state/siteProfiles';
import { initialState } from '../../state/reducer';
import type { SiteDataBackup } from '../../state/session';

const DATA: SiteDataBackup = {
  targetTables: {},
  oldTables: {},
  mappings: {},
  settings: initialState.settings,
};

async function renderDrawer(open = true) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <AppStateProvider enableAutosave={false}>
        <SitesDrawer open={open} onClose={vi.fn()} />
      </AppStateProvider>,
    );
  });
  return { container, root };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('SitesDrawer', () => {
  it('renders the title and lists saved profiles with an Active badge', async () => {
    saveSiteProfile('old.example', DATA);
    saveSiteProfile('other.example', DATA);
    const { container, root } = await renderDrawer();
    expect(container.textContent).toContain('Auto saved site preferences');
    expect(container.textContent).toContain('old.example');
    expect(container.textContent).toContain('other.example');
    expect(container.textContent).not.toContain('Active');
    root.unmount();
  });

  it('renders nothing when closed', async () => {
    const { container, root } = await renderDrawer(false);
    expect(container.textContent).toBe('');
    root.unmount();
  });

  it('filters the list by search', async () => {
    saveSiteProfile('old.example', DATA);
    saveSiteProfile('other.example', DATA);
    const { container, root } = await renderDrawer();
    const search = Array.from(container.querySelectorAll('input')).find((el) => (el as HTMLInputElement).getAttribute('aria-label') === 'Search sites');
    expect(search).toBeDefined();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setter?.call(search, 'other');
      search?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.textContent).toContain('other.example');
    expect(container.textContent).not.toContain('old.example');
    root.unmount();
  });

  it('deletes a profile after confirming in the modal', async () => {
    saveSiteProfile('old.example', DATA);
    const { container, root } = await renderDrawer();
    const deleteBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Delete');
    await act(async () => { deleteBtn?.click(); });
    expect(container.textContent).toContain('Delete saved site?');
    const confirmBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Delete' && b !== deleteBtn);
    await act(async () => { confirmBtn?.click(); });
    expect(window.localStorage.getItem('relay_site_v1_old.example')).toBeNull();
    expect(container.textContent).not.toContain('old.example');
    root.unmount();
  });

  it('renames a profile via the edit-domain modal', async () => {
    saveSiteProfile('old.example', DATA);
    const { container, root } = await renderDrawer();
    const editBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Edit domain');
    await act(async () => { editBtn?.click(); });
    expect(container.textContent).toContain('Edit domain');
    const input = Array.from(container.querySelectorAll('input')).find((el) => (el as HTMLInputElement).getAttribute('aria-label') === 'New domain');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setter?.call(input, 'renamed.example');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Save');
    await act(async () => { saveBtn?.click(); });
    expect(window.localStorage.getItem('relay_site_v1_renamed.example')).toBeTruthy();
    expect(window.localStorage.getItem('relay_site_v1_old.example')).toBeNull();
    root.unmount();
  });

  it('marks the active site', async () => {
    saveSiteProfile('active.example', DATA);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={{ ui: { ...initialState.ui, sourceDomain: 'active.example' } }}>
          <SitesDrawer open onClose={vi.fn()} />
        </AppStateProvider>,
      );
    });
    expect(container.textContent).toContain('Active');
    root.unmount();
  });
});
