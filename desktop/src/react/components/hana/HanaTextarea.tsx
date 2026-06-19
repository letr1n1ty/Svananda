import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

type HanaTextareaProps = ComponentProps<typeof Textarea>;

/**
 * HanaTextarea — Hana 風格的 shadcn Textarea 封裝
 */
export function HanaTextarea({ className, ...props }: HanaTextareaProps) {
  return (
    <Textarea
      className={cn(
        'transition-[border-color,box-shadow] duration-[var(--duration-fast,150ms)]',
        className,
      )}
      {...props}
    />
  );
}
