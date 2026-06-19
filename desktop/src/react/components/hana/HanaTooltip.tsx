/**
 * HanaTooltip — Radix Tooltip 封裝
 *
 * 直接 re-export shadcn tooltip，加 HanaTooltipProvider 作為便利包裝。
 * 使用：
 *   <HanaTooltip content="說明文字">
 *     <button>...</button>
 *   </HanaTooltip>
 *
 * 或拆開控制（低階用法）：
 *   <HanaTooltipProvider>
 *     <Tooltip>
 *       <TooltipTrigger>...</TooltipTrigger>
 *       <TooltipContent>...</TooltipContent>
 *     </Tooltip>
 *   </HanaTooltipProvider>
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

// 補足 JSDOM 測試環境中缺乏 ResizeObserver 導致 Radix UI/Popper 渲染崩潰的問題
if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

// 低階 re-export（供有需要精細控制的元件使用）
export {
  Tooltip as HanaTooltipRoot,
  TooltipContent as HanaTooltipContent,
  TooltipProvider as HanaTooltipProvider,
  TooltipTrigger as HanaTooltipTrigger,
};

interface HanaTooltipProps {
  /** tooltip 的提示文字 */
  content: ReactNode;
  /** 被包裹的觸發元素 */
  children: ReactNode;
  /** 延遲出現時間（ms），預設 400 */
  delayDuration?: number;
  /** tooltip 位置 */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** 對齊方式 */
  align?: 'start' | 'center' | 'end';
  className?: string;
  /** 是否停用 tooltip（例如 disabled button） */
  disabled?: boolean;
}

/**
 * HanaTooltip — 高階便利元件
 * 不需要自己管 Provider 和 Trigger，直接包裹子元素即可。
 */
export function HanaTooltip({
  content,
  children,
  delayDuration = 400,
  side = 'top',
  align = 'center',
  className,
  disabled = false,
}: HanaTooltipProps) {
  if (disabled) {
    return <>{children}</>;
  }

  const isTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true');
  const resolvedDelay = isTest ? 0 : delayDuration;

  return (
    <TooltipProvider delayDuration={resolvedDelay}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} align={align} className={cn(className)}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
