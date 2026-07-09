const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vrmFiles", {
  open: () => ipcRenderer.invoke("vrm:open"),
  openAnimation: () => ipcRenderer.invoke("animation:open"),
  storeAnimation: (filePath) => ipcRenderer.invoke("animation:store", filePath),
  openStoredAnimation: (fileName) => ipcRenderer.invoke("animation:openStored", fileName),
  existsStoredAnimation: (fileName) => ipcRenderer.invoke("animation:existsStored", fileName),
  listStoredAnimations: () => ipcRenderer.invoke("animation:listStored"),
  updateAnimationInfo: (fileName, patch) => ipcRenderer.invoke("animation:updateInfo", fileName, patch),
  deleteStoredAnimation: (fileName) => ipcRenderer.invoke("animation:deleteStored", fileName),
  loadOrCreateMeta: (vrmPath, data) => ipcRenderer.invoke("meta:loadOrCreate", vrmPath, data),
  saveMeta: (filePath, data) => ipcRenderer.invoke("meta:save", filePath, data),
  openJson: () => ipcRenderer.invoke("json:open"),
  saveJson: (filePath, data) => ipcRenderer.invoke("json:save", filePath, data),
  writeTemp: (originalPath, data) => ipcRenderer.invoke("vrm:writeTemp", originalPath, data),
  commit: (originalPath, data) => ipcRenderer.invoke("vrm:commit", originalPath, data),
  saveAddedShapeKeys: (originalPath, data) => ipcRenderer.invoke("vrm:saveAddedShapeKeys", originalPath, data),
});
