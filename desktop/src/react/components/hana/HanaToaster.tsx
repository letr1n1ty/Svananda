import { useEffect, useRef } from 'react';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { toast as sonnerToast } from 'sonner';
import { useStore } from '../../stores';

export function HanaToaster() {
  const toasts = useStore((s) => s.toasts);
  const processedIds = useRef(new Set<number>());

  useEffect(() => {
    if (toasts.length === 0) return;

    toasts.forEach((t) => {
      if (processedIds.current.has(t.id)) return;
      processedIds.current.add(t.id);

      const options = {
        id: String(t.id),
        duration: t.persistent ? Infinity : 4000,
        action: t.action ? {
          label: t.action.label,
          onClick: t.action.onClick,
        } : undefined,
      };

      if (t.type === 'success') {
        sonnerToast.success(t.text, options);
      } else if (t.type === 'error') {
        sonnerToast.error(t.text, options);
      } else if (t.type === 'warning') {
        sonnerToast.warning(t.text, options);
      } else {
        sonnerToast.info(t.text, options);
      }

      // 觸發後立即從 Zustand store 移除，由 Sonner 獨立管理生命週期
      useStore.getState().removeToast(t.id);
    });

    // 定期做 garbage collection
    if (processedIds.current.size > 200) {
      processedIds.current.clear();
    }
  }, [toasts]);

  return <SonnerToaster position="bottom-right" />;
}
