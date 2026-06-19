import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

type HanaBadgeProps = ComponentProps<typeof Badge>;

/**
 * HanaBadge — Hana 風格的 shadcn Badge 封裝
 */
export function HanaBadge({ className, variant = 'secondary', ...props }: HanaBadgeProps) {
  return (
    <Badge
      variant={variant}
      className={cn('font-normal', className)}
      {...props}
    />
  );
}
