import { useI18n } from '../../hooks/use-i18n';
import styles from './InputArea.module.css';

export function SendButton({ isStreaming, hasInput, disabled, isOptionHeld, onSend, onQueue, onSteer, onStop }: {
  isStreaming: boolean;
  hasInput: boolean;
  disabled: boolean;
  isOptionHeld: boolean;
  onSend: () => void;
  onQueue: () => void;
  onSteer: () => void;
  onStop: () => void;
}) {
  const { t } = useI18n();

  // 四態：send / queue / steer(option) / stop
  const mode = isStreaming
    ? hasInput
      ? isOptionHeld ? 'steer' : 'queue'
      : 'stop'
    : 'send';

  const handleClick = () => {
    if (mode === 'queue') onQueue();
    else if (mode === 'steer') onSteer();
    else if (mode === 'stop') onStop();
    else onSend();
  };

  const btnClass = [
    styles['send-btn'],
    mode === 'steer' ? styles['is-steer'] : '',
    mode === 'stop' ? styles['is-streaming'] : '',
    mode === 'queue' ? styles['is-queue'] : '',
  ].filter(Boolean).join(' ');

  const title = mode === 'queue' ? t('chat.queueTooltip') : undefined;

  return (
    <button
      className={btnClass}
      disabled={disabled}
      title={title}
      onClick={handleClick}
    >
      {mode === 'send' && (
        <span className={styles['send-label']}>
          <svg className={styles['send-enter-icon']} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 10 4 15 9 20" /><path d="M20 4v7a4 4 0 01-4 4H4" />
          </svg>
          <span>{t('chat.send')}</span>
        </span>
      )}
      {mode === 'queue' && (
        <span className={styles['send-label']}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{t('chat.queue')}</span>
        </span>
      )}
      {mode === 'steer' && (
        <span className={styles['send-label']}>
          <svg className={styles['send-enter-icon']} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>{t('chat.steer')}</span>
        </span>
      )}
      {mode === 'stop' && (
        <span className={styles['send-label']}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          <span>{t('chat.stop')}</span>
        </span>
      )}
    </button>
  );
}
