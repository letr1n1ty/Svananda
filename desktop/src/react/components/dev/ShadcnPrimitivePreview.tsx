/**
 * ShadcnPrimitivePreview — dev-only shadcn token bridge 驗證元件
 *
 * 用途：在開發環境快速確認 shadcn 元件是否正確吃到 Hana token。
 * 預設關閉，需手動啟用：
 *
 *   localStorage.setItem('hana.dev.shadcnPreview', '1');
 *   location.reload();
 *
 * 關閉：
 *   localStorage.removeItem('hana.dev.shadcnPreview');
 *   location.reload();
 *
 * PROD build 時此元件直接回傳 null，不會打包任何可見內容。
 */

import {
  HanaButton,
  HanaCard,
  HanaCardContent,
  HanaCardHeader,
  HanaCardTitle,
  HanaInput,
  HanaBadge,
  HanaTooltip,
  HanaIconButton,
} from '@/components/hana';

function PenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

export function ShadcnPrimitivePreview() {
  // PROD 環境完全不渲染
  if (import.meta.env.PROD) return null;

  const enabled =
    typeof window !== 'undefined' &&
    window.localStorage.getItem('hana.dev.shadcnPreview') === '1';
  if (!enabled) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-80 shadow-xl">
      <HanaCard>
        <HanaCardHeader className="pb-2">
          <HanaCardTitle className="text-sm flex items-center gap-2">
            <HanaBadge>DEV</HanaBadge>
            shadcn Primitive Preview
          </HanaCardTitle>
        </HanaCardHeader>
        <HanaCardContent className="space-y-3">
          {/* Input */}
          <HanaInput placeholder="HanaInput — token bridge test" />

          {/* Button variants */}
          <div className="flex flex-wrap gap-2">
            <HanaButton>Ghost（預設）</HanaButton>
            <HanaButton variant="outline" size="sm">Outline</HanaButton>
            <HanaButton variant="default" size="sm">Default</HanaButton>
            <HanaButton variant="destructive" size="sm">Destructive</HanaButton>
          </div>

          {/* Icon button */}
          <div className="flex items-center gap-2">
            <HanaTooltip content="HanaIconButton">
              <HanaIconButton title="編輯">
                <PenIcon />
              </HanaIconButton>
            </HanaTooltip>
            <HanaTooltip content="Active 狀態" side="right">
              <HanaIconButton title="Active 示範" active>
                <PenIcon />
              </HanaIconButton>
            </HanaTooltip>
            <span className="text-xs text-muted-foreground">← hover 看 tooltip</span>
          </div>

          {/* Badge */}
          <div className="flex gap-2">
            <HanaBadge variant="secondary">secondary</HanaBadge>
            <HanaBadge variant="outline">outline</HanaBadge>
            <HanaBadge variant="default">default</HanaBadge>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            若以上元件外觀符合目前 Hana theme（顏色、圓角、字體），
            代表 token bridge 設定正確。
          </p>
        </HanaCardContent>
      </HanaCard>
    </div>
  );
}
