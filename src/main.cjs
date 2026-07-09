const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    title: "VRM Expression Editor",
    backgroundColor: "#121418",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

function backupName(filePath) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "_")
    .slice(0, 15);
  return path.join(dir, `${base}_backup_${stamp}${ext}`);
}

function animationsDir() {
  return path.join(__dirname, "..", "animations");
}

function animationCatalogPath() {
  return path.join(animationsDir(), "animations.meta");
}

async function readAnimationCatalog() {
  await fs.mkdir(animationsDir(), { recursive: true });
  let catalog = { schemaVersion: 1, type: "vrm-animation-catalog", animations: {} };
  try {
    catalog = parseJsonCatalog(await fs.readFile(animationCatalogPath(), "utf8"));
    catalog.animations ??= {};
  } catch (error) {
    if (error.code !== "ENOENT") {
      const brokenPath = `${animationCatalogPath()}.broken-${Date.now()}`;
      await fs.rename(animationCatalogPath(), brokenPath).catch(() => {});
    }
  }

  const animationFiles = new Set((await fs.readdir(animationsDir())).filter((name) => /\.(vrma|glb|gltf)$/i.test(name)));
  catalog.animations = Object.fromEntries(
    Object.entries(catalog.animations ?? {}).filter(([fileName]) => animationFiles.has(fileName)),
  );
  for (const fileName of animationFiles) {
    catalog.animations[fileName] ??= {
      fileName,
      description: "",
      mustWatchFull: false,
    };
  }
  await writeAnimationCatalog(catalog);
  return catalog;
}

function parseJsonCatalog(text) {
  try {
    return JSON.parse(text);
  } catch {
    const trimmed = text.trim();
    let end = trimmed.length;
    while (end > 0) {
      end = trimmed.lastIndexOf("}", end - 1);
      if (end < 0) break;
      try {
        return JSON.parse(trimmed.slice(0, end + 1));
      } catch {
        // Keep looking for the previous closing brace.
      }
    }
    throw new Error("Animation catalog is not JSON.");
  }
}

async function writeAnimationCatalog(catalog) {
  await fs.mkdir(animationsDir(), { recursive: true });
  await fs.writeFile(animationCatalogPath(), JSON.stringify(catalog, null, 2), "utf8");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle("vrm:open", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open VRM",
    properties: ["openFile"],
    filters: [{ name: "VRM", extensions: ["vrm"] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const filePath = result.filePaths[0];
  const data = await fs.readFile(filePath);
  return { filePath, name: path.basename(filePath), data };
});

ipcMain.handle("json:open", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open Motion Correction JSON",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const filePath = result.filePaths[0];
  const data = await fs.readFile(filePath);
  return { filePath, name: path.basename(filePath), data };
});

ipcMain.handle("animation:open", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open Reference Animation",
    properties: ["openFile"],
    filters: [
      { name: "Animation", extensions: ["vrma", "glb", "gltf"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const filePath = result.filePaths[0];
  const data = await fs.readFile(filePath);
  return { filePath, name: path.basename(filePath), data };
});

ipcMain.handle("animation:store", async (_event, sourcePath) => {
  const dir = animationsDir();
  await fs.mkdir(dir, { recursive: true });
  const fileName = path.basename(sourcePath);
  const targetPath = path.join(dir, fileName);
  if (path.resolve(sourcePath) !== path.resolve(targetPath)) {
    await fs.copyFile(sourcePath, targetPath);
  }
  const catalog = await readAnimationCatalog();
  catalog.animations[fileName] ??= { fileName, description: "", mustWatchFull: false };
  await writeAnimationCatalog(catalog);
  const data = await fs.readFile(targetPath);
  return { filePath: targetPath, name: fileName, data };
});

ipcMain.handle("animation:openStored", async (_event, fileName) => {
  const filePath = path.join(animationsDir(), path.basename(fileName));
  const data = await fs.readFile(filePath);
  return { filePath, name: path.basename(filePath), data };
});

ipcMain.handle("animation:existsStored", async (_event, fileName) => {
  const filePath = path.join(animationsDir(), path.basename(fileName));
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("animation:listStored", async () => readAnimationCatalog());

ipcMain.handle("animation:updateInfo", async (_event, fileName, patch) => {
  const catalog = await readAnimationCatalog();
  const safeName = path.basename(fileName);
  catalog.animations[safeName] ??= { fileName: safeName, description: "", mustWatchFull: false };
  if (Object.hasOwn(patch, "description")) catalog.animations[safeName].description = String(patch.description ?? "");
  if (Object.hasOwn(patch, "mustWatchFull")) catalog.animations[safeName].mustWatchFull = Boolean(patch.mustWatchFull);
  await writeAnimationCatalog(catalog);
  return catalog.animations[safeName];
});

ipcMain.handle("animation:deleteStored", async (_event, fileName) => {
  const safeName = path.basename(fileName);
  const filePath = path.join(animationsDir(), safeName);
  await fs.rm(filePath, { force: true });
  const catalog = await readAnimationCatalog();
  delete catalog.animations[safeName];
  await writeAnimationCatalog(catalog);
  return { filePath, name: path.basename(filePath) };
});

ipcMain.handle("meta:loadOrCreate", async (_event, vrmPath, data) => {
  const filePath = `${vrmPath}.meta`;
  try {
    const existing = await fs.readFile(filePath);
    return { filePath, name: path.basename(filePath), data: existing, created: false };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await fs.writeFile(filePath, data, "utf8");
    return { filePath, name: path.basename(filePath), data: Buffer.from(data, "utf8"), created: true };
  }
});

ipcMain.handle("meta:save", async (_event, filePath, data) => {
  await fs.writeFile(filePath, data, "utf8");
  return { filePath, name: path.basename(filePath) };
});

ipcMain.handle("json:save", async (_event, currentPath, data) => {
  let filePath = currentPath;
  if (!filePath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Save Motion Correction JSON",
      defaultPath: "motion-correction.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return null;
    filePath = result.filePath;
  }

  await fs.writeFile(filePath, data, "utf8");
  return { filePath, name: path.basename(filePath) };
});

ipcMain.handle("vrm:writeTemp", async (_event, originalPath, data) => {
  const tempDir = path.join(app.getPath("temp"), "vrm-expression-editor");
  await fs.mkdir(tempDir, { recursive: true });
  const ext = path.extname(originalPath) || ".vrm";
  const base = path.basename(originalPath, ext);
  const tempPath = path.join(tempDir, `${base}.working${ext}`);
  await fs.writeFile(tempPath, Buffer.from(data));
  return { tempPath };
});

ipcMain.handle("vrm:commit", async (_event, originalPath, data) => {
  const backupPath = backupName(originalPath);
  await fs.rename(originalPath, backupPath);
  await fs.writeFile(originalPath, Buffer.from(data));
  return { backupPath, filePath: originalPath };
});

ipcMain.handle("vrm:saveAddedShapeKeys", async (_event, originalPath, data) => {
  const dir = path.dirname(originalPath);
  const ext = path.extname(originalPath) || ".vrm";
  const base = path.basename(originalPath, ext);
  const filePath = path.join(dir, `${base}_addedShapeKeys${ext}`);
  await fs.writeFile(filePath, Buffer.from(data));
  return { filePath, name: path.basename(filePath) };
});
