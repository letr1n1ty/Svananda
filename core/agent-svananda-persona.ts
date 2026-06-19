import fs from "fs";
import path from "path";
import YAML from "js-yaml";

/**
 * Svananda 專屬的單一聲明式人設加載器
 * 取代舊版繁瑣的 identity.md, ishiki.md, yuan 等碎片化檔案
 */
export function loadSvanandaPersona(agentDir: string, fallbackDir: string, locale: string = "zh"): string {
  const yamlPath = path.join(agentDir, "svananda.yaml");
  
  // 1. 如果存在 Svananda 的聲明文件，優先使用它，並覆寫本地的 .md 防止 GUI 操作導致漂移
  if (fs.existsSync(yamlPath)) {
    try {
      const personaData = YAML.load(fs.readFileSync(yamlPath, "utf-8")) as any;
      const parts = [];
      if (personaData.identity) {
          parts.push(personaData.identity);
          // Sync 回 GUI 讀取的 identity.md
          fs.writeFileSync(path.join(agentDir, "identity.md"), personaData.identity, "utf-8");
      }
      if (personaData.capabilities) {
          parts.push("## 核心能力 (Capabilities)\n" + (Array.isArray(personaData.capabilities) ? personaData.capabilities.map(c => "- " + c).join("\n") : personaData.capabilities));
      }
      if (personaData.consciousness) {
          parts.push(personaData.consciousness);
          // Sync 回 GUI 讀取的 ishiki.md
          fs.writeFileSync(path.join(agentDir, "ishiki.md"), personaData.consciousness, "utf-8");
      }
      if (personaData.directives) {
          parts.push("## 行為準則 (Directives)\n" + (Array.isArray(personaData.directives) ? personaData.directives.map(d => "- " + d).join("\n") : personaData.directives));
      }
      return parts.join("\n\n");
    } catch (e) {
      console.warn(`[Svananda] Failed to parse svananda.yaml at ${agentDir}:`, e);
    }
  }
  
  // 2. 如果沒有 svananda.yaml，則相容舊版 GUI 操作，並嘗試將 GUI 的資料聚合導出為 svananda.yaml
  const safeRead = (p: string) => {
      try { return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : ""; }
      catch { return ""; }
  };
  
  const identity = safeRead(path.join(agentDir, "identity.md"));
  const ishiki = safeRead(path.join(agentDir, "ishiki.md"));
  const yuan = safeRead(path.join(fallbackDir, "yuan", "hanako.md")); // 預設底層能力
  
  // 如果舊檔案存在，把它們自動轉換並儲存成全新的 svananda.yaml
  if (identity || ishiki) {
    try {
      const newYaml = YAML.dump({
          identity: identity.trim() || "",
          capabilities: ["操作本地工作區", "目標與排程驅動"],
          consciousness: ishiki.trim() || "",
      });
      fs.writeFileSync(yamlPath, newYaml, "utf-8");
    } catch (e) { /* ignore write errors */ }
    
    return [identity, yuan, ishiki].filter(Boolean).join("\n\n");
  }
  
  return "Svananda Agent Ready."; // 最底線的 fallback
}
