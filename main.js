'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./lib/store');

let win = null;
let watcher = null;
let debounce = null;
let lastSerialized = '';

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try {
    const s = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    if (s && typeof s.folder === 'string' && s.folder) return s;
  } catch (e) {
    /* premier lancement */
  }
  return { folder: app.getPath('userData') };
}

function writeSettings(s) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2), 'utf8');
}

function describe() {
  const { folder } = readSettings();
  return {
    folder,
    fileName: store.FILE_NAME,
    dataFile: store.fileFor(folder),
    isDefault: path.resolve(folder) === path.resolve(app.getPath('userData')),
  };
}

function remember(data) {
  lastSerialized = JSON.stringify(data);
  return data;
}

/* Prévient la fenêtre quand un autre poste modifie le fichier (Dropbox). */
function watchData() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  const { folder } = readSettings();
  try {
    fs.mkdirSync(folder, { recursive: true });
    watcher = fs.watch(folder, { persistent: false }, (_event, name) => {
      if (name && name !== store.FILE_NAME && !/conflict|conflit/i.test(name)) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        try {
          const data = store.load(folder);
          if (JSON.stringify(data) !== lastSerialized && win && !win.isDestroyed()) {
            remember(data);
            win.webContents.send('data:changed', data);
          }
        } catch (e) {
          /* fichier en cours de synchronisation : on réessaiera au prochain événement */
        }
      }, 400);
    });
    watcher.on('error', () => {});
  } catch (e) {
    /* dossier inaccessible : pas de suivi en direct */
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 420,
    minHeight: 560,
    show: false,
    title: 'AGOA CG — Congés',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.on('closed', () => {
    win = null;
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

ipcMain.handle('settings:get', () => describe());

ipcMain.handle('data:load', () => remember(store.load(readSettings().folder)));

ipcMain.handle('data:save', (_e, patch) => remember(store.save(readSettings().folder, patch)));

ipcMain.handle('settings:chooseFolder', async () => {
  const current = readSettings().folder;
  const r = await dialog.showOpenDialog(win, {
    title: 'Choisir le dossier de données',
    defaultPath: current,
    properties: ['openDirectory', 'createDirectory'],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const folder = r.filePaths[0];
  const target = store.fileFor(folder);
  const existed = fs.existsSync(target);
  if (!existed) {
    let before = store.emptyData();
    try {
      before = store.load(current);
    } catch (e) {
      /* ancien fichier illisible : on repart d'un fichier vide */
    }
    store.writeAtomic(target, before);
  }
  const data = store.load(folder);
  writeSettings({ folder });
  remember(data);
  watchData();
  return { settings: describe(), data, copied: !existed };
});

ipcMain.handle('shell:showFolder', () => {
  const s = describe();
  if (fs.existsSync(s.dataFile)) shell.showItemInFolder(s.dataFile);
  else shell.openPath(s.folder);
});

ipcMain.handle('file:saveText', async (_e, name, text) => {
  const safe = String(name || 'compte-rendu.txt').replace(/[\\/:*?"<>|]/g, '-').slice(0, 120);
  const r = await dialog.showSaveDialog(win, {
    title: 'Enregistrer le compte rendu',
    defaultPath: path.join(app.getPath('documents'), safe),
    filters: [{ name: 'Texte', extensions: ['txt'] }],
  });
  if (r.canceled || !r.filePath) return { saved: false };
  fs.writeFileSync(r.filePath, '﻿' + String(text || '').replace(/\r?\n/g, '\r\n'), 'utf8');
  return { saved: true, path: r.filePath };
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
    watchData();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => app.quit());
}
