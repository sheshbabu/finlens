import { useState } from 'react';
import FoldersPane from './FoldersPane.jsx';
import './SettingsPage.css';

const TABS = [
  { id: 'folders', label: 'Folders', component: FoldersPane },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('folders');

  const navItems = TABS.map(function (tab) {
    const className = activeTab === tab.id ? 'settings-nav-item is-active' : 'settings-nav-item';
    return (
      <button key={tab.id} className={className} onClick={() => setActiveTab(tab.id)}>
        {tab.label}
      </button>
    );
  });

  const activeTabDef = TABS.find(function (tab) {
    return tab.id === activeTab;
  });
  const ActiveComponent = activeTabDef.component;

  return (
    <div className="settings-page">
      <nav className="settings-nav">{navItems}</nav>
      <div className="settings-content">
        <ActiveComponent />
      </div>
    </div>
  );
}
