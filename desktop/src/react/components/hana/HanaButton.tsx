import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

type HanaButtonProps = ComponentProps<typeof Button>;

/**
 * HanaButton — Hana 風格的 shadcn Button 封裝
 *
 * 業務層一律透過這個元件使用 Button，不直接引用 @/components/ui/button。
 * 這樣未來若需要換底層 primitive 或調整預設值，只改這裡即可。
 *
 * 預設：variant="ghost", size="sm"
 */
export function HanaButton({
  className,
  variant = 'ghost',
  size = 'sm',
  ...props
}: HanaButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        'font-normal transition-[background-color,color,border-color,box-shadow,opacity]',
        'duration-[var(--duration-fast,150ms)]',
        className,
      )}
      {...props}
    />
  );
}
