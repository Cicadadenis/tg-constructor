const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let mainWindow;

app.setName('Cicada Studio');

function getStartUrl() {
  if (process.env.ELECTRON_START_URL) {
    return process.env.ELECTRON_START_URL;
  }

  return pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).toString();
}

function quitApp() {
  if (!app.isQuitting) {
    app.isQuitting = true;
    app.quit();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#05070d',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      event.preventDefault();
      quitApp();
    }
  });

  const startUrl = getStartUrl();
  console.log('[electron] ELECTRON_START_URL =', process.env.ELECTRON_START_URL);
  console.log('[electron] resolved startUrl =', startUrl);

  // Forward renderer console messages to main process console for easier debugging
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[renderer][level ${level}] ${message} (${sourceId}:${line})`);
  });

  // Capture renderer crashes
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[electron] render-process-gone', details);
  });
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[electron] failed to load ${url}: ${description} (${code})`);
    if (String(startUrl).includes('localhost:5173')) {
      console.error('[electron] Start Vite first: npm run dev   (or npm run dev:full)');
    }
  });
  mainWindow.loadURL(startUrl);
}

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('Escape', quitApp);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  quitApp();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
