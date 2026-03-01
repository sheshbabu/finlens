import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { marked } from 'marked';
import Button from '../../commons/components/Button.jsx';
import { ChevronDownIcon, ChevronRightIcon } from '../../commons/components/Icon.jsx';
import { navigateTo } from '../../commons/components/Link.jsx';
import './ChatPage.css';

function ThinkingBlock({ content, isStreaming }) {
  const [isOpen, setIsOpen] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!isStreaming) return;
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  const formatElapsed = (s) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <div className="chat-thinking-block">
      <div className="chat-thinking-summary" onClick={() => setIsOpen(o => !o)}>
        {isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
        <span>{isStreaming ? 'Thinking…' : 'Thought process'}</span>
        {elapsed > 0 && <span className="chat-thinking-elapsed">{formatElapsed(elapsed)}</span>}
      </div>
      {isOpen && (
        <div
          className="chat-thinking-content chat-message-markdown"
          ref={contentRef}
          dangerouslySetInnerHTML={{ __html: marked.parse(content) }}
        />
      )}
    </div>
  );
}

export default function ChatPage({ conversationId: conversationIdStr }) {
  const conversationId = conversationIdStr ? parseInt(conversationIdStr, 10) : null;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(conversationId);
  const messagesEndRef = useRef(null);

  // Load messages when navigating to an existing conversation
  useEffect(() => {
    setActiveConversationId(conversationId);
    if (conversationId) {
      if (!isLoading) {
        loadMessages(conversationId);
      }
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages(id) {
    try {
      const rows = await invoke('get_messages', { conversationId: id });
      setMessages(rows.map(r => ({ role: r.role, content: r.content, thinking: '' })));
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setIsLoading(true);

    // Create conversation on first message
    let convId = activeConversationId;
    if (!convId) {
      const title = text.slice(0, 60);
      convId = await invoke('create_conversation', { title });
      setActiveConversationId(convId);
      navigateTo(`/chat/${convId}`);
      // Trigger sidebar refresh
      window.dispatchEvent(new CustomEvent('conversation-created'));
    }

    // Save user message to DB
    await invoke('save_message', { conversationId: convId, role: 'user', content: text });

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setMessages(prev => [...prev, { role: 'assistant', content: '', thinking: '' }]);

    const unlistenThinking = await listen('chat-thinking', (event) => {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        updated[updated.length - 1] = { ...last, thinking: (last.thinking || '') + event.payload };
        return updated;
      });
    });

    const unlistenChunk = await listen('chat-chunk', (event) => {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        updated[updated.length - 1] = { ...last, content: last.content + event.payload };
        return updated;
      });
    });

    const unlistenDone = await listen('chat-done', () => {
      setIsLoading(false);
      unlistenThinking();
      unlistenChunk();
      unlistenDone();
      // Trigger sidebar refresh to update updated_at ordering
      window.dispatchEvent(new CustomEvent('conversation-updated'));
    });

    try {
      await invoke('chat', { conversationId: convId });
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `Error: ${err}`, thinking: '' };
        return updated;
      });
      setIsLoading(false);
      unlistenThinking();
      unlistenChunk();
      unlistenDone();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const isLastMessage = (i) => i === messages.length - 1;

  return (
    <div className="chat-page">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">Start a conversation</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="chat-message-group">
            {msg.role === 'assistant' && msg.thinking !== undefined && msg.thinking !== '' && (
              <ThinkingBlock
                content={msg.thinking}
                isStreaming={isLoading && isLastMessage(i) && msg.content === ''}
              />
            )}
            {msg.content !== '' && (
              <div className={`chat-message chat-message-${msg.role}`}>
                {msg.role === 'assistant' ? (
                  <div
                    className="chat-message-content chat-message-markdown"
                    dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }}
                  />
                ) : (
                  <div className="chat-message-content">
                    {msg.content}
                  </div>
                )}
                {isLoading && isLastMessage(i) && msg.role === 'assistant' && (
                  <span className="chat-cursor" />
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <textarea
          className="chat-textarea"
          placeholder="Message (Enter to send, Shift+Enter for newline)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          autoFocus
        />
        <Button type="submit" variant="primary" isDisabled={!input.trim() || isLoading} isLoading={isLoading}>
          Send
        </Button>
      </form>
    </div>
  );
}
