const { spawnSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const cacheDir = path.join(root, "work", "electron-cache");
const npmCacheDir = path.join(root, "work", "npm-cache");
const env = {
  ...process.env,
  electron_config_cache: cacheDir,
  ELECTRON_CONFIG_CACHE: cacheDir,
};

function run(command, args, options = {}) {
  const actualCommand = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : command;
  const actualArgs = process.platform === "win32" ? ["/d", "/s", "/c", command, ...args] : args;
  const result = spawnSync(actualCommand, actualArgs, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function electronExecutable() {
  if (process.platform === "win32") {
    return path.join(root, "node_modules", "electron", "dist", "electron.exe");
  }
  if (process.platform === "darwin") {
    return path.join(root, "node_modules", "electron", "dist", "Electron.app", "Contents", "MacOS", "Electron");
  }
  return path.join(root, "node_modules", "electron", "dist", "electron");
}

function electronVersionNeedsInstall() {
  try {
    const expected = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))?.dependencies?.electron;
    const installed = JSON.parse(
      fs.readFileSync(path.join(root, "node_modules", "electron", "package.json"), "utf8"),
    )?.version;
    const normalizedExpected = String(expected ?? "").replace(/^[~^]/, "");
    return !normalizedExpected || normalizedExpected !== String(installed ?? "");
  } catch {
    return true;
  }
}

fs.mkdirSync(cacheDir, { recursive: true });
fs.mkdirSync(npmCacheDir, { recursive: true });

if (electronVersionNeedsInstall()) {
  console.log("Installing app dependencies...");
  run(npmCmd, ["install", "--cache", npmCacheDir]);
}

if (!fs.existsSync(electronExecutable())) {
  console.log("Installing Electron runtime...");
  run(npxCmd, ["--no-install", "install-electron", "--no"]);
}

if (!fs.existsSync(electronExecutable())) {
  console.error(`Electron runtime was not installed: ${electronExecutable()}`);
  process.exit(1);
}

run(npmCmd, ["run", "build"]);

const child = spawn(electronExecutable(), [path.join(root, "src", "main.cjs")], {
  cwd: root,
  env,
  stdio: "ignore",
  detached: true,
});

child.once("error", (error) => {
  console.error(`VRM Expression Editor could not start: ${error.message}`);
  process.exitCode = 1;
});
child.once("spawn", () => child.unref());
