const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  getCurrentFolder: () => ipcRenderer.invoke('get-current-folder'),
  getFolderChildren: (folderPath) => ipcRenderer.invoke('get-folder-children', folderPath),
  syncToFile: (filePath) => ipcRenderer.invoke('sync-to-file', filePath),
  refreshFolder: () => ipcRenderer.invoke('refresh-folder'),
  refreshFile: (filePath) => ipcRenderer.invoke('refresh-file', filePath),
  getSystemFonts: () => ipcRenderer.invoke('get-system-fonts'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  onFileOpened: (callback) => {
    ipcRenderer.on('file-opened', (event, data) => callback(data));
  },
  onFolderOpened: (callback) => {
    ipcRenderer.on('folder-opened', (event, data) => callback(data));
  },
  onMenuOpenFile: (callback) => {
    ipcRenderer.on('menu-open-file', () => callback());
  },
  onMenuOpenFolder: (callback) => {
    ipcRenderer.on('menu-open-folder', () => callback());
  },
  onExpandToPath: (callback) => {
    ipcRenderer.on('expand-to-path', (event, targetPath) => callback(targetPath));
  }
});
