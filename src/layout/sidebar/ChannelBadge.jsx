import React from 'react';

const CHANNELS = {
  telegram: { label: 'Telegram', color: '#229ED9', abbr: 'TG' },
  instagram: { label: 'Instagram', color: '#E4405F', abbr: 'IG' },
  whatsapp: { label: 'WhatsApp', color: '#25D366', abbr: 'WA' },
};

export default function ChannelBadge({ channel = 'telegram', size = 'sm' }) {
  const cfg = CHANNELS[channel] || CHANNELS.telegram;
  return (
    <span
      className={`mc-channel-badge mc-channel-badge--${size}`}
      style={{ '--channel-color': cfg.color }}
      title={cfg.label}
    >
      <span className="mc-channel-badge__dot" aria-hidden />
      <span className="mc-channel-badge__abbr">{cfg.abbr}</span>
    </span>
  );
}
