import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(import.meta.dirname, "..");

function packageScripts() {
  return JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf-8")).scripts;
}

function expectClientBeforeServer(scriptName, command) {
  const clientIndex = command.indexOf("npm run build:client");
  const serverIndex = command.indexOf("npm run build:server");
  expect(clientIndex, `${scriptName} must build the renderer before server packaging`).toBeGreaterThanOrEqual(0);
  expect(serverIndex, `${scriptName} must build the server runtime`).toBeGreaterThanOrEqual(0);
  expect(clientIndex, `${scriptName} must copy a fresh mobile renderer bundle into the server runtime`).toBeLessThan(serverIndex);
}

describe("package build order", () => {
  it("builds renderer assets before the server runtime for packaged apps", () => {
    const scripts = packageScripts();

    expectClientBeforeServer("pack", scripts.pack);
    expectClientBeforeServer("dist", scripts.dist);
    expectClientBeforeServer("dist:win", scripts["dist:win"]);
    expectClientBeforeServer("dist:linux", scripts["dist:linux"]);
  });
});
