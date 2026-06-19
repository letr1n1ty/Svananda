import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

type HanaInputProps = ComponentProps<typeof Input>;

/**
 * HanaInput — Hana 風格的 shadcn Input 封裝
 */
export function HanaInput({ className, ...props }: HanaInputProps) {
  return (
    <Input
      className={cn(
        'transition-[border-color,box-shadow] duration-[var(--duration-fast,150ms)]',
        className,
      )}
      {...props}
    />
  );
}
