import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { HanaButton } from './HanaButton';

interface HanaIconButtonProps {
  /** aria-label 與 title（必填，無障礙需求） */
  title: string;
  /** active 狀態（會加 bg-accent/15 背景） */
  active?: boolean;
  /** 是否 disabled */
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/**
 * HanaIconButton — 給 Sidebar / Titlebar 用的 icon button
 *
 * 統一規格：7 × 7（28px），rounded-md，ghost variant。
 * 不動現有 Titlebar 和 Sidebar，只在遷移 PR 裡逐步替換手寫 button。
 */
export function HanaIconButton({
  title,
  active,
  disabled,
  children,
  className,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: HanaIconButtonProps) {
  return (
    <HanaButton
      type="button"
      variant="ghost"
      size="icon"
      title={title}
      aria-label={title}
      disabled={disabled}
      data-active={active ? 'true' : 'false'}
      // 防止點擊 button 讓 editor/input 失焦
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'h-7 w-7 rounded-[var(--radius-md,6px)]',
        'data-[active=true]:bg-accent/15',
        className,
      )}
    >
      {children}
    </HanaButton>
  );
}
