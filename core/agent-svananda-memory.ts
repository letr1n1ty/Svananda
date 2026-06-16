import fs from "fs";
import path from "path";

/**
 * Svananda 專屬的大一統記憶路由 (Consolidated Memory)
 * 取代舊版 today.md / week.md / longterm.md / memory.md 的多重讀取
 */
export function buildSvanandaConsolidatedMemory(agentDir: string): string {
  const memoryDir = path.join(agentDir, "memory");
  const consolidatedPath = path.join(memoryDir, "svananda_core_memory.md");
  const legacyMemoryPath = path.join(memoryDir, "memory.md");

  // 1. 如果存在 Svananda 的統整記憶庫，優先讀取
  if (fs.existsSync(consolidatedPath)) {
    try {
      const content = fs.readFileSync(consolidatedPath, "utf-8").trim();
      return content || "（暫無記憶）";
    } catch (e) {
      console.warn(`[Svananda] Failed to read core memory at ${consolidatedPath}:`, e);
    }
  }

  // 2. 如果不存在，退回讀取舊版的 memory.md，並在背景觸發「記憶純化」任務
  if (fs.existsSync(legacyMemoryPath)) {
    try {
      const legacyContent = fs.readFileSync(legacyMemoryPath, "utf-8").trim();
      if (legacyContent && legacyContent !== "（暂无记忆）" && legacyContent !== "(No memory yet)") {
        // TODO: 未來可以在這裡加入背景去重邏輯
        return legacyContent;
      }
    } catch (e) {
      // 忽略讀取錯誤
    }
  }

  return "（暫無記憶）";
}
