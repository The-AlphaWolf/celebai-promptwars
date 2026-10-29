import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, Bot, Check, X } from 'lucide-react';
import FormattedText from './FormattedText';
import { LIMITS } from '../domain/constants';
import './ChatPanel.css';

/** Suggestions the offline engine can act on, so every chip does something in demo mode too. */
const SUGGESTIONS = {
  wedding: ['Reduce catering by 15%', 'We now have 160 guests', 'What are my biggest risks?', 'More ideas'],
  birthday: ['Set budget to 8000', 'Trim the DJ budget by 10%', 'What should I do next?', 'More ideas'],
  community: ['We now have 500 people', 'Reduce stage costs by 10%', 'What are my biggest risks?', 'More ideas'],
};

export default function ChatPanel({ plan, messages, onSendMessage, onApplyPlan, onClose, isBusy, aiStatus }) {
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep the newest message in view whenever the conversation changes.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [messages, isBusy]);

  const send = (text) => {
    const message = text.trim();
    if (!message || isBusy) return;
    onSendMessage(message);
    setInput('');
  };

  return (
    <aside className="chat-dock glass-panel" aria-labelledby="chat-title">
      <div className="chat-header">
        <div className="chat-title-group">
          <div className="chat-bot-avatar" aria-hidden="true">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 id="chat-title" className="chat-title">Planning assistant</h2>
            <span className={`chat-status-text ${aiStatus === 'live' ? 'online' : 'demo'}`}>
              {isBusy ? 'Working…' : aiStatus === 'live' ? 'Gemini with engine checks' : 'Offline engine (deterministic)'}
            </span>
          </div>
        </div>
        <button type="button" className="btn-chat-close" onClick={onClose} aria-label="Close assistant">
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="chat-messages-container" role="log" aria-live="polite" aria-busy={isBusy}>
        {messages.map((message, index) => (
          <div key={index} className={`chat-bubble-row ${message.role}`}>
            <div className="bubble-avatar" aria-hidden="true">
              {message.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className="bubble-content">
              <span className="visually-hidden">{message.role === 'user' ? 'You said:' : 'Assistant:'}</span>
              <div className="bubble-text">
                <FormattedText text={message.text} />
              </div>
              {message.role === 'model' && message.source && (
                <div className="bubble-source-tag">{message.source === 'gemini' ? 'Gemini · validated by engine' : 'Planning engine'}</div>
              )}
              {message.notice && <div className="bubble-source-tag">{message.notice}</div>}
              {message.plan && (
                <div className="bubble-plan-card">
                  <div className="plan-card-header">
                    <Check size={14} className="text-emerald" aria-hidden="true" />
                    <span>{message.applied ? 'Applied to your plan' : 'Proposed plan update'}</span>
                  </div>
                  {!message.applied && (
                    <button type="button" className="btn-apply-plan" onClick={() => onApplyPlan(index)}>
                      Apply to plan
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isBusy && (
          <div className="chat-bubble-row model">
            <div className="bubble-avatar" aria-hidden="true"><Bot size={14} /></div>
            <div className="bubble-content"><div className="bubble-text">Thinking…</div></div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <fieldset className="prompt-chips-tray" aria-label="Suggested requests">
        {(SUGGESTIONS[plan.eventType] || SUGGESTIONS.wedding).map((suggestion) => (
          <button key={suggestion} type="button" className="prompt-chip" onClick={() => send(suggestion)} disabled={isBusy}>
            {suggestion}
          </button>
        ))}
      </fieldset>

      <form
        className="chat-input-bar"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="chat-input" className="visually-hidden">Message the planning assistant</label>
        <input
          id="chat-input"
          ref={inputRef}
          type="text"
          placeholder="e.g. Reduce catering by 10%"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={LIMITS.chatMessage}
          disabled={isBusy}
        />
        <button type="submit" className="btn-send-chat" disabled={!input.trim() || isBusy} aria-label="Send message">
          <Send size={15} aria-hidden="true" />
        </button>
      </form>
    </aside>
  );
}
