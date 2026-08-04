const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

let mainWindow;
let editorConfigCache = null;
let configSavedForQuit = false;

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

function configPath() {
  return path.join(__dirname, "..", "ExpressionEditorConfig.ini");
}

function createDefaultConfig() {
  return {
    expressionEditor: {
      knownShapeKeys: null,
      visibleShapeKeys: null,
    },
    cameraPresets: {},
    viewer: {
      lightIntensity: 0.75,
    },
    transitionViewer: {
      idle: [],
      transition: [],
      event: [],
      start: null,
      transitionPick: null,
      end: null,
      startBlend: 0.4,
      endBlend: 0.4,
      transitionTrim: 0,
      transitionPivot: 0,
    },
  };
}

function parseIniConfig(text) {
  const config = createDefaultConfig();
  let section = "";
  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) continue;
    const sectionMatch = line.match(/^\[(.+)]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      continue;
    }
    const equalsIndex = line.indexOf("=");
    if (equalsIndex < 0) continue;
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    if (section === "ExpressionEditor.Filter" && key === "VisibleShapeKeysJson") {
      try {
        const names = JSON.parse(value);
        config.expressionEditor.visibleShapeKeys = Array.isArray(names) ? names.map(String) : null;
      } catch {
        config.expressionEditor.visibleShapeKeys = null;
      }
    }
    if (section === "ExpressionEditor.Filter" && key === "KnownShapeKeysJson") {
      try {
        const names = JSON.parse(value);
        config.expressionEditor.knownShapeKeys = Array.isArray(names) ? names.map(String) : null;
      } catch {
        config.expressionEditor.knownShapeKeys = null;
      }
    }
    if (section === "Camera.Presets" && key === "ModesJson") {
      try {
        const presets = JSON.parse(value);
        config.cameraPresets = presets && typeof presets === "object" ? presets : {};
      } catch {
        config.cameraPresets = {};
      }
    }
    if (section === "Viewer" && key === "LightIntensity") {
      const intensity = Number(value);
      config.viewer.lightIntensity = Number.isFinite(intensity) ? intensity : config.viewer.lightIntensity;
    }
    if (section === "TransitionViewer" && key === "StateJson") {
      try {
        const viewer = JSON.parse(value);
        config.transitionViewer = viewer && typeof viewer === "object" ? viewer : config.transitionViewer;
      } catch {
        config.transitionViewer = createDefaultConfig().transitionViewer;
      }
    }
  }
  if (!Array.isArray(config.expressionEditor.knownShapeKeys) && Array.isArray(config.expressionEditor.visibleShapeKeys)) {
    config.expressionEditor.knownShapeKeys = [...config.expressionEditor.visibleShapeKeys];
  }
  return config;
}

function serializeIniConfig(config) {
  const known = Array.isArray(config?.expressionEditor?.knownShapeKeys)
    ? config.expressionEditor.knownShapeKeys.map(String)
    : null;
  const visible = Array.isArray(config?.expressionEditor?.visibleShapeKeys)
    ? config.expressionEditor.visibleShapeKeys.map(String)
    : null;
  return [
    "; VRM Expression Editor workspace settings",
    "[ExpressionEditor.Filter]",
    `KnownShapeKeysJson=${JSON.stringify(known)}`,
    `VisibleShapeKeysJson=${JSON.stringify(visible)}`,
    "",
    "[Camera.Presets]",
    `ModesJson=${JSON.stringify(config?.cameraPresets && typeof config.cameraPresets === "object" ? config.cameraPresets : {})}`,
    "",
    "[Viewer]",
    `LightIntensity=${Number.isFinite(Number(config?.viewer?.lightIntensity)) ? Number(config.viewer.lightIntensity) : 0.75}`,
    "",
    "[TransitionViewer]",
    `StateJson=${JSON.stringify(config?.transitionViewer && typeof config.transitionViewer === "object" ? config.transitionViewer : createDefaultConfig().transitionViewer)}`,
    "",
  ].join("\n");
}

async function readEditorConfig() {
  try {
    const text = await fs.readFile(configPath(), "utf8");
    editorConfigCache = parseIniConfig(text);
    return editorConfigCache;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const config = createDefaultConfig();
    await writeEditorConfig(config);
    return config;
  }
}

async function writeEditorConfig(config) {
  editorConfigCache = config;
  await fs.writeFile(configPath(), serializeIniConfig(config), "utf8");
  return config;
}

async function readAnimationCatalog() {
  await fs.mkdir(animationsDir(), { recursive: true });
  let catalog = { schemaVersion: 1, type: "vrm-animation-catalog", animations: {} };
  let changed = false;
  try {
    catalog = parseJsonCatalog(await fs.readFile(animationCatalogPath(), "utf8"));
    catalog.animations ??= {};
  } catch (error) {
    if (error.code !== "ENOENT") {
      const brokenPath = `${animationCatalogPath()}.broken-${Date.now()}`;
      await fs.rename(animationCatalogPath(), brokenPath).catch(() => {});
    }
    changed = true;
  }

  const animationFiles = new Set((await fs.readdir(animationsDir())).filter((name) => /\.(vrma|glb|gltf)$/i.test(name)));
  for (const fileName of animationFiles) {
    if (!catalog.animations[fileName]) {
      catalog.animations[fileName] = {
        fileName,
        description: "",
        mustWatchFull: false,
        duration: 0,
      };
      changed = true;
    }
    const entry = catalog.animations[fileName];
    const normalizedDuration = Number(entry.duration) || 0;
    if (entry.fileName !== fileName) {
      entry.fileName = fileName;
      changed = true;
    }
    if (typeof entry.description !== "string") {
      entry.description = String(entry.description ?? "");
      changed = true;
    }
    if (typeof entry.mustWatchFull !== "boolean") {
      entry.mustWatchFull = Boolean(entry.mustWatchFull);
      changed = true;
    }
    if (entry.duration !== normalizedDuration) {
      entry.duration = normalizedDuration;
      changed = true;
    }
  }
  if (changed) await writeAnimationCatalog(catalog);
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

app.on("before-quit", async (event) => {
  if (!editorConfigCache || configSavedForQuit) return;
  event.preventDefault();
  const config = editorConfigCache;
  configSavedForQuit = true;
  await writeEditorConfig(config);
  app.quit();
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
  catalog.animations[fileName] ??= { fileName, description: "", mustWatchFull: false, duration: 0 };
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
  catalog.animations[safeName] ??= { fileName: safeName, description: "", mustWatchFull: false, duration: 0 };
  if (Object.hasOwn(patch, "description")) catalog.animations[safeName].description = String(patch.description ?? "");
  if (Object.hasOwn(patch, "mustWatchFull")) catalog.animations[safeName].mustWatchFull = Boolean(patch.mustWatchFull);
  if (Object.hasOwn(patch, "duration")) {
    const duration = Number(patch.duration);
    catalog.animations[safeName].duration = Number.isFinite(duration) && duration > 0 ? Math.round(duration * 1000) / 1000 : 0;
  }
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

ipcMain.handle("config:load", async () => readEditorConfig());

ipcMain.handle("config:updateMemory", async (_event, config) => {
  editorConfigCache = config;
  return editorConfigCache;
});

ipcMain.handle("config:save", async (_event, config) => writeEditorConfig(config));

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
