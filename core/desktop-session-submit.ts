/**
 * 桌面 session 的统一提交入口。
 * 本地输入与 bridge /rc 接管都应通过这一层提交消息到桌面 session。
 */

/**
 * @param {object} engine
 * @param {object} opts
 * @param {string} opts.sessionPath
 * @param {string} opts.text
 * @param {Array<{type:'image', data:string, mimeType:string}>} [opts.images]
 * @param {string[]} [opts.imageAttachmentPaths]
 * @param {Array<{type:'video', data:string, mimeType:string}>} [opts.videos]
 * @param {string[]} [opts.videoAttachmentPaths]
 * @param {Array<{type:'audio', data:string, mimeType:string}>} [opts.audios]
 * @param {string[]} [opts.audioAttachmentPaths]
 * @param {Array<{type:string, filename?:string, mimeType?:string, buffer:Buffer|Uint8Array|string}>} [opts.inboundFiles]
 * @param {(delta: string, accumulated: string) => void} [opts.onDelta]
 * @param {object} [opts.displayMessage]
 * @param {Array<{fileId?:string, sessionPath?:string, label?:string, kind?:string}>} [opts.sessionFileRefs]
 * @param {object|null|undefined} [opts.uiContext]
 * @param {object|null|undefined} [opts.context]
 * @returns {Promise<{ text: string | null, toolMedia: string[] }>}
 */
import path from "path";
import { extOfName, inferFileKind } from "../lib/file-metadata.ts";
import { collectMediaItems } from "../lib/tools/media-details.ts";
import { formatSettingsUpdateText } from "../lib/tools/settings-update-result.ts";
import { materializeBridgeInboundFiles } from "../lib/session-files/bridge-inbound-files.ts";
import { serializeSessionFile } from "../lib/session-files/session-file-response.ts";
import { extractLatestTodosFromEntries } from "../lib/tools/todo-compat.ts";

/**
 * 非桌面来源（bridge /rc 等）用户消息的来源元信息持久化条目类型。
 *
 * jsonl 的 message 条目格式归 Pi SDK 所有，不能塞自定义字段；来源元信息
 * 走 SDK 的 custom entry 通道（与 hana-deferred-result 同一模式）。
 * 条目写在它所注释的 user message 之前，紧邻性尽力保证；interject 路径
 * 时，中间可能隔着在途 assistant 输出，消费方须以"其后第一条 user message"
 * 语义关联（跳过中间 assistant 条目）。未知 customType 的 custom 条目不进
 * 模型上下文、不进历史展示，老版本读取时自动跳过。
 *
 * 孤儿容忍规则：消费方必须容忍"origin 条目后没有紧随 user message"的孤儿
 * 条目（例如 steer 被拒绝、prompt 路径写入前抛错），遇到孤儿时跳过即可，
 * 禁止盲目前向关联到下一条消息。
 */
export const MESSAGE_ORIGIN_RECORD_TYPE = "hana-message-origin";

const pendingDesktopSessionSubmissions = new Set();

/**
 * 持久化非桌面来源的消息 origin。写失败只告警不阻断：来源标注是辅助
 * 元数据，不能因为它写不进去就丢掉用户消息本身。
 */
function recordMessageOriginEntry(session: any, sessionPath: string, displayMessage: any): void {
  const source = displayMessage?.source;
  if (!source || source === "desktop") return;
  try {
    if (typeof session?.sessionManager?.appendCustomEntry !== "function") {
      console.warn(`[desktop-session-submit] message origin not persisted (no appendCustomEntry): ${sessionPath}`);
      return;
    }
    session.sessionManager.appendCustomEntry(MESSAGE_ORIGIN_RECORD_TYPE, {
      source,
      bridgeSessionKey: displayMessage?.bridgeSessionKey || null,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn(`[desktop-session-submit] message origin write failed for ${sessionPath}: ${err?.message || err}`);
  }
}

export async function submitDesktopSessionMessage(engine: any, opts: {
  sessionPath?: string;
  text?: string;
  images?: Array<{ type: string; data: string; mimeType: string }>;
  imageAttachmentPaths?: string[];
  videos?: Array<{ type: string; data: string; mimeType: string }>;
  videoAttachmentPaths?: string[];
  audios?: Array<{ type: string; data: string; mimeType: string }>;
  audioAttachmentPaths?: string[];
  inboundFiles?: Array<{ type: string; filename?: string; mimeType?: string; buffer: any }>;
  onDelta?: (delta: string, accumulated: string) => void;
  displayMessage?: any;
  sessionFileRefs?: Array<{ fileId?: string; sessionPath?: string; label?: string; kind?: string }>;
  uiContext?: any;
  context?: any;
} = {}) {
  const {
    sessionPath,
    text,
    images,
    imageAttachmentPaths,
    videos,
    videoAttachmentPaths,
    audios,
    audioAttachmentPaths,
    inboundFiles,
    onDelta,
    displayMessage,
    sessionFileRefs,
    uiContext,
    context,
  } = opts;

  if (!engine || typeof engine.ensureSessionLoaded !== "function" || typeof engine.promptSession !== "function") {
    throw new Error("desktop-session-submit: engine session API unavailable");
  }
  if (!sessionPath) throw new Error("desktop-session-submit: sessionPath is required");
  if (!text && !images?.length && !videos?.length && !audios?.length) throw new Error("desktop-session-submit: text, images, videos, or audios required");
  if (pendingDesktopSessionSubmissions.has(sessionPath)) {
    throw new Error("session_busy");
  }
  if (typeof engine.isSessionStreaming === "function" && engine.isSessionStreaming(sessionPath)) {
    throw new Error("session_busy");
  }

  pendingDesktopSessionSubmissions.add(sessionPath);
  try {
    const session = await engine.ensureSessionLoaded(sessionPath);
    if (!session) throw new Error(`desktop-session-submit: failed to load session ${sessionPath}`);

    if (uiContext !== undefined) {
      engine.setUiContext?.(sessionPath, uiContext ?? null);
    }

    let promptImageAttachmentPaths = imageAttachmentPaths || [];
    let promptVideoAttachmentPaths = videoAttachmentPaths || [];
    let promptAudioAttachmentPaths = audioAttachmentPaths || [];
    let displayAttachments = displayMessage?.attachments;
    let promptText = text || "";
    let promptSessionFileRefs = normalizeSessionFileRefs(sessionFileRefs, sessionPath);

    if (displayAttachments?.length) {
      const registeredDisplay = registerDisplayAttachments({
        hanakoHome: engine.hanakoHome,
        sessionPath,
        attachments: displayAttachments,
        registerSessionFile: engine.registerSessionFile?.bind(engine),
      });
      displayAttachments = registeredDisplay.attachments;
      promptImageAttachmentPaths = uniquePaths([
        ...promptImageAttachmentPaths,
        ...registeredDisplay.imageAttachmentPaths,
      ]);
      promptVideoAttachmentPaths = uniquePaths([
        ...promptVideoAttachmentPaths,
        ...registeredDisplay.videoAttachmentPaths,
      ]);
      if (audios?.length || promptAudioAttachmentPaths.length) {
        promptAudioAttachmentPaths = uniquePaths([
          ...promptAudioAttachmentPaths,
          ...registeredDisplay.audioAttachmentPaths,
        ]);
      }
      promptSessionFileRefs = mergeSessionFileRefs(
        promptSessionFileRefs,
        sessionFileRefsFromAttachments(displayAttachments, sessionPath),
      );
    }

    if (inboundFiles?.length) {
      const materialized = await materializeBridgeInboundFiles({
        hanakoHome: engine.hanakoHome,
        sessionPath,
        files: inboundFiles,
        registerSessionFile: engine.registerSessionFile?.bind(engine),
      });
      promptImageAttachmentPaths = [
        ...promptImageAttachmentPaths,
        ...materialized.imageAttachmentPaths,
      ];
      promptImageAttachmentPaths = uniquePaths(promptImageAttachmentPaths);
      displayAttachments = [
        ...(displayAttachments || []),
        ...materialized.displayAttachments,
      ];
      promptSessionFileRefs = mergeSessionFileRefs(
        promptSessionFileRefs,
        sessionFileRefsFromAttachments(materialized.displayAttachments, sessionPath),
      );
    }

    engine.emitEvent?.({ type: "session_status", isStreaming: true }, sessionPath);
    // 来源元信息先于 prompt 持久化，让 origin 条目紧邻它注释的 user message。
    recordMessageOriginEntry(session, sessionPath, displayMessage);
    engine.emitEvent?.({
      type: "session_user_message",
      message: {
        text: displayMessage?.text ?? text ?? "",
        timestamp: Date.now(),
        attachments: displayAttachments,
        quotedText: displayMessage?.quotedText,
        skills: displayMessage?.skills,
        deskContext: displayMessage?.deskContext ?? null,
        source: displayMessage?.source || "desktop",
        bridgeSessionKey: displayMessage?.bridgeSessionKey || null,
      },
    }, sessionPath);
    queueVoiceInputTranscriptions({
      speechRecognition: engine.speechRecognition,
      sessionPath,
      attachments: displayAttachments,
    });

    promptText = addAttachedImageMarkers(promptText, promptImageAttachmentPaths);
    promptText = addAttachedVideoMarkers(promptText, promptVideoAttachmentPaths);
    promptText = addAttachedAudioMarkers(promptText, promptAudioAttachmentPaths);
    promptText = addSessionFileRefMarkers(promptText, promptSessionFileRefs);

    let captured = "";
    const toolMedia = [];
    const unsub = session.subscribe?.((event) => {
      if (event.type === "message_update") {
        const sub = event.assistantMessageEvent;
        if (sub?.type === "text_delta") {
          const delta = sub.delta || "";
          captured += delta;
          try { onDelta?.(delta, captured); } catch {}
        }
      } else if (event.type === "tool_execution_end" && !event.isError) {
        toolMedia.push(...collectMediaItems(event.result?.details?.media));
        const card = event.result?.details?.card;
        if (card?.description) {
          captured += (captured ? "\n\n" : "") + card.description;
        }
        const settingsUpdateText = formatSettingsUpdateText(event.result?.details?.settingsUpdate);
        if (settingsUpdateText) {
          captured += (captured ? "\n\n" : "") + settingsUpdateText;
        }
      }
    });

    // Auto-Pilot /goal 自動迴圈與 System Prompt 約束注入
    const promptTrim = promptText.trim();
    if (promptTrim.startsWith("/goal!")) {
      promptText = promptText.replace(/^\/goal!/, "/goal");
    }

    const isAutoPilot = !!context?.autoPilot || promptTrim.startsWith("/goal");
    let autoPilotMode = context?.autoPilotMode || "interactive";

    if (promptTrim.startsWith("/goal!") || promptTrim.includes("--yes") || promptTrim.includes("-y")) {
      autoPilotMode = "full";
    }

    if (isAutoPilot) {
      const isFull = autoPilotMode === "full";
      
      const autoPilotRules = isFull ? `
[SYSTEM CONTRACT: AUTO-PILOT MODE (FULL AUTONOMY)]
你目前正處於「完全自主執行模式（Full Autopilot Mode）」。你必須遵守以下最高指令限制，不得違背：
1. 嚴禁提問與確認：你必須自主進行技術決策並直接執行。嚴禁以 any 形式向用戶詢問「是否可以執行某個指令」、「需要選擇哪個方案」或「你是否同意此變更」等確認問題。即使面臨不確定性，你必須利用你擁有的工具自主調研、閱讀文件或搜尋 codebase 以做出最合理的決策。
2. 拒絕草率與敷衍：你必須以最高工程標準完成任務。在將任何 TODO 標記為 completed 之前，你必須自主執行完整的驗證步驟（包括但不限於：編譯程式碼、跑單元測試、檢查命令的 stdout/stderr 輸出結果）。僅當驗證完全通過、結果正確時，才能更新該 TODO 的狀態為 completed。
3. 主動更新任務清單：請在每次大步驟的末尾或更新時，主動、精確地更新與記錄當前的 TODO 待辦清單，並依此引導推進你的執行。`
      : `
[SYSTEM CONTRACT: AUTO-PILOT MODE (INTERACTIVE CONSTRAINTS)]
你目前正處於「互動參考模式（Interactive Autopilot Mode）」。你必須遵守以下最高指令限制：
1. 主動參考與確認：在開始執行或面臨多個架構選擇、破壞性變更時，你應該主動提出可能的方案並詢問使用者意見，並將其作為執行約束，而不是完全蒙眼狂奔。
2. 自主推進與 TODO 管理：雖然在關鍵決策時需要參考使用者意見，但一旦方向確定，你仍應自主執行實作。在將 TODO 標記為 completed 之前，你依然必須自主執行驗證，並精確更新 TODO 清單。`;

      const basePrompt = context?.systemPrompt || session.agent?.state?.systemPrompt || session.systemPrompt || "";
      context = {
        ...context,
        autoPilot: true,
        autoPilotMode,
        systemPrompt: basePrompt + "\n" + autoPilotRules,
      };
    }

    try {
      const promptOpts = buildPromptOptions({
        images,
        videos,
        audios,
        promptImageAttachmentPaths,
        promptVideoAttachmentPaths,
        promptAudioAttachmentPaths,
        context,
      });
      await engine.promptSession(sessionPath, promptText, promptOpts);
    } finally {
      try { unsub?.(); } catch {}
      engine.emitEvent?.({ type: "session_status", isStreaming: false }, sessionPath);
    }

    // Auto-Pilot /goal 自動迴圈檢查
    let nextAutoPilotStep = false;
    
    if (isAutoPilot) {
      try {
        const entries = session.sessionManager.getEntries();
        const latestTodos = extractLatestTodosFromEntries(entries);
        if (latestTodos && Array.isArray(latestTodos)) {
          const hasUnfinished = latestTodos.some(td => td.status === "pending" || td.status === "in_progress");
          if (hasUnfinished) {
             nextAutoPilotStep = true;
          }
        }
      } catch (err) {
        console.warn(`[desktop-session-submit] auto-pilot check failed:`, err);
      }
    }

    if (nextAutoPilotStep) {
      // 延遲 1.5 秒讓 UI 更新，然後自動注入下一輪背景喚醒指令
      setTimeout(() => {
        // 確保 session 未被中斷 (如果使用者按了 Stop，Session 的 isStreaming 會停掉，但我們也要防呆)
        if (typeof engine.isSessionStreaming === "function" && engine.isSessionStreaming(sessionPath)) return;
        
        console.log(`[desktop-session-submit] Auto-Pilot triggering next step for ${sessionPath}`);
        submitDesktopSessionMessage(engine, {
          sessionPath,
          text: "[System: Auto-Pilot Mode] 請自動推進下一個待辦步驟。如果是 pending 任務請轉換為 in_progress 進行；如果是尚未完成的 in_progress 請繼續處理。不要等我確認，做完這一步請再次更新 todo 狀態。",
          context: { ...context, autoPilot: true, autoPilotMode },
        }).catch(err => {
          console.error(`[desktop-session-submit] Auto-Pilot loop error:`, err);
        });
      }, 1500);
    }

    return {
      text: captured.trim() || null,
      toolMedia,
    };
  } finally {
    pendingDesktopSessionSubmissions.delete(sessionPath);
  }
}

export async function submitDesktopSessionInterjection(engine: any, opts: {
  sessionPath?: string;
  text?: string;
  images?: Array<{ type: string; data: string; mimeType: string }>;
  imageAttachmentPaths?: string[];
  videos?: Array<{ type: string; data: string; mimeType: string }>;
  videoAttachmentPaths?: string[];
  audios?: Array<{ type: string; data: string; mimeType: string }>;
  audioAttachmentPaths?: string[];
  inboundFiles?: Array<{ type: string; filename?: string; mimeType?: string; buffer: any }>;
  displayMessage?: any;
  sessionFileRefs?: Array<{ fileId?: string; sessionPath?: string; label?: string; kind?: string }>;
  uiContext?: any;
  context?: any;
} = {}) {
  const {
    sessionPath,
    text,
    images,
    imageAttachmentPaths,
    videos,
    videoAttachmentPaths,
    audios,
    audioAttachmentPaths,
    inboundFiles,
    displayMessage,
    sessionFileRefs,
    uiContext,
    context,
  } = opts;

  if (!engine || typeof engine.ensureSessionLoaded !== "function" || typeof engine.steerSession !== "function") {
    throw new Error("desktop-session-submit: engine interjection API unavailable");
  }
  if (!sessionPath) throw new Error("desktop-session-submit: sessionPath is required");
  if (!text && !images?.length && !videos?.length && !audios?.length) throw new Error("desktop-session-submit: text, images, videos, or audios required");

  if (typeof engine.isSessionStreaming === "function" && !engine.isSessionStreaming(sessionPath)) {
    return submitDesktopSessionMessage(engine, opts);
  }

  const session = await engine.ensureSessionLoaded(sessionPath);
  if (!session) {
    throw new Error(`desktop-session-submit: failed to load session ${sessionPath}`);
  }

  if (uiContext !== undefined) {
    engine.setUiContext?.(sessionPath, uiContext ?? null);
  }

  let promptImageAttachmentPaths = imageAttachmentPaths || [];
  let promptVideoAttachmentPaths = videoAttachmentPaths || [];
  let promptAudioAttachmentPaths = audioAttachmentPaths || [];
  let displayAttachments = displayMessage?.attachments;
  let promptText = text || "";
  let promptSessionFileRefs = normalizeSessionFileRefs(sessionFileRefs, sessionPath);

  if (displayAttachments?.length) {
    const registeredDisplay = registerDisplayAttachments({
      hanakoHome: engine.hanakoHome,
      sessionPath,
      attachments: displayAttachments,
      registerSessionFile: engine.registerSessionFile?.bind(engine),
    });
    displayAttachments = registeredDisplay.attachments;
    promptImageAttachmentPaths = uniquePaths([
      ...promptImageAttachmentPaths,
      ...registeredDisplay.imageAttachmentPaths,
    ]);
    promptVideoAttachmentPaths = uniquePaths([
      ...promptVideoAttachmentPaths,
      ...registeredDisplay.videoAttachmentPaths,
    ]);
    if (audios?.length || promptAudioAttachmentPaths.length) {
      promptAudioAttachmentPaths = uniquePaths([
        ...promptAudioAttachmentPaths,
        ...registeredDisplay.audioAttachmentPaths,
      ]);
    }
    promptSessionFileRefs = mergeSessionFileRefs(
      promptSessionFileRefs,
      sessionFileRefsFromAttachments(displayAttachments, sessionPath),
    );
  }

  if (inboundFiles?.length) {
    const materialized = await materializeBridgeInboundFiles({
      hanakoHome: engine.hanakoHome,
      sessionPath,
      files: inboundFiles,
      registerSessionFile: engine.registerSessionFile?.bind(engine),
    });
    promptImageAttachmentPaths = uniquePaths([
      ...promptImageAttachmentPaths,
      ...materialized.imageAttachmentPaths,
    ]);
    displayAttachments = [
      ...(displayAttachments || []),
      ...materialized.displayAttachments,
    ];
    promptSessionFileRefs = mergeSessionFileRefs(
      promptSessionFileRefs,
      sessionFileRefsFromAttachments(materialized.displayAttachments, sessionPath),
    );
  }

  engine.emitEvent?.({
    type: "session_user_message",
    message: {
      text: displayMessage?.text ?? text ?? "",
      timestamp: Date.now(),
      attachments: displayAttachments,
      quotedText: displayMessage?.quotedText,
      skills: displayMessage?.skills,
      deskContext: displayMessage?.deskContext ?? null,
      source: displayMessage?.source || "desktop",
      bridgeSessionKey: displayMessage?.bridgeSessionKey || null,
    },
  }, sessionPath);
  queueVoiceInputTranscriptions({
    speechRecognition: engine.speechRecognition,
    sessionPath,
    attachments: displayAttachments,
  });

  promptText = addAttachedImageMarkers(promptText, promptImageAttachmentPaths);
  promptText = addAttachedVideoMarkers(promptText, promptVideoAttachmentPaths);
  promptText = addAttachedAudioMarkers(promptText, promptAudioAttachmentPaths);
  promptText = addSessionFileRefMarkers(promptText, promptSessionFileRefs);
  if (context?.beforeUser) {
    promptText = `${context.beforeUser}\n\n${promptText}`;
  }

  const steered = engine.steerSession(sessionPath, promptText);
  if (!steered) throw new Error("session_busy");
  // 来源元信息在 steer 成功后持久化，避免 steer 被拒绝时产生孤儿条目。
  // steerSession 同步返回，与 appendCustomEntry 之间无 await，紧邻性不受影响。
  // 契约：origin 条目注释其后第一条 user message（中间可能隔着在途 assistant 输出）。
  recordMessageOriginEntry(session, sessionPath, displayMessage);
  return { text: null, toolMedia: [], steered: true };
}

function buildPromptOptions({
  images,
  videos,
  audios,
  promptImageAttachmentPaths,
  promptVideoAttachmentPaths,
  promptAudioAttachmentPaths,
  context,
}: any = {}) {
  const opts: any = {};
  if (images?.length) opts.images = images;
  if (videos?.length) opts.videos = videos;
  if (audios?.length) opts.audios = audios;
  if (promptImageAttachmentPaths?.length) opts.imageAttachmentPaths = promptImageAttachmentPaths;
  if (promptVideoAttachmentPaths?.length) opts.videoAttachmentPaths = promptVideoAttachmentPaths;
  if (promptAudioAttachmentPaths?.length) opts.audioAttachmentPaths = promptAudioAttachmentPaths;
  if (context !== undefined && context !== null) opts.context = context;
  return Object.keys(opts).length ? opts : undefined;
}

function queueVoiceInputTranscriptions({ speechRecognition, sessionPath, attachments }) {
  if (!speechRecognition || typeof speechRecognition.queueVoiceTranscription !== "function") return;
  for (const attachment of attachments || []) {
    if (attachment?.presentation !== "voice-input" || !attachment.fileId) continue;
    speechRecognition.queueVoiceTranscription({
      sessionPath,
      fileId: attachment.fileId,
    });
  }
}

function registerDisplayAttachments({ hanakoHome, sessionPath, attachments, registerSessionFile }) {
  const nextAttachments = [];
  const imageAttachmentPaths = [];
  const videoAttachmentPaths = [];
  const audioAttachmentPaths = [];

  for (const attachment of attachments || []) {
    let next = { ...attachment };
    let sessionFile = null;

    if (!next.fileId && next.path && path.isAbsolute(next.path) && typeof registerSessionFile === "function") {
      sessionFile = serializeSessionFile(registerSessionFile({
        sessionPath,
        filePath: next.path,
        label: next.name || path.basename(next.path),
        origin: originForDisplayAttachment(next),
        storageKind: displayAttachmentStorageKind(hanakoHome, next.path),
        presentation: displayAttachmentPresentation(next),
        listed: listedForDisplayAttachment(next),
        waveform: next.waveform,
      }));
      if (sessionFile) {
        next = {
          ...next,
          fileId: sessionFile.fileId || sessionFile.id,
          name: next.name || sessionFile.displayName || sessionFile.filename || path.basename(next.path),
          mimeType: next.mimeType || sessionFile.mime,
          isDir: next.isDir || !!sessionFile.isDirectory,
          presentation: sessionFile.presentation || displayAttachmentPresentation(next),
          listed: sessionFile.listed !== undefined ? sessionFile.listed !== false : listedForDisplayAttachment(next),
          status: sessionFile.status,
          missingAt: sessionFile.missingAt,
          waveform: sessionFile.waveform || next.waveform,
        };
      }
    }

    if (next.path && path.isAbsolute(next.path) && next.base64Data) {
      const { base64Data, ...withoutInlineBytes } = next;
      next = withoutInlineBytes;
    }

    const kind = sessionFile?.kind || inferFileKind({
      mime: next.mimeType,
      ext: extOfName(next.name || next.path),
      isDirectory: !!next.isDir,
    } as any);
    if (!next.isDir && next.path && kind === "image") {
      imageAttachmentPaths.push(next.path);
    } else if (!next.isDir && next.path && kind === "video") {
      videoAttachmentPaths.push(next.path);
    } else if (!next.isDir && next.path && kind === "audio") {
      audioAttachmentPaths.push(next.path);
    }
    nextAttachments.push(next);
  }

  return {
    attachments: nextAttachments,
    imageAttachmentPaths: uniquePaths(imageAttachmentPaths),
    videoAttachmentPaths: uniquePaths(videoAttachmentPaths),
    audioAttachmentPaths: uniquePaths(audioAttachmentPaths),
  };
}

function displayAttachmentPresentation(attachment) {
  return attachment?.presentation === "voice-input" ? "voice-input" : "attachment";
}

function listedForDisplayAttachment(attachment) {
  return displayAttachmentPresentation(attachment) !== "voice-input";
}

function originForDisplayAttachment(attachment) {
  return displayAttachmentPresentation(attachment) === "voice-input" ? "voice_input" : "user_attachment";
}

function displayAttachmentStorageKind(hanakoHome, filePath) {
  if (!hanakoHome) return "external";
  const root = path.resolve(hanakoHome, "session-files");
  const target = path.resolve(filePath);
  const rel = path.relative(root, target);
  if (rel === "" || (rel && !rel.startsWith("..") && !path.isAbsolute(rel))) {
    return "managed_cache";
  }
  return "external";
}

function addAttachedImageMarkers(text, imageAttachmentPaths) {
  let promptText = text || "";
  const missing = uniquePaths(imageAttachmentPaths)
    .filter((filePath) => filePath && !promptText.includes(`[attached_image: ${filePath}]`));
  if (!missing.length) return promptText;
  const markerText = missing.map((filePath) => `[attached_image: ${filePath}]`).join("\n");
  return promptText ? `${markerText}\n${promptText}` : markerText;
}

function addAttachedVideoMarkers(text, videoAttachmentPaths) {
  let promptText = text || "";
  const missing = uniquePaths(videoAttachmentPaths)
    .filter((filePath) => filePath && !promptText.includes(`[attached_video: ${filePath}]`));
  if (!missing.length) return promptText;
  const markerText = missing.map((filePath) => `[attached_video: ${filePath}]`).join("\n");
  return promptText ? `${markerText}\n${promptText}` : markerText;
}

function addAttachedAudioMarkers(text, audioAttachmentPaths) {
  let promptText = text || "";
  const missing = uniquePaths(audioAttachmentPaths)
    .filter((filePath) => filePath && !promptText.includes(`[attached_audio: ${filePath}]`));
  if (!missing.length) return promptText;
  const markerText = missing.map((filePath) => `[attached_audio: ${filePath}]`).join("\n");
  return promptText ? `${markerText}\n${promptText}` : markerText;
}

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set((paths || []).filter(Boolean)));
}

function normalizeSessionFileRefs(refs, fallbackSessionPath) {
  if (!Array.isArray(refs)) return [];
  const normalized = [];
  for (const ref of refs) {
    if (!ref || typeof ref !== "object") continue;
    const fileId = typeof ref.fileId === "string" && ref.fileId.trim() ? ref.fileId.trim() : null;
    if (!fileId) continue;
    normalized.push({
      fileId,
      sessionPath: typeof ref.sessionPath === "string" && ref.sessionPath ? ref.sessionPath : fallbackSessionPath,
      label: typeof ref.label === "string" && ref.label ? ref.label : fileId,
      kind: typeof ref.kind === "string" && ref.kind ? ref.kind : "attachment",
    });
  }
  return normalized;
}

function sessionFileRefsFromAttachments(attachments, sessionPath) {
  return normalizeSessionFileRefs((attachments || []).map((attachment) => ({
    fileId: attachment?.fileId,
    sessionPath,
    label: attachment?.name || attachment?.label || attachment?.path,
    kind: attachment?.isDir ? "directory" : "attachment",
  })), sessionPath);
}

function mergeSessionFileRefs(primary, secondary) {
  const out = [];
  const seen = new Set();
  for (const ref of [...(primary || []), ...(secondary || [])]) {
    if (!ref?.fileId) continue;
    const key = `${ref.sessionPath || ""}:${ref.fileId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

function addSessionFileRefMarkers(text, refs) {
  const items = normalizeSessionFileRefs(refs, null);
  if (!items.length) return text || "";
  const markerText = items
    .map((ref) => `[SessionFile] ${JSON.stringify({
      fileId: ref.fileId,
      sessionPath: ref.sessionPath || null,
      label: ref.label,
      kind: ref.kind,
    })}`)
    .join("\n");
  const promptText = text || "";
  return promptText ? `${markerText}\n${promptText}` : markerText;
}
