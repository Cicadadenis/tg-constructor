import React from 'react';

const QUICK_EVENTS = [
  { id: 'start', label: '/start', event: { kind: 'start', text: '/start' } },
  { id: 'help', label: '/help', event: { kind: 'command', command: '/help', text: '/help' } },
  { id: 'voice', label: '🎤', event: { kind: 'voice' } },
  { id: 'sticker', label: '🎭', event: { kind: 'sticker', stickerId: 'preview_sticker', stickerEmoji: '🙂' } },
  { id: 'contact', label: '👤', event: { kind: 'contact', phone: '+10000000000' } },
  { id: 'location', label: '📍', event: { kind: 'location', latitude: 55.75, longitude: 37.62 } },
];

export default function EventInjector({ busy, onInject, customEvents = [] }) {
  const all = [...QUICK_EVENTS, ...customEvents];

  return (
    <div className="chat-sim__injector">
      <span className="chat-sim__injector-label">События</span>
      <div className="chat-sim__injector-row">
        {all.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chat-sim__injector-btn"
            disabled={busy}
            title={item.title || item.label}
            onClick={() => onInject?.(item.event, item.label)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
