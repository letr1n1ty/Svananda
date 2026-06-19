/**
 * HanaDialog — Radix Dialog 封裝（Re-export）
 *
 * 第一階段只提供 wrapper，不替換現有 SettingsModalShell。
 * 後續 PR 4 才建立 SettingsModalShellV2。
 *
 * 業務層使用：
 *   import { HanaDialog, HanaDialogContent, HanaDialogTitle } from '@/components/hana';
 */
export {
  Dialog as HanaDialog,
  DialogClose as HanaDialogClose,
  DialogContent as HanaDialogContent,
  DialogDescription as HanaDialogDescription,
  DialogFooter as HanaDialogFooter,
  DialogHeader as HanaDialogHeader,
  DialogTitle as HanaDialogTitle,
  DialogTrigger as HanaDialogTrigger,
  DialogPortal as HanaDialogPortal,
  DialogOverlay as HanaDialogOverlay,
} from '@/components/ui/dialog';
