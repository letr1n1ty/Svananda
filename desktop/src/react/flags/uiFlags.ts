/**
 * uiFlags.ts — UI 遷移 Feature Flag 工具
 *
 * 統一透過 localStorage 控制各區域遷移開關，避免引入新的 config 系統。
 *
 * 開啟：localStorage.setItem('hana.ui.<key>', '1'); location.reload();
 * 關閉：localStorage.removeItem('hana.ui.<key>'); location.reload();
 *
 * Flag 命名規則：
 *   hana.dev.shadcnPreview       — dev primitive preview overlay
 *   hana.ui.settings.basic       — Settings 基本 section 遷移
 *   hana.ui.settings.dialog      — SettingsModalShellV2（Radix Dialog）
 *   hana.ui.toast                — HanaToaster（Sonner）
 *   hana.ui.tooltip              — Radix Tooltip
 *   hana.ui.dropdown             — Radix DropdownMenu
 *   hana.ui.sidebar.buttons      — Sidebar action buttons
 *   hana.ui.titlebar.buttons     — Titlebar icon buttons
 */

const UI_FLAG_PREFIX = 'hana.ui.';

/**
 * 查詢 UI 遷移 flag 是否啟用。
 * @param key - flag 後綴，例如 'settings.dialog'、'toast'
 */
export function isUiMigrationEnabled(key: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(`${UI_FLAG_PREFIX}${key}`) === '1';
}

/**
 * 設定 UI 遷移 flag。
 * @param key - flag 後綴
 * @param enabled - true 啟用，false 關閉
 */
export function setUiMigrationEnabled(key: string, enabled: boolean): void {
  if (typeof window === 'undefined') return;
  const fullKey = `${UI_FLAG_PREFIX}${key}`;
  if (enabled) {
    window.localStorage.setItem(fullKey, '1');
  } else {
    window.localStorage.removeItem(fullKey);
  }
}

/**
 * 取得所有目前啟用的 UI flag（用於 debug）。
 */
export function getEnabledUiFlags(): string[] {
  if (typeof window === 'undefined') return [];
  return Object.keys(window.localStorage)
    .filter(k => k.startsWith(UI_FLAG_PREFIX))
    .map(k => k.slice(UI_FLAG_PREFIX.length));
}
