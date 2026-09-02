const { spawnSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
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

fs.mkdirSync(cacheDir, { recursive: true });
fs.mkdirSync(npmCacheDir, { recursive: true });

if (!fs.existsSync(electronExecutable())) {
  console.log("Installing app dependencies...");
  run(npmCmd, ["install", "--cache", npmCacheDir]);
}

run(npmCmd, ["run", "build"]);

const child = spawn(electronExecutable(), [path.join(root, "src", "main.cjs")], {
  cwd: root,
  env,
  stdio: "ignore",
  detached: true,
});

child.unref();
