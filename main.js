const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Store = require('electron-store');
const fontList = require('font-list');

// Set app name before anything else
app.setName('DS MD Viewer');

const store = new Store();

// Log file setup - use temp directory for logs
const logFile = path.join(os.tmpdir(), 'ds-md-viewer.log');
function log(message) {
  try {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
  } catch (err) {
    // Silently ignore logging errors in production
    console.error('Log error:', err.message);
  }
}

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`UNCAUGHT EXCEPTION: ${error.message}\n${error.stack}`);
  dialog.showErrorBox('Uncaught Exception', `${error.message}\n\n${error.stack}`);
});

process.on('unhandledRejection', (reason) => {
  log(`UNHANDLED REJECTION: ${reason}`);
  dialog.showErrorBox('Unhandled Rejection', String(reason));
});

log('App starting...');

let mainWindow;
let currentFilePath = null;
let currentFolderPath = null;

function createWindow() {
  log('Creating window...');
  try {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, 'assets', 'icon.ico')
    });

    log('Window created, loading HTML...');
    mainWindow.loadFile('dist/index.html');

    mainWindow.webContents.on('did-finish-load', () => {
      log('HTML loaded, restoring session...');
      // Always start from root
      const rootFolder = process.platform === 'win32' ? 'C:\\' : '/';
      openFolder(rootFolder);

      // Handle file opened from command line or file association
      const filePath = process.argv.find(arg => arg.endsWith('.md'));
      if (filePath && fs.existsSync(filePath)) {
        log(`Opening file from command line: ${filePath}`);
        openFile(filePath);
        // Expand to the file's folder
        mainWindow.webContents.send('expand-to-path', filePath);
      } else {
        // Restore last file if exists
        const lastFile = store.get('lastFile');
        if (lastFile && fs.existsSync(lastFile)) {
          openFile(lastFile);
          mainWindow.webContents.send('expand-to-path', lastFile);
        }
      }
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      log(`Failed to load: ${errorCode} - ${errorDescription}`);
    });
  } catch (err) {
    log(`Error creating window: ${err.message}\n${err.stack}`);
  }
}

function saveSession() {
  if (currentFilePath) {
    store.set('lastFile', currentFilePath);
  }
}

function openFile(filePath) {
  if (fs.existsSync(filePath)) {
    currentFilePath = filePath;
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    mainWindow.webContents.send('file-opened', { content, fileName, filePath });
    mainWindow.setTitle(`${fileName} - DS MD Viewer`);
    saveSession();
  }
}

function openFolder(folderPath) {
  log(`Opening folder: ${folderPath}`);
  try {
    if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
      currentFolderPath = folderPath;
      log(`Scanning for markdown files...`);
      const files = getMarkdownFiles(folderPath);
      log(`Found ${files.length} items, sending to renderer...`);
      mainWindow.webContents.send('folder-opened', { folderPath, files });
      saveSession();
      log(`Folder opened successfully`);
    } else {
      log(`Folder does not exist or is not a directory: ${folderPath}`);
    }
  } catch (err) {
    log(`Error opening folder: ${err.message}\n${err.stack}`);
  }
}

function getMarkdownFiles(folderPath) {
  const items = [];

  let entries;
  try {
    entries = fs.readdirSync(folderPath);
    log(`Read ${entries.length} entries from ${folderPath}`);
  } catch (err) {
    log(`Error reading folder ${folderPath}: ${err.message}`);
    return items;
  }

  for (const name of entries) {
    if (name.startsWith('.') || name.startsWith('$')) {
      continue;
    }

    const fullPath = path.join(folderPath, name);

    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        items.push({
          name: name,
          path: fullPath,
          isDirectory: true,
          expanded: false,
          children: null
        });
      } else if (stat.isFile() && name.toLowerCase().endsWith('.md')) {
        items.push({
          name: name,
          path: fullPath,
          isDirectory: false
        });
      }
    } catch (err) {
      // If we can't stat it, try to add it as a directory anyway (for virtual folders)
      log(`Can't stat ${name}, adding as directory: ${err.message}`);
      items.push({
        name: name,
        path: fullPath,
        isDirectory: true,
        expanded: false,
        children: null
      });
    }
  }

  log(`Returning ${items.length} items`);
  return items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
}

// IPC handlers
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Markdown Files', extensions: ['md', 'markdown'] }]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    openFile(result.filePaths[0]);
    return true;
  }
  return false;
});

ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    openFolder(result.filePaths[0]);
    return true;
  }
  return false;
});

ipcMain.handle('read-file', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    openFile(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('get-current-folder', () => {
  return currentFolderPath;
});

ipcMain.handle('get-folder-children', async (event, folderPath) => {
  return getMarkdownFiles(folderPath);
});

ipcMain.handle('refresh-folder', async () => {
  if (currentFolderPath) {
    log(`Refreshing folder: ${currentFolderPath}`);
    const files = getMarkdownFiles(currentFolderPath);
    mainWindow.webContents.send('folder-opened', { folderPath: currentFolderPath, files });
    return true;
  }
  return false;
});

ipcMain.handle('refresh-file', async (event, filePath) => {
  log(`Refreshing file: ${filePath}`);
  if (filePath && fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    return { content, fileName, filePath };
  }
  return null;
});

ipcMain.handle('sync-to-file', async (event, filePath) => {
  log(`Syncing to file: ${filePath}`);
  if (filePath && fs.existsSync(filePath)) {
    // Don't change root folder, just expand to the file's location
    mainWindow.webContents.send('expand-to-path', filePath);
    return true;
  }
  return false;
});

ipcMain.handle('get-system-fonts', async () => {
  try {
    const fonts = await fontList.getFonts();
    // font-list returns fonts with quotes, remove them
    return fonts.map(f => f.replace(/^"|"$/g, '')).sort();
  } catch (err) {
    log(`Error getting system fonts: ${err.message}`);
    return ['Segoe UI', 'Arial', 'Times New Roman', 'Consolas'];
  }
});

ipcMain.handle('get-settings', () => {
  return {
    fontFamily: store.get('fontFamily', 'Segoe UI'),
    codeFontFamily: store.get('codeFontFamily', 'JetBrains Mono'),
    zoom: store.get('zoom', 100)
  };
});

ipcMain.handle('save-settings', (event, settings) => {
  if (settings.fontFamily) store.set('fontFamily', settings.fontFamily);
  if (settings.codeFontFamily) store.set('codeFontFamily', settings.codeFontFamily);
  if (settings.zoom !== undefined) store.set('zoom', settings.zoom);
  return true;
});

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open File',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu-open-file');
          }
        },
        {
          label: 'Open Folder',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            mainWindow.webContents.send('menu-open-folder');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle second instance (for file association)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      const filePath = commandLine.find(arg => arg.endsWith('.md'));
      if (filePath && fs.existsSync(filePath)) {
        openFile(filePath);
        // Don't change root folder, just expand to the file's location
        mainWindow.webContents.send('expand-to-path', filePath);
      }
    }
  });
}
