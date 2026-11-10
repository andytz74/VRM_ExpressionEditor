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

// package-lock.json에 적힌 직접 의존성 버전과 실제 설치된 버전이 하나라도 다르면 다시 설치한다.
// (Electron 버전 변경, vendor/ 업로더 패키지 교체 모두 여기서 걸린다)
function dependenciesNeedInstall() {
  try {
    const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
    const direct = Object.keys(lock?.packages?.[""]?.dependencies ?? {});
    if (!direct.length) return true;
    return direct.some((name) => {
      const expected = lock.packages[`node_modules/${name}`]?.version;
      try {
        const installed = JSON.parse(fs.readFileSync(path.join(root, "node_modules", name, "package.json"), "utf8"))?.version;
        return !expected || expected !== installed;
      } catch {
        return true;
      }
    });
  } catch {
    return true;
  }
}

fs.mkdirSync(cacheDir, { recursive: true });
fs.mkdirSync(npmCacheDir, { recursive: true });

if (dependenciesNeedInstall()) {
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
