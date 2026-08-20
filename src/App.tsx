import { AppStateProvider, useAppState } from './state/AppStateContext';
import { Header } from './ui/Header';
import { OnboardingTour } from './features/onboarding/OnboardingTour';
import { ImportTab } from './features/import';
import { MappingsTab } from './features/mappings';
import { SettingsTab } from './features/settings';
import { ArticlesTab } from './features/articles';
import { BuildTab } from './features/build';
import { useImageHealthCheck } from './features/import/useImageHealthCheck';
import { useUnsavedChangesWarning } from './state/useUnsavedChangesWarning';
import './theme';

function AppContent() {
  const { state } = useAppState();
  const { activeTab } = state.ui;

  // Lives here, not inside ImportTab, so it survives navigating away from
  // the Import tab — ImportTab (and anything inside it) unmounts the moment
  // the user switches tabs, which previously cancelled the in-flight health
  // check (or meant it never ran at all on a page reload that restores
  // straight into a different tab).
  useImageHealthCheck();

  // Same reasoning: lives on AppContent so the `beforeunload` guard stays
  // armed no matter which tab is active — session-only article work (manual
  // excludes/includes, review flags, saved edits) and an unsaved drawer
  // draft are both lost on reload.
  useUnsavedChangesWarning();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--relay-bg)', color: 'var(--relay-text)' }}>
      <Header />
      <OnboardingTour />
      <main style={{ flex: 1, padding: '32px 24px' }}>
        {activeTab === 'import' && <ImportTab />}
        {activeTab === 'mappings' && <MappingsTab />}
        {activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'articles' && <ArticlesTab />}
        {activeTab === 'build' && <BuildTab />}
      </main>
    </div>
  );
}

export function App() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
}
