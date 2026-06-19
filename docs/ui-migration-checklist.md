# UI Migration QA Checklist

> 每個遷移 PR 合併前都必須逐項勾選。  
> 若某項不適用（例如 quick-chat 在非相關 PR），標 `N/A` 並說明原因。

---

## Global — 每個 PR 都要確認

- [ ] App 可以正常啟動（`npm run start:vite`）
- [ ] Main chat 頁面正常載入
- [ ] **warm-paper theme** 外觀不變
- [ ] **midnight theme** 外觀不變
- [ ] paper texture 在開啟時仍可見
- [ ] Scrollbar 外觀不變
- [ ] Text selection 行為不變
- [ ] 字體（`--font-ui`）不變

## Build — 每個 PR 都要跑

```bash
npm run typecheck
npm run build:renderer
npm run build:theme
```

---

## Settings Modal

- [ ] 開啟 Settings
- [ ] ESC 關閉
- [ ] 點擊 overlay 關閉
- [ ] `Tab` 不逃出 modal
- [ ] `Shift+Tab` 向後循環不逃出
- [ ] 關閉後 focus 回到 opener
- [ ] Plugin marketplace **wide mode** 不變
- [ ] 巢狀 Popover/Dropdown 不被 modal 誤關閉
- [ ] Screen reader：title/description 存在

## Sidebar

- [ ] New chat button 可用
- [ ] Settings button 可用
- [ ] Collapse button 可用
- [ ] Activity / Automation / Bridge buttons 可用
- [ ] Sidebar collapsed 狀態正常
- [ ] Sidebar open 狀態正常

## Titlebar

- [ ] Left sidebar toggle 可用
- [ ] Right jian toggle 可用
- [ ] Window controls 可用（最小化/最大化/關閉）
- [ ] Channel tabs 可用
- [ ] Preview toggle 可用

## Toast Notifications

- [ ] Success toast 顯示正常
- [ ] Error toast 顯示正常
- [ ] Long text toast 不溢位
- [ ] 多個 toast 堆疊正常
- [ ] 關閉按鈕可用
- [ ] Theme token 正確

## Floating Elements

- [ ] Tooltip 顯示/隱藏正常
- [ ] DropdownMenu 鍵盤導航正常（Arrow, Enter, Esc）
- [ ] Popover 開關正常
- [ ] ContextMenu（右鍵）正常

## Keyboard Navigation

- [ ] 可以完全不用滑鼠操作 Settings
- [ ] Tab order 合理
- [ ] Focus visible（`:focus-visible`）正常顯示
- [ ] ESC 在所有 overlay 都能關閉

## Multi-window Entries

| 窗口 | 啟動正常 | Theme 正常 | 備註 |
|------|---------|-----------|------|
| main（index.html）| [ ] | [ ] | |
| quick-chat | [ ] | [ ] | |
| settings.html | [ ] | [ ] | |
| onboarding | [ ] | [ ] | |
| splash | [ ] | [ ] | |
| mobile | [ ] | [ ] | |

## dist-renderer 完整性

- [ ] `dist-renderer/` 包含 legacy CSS（`styles.css`）
- [ ] `dist-renderer/themes/` 包含所有 theme CSS
- [ ] `dist-renderer/lib/theme.js` 存在

---

## Feature Flag 快速開關

```js
// 開啟
localStorage.setItem('hana.ui.<key>', '1'); location.reload();
// 關閉
localStorage.removeItem('hana.ui.<key>'); location.reload();
```

| Flag 名稱 | 用途 |
|-----------|------|
| `hana.dev.shadcnPreview` | Dev primitive preview overlay |
| `hana.ui.settings.basic` | Settings 基本 section 遷移 |
| `hana.ui.settings.dialog` | SettingsModalShellV2（Radix Dialog）|
| `hana.ui.toast` | HanaToaster（Sonner）|
| `hana.ui.tooltip` | Radix Tooltip |
| `hana.ui.dropdown` | Radix DropdownMenu |
| `hana.ui.sidebar.buttons` | Sidebar action buttons |
| `hana.ui.titlebar.buttons` | Titlebar icon buttons |
