import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { marked } from 'marked';
import Button from '../../commons/components/Button.jsx';
import { ChevronDownIcon, ChevronRightIcon, SettingsIcon } from '../../commons/components/Icon.jsx';
import { ModalBackdrop, ModalContainer, ModalHeader, ModalContent } from '../../commons/components/Modal.jsx';
import SegmentedControl from '../../commons/components/SegmentedControl.jsx';
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

  function formatElapsed(s) {
    if (s < 60) {
      return `${s}s`;
    }
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  let chevron = <ChevronRightIcon />;
  if (isOpen === true) {
    chevron = <ChevronDownIcon />;
  }

  let summaryLabel = 'Thought process';
  if (isStreaming === true) {
    summaryLabel = 'Thinking…';
  }

  let elapsedDisplay = null;
  if (elapsed > 0) {
    elapsedDisplay = <span className="chat-thinking-elapsed">{formatElapsed(elapsed)}</span>;
  }

  let thinkingContent = null;
  if (isOpen === true) {
    thinkingContent = (
      <div
        className="chat-thinking-content chat-message-markdown"
        ref={contentRef}
        dangerouslySetInnerHTML={{ __html: marked.parse(content) }}
      />
    );
  }

  return (
    <div className="chat-thinking-block">
      <div className="chat-thinking-summary" onClick={() => setIsOpen(o => !o)}>
        {chevron}
        <span>{summaryLabel}</span>
        {elapsedDisplay}
      </div>
      {thinkingContent}
    </div>
  );
}

export default function ChatPage({ conversationId: conversationIdStr }) {
  const conversationId = conversationIdStr ? parseInt(conversationIdStr, 10) : null;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(conversationId);
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const messagesEndRef = useRef(null);

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

    let convId = activeConversationId;
    if (!convId) {
      const title = text.slice(0, 60);
      convId = await invoke('create_conversation', { title });
      setActiveConversationId(convId);
      navigateTo(`/chat/${convId}`);
      window.dispatchEvent(new CustomEvent('conversation-created'));
    }

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
      await invoke('chat', { conversationId: convId, think: isThinkingEnabled });
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

  function handleSettingsClick() {
    setIsSettingsOpen(true);
  }

  function handleSettingsClose() {
    setIsSettingsOpen(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function isLastMessage(i) {
    return i === messages.length - 1;
  }

  let emptyState = null;
  if (messages.length === 0) {
    emptyState = <div className="chat-empty">Start a conversation</div>;
  }

  const messageItems = messages.map((msg, i) => {
    let thinkingBlock = null;
    const hasThinking = msg.role === 'assistant' && msg.thinking !== undefined && msg.thinking !== '';
    if (hasThinking === true) {
      const isThinkingStreaming = isLoading === true && isLastMessage(i) === true && msg.content === '';
      thinkingBlock = <ThinkingBlock content={msg.thinking} isStreaming={isThinkingStreaming} />;
    }

    let messageBlock = null;
    if (msg.content !== '') {
      let messageContent = null;
      if (msg.role === 'assistant') {
        messageContent = (
          <div
            className="chat-message-content chat-message-markdown"
            dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }}
          />
        );
      } else {
        messageContent = <div className="chat-message-content">{msg.content}</div>;
      }

      let cursor = null;
      if (isLoading === true && isLastMessage(i) === true && msg.role === 'assistant') {
        cursor = <span className="chat-cursor" />;
      }

      messageBlock = (
        <div className={`chat-message chat-message-${msg.role}`}>
          {messageContent}
          {cursor}
        </div>
      );
    }

    return (
      <div key={i} className="chat-message-group">
        {thinkingBlock}
        {messageBlock}
      </div>
    );
  });

  const isSendDisabled = !input.trim() || isLoading;

  let settingsModal = null;
  if (isSettingsOpen === true) {
    settingsModal = (
      <ModalBackdrop onClose={handleSettingsClose}>
        <ModalContainer>
          <ModalHeader title="Chat Settings" onClose={handleSettingsClose} />
          <ModalContent>
            <div className="chat-settings-row">
              <span className="chat-settings-label">Thinking</span>
              <SegmentedControl
                options={[{ label: 'On', value: true }, { label: 'Off', value: false }]}
                value={isThinkingEnabled}
                onChange={setIsThinkingEnabled}
              />
            </div>
          </ModalContent>
        </ModalContainer>
      </ModalBackdrop>
    );
  }

  return (
    <div className="chat-page">
      {settingsModal}
      <div className="chat-messages">
        {emptyState}
        {messageItems}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <div className="chat-input-settings" onClick={handleSettingsClick}>
          <SettingsIcon />
        </div>
        <textarea
          className="chat-textarea"
          placeholder="Message (Enter to send, Shift+Enter for newline)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          autoFocus
        />
        <Button type="submit" variant="primary" isDisabled={isSendDisabled} isLoading={isLoading}>
          Send
        </Button>
      </form>
    </div>
  );
}
