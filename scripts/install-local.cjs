const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const packageJson = require(path.join(rootDir, "package.json"));
const productName = packageJson.build?.productName || "HanaAgent";

const sourceApp = path.join(rootDir, "dist", "mac-arm64", `${productName}.app`);
const targetApp = path.join("/Applications", `${productName}.app`);

console.log(`[install-local] Preparing local installation for ${productName}.app...`);

if (!fs.existsSync(sourceApp)) {
  console.error(`[install-local] Error: Source application not found at ${sourceApp}`);
  process.exit(1);
}

// 1. Remove old versions
const pathsToRemove = [
  targetApp,
  "/Applications/HanaAgent.app",
  "/Applications/Hanako.app"
];

for (const p of pathsToRemove) {
  if (fs.existsSync(p)) {
    console.log(`[install-local] Removing old bundle: ${p}`);
    fs.rmSync(p, { recursive: true, force: true });
  }
}

// 2. Copy new app bundle
console.log(`[install-local] Copying new bundle to ${targetApp}...`);
fs.cpSync(sourceApp, targetApp, { recursive: true, verbatimSymlinks: true });

// 3. Write app-update.yml
const updateYmlPath = path.join(targetApp, "Contents", "Resources", "app-update.yml");
console.log(`[install-local] Writing app-update.yml to ${updateYmlPath}...`);
fs.writeFileSync(
  updateYmlPath,
  "provider: github\nowner: liliMozi\nrepo: openhanako\n",
  "utf-8"
);

// 4. Run sign-local.cjs
console.log("[install-local] Running local signing script...");
execSync("node scripts/sign-local.cjs", { stdio: "inherit", cwd: rootDir });

console.log("[install-local] ✓ Local installation completed successfully!");
