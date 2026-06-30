import { Dialog as DialogPrimitive } from 'radix-ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../stores';
import { closeSettingsModal, setSettingsModalActiveTab } from '../stores/settings-modal-actions';
import { SettingsContent } from '../settings/SettingsContent';
import { useSettingsStore } from '../settings/store';
import { useAnimatePresence } from '../hooks/use-animate-presence';
import styles from './SettingsModalShell.module.css';

declare function t(key: string, vars?: Record<string, string | number>): string;

const CLOSE_ANIMATION_MS = 150;  // 對齊 --duration-fast（0.15s）
type VisualState = 'opening' | 'open' | 'closing';

export function SettingsModalShellV2() {
  const settingsModal = useStore(s => s.settingsModal);
  const { mounted, stage } = useAnimatePresence(settingsModal.open, { duration: CLOSE_ANIMATION_MS });
  const [shown, setShown] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // rAF double-buffer：與 V1 保持一致的轉場幀邏輯
  useEffect(() => {
    if (!mounted) {
      setShown(false);
      return;
    }
    if (stage === 'exit') {
      setShown(false);
      return;
    }
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [mounted, stage]);

  const visualState: VisualState =
    stage === 'exit' ? 'closing' :
    shown ? 'open' : 'opening';
  const isWideSettingsPage = settingsModal.activeTab === 'plugin-marketplace';

  const requestClose = useCallback(() => {
    closeSettingsModal();
  }, []);

  const handleActiveTabChange = useCallback((tab: string) => {
    const current = useStore.getState().settingsModal;
    if (current?.activeTab === tab) return;
    setSettingsModalActiveTab(tab);
  }, []);

  // 同步 activeTab 到 settings store（僅在打開期間）
  useEffect(() => {
    if (!mounted) return;
    if (useSettingsStore.getState().activeTab === settingsModal.activeTab) return;
    useSettingsStore.setState({ activeTab: settingsModal.activeTab });
  }, [mounted, settingsModal.activeTab]);

  if (!mounted) return null;

  return (
    <DialogPrimitive.Root open={mounted} onOpenChange={(open) => { if (!open) requestClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={`${styles.overlay} ${styles[visualState]}`}
          data-state={visualState}
        />
        <div
          className={`${styles.overlay} ${styles[visualState]}`}
          style={{ background: 'none', backdropFilter: 'none', WebkitBackdropFilter: 'none', pointerEvents: 'none', zIndex: 1801 }}
        >
          <DialogPrimitive.Content
            ref={cardRef}
            className={`${styles.card} ${styles[visualState]}`}
            style={{ pointerEvents: 'auto' }}
            data-wide={isWideSettingsPage ? 'true' : undefined}
            data-state={visualState}
            aria-label={t('settings.title')}
            onOpenAutoFocus={(event) => {
              const target = cardRef.current?.querySelector<HTMLElement>('[data-settings-return]');
              if (target) {
                event.preventDefault();
                target.focus();
              }
            }}
            onPointerDownOutside={(event) => {
              // 設定面板內的模型下拉 (data-provider-model-dropdown) 與 SelectWidget popup
              // (data-select-widget-popup) 透過 createPortal(document.body) 渲染到 Dialog
              // Content 的 DOM 子樹之外，會被 Radix DismissableLayer 誤判為 outside
              // interaction 而關閉整個設定視窗。這裡辨認這些浮層並阻止關閉，讓使用者能正常
              // 點選下拉項目；浮層自身的 outside-click 關閉邏輯不受影響。
              const target = event.target;
              if (
                target instanceof Element
                && target.closest('[data-select-widget-popup],[data-provider-model-dropdown]')
              ) {
                event.preventDefault();
              }
            }}
          >
            <SettingsContent
              variant="modal"
              onClose={requestClose}
              onActiveTabChange={handleActiveTabChange}
            />
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
