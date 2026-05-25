import React from 'react';

/**
 * Mobile / desktop chrome around Telegram chat preview.
 */
export default function TelegramDeviceFrame({
  viewMode = 'mobile',
  children,
  botName = 'Bot',
}) {
  if (viewMode === 'desktop') {
    return (
      <div className="tg-device tg-device--desktop">
        <div className="tg-device__desktop-bar">
          <span className="tg-device__desktop-dots" aria-hidden>
            <i /><i /><i />
          </span>
          <span className="tg-device__desktop-title">Telegram — {botName}</span>
        </div>
        <div className="tg-device__desktop-body">{children}</div>
      </div>
    );
  }

  return (
    <div className="tg-device tg-device--mobile">
      <div className="tg-device__bezel">
        <div className="tg-device__status" aria-hidden>
          <span className="tg-device__time">9:41</span>
          <span className="tg-device__notch" />
          <span className="tg-device__signal">●●●</span>
        </div>
        <div className="tg-device__screen">{children}</div>
        <div className="tg-device__home" aria-hidden />
      </div>
    </div>
  );
}
