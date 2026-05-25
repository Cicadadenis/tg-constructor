import React, { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { SUBSCRIBER_PRESETS, presetLabel } from '../subscriberSandbox.js';

const QUICK_INJECT = [
  { id: 'start', label: '/start', event: { kind: 'start', text: '/start' } },
  { id: 'help', label: '/help', event: { kind: 'command', command: '/help', text: '/help' } },
  { id: 'photo', label: '🖼', event: { kind: 'photo', fileId: 'photo_preview' } },
  { id: 'contact', label: '👤', event: { kind: 'contact', phone: '+79001234567' } },
];

/**
 * ManyChat-style simulator toolbar — subscriber, inject, restart, replay, view mode.
 */
export default function SimulatorStudioBar({
  lang = 'ru',
  busy = false,
  liveMode = true,
  testMode = true,
  viewMode = 'mobile',
  onViewModeChange,
  onRestart,
  onInject,
  onToggleLiveMode,
  onToggleTestMode,
  subscriberPresets = SUBSCRIBER_PRESETS,
  activePresetId = 'new_user',
  onSwitchSubscriber,
  onOpenDrawerTab,
}) {
  const [injectOpen, setInjectOpen] = useState(false);

  const t = lang === 'en'
    ? {
      subscriber: 'Test user', restart: 'Restart flow', inject: 'Inject event',
      replay: 'Replay', live: 'Live', delays: 'Delays', vars: 'Variables',
      mobile: 'Phone', desktop: 'Wide',
    }
    : lang === 'uk'
      ? {
        subscriber: 'Тестовий', restart: 'Перезапуск', inject: 'Подія',
        replay: 'Повтор', live: 'Live', delays: 'Паузи', vars: 'Змінні',
        mobile: 'Телефон', desktop: 'Широкий',
      }
      : {
        subscriber: 'Тестовый', restart: 'Перезапуск', inject: 'Событие',
        replay: 'Повтор', live: 'Live', delays: 'Паузы', vars: 'Переменные',
        mobile: 'Телефон', desktop: 'Широкий',
      };

  return (
    <div className="tg-sim-bar" role="toolbar">
      <div className="tg-sim-bar__group">
        <span className="tg-sim-bar__label">{t.subscriber}</span>
        <select
          className="tg-sim-bar__select"
          value={activePresetId}
          disabled={busy}
          onChange={(e) => onSwitchSubscriber?.(e.target.value)}
          aria-label={t.subscriber}
        >
          {subscriberPresets.map((p) => (
            <option key={p.id} value={p.id}>{presetLabel(p, lang)}</option>
          ))}
        </select>
      </div>

      <div className="tg-sim-bar__group tg-sim-bar__view">
        <button
          type="button"
          className={`tg-sim-bar__chip${viewMode === 'mobile' ? ' tg-sim-bar__chip--on' : ''}`}
          onClick={() => onViewModeChange?.('mobile')}
          title={t.mobile}
        >
          📱
        </button>
        <button
          type="button"
          className={`tg-sim-bar__chip${viewMode === 'desktop' ? ' tg-sim-bar__chip--on' : ''}`}
          onClick={() => onViewModeChange?.('desktop')}
          title={t.desktop}
        >
          🖥
        </button>
      </div>

      <div className="tg-sim-bar__spacer" />

      <DropdownMenu.Root open={injectOpen} onOpenChange={setInjectOpen}>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="tg-sim-bar__btn" disabled={busy}>
            ⚡ {t.inject}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="tg-sim-bar__menu" sideOffset={6}>
            {QUICK_INJECT.map((item) => (
              <DropdownMenu.Item
                key={item.id}
                className="tg-sim-bar__menu-item"
                onSelect={() => {
                  setInjectOpen(false);
                  onInject?.(item.event, item.label);
                }}
              >
                {item.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <button
        type="button"
        className={`tg-sim-bar__btn tg-sim-bar__btn--ghost${!liveMode ? ' tg-sim-bar__btn--on' : ''}`}
        disabled={busy}
        onClick={() => onToggleLiveMode?.(!liveMode)}
        title={t.replay}
      >
        ⏮ {t.replay}
      </button>

      <button
        type="button"
        className={`tg-sim-bar__btn tg-sim-bar__btn--ghost${testMode ? ' tg-sim-bar__btn--on' : ''}`}
        disabled={busy}
        onClick={() => onToggleTestMode?.(!testMode)}
        title={t.delays}
      >
        … {t.delays}
      </button>

      <button
        type="button"
        className="tg-sim-bar__btn tg-sim-bar__btn--ghost"
        onClick={() => onOpenDrawerTab?.('vars')}
      >
        {`{ }`} {t.vars}
      </button>

      <button
        type="button"
        className="tg-sim-bar__btn tg-sim-bar__btn--primary"
        disabled={busy}
        onClick={onRestart}
        title={t.restart}
      >
        ↻
      </button>
    </div>
  );
}
