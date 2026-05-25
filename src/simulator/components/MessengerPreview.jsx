import React, { useEffect, useRef } from 'react';
import { PreviewRichText, safePreviewHref } from '../previewRichText.jsx';
import { previewKeyboardButtonKey } from '../previewMessages.js';
import { normalizeCallbackData } from '../../../core/codegen/callbackDataNormalize.js';

function TypingBubble() {
  return (
    <div className="chat-sim__bubble chat-sim__bubble--bot chat-sim__bubble--typing">
      <span className="chat-sim__typing-dot" />
      <span className="chat-sim__typing-dot" />
      <span className="chat-sim__typing-dot" />
    </div>
  );
}

function MessageBubble({ message, busy, onReplyText, onCallback }) {
  const m = message;
  if (m.kind === 'typing_marker' || m.kind === 'delay_marker') return null;

  const isUser = m.role === 'user';

  const animClass = m._animate ? ' chat-sim__bubble--enter' : '';

  return (
    <div className={`chat-sim__bubble ${isUser ? 'chat-sim__bubble--user' : 'chat-sim__bubble--bot'}${animClass}`}>
      {m.role === 'bot' && m.kind === 'sys' && (
        <span className="chat-sim__sys">{m.text}</span>
      )}
      {m.role === 'bot' && (m.kind === 'text' || m.kind === 'reply_keyboard' || m.kind === 'inline_keyboard') && (
        <>
          {(m.text || '').trim().length > 0 && (
            <div className="chat-sim__text">
              <PreviewRichText text={m.text} format={m.format} />
            </div>
          )}
          {m.kind === 'reply_keyboard' && Array.isArray(m.keyboard) && (
            <div className="chat-sim__reply-kb">
              {m.keyboard.flatMap((row, ri) => (Array.isArray(row) ? row : []).map((lbl, ci) => (
                <button
                  key={previewKeyboardButtonKey('reply', ri, ci, lbl)}
                  type="button"
                  className="chat-sim__kb-btn chat-sim__kb-btn--reply"
                  disabled={busy}
                  onClick={() => onReplyText(lbl)}
                >
                  {lbl}
                </button>
              )))}
            </div>
          )}
          {m.kind === 'inline_keyboard' && Array.isArray(m.rows) && (
            <div className="chat-sim__inline-kb">
              {m.rows.map((row, ri) => (
                <div key={`inline-row-${ri}`} className="chat-sim__inline-row">
                  {(row || []).map((btn, bi) => {
                    const label = btn?.text ?? '';
                    const cd = normalizeCallbackData(btn?.callback_data != null ? btn.callback_data : label);
                    const url = btn?.url;
                    if (url) {
                      const safeUrl = safePreviewHref(url);
                      if (!safeUrl) return null;
                      return (
                        <a
                          key={previewKeyboardButtonKey('inline-url', ri, bi, btn)}
                          href={safeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="chat-sim__kb-btn chat-sim__kb-btn--url"
                        >
                          {label}
                        </a>
                      );
                    }
                    return (
                      <button
                        key={previewKeyboardButtonKey('inline', ri, bi, btn)}
                        type="button"
                        className="chat-sim__kb-btn chat-sim__kb-btn--inline"
                        disabled={busy || !cd}
                        onClick={() => onCallback(cd)}
                      >
                        {label || cd}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {m.role === 'user' && m.kind === 'text' && <span className="chat-sim__text">{m.text}</span>}
      {m.role === 'user' && (m.kind === 'document' || m.kind === 'photo') && (
        <span className="chat-sim__text">
          {m.kind === 'photo' ? '🖼 ' : '📎 '}{m.fileName || 'файл'}
        </span>
      )}
    </div>
  );
}

export default function MessengerPreview({
  messages = [],
  typing = false,
  busy = false,
  botName = 'Test Bot',
  botHandle = '@preview_bot',
  activeNodeId = null,
  activeNodeLabel = null,
  viewMode = 'mobile',
  onSendText,
  onSendCallback,
  draft = '',
  onDraftChange,
  onSubmitDraft,
  fileInputRef,
  onFilePick,
  toolbar,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing, busy]);

  const shellClass = [
    'chat-sim__device',
    viewMode === 'desktop' ? 'chat-sim__device--desktop' : 'chat-sim__device--mobile',
  ].join(' ');

  return (
    <div className={shellClass}>
      <header className="chat-sim__header">
        <div className="chat-sim__avatar" aria-hidden />
        <div className="chat-sim__header-meta">
          <div className="chat-sim__header-title">{botName}</div>
          <div className="chat-sim__header-sub">{botHandle}</div>
        </div>
        <span className="chat-sim__header-online">
          {busy ? 'typing…' : 'online'}
        </span>
      </header>
      {activeNodeId && (
        <div className="chat-sim__active-chip" title={activeNodeId}>
          <span className="chat-sim__active-chip-dot" />
          {activeNodeLabel || activeNodeId}
        </div>
      )}

      <div ref={scrollRef} className="chat-sim__messages">
        {messages.length === 0 && (
          <p className="chat-sim__empty">
            Отправьте <strong>/start</strong>, текст или нажмите кнопку — сценарий выполняется в изолированной песочнице.
          </p>
        )}
        {messages.map((m, i) => (
          <MessageBubble
            key={m.id ?? `msg-${i}-${m.ts ?? i}`}
            message={{ ...m, _animate: i === messages.length - 1 }}
            busy={busy}
            onReplyText={onSendText}
            onCallback={onSendCallback}
          />
        ))}
        {typing && <TypingBubble />}
      </div>

      {toolbar}

      <footer className="chat-sim__composer">
        <input
          ref={fileInputRef}
          type="file"
          className="chat-sim__file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFilePick?.(f);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className="chat-sim__composer-icon"
          disabled={busy}
          title="Файл"
          onClick={() => fileInputRef?.current?.click()}
        >
          📎
        </button>
        <input
          className="chat-sim__composer-input"
          value={draft}
          onChange={(e) => onDraftChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmitDraft?.();
            }
          }}
          placeholder="Сообщение"
          disabled={busy}
        />
        <button
          type="button"
          className="chat-sim__composer-send"
          disabled={busy || !String(draft || '').trim()}
          onClick={() => onSubmitDraft?.()}
        >
          ➤
        </button>
      </footer>
    </div>
  );
}
