const fs = require("fs");
const os = require("os");
const path = require("path");
const { app, dialog } = require("electron");

let diagnosticsDir = path.join(os.tmpdir(), "hanako-desktop-launch");
let launchIntegrity = null;

function serializeError(err) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
    };
  }
  return { message: String(err) };
}

function fallbackWriteDiagnostic(fileName, event, payload) {
  try {
    fs.mkdirSync(diagnosticsDir, { recursive: true });
    const filePath = path.join(diagnosticsDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify({
      event,
      time: new Date().toISOString(),
      payload,
    }, null, 2) + "\n", "utf-8");
    return filePath;
  } catch {
    return null;
  }
}

function writeDiagnostic(fileName, event, payload) {
  try {
    if (launchIntegrity?.writeLaunchDiagnostic) {
      return launchIntegrity.writeLaunchDiagnostic({
        diagnosticsDir,
        fileName,
        event,
        payload,
      });
    }
  } catch {}
  return fallbackWriteDiagnostic(fileName, event, payload);
}

function appendLaunchLog(event, payload) {
  try {
    if (launchIntegrity?.appendLaunchLog) {
      return launchIntegrity.appendLaunchLog({ diagnosticsDir, event, payload });
    }
  } catch {}

  try {
    fs.mkdirSync(diagnosticsDir, { recursive: true });
    const filePath = path.join(diagnosticsDir, "launch.log");
    fs.appendFileSync(filePath, JSON.stringify({
      event,
      time: new Date().toISOString(),
      payload,
    }) + "\n", "utf-8");
    return filePath;
  } catch {
    return null;
  }
}

function writeLaunchMarker(status, payload = {}) {
  return writeDiagnostic("launch-marker.json", "launch-marker", {
    status,
    pid: process.pid,
    platform: process.platform,
    arch: process.arch,
    execPath: process.execPath,
    resourcesPath: process.resourcesPath || null,
    hanakoHome,
    ...payload,
  });
}

function showBootstrapError(title, detail) {
  try {
    dialog.showErrorBox(title, detail);
  } catch {}
}

function exitAfterBootstrapFailure() {
  try {
    app.exit(1);
  } catch {}
  process.exit(1);
}

function recordProcessError(kind, err) {
  const payload = {
    kind,
    error: serializeError(err),
    phase: "desktop-bootstrap",
  };
  const fileName = `${kind}.json`;
  writeDiagnostic(fileName, kind, payload);
  appendLaunchLog(kind, payload);
}

process.on("uncaughtException", (err) => {
  if (err?.code === "EPIPE" || err?.code === "ERR_IPC_CHANNEL_CLOSED") return;
  recordProcessError("uncaughtException", err);
});

process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  recordProcessError("unhandledRejection", err);
});

let hanakoHome = null;
try {
  const { resolveHanakoHome } = require("../shared/hana-runtime-paths.cjs");
  hanakoHome = resolveHanakoHome(process.env.HANA_HOME);

  function isValidConfigHome(dir) {
    try {
      if (!fs.existsSync(dir)) return false;
      const modelsPath = path.join(dir, "added-models.yaml");
      if (fs.existsSync(modelsPath)) {
        const content = fs.readFileSync(modelsPath, "utf-8");
        if (/api_key:\s*["']?[^"'\s]+/.test(content)) {
          return true;
        }
      }
      const agentsDir = path.join(dir, "agents");
      if (fs.existsSync(agentsDir)) {
        const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const configPath = path.join(agentsDir, entry.name, "config.yaml");
            if (fs.existsSync(configPath)) {
              const configText = fs.readFileSync(configPath, "utf-8");
              if (/api_key:\s*["']?[^"'\s]+/.test(configText)) {
                return true;
              }
            }
          }
        }
      }
    } catch {}
    return false;
  }

  function isValidUserData(dir) {
    try {
      if (!fs.existsSync(dir)) return false;
      const prefsPath = path.join(dir, "user", "preferences.json");
      if (fs.existsSync(prefsPath)) {
        const content = JSON.parse(fs.readFileSync(prefsPath, "utf-8"));
        if (content.setupComplete === true) {
          return true;
        }
      }
    } catch {}
    return false;
  }

  // 自動遷移舊版 (Hanako) 或同名正式版 (Svananda) 的設定檔到新版 (Svananda-dev)
  const targetHomeValid = isValidConfigHome(hanakoHome);
  if (!targetHomeValid) {
    const sameHomeProd = hanakoHome.replace(/-dev$/, "");
    const oldHomeDev = hanakoHome.replace(/svananda/g, "hanako");
    const oldHomeProd = oldHomeDev.replace(/-dev$/, "");

    let sourceHome = null;
    if (sameHomeProd !== hanakoHome && isValidConfigHome(sameHomeProd)) {
      sourceHome = sameHomeProd;
    } else if (isValidConfigHome(oldHomeDev)) {
      sourceHome = oldHomeDev;
    } else if (isValidConfigHome(oldHomeProd)) {
      sourceHome = oldHomeProd;
    } else if (sameHomeProd !== hanakoHome && fs.existsSync(sameHomeProd)) {
      sourceHome = sameHomeProd;
    } else if (fs.existsSync(oldHomeDev)) {
      sourceHome = oldHomeDev;
    } else if (fs.existsSync(oldHomeProd)) {
      sourceHome = oldHomeProd;
    }

    if (sourceHome) {
      try {
        if (fs.existsSync(hanakoHome)) {
          fs.rmSync(hanakoHome, { recursive: true, force: true });
        }
        fs.cpSync(sourceHome, hanakoHome, { recursive: true });
        console.log(`[bootstrap] Migrated home from ${sourceHome} to ${hanakoHome}`);
      } catch (err) {
        console.error(`[bootstrap] Failed to migrate home from ${sourceHome} to ${hanakoHome}:`, err);
      }
    }
  }

  // 自動遷移偏好設定 userData
  try {
    const appData = app.getPath("appData");
    const suffix = path.basename(hanakoHome).replace(/^\./, "");
    const appName = suffix.charAt(0).toUpperCase() + suffix.slice(1);
    const targetUserData = path.join(appData, appName);

    const targetUserDataValid = isValidUserData(targetUserData);
    if (!targetUserDataValid) {
      const sameUserDataProd = targetUserData.replace(/-dev$/, "");
      const oldAppNameDev = appName.replace(/Svananda/g, "Hanako");
      const oldAppNameProd = oldAppNameDev.replace(/-dev$/, "");
      
      const sourceUserDataDev = path.join(appData, oldAppNameDev);
      const sourceUserDataProd = path.join(appData, oldAppNameProd);

      let sourceUserData = null;
      if (sameUserDataProd !== targetUserData && isValidUserData(sameUserDataProd)) {
        sourceUserData = sameUserDataProd;
      } else if (isValidUserData(sourceUserDataDev)) {
        sourceUserData = sourceUserDataDev;
      } else if (isValidUserData(sourceUserDataProd)) {
        sourceUserData = sourceUserDataProd;
      } else if (sameUserDataProd !== targetUserData && fs.existsSync(sameUserDataProd)) {
        sourceUserData = sameUserDataProd;
      } else if (fs.existsSync(sourceUserDataDev)) {
        sourceUserData = sourceUserDataDev;
      } else if (fs.existsSync(sourceUserDataProd)) {
        sourceUserData = sourceUserDataProd;
      }

      if (sourceUserData && sourceUserData !== targetUserData) {
        try {
          if (fs.existsSync(targetUserData)) {
            fs.rmSync(targetUserData, { recursive: true, force: true });
          }
          fs.cpSync(sourceUserData, targetUserData, { recursive: true });
          console.log(`[bootstrap] Migrated userData from ${sourceUserData} to ${targetUserData}`);
        } catch (err) {
          console.error(`[bootstrap] Failed to migrate userData from ${sourceUserData} to ${targetUserData}:`, err);
        }
      }
    }
  } catch (err) {
    console.error("[bootstrap] Failed during userData migration check:", err);
  }

  process.env.HANA_HOME = hanakoHome;
  diagnosticsDir = path.join(hanakoHome, "diagnostics", "desktop-launch");
} catch (err) {
  const diagnosticPath = writeDiagnostic("hana-home-resolve-failed.json", "hana-home-resolve-failed", {
    phase: "desktop-bootstrap",
    error: serializeError(err),
  });
  showBootstrapError(
    "HanaAgent Launch Failed",
    `HanaAgent failed before HANA_HOME could be resolved.\n\n${err?.message || err}\n\nDiagnostic file:\n${diagnosticPath || diagnosticsDir}`,
  );
  exitAfterBootstrapFailure();
}

writeLaunchMarker("bootstrap-started", {
  argv: process.argv,
  versions: {
    electron: process.versions.electron || null,
    node: process.versions.node || null,
    chrome: process.versions.chrome || null,
  },
});

function verifyWindowsInstallSurfaceBeforeMain() {
  if (process.platform !== "win32" || !app.isPackaged) {
    return true;
  }
  const result = launchIntegrity.checkWindowsInstallSurface({
    execPath: process.execPath,
    resourcesPath: process.resourcesPath,
  });
  if (result.ok) {
    appendLaunchLog("install-surface-check-ok", result);
    return true;
  }

  const diagnosticPath = writeDiagnostic(
    "install-surface-check.json",
    "install-surface-check-failed",
    result,
  );
  writeLaunchMarker("install-surface-check-failed", {
    missing: result.missing,
    diagnosticPath,
  });
  const detail = launchIntegrity.formatInstallSurfaceError(result, diagnosticPath);
  showBootstrapError("HanaAgent Launch Failed", detail);
  exitAfterBootstrapFailure();
  return false;
}

function loadDesktopMain() {
  try {
    launchIntegrity = require("./src/shared/launch-integrity.cjs");
    appendLaunchLog("bootstrap-loaded", {
      packaged: app.isPackaged,
      main: app.isPackaged ? "main.bundle.cjs" : "main.cjs",
    });

    if (!verifyWindowsInstallSurfaceBeforeMain()) return;

    writeLaunchMarker("main-load-started", {
      main: app.isPackaged ? "main.bundle.cjs" : "main.cjs",
    });
    require(app.isPackaged ? "./main.bundle.cjs" : "./main.cjs");
    writeLaunchMarker("main-loaded");
  } catch (err) {
    const payload = {
      phase: "desktop-main-load",
      error: serializeError(err),
    };
    const diagnosticPath = writeDiagnostic("desktop-main-load-failed.json", "desktop-main-load-failed", payload);
    appendLaunchLog("desktop-main-load-failed", { ...payload, diagnosticPath });
    writeLaunchMarker("desktop-main-load-failed", { diagnosticPath });
    showBootstrapError(
      "HanaAgent Launch Failed",
      `HanaAgent failed before the desktop main process finished loading.\n\n${err?.message || err}\n\nDiagnostic file:\n${diagnosticPath || diagnosticsDir}`,
    );
    exitAfterBootstrapFailure();
  }
}

function tryStartOfficePdfHelper() {
  let helper;
  try {
    helper = require("./src/office-pdf-helper.cjs");
  } catch (err) {
    if (process.argv.some((arg) => arg === "--hana-office-html-to-pdf" || arg.startsWith("--hana-office-html-to-pdf="))) {
      console.error("[office-pdf-helper] failed to load helper:", err?.stack || err?.message || err);
      process.exitCode = 1;
      try { app.exit(1); } catch {}
      return true;
    }
    return false;
  }
  if (!helper.isOfficePdfHelperInvocation(process.argv)) return false;
  helper.runOfficePdfHelperFromArgv(process.argv).catch((err) => {
    console.error("[office-pdf-helper]", err?.stack || err?.message || err);
    process.exitCode = 1;
    try { app.exit(1); } catch {}
  });
  return true;
}

if (!tryStartOfficePdfHelper()) {
  loadDesktopMain();
}
