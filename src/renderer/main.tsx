import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { DashboardView } from './views/DashboardView';
import { SettingsView } from './views/SettingsView';
import { WorkspaceView } from './views/WorkspaceView';
import { LoginView } from './views/LoginView';
import './css/style.css';

const App = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'settings' | 'workspace'>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // On mount, try to restore an existing session
  useEffect(() => {
    window.api.crm.getSession()
      .then((user: any) => {
        if (user) setCurrentUser(user);
      })
      .catch(() => {})
      .finally(() => setAuthChecking(false));
  }, []);

  const handleLogin = (user: any) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
  };

  const handleLogout = async () => {
    await window.api.crm.signOut();
    setCurrentUser(null);
    setCurrentView('dashboard');
    setSelectedProjectId(null);
  };

  if (authChecking) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="app-container" style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden' }}>
      {currentView === 'dashboard' && (
        <DashboardView
          currentUser={currentUser}
          onOpenProject={(id) => {
            setSelectedProjectId(id);
            setCurrentView('workspace');
          }}
          onOpenSettings={() => setCurrentView('settings')}
          onLogout={handleLogout}
        />
      )}
      {currentView === 'settings' && (
        <SettingsView
          currentUser={currentUser}
          onBack={() => setCurrentView('dashboard')}
        />
      )}
      {currentView === 'workspace' && selectedProjectId && (
        <WorkspaceView
          projectId={selectedProjectId}
          currentUser={currentUser}
          onBack={() => setCurrentView('dashboard')}
        />
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
