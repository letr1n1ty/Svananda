import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

type HanaSwitchProps = Omit<ComponentProps<typeof Switch>, 'checked' | 'onCheckedChange' | 'onChange'> & {
  /** 開啟狀態（undefined 或 'mixed' = loading）*/
  on: boolean | 'mixed' | undefined;
  onChange: (on: boolean) => void | Promise<void>;
};

/**
 * HanaSwitch — Hana 風格的 shadcn Switch 封裝
 *
 * 對應現有的 `Toggle` 元件（`<button role="switch">`），
 * 提供相同的 API（on / onChange），讓 Settings section 遷移時
 * 直接替換而不需要修改 parent state 邏輯。
 *
 * loading 狀態（on === undefined 或 'mixed'）：Switch disabled，aria-busy。
 *
 * 使用：
 *   <HanaSwitch on={autoCheck} onChange={handleAutoCheckToggle} />
 */
export function HanaSwitch({ on, onChange, className, disabled, ...props }: HanaSwitchProps) {
  const loading = on === undefined || on === 'mixed';
  const isDisabled = disabled || loading;

  // 用 wrapper function 隔離 Radix onCheckedChange 的複合型別，
  // 讓 async handler（回傳 Promise<void>）可以直接傳入不會有型別問題。
  const handleCheckedChange = (checked: boolean) => {
    onChange(checked);
  };

  if (loading) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked="mixed"
        disabled
        className={cn(
          "peer group/switch inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none disabled:cursor-not-allowed bg-input opacity-50",
          className
        )}
        {...props}
      >
        <span
          className="pointer-events-none block size-4 rounded-full bg-background ring-0 transition-transform translate-x-0"
        />
      </button>
    );
  }

  return (
    <Switch
      checked={on === true}
      onCheckedChange={handleCheckedChange}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-loading={loading ? 'true' : undefined}
      className={cn(
        'transition-[background-color] duration-[var(--duration-fast,150ms)]',
        className,
      )}
      {...props}
    />
  );
}
