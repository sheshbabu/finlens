import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { navigateTo } from '../../commons/components/Link.jsx';
import Button from '../../commons/components/Button.jsx';
import IconButton from '../../commons/components/IconButton.jsx';
import { TrashIcon } from '../../commons/components/Icon.jsx';
import './ChatHistorySidebar.css';

export default function ChatHistorySidebar() {
  const [conversations, setConversations] = useState([]);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    loadConversations();

    function handleRefresh() {
      loadConversations();
    }
    window.addEventListener('conversation-created', handleRefresh);
    window.addEventListener('conversation-updated', handleRefresh);
    return () => {
      window.removeEventListener('conversation-created', handleRefresh);
      window.removeEventListener('conversation-updated', handleRefresh);
    };
  }, []);

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

  async function loadConversations() {
    try {
      const list = await invoke('get_conversations');
      setConversations(list);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }

  async function handleNew() {
    navigateTo('/chat');
  }

  async function handleDelete(e, conversationId) {
    e.stopPropagation();
    e.preventDefault();
    try {
      await invoke('delete_conversation', { conversationId });
      const activeId = getActiveId();
      if (activeId === conversationId) {
        navigateTo('/chat');
      }
      loadConversations();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  }

  function getActiveId() {
    const match = currentPath.match(/^\/chat\/(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }

  const activeId = getActiveId();

  return (
    <div className="chat-history-sidebar">
      <div className="chat-history-header">
        <Button className="chat-history-new-btn" onClick={handleNew}>
          + New chat
        </Button>
      </div>
      <div className="chat-history-list">
        {conversations.length === 0 && (
          <div className="chat-history-empty">No conversations yet</div>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.conversation_id}
            className={`chat-history-item${activeId === conv.conversation_id ? ' is-active' : ''}`}
            onClick={() => navigateTo(`/chat/${conv.conversation_id}`)}
          >
            <span className="chat-history-title">{conv.title}</span>
            <IconButton
              className="chat-history-delete"
              onClick={(e) => handleDelete(e, conv.conversation_id)}
              title="Delete"
            >
              <TrashIcon />
            </IconButton>
          </div>
        ))}
      </div>
    </div>
  );
}
