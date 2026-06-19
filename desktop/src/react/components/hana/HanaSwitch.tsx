import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

type HanaSwitchProps = Omit<ComponentProps<typeof Switch>, 'checked' | 'onCheckedChange' | 'onChange'> & {
  /** 開啟狀態（undefined = loading）*/
  on: boolean | undefined;
  onChange: (on: boolean) => void | Promise<void>;
};

/**
 * HanaSwitch — Hana 風格的 shadcn Switch 封裝
 *
 * 對應現有的 `Toggle` 元件（`<button role="switch">`），
 * 提供相同的 API（on / onChange），讓 Settings section 遷移時
 * 直接替換而不需要修改 parent state 邏輯。
 *
 * loading 狀態（on === undefined）：Switch disabled，aria-busy。
 *
 * 使用：
 *   <HanaSwitch on={autoCheck} onChange={handleAutoCheckToggle} />
 */
export function HanaSwitch({ on, onChange, className, disabled, ...props }: HanaSwitchProps) {
  const loading = on === undefined;
  const isDisabled = disabled || loading;

  // 用 wrapper function 隔離 Radix onCheckedChange 的複合型別，
  // 讓 async handler（回傳 Promise<void>）可以直接傳入不會有型別問題。
  const handleCheckedChange = (checked: boolean) => {
    onChange(checked);
  };

  return (
    <Switch
      checked={on === true}
      onCheckedChange={handleCheckedChange}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-loading={loading ? 'true' : undefined}
      className={cn(
        'transition-[background-color] duration-[var(--duration-fast,150ms)]',
        // loading 時半透明
        loading && 'opacity-50',
        className,
      )}
      {...props}
    />
  );
}
