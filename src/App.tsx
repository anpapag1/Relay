import { AppStateProvider, useAppState } from './state/AppStateContext';
import { Header } from './ui/Header';
import { ImportTab } from './features/import';
import { MappingsTab } from './features/mappings';
import { SettingsTab } from './features/settings';
import { ArticlesTab } from './features/articles';
import { BuildTab } from './features/build';
import './theme';

function AppContent() {
  const { state } = useAppState();
  const { activeTab } = state.ui;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'oklch(98% 0.003 250)', color: 'oklch(20% 0.01 250)' }}>
      <Header />
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
