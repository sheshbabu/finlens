import { useState, useEffect } from 'react';
import Router from './commons/components/Router.jsx';
import Route from './commons/components/Route.jsx';
import Sidebar from './commons/components/Sidebar.jsx';
import ChatHistorySidebar from './features/chat/ChatHistorySidebar.jsx';
import HomePage from './features/home/HomePage.jsx';
import ChatPage from './features/chat/ChatPage.jsx';
import SettingsPage from './features/settings/SettingsPage.jsx';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    function handleNavigate() {
      setCurrentPath(window.location.pathname);
    }
    window.addEventListener('navigate', handleNavigate);
    window.addEventListener('popstate', handleNavigate);
    return () => {
      window.removeEventListener('navigate', handleNavigate);
      window.removeEventListener('popstate', handleNavigate);
    };
  }, []);

  const isChat = currentPath === '/chat' || currentPath.startsWith('/chat/');

  let chatHistorySidebar = null;
  if (isChat === true) {
    chatHistorySidebar = <ChatHistorySidebar />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      {chatHistorySidebar}
      <div className="main-content">
        <Router>
          <Route path="/" component={HomePage} />
          <Route path="/chat" component={ChatPage} />
          <Route path="/chat/:conversationId" component={ChatPage} />
          <Route path="/settings" component={SettingsPage} />
        </Router>
      </div>
    </div>
  );
}
