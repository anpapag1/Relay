import { useState } from 'react';

type TabId = 'import' | 'mappings' | 'settings' | 'articles' | 'build';

const TABS: { id: TabId; label: string }[] = [
  { id: 'import', label: 'Import' },
  { id: 'mappings', label: 'Mappings' },
  { id: 'settings', label: 'Settings' },
  { id: 'articles', label: 'Articles' },
  { id: 'build', label: 'Build & Export' },
];

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('import');

  return (
    <div className="app">
      <header className="app-header">
        <h1>Relay</h1>
        <nav className="tab-bar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={tab.id === activeTab ? 'tab-button tab-button-active' : 'tab-button'}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <p>{TABS.find((tab) => tab.id === activeTab)?.label} tab coming soon.</p>
      </main>
    </div>
  );
}
