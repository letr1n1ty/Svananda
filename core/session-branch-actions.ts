import path from "path";
import { SessionManager } from "../lib/pi-sdk/index.ts";

export async function branchSessionToEntry(engine, opts: Record<string, any> = {}) {
  const {
    sessionPath,
    sourceEntryId,
    clientMessageId,
  } = opts;

  if (!engine || typeof engine.ensureSessionLoaded !== "function") {
    throw new Error("branchSessionToEntry requires engine.ensureSessionLoaded");
  }
  if (!sessionPath) throw new Error("sessionPath is required");
  if (!sourceEntryId) throw new Error("sourceEntryId is required");

  if (typeof engine.isSessionStreaming === "function" && engine.isSessionStreaming(sessionPath)) {
    throw new Error("session_busy");
  }

  // 1. 開啟一個臨時的 SessionManager 以進行分支，寫入新 JSONL 檔案而不破壞現有的記憶體快取
  const tempManager = SessionManager.open(sessionPath, path.dirname(sessionPath));
  const entries = (tempManager as any).fileEntries || [];
  const targetEntry = entries.find((e: any) => e.id === sourceEntryId);
  if (!targetEntry) {
    throw new Error("Source entry ID not found in original session");
  }

  const newSessionFile = tempManager.createBranchedSession(sourceEntryId);

  if (!newSessionFile) {
    throw new Error("Failed to create branched session file");
  }

  // 2. 將新分支會話載入引擎快取
  const newSession = await engine.ensureSessionLoaded(newSessionFile);

  // 3. 同步新會話的 agent context
  replaceAgentMessagesFromBranch(newSession);

  // 4. 設定新會話的 title 與 metadata
  const originalMeta = engine._sessionCoord._readSessionMetaEntrySync(sessionPath);
  let originalTitle = originalMeta?.title;
  if (!originalTitle) {
    const agentId = engine._sessionCoord._d.agentIdFromSessionPath(sessionPath);
    const sessionDir = agentId
      ? path.join(engine._sessionCoord._d.agentsDir, agentId, "sessions")
      : engine._sessionCoord._d.getAgent().sessionDir;
    try {
      const titles = await engine._sessionCoord._loadSessionTitlesFor(sessionDir);
      originalTitle = titles[sessionPath];
    } catch {}
  }
  if (!originalTitle) {
    const firstUserEntry = entries.find((e: any) => e.type === "message" && e.message?.role === "user");
    if (firstUserEntry) {
      const content = firstUserEntry.message.content;
      if (typeof content === "string") {
        originalTitle = content;
      } else if (Array.isArray(content)) {
        originalTitle = content
          .filter((block: any) => block?.type === "text" && typeof block.text === "string")
          .map((block: any) => block.text)
          .join(" ");
      }
    }
  }
  if (!originalTitle) {
    originalTitle = path.basename(sessionPath, ".jsonl");
  }

  if (originalTitle && originalTitle.length > 40) {
    originalTitle = originalTitle.substring(0, 40) + "...";
  }

  const newTitle = `分支-${originalTitle}`;
  console.log("[branchSessionToEntry] Saving session title:", { newSessionFile, newTitle, originalTitle });
  await engine._sessionCoord.saveSessionTitle(newSessionFile, newTitle);
  console.log("[branchSessionToEntry] saveSessionTitle completed successfully");

  const branchFromRole = targetEntry.role || "assistant";
  await engine._sessionCoord.writeSessionMeta(newSessionFile, {
    title: newTitle,
    branchOf: sessionPath,
    branchFromEntryId: sourceEntryId,
    branchFromMessageId: clientMessageId || null,
    branchFromRole,
    branchCreatedAt: Date.now(),
  });

  // 5. 發送事件
  engine.emitEvent?.({
    type: "session_branch_switched",
    messageId: sourceEntryId,
    clientMessageId: clientMessageId || null,
    newSessionPath: newSessionFile,
  }, sessionPath);

  return {
    sessionPath: newSessionFile,
    path: newSessionFile,
    title: newTitle,
    branchOf: sessionPath,
    branchFromEntryId: sourceEntryId,
  };
}

function replaceAgentMessagesFromBranch(session) {
  const context = session.sessionManager.buildSessionContext();
  if (session.agent?.replaceMessages) {
    session.agent.replaceMessages(context.messages);
  } else if (session.agent?.state) {
    session.agent.state.messages = context.messages;
  }
}
