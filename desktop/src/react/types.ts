import type { ThinkingLevel } from './stores/model-slice';

// ── Auto-update ──

export interface AutoUpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error' | 'latest';
  version: string | null;
  releaseNotes: string | null;
  releaseUrl: string | null;
  downloadUrl: string | null;
  progress: {
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
  } | null;
  error: string | null;
}

export interface AutoLaunchStatus {
  supported: boolean;
  openAtLogin: boolean;
  openedAtLogin: boolean;
  status: string | null;
  executableWillLaunchAtLogin?: boolean | null;
}

export interface KeepAwakeStatus {
  enabled: boolean;
  active: boolean;
  blockerId: number | null;
  type: 'prevent-app-suspension';
}

export type DesktopNotificationFocusPolicy = 'always' | 'when_unfocused';

export interface DesktopNotificationOptions {
  desktopFocusPolicy?: DesktopNotificationFocusPolicy;
}

// ── 核心数据结构 ──

export type SessionPermissionMode = 'auto' | 'operate' | 'ask' | 'read_only';

/**
 * #1624：服务端在 session restore 时算好的"工具能力有更新"提示数据
 * （冻结快照 vs 当前 agent 配置）。前端只消费，不自行计算。
 */
export interface SessionCapabilityDrift {
  version: number;
  /** 当前 live 配置的能力 fingerprint（dismiss 时回传） */
  fingerprint: string;
  frozenFingerprint: string;
  addedToolNames: string[];
  removedToolNames: string[];
  invalidToolNames: string[];
  promptChanged: boolean;
  hasDrift: boolean;
}

export interface Session {
  path: string;
  title: string | null;
  firstMessage: string;
  modified: string;
  /**
   * 服务端磁盘修订点（stat 签名）。null = 服务端未提供（老服务端 / 内存占位投影）。
   * 与 chatSessions[path].revision 对比用于判断缓存内容是否落后于磁盘真相。
   */
  revision?: string | null;
  messageCount: number;
  agentId: string | null;
  agentName: string | null;
  cwd: string | null;
  workspaceMountId?: string | null;
  workspaceLabel?: string | null;
  projectId?: string | null;
  permissionMode?: SessionPermissionMode | null;
  pinnedAt?: string | null;
  hasSummary?: boolean;
  agentDeleted?: boolean;
  readOnlyReason?: 'agent_deleted' | string | null;
  continuationAvailable?: boolean;
  deletedAt?: string | null;
  rcAttachment?: {
    sessionKey: string;
    platform: string;
    title?: string | null;
  } | null;
  _optimistic?: boolean;
}

export interface Agent {
  id: string;
  name: string;
  yuan: string;
  isPrimary: boolean;
  hasAvatar?: boolean;
  chatModel?: { id: string; provider?: string | null } | null;
  homeFolder?: string | null;
  memoryMasterEnabled?: boolean;
}

export interface SessionStream {
  streamId: string | null;
  lastSeq: number;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  isCurrent?: boolean;
  reasoning?: boolean;
  xhigh?: boolean;
  thinkingLevels?: ThinkingLevel[];
  defaultThinkingLevel?: ThinkingLevel;
  audio?: boolean;
  audioTransport?: string | null;
  audioTransportSupported?: boolean;
  /** 输入模态数组（Pi SDK 标准字段）。包含 "image" / "video" 表示模型支持对应媒体输入；音频走 Hana 兼容能力字段。 */
  input?: ("text" | "image" | "video")[];
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  members: string[];
  lastMessage: string;
  lastSender: string;
  lastTimestamp: string;
  messageCount?: number;
  newMessageCount: number;
  isDM?: boolean;
  dmOwnerId?: string;
  peerId?: string;
  peerName?: string;
}

export interface ChannelMessage {
  sender: string;
  timestamp: string;
  body: string;
}

export interface AgentPhoneActivity {
  conversationId: string;
  conversationType: 'channel' | 'dm';
  agentId: string;
  state: 'idle' | 'viewed' | 'triaging' | 'no_reply' | 'replying' | 'using_tool' | 'waiting_permission' | 'compacting' | 'error' | string;
  summary: string;
  timestamp: string;
  details?: Record<string, unknown> | null;
}

export type ChannelAgentActivities = Record<string, Record<string, AgentPhoneActivity[]>>;

export interface ChannelTickerStatus {
  active?: {
    channelName?: string;
    agentId?: string;
    activeAgentId?: string;
    delivered?: number;
    agentCount?: number;
    checks?: number;
    maxChecks?: number;
    mode?: string;
  } | null;
  nextReminder?: {
    channelName?: string;
    dueAt?: string;
    dueAtMs?: number;
    intervalMs?: number;
  } | null;
  running?: boolean;
  queued?: boolean;
}

export type ChannelTickerStatusMap = Record<string, ChannelTickerStatus | null>;
export type AgentPhoneToolMode = 'read_only' | 'write';

export interface AgentPhoneSettings {
  mode: AgentPhoneToolMode;
  replyMinChars: number | null;
  replyMaxChars: number | null;
  proactiveEnabled: boolean;
  reminderIntervalMinutes: number;
  guardLimit: number;
  modelOverrideEnabled: boolean;
  modelOverrideModel: { id: string; provider: string } | null;
}

export interface Activity {
  id: string;
  type: string;
  title: string;
  timestamp: string;
  agentId?: string;
  agentName?: string;
  summary?: string;
  [key: string]: unknown;
}

export interface PreviewItem {
  id: string;
  type: string;
  title: string;
  content: string;
  language?: string | null;
  fileId?: string;
  filePath?: string;
  ext?: string;
  mime?: string;
  kind?: string;
  storageKind?: string;
  sourceUrl?: string;
  sourceRootPath?: string;
  status?: 'available' | 'expired' | string;
  missingAt?: number | null;
  remoteContentRef?: RemoteContentRef | null;
}

export interface DeskFile {
  name: string;
  isDir: boolean;
  size?: number;
  mtime?: string;
}

export interface StudioWorkspace {
  workspaceId: string;
  mountId: string;
  label: string;
  sourceKind?: string | null;
  provider?: string | null;
  presentation?: string | null;
  capabilities?: string[];
  isDefault?: boolean;
  /**
   * local_fs mount 的 native 绝对根路径。仅当服务端按 principal 判定为
   * 本地 owner 时披露；远端/虚拟 mount 恒为 null。
   */
  nativeRootPath?: string | null;
}

export interface WorkspaceChangePayload {
  rootPath: string;
  changedPath: string;
  affectedDir: string;
  eventType: string;
}

export interface DeskSearchResult {
  name: string;
  relativePath: string;
  parentSubdir: string;
  isDir: boolean;
  size?: number | null;
  mtime?: string;
}

export type TodoStatus = 'pending' | 'in_progress' | 'completed';

export interface TodoItem {
  content: string;
  activeForm: string;
  status: TodoStatus;
}

// ── 浮动面板类型 ──
export type ActivePanel = 'activity' | 'automation' | 'bridge' | 'ultrawork' | null;
export type TabType = 'chat' | 'channels' | `plugin:${string}`;
export type RightWorkspaceTab = 'session-files' | 'workspace' | `plugin-widget:${string}`;

export interface FileVersion {
  mtimeMs: number;
  size: number;
  sha256?: string;
}

export interface TextFileSnapshot {
  content: string;
  version: FileVersion;
}

export interface VersionedWriteResult {
  ok: boolean;
  conflict?: boolean;
  version?: FileVersion | null;
}

export interface RemoteWorkbenchContentRef {
  kind: 'workbench-file' | 'mobile-workbench';
  mountId?: string;
  rootId?: string;
  subdir: string;
  name: string;
  contentPath: string;
  version?: FileVersion | null;
}

export type RemoteContentRef = RemoteWorkbenchContentRef;

// ── Plugin Card Protocol ──

export interface PluginCardDetails {
  type: string;         // "iframe" | future types
  pluginId: string;
  route: string;
  title?: string;
  description: string;  // IM fallback / degradation text
  aspectRatio?: string;
}

// ── 插件 UI 信息 ──

export interface PluginPageInfo {
  pluginId: string;
  title: string | Record<string, string>;
  icon: string | null;
  routeUrl: string;
  hostCapabilities: string[];
}

export interface PluginWidgetInfo {
  pluginId: string;
  title: string | Record<string, string>;
  icon: string | null;
  routeUrl: string;
  hostCapabilities: string[];
}

export interface PluginUiHostCapabilityGrant {
  pluginId: string;
  hostCapabilities: string[];
}

export interface BrowserViewerTab {
  tabId: string;
  title?: string;
  url?: string | null;
  canGoBack?: boolean;
  canGoForward?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface BrowserViewerUpdate {
  title?: string;
  url?: string | null;
  canGoBack?: boolean;
  canGoForward?: boolean;
  running?: boolean;
  reason?: string | null;
  sessionPath?: string | null;
  activeTabId?: string | null;
  tabs?: BrowserViewerTab[];
}
