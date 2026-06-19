/**
 * components/hana/index.ts — Hana Primitive Wrapper 入口
 *
 * 業務層一律從這裡 import，不直接依賴 @/components/ui/*。
 *
 * 例外：
 *   - components/hana/* 內部可以引用 @/components/ui/*
 *   - dev preview（ShadcnPrimitivePreview.tsx）可以直接引用 ui/*
 *
 * 未來要換底層 primitive 或調整預設值，只改 hana/* 即可，業務層不受影響。
 */

// Button 系列
export { HanaButton } from './HanaButton';
export { HanaIconButton } from './HanaIconButton';

// Form 系列
export { HanaInput } from './HanaInput';
export { HanaTextarea } from './HanaTextarea';
export { HanaSwitch } from './HanaSwitch';

// Layout / Display 系列
export {
  HanaCard,
  HanaCardContent,
  HanaCardDescription,
  HanaCardFooter,
  HanaCardHeader,
  HanaCardTitle,
} from './HanaCard';
export { HanaBadge } from './HanaBadge';

// Floating 系列
export {
  HanaTooltip,
  HanaTooltipRoot,
  HanaTooltipContent,
  HanaTooltipProvider,
  HanaTooltipTrigger,
} from './HanaTooltip';

// Dialog 系列
export {
  HanaDialog,
  HanaDialogClose,
  HanaDialogContent,
  HanaDialogDescription,
  HanaDialogFooter,
  HanaDialogHeader,
  HanaDialogTitle,
  HanaDialogTrigger,
  HanaDialogPortal,
  HanaDialogOverlay,
} from './HanaDialog';

// Toast 系列
export { HanaToaster } from './HanaToaster';
