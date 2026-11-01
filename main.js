'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./lib/store');

let win = null;
let watcher = null;
let debounce = null;
let lastSerialized = '';
let updater = null;
let updateState = 'idle';

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
    version: app.getVersion(),
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
      if (name && name !== store.FILE_NAME && !/conflict|conflit/i.test(name)) return; /* .bak et sauvegardes ignorés */
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

/* Mises à jour : les Releases GitHub du dépôt (comme AGOA PV). */
function initUpdater() {
  if (!app.isPackaged) return;
  try {
    updater = require('electron-updater').autoUpdater;
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.on('update-downloaded', (info) => {
      updateState = 'ready';
      dialog
        .showMessageBox(win, {
          type: 'info',
          buttons: ['Redémarrer maintenant', 'Plus tard'],
          defaultId: 0,
          cancelId: 1,
          title: 'Mise à jour AGOA CG',
          message: 'La version ' + info.version + ' est prête.',
          detail: 'Redémarrez pour l’installer, ou continuez : elle s’installera à la fermeture.',
        })
        .then((r) => {
          if (r.response === 0) updater.quitAndInstall(false, true);
        });
    });
    updater.on('error', (err) => {
      console.warn('Mise à jour :', err && err.message);
      if (updateState === 'checking') updateState = 'idle';
    });
    updater.checkForUpdates().catch(() => {});
  } catch (e) {
    console.warn(e);
    updater = null;
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

ipcMain.handle('data:load', () => {
  const folder = readSettings().folder;
  const data = store.load(folder);
  try {
    store.dailySnapshot(folder, data, Date.now());
  } catch (e) {
    /* la sauvegarde du jour ne doit pas empêcher l'ouverture */
  }
  return remember(data);
});

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

ipcMain.handle('update:check', async () => {
  if (!app.isPackaged || !updater) return 'Disponible uniquement dans la version installée.';
  if (updateState === 'ready') return 'Une nouvelle version est prête : elle s’installera à la fermeture.';
  try {
    updateState = 'checking';
    const r = await updater.checkForUpdates();
    updateState = 'idle';
    const v = r && r.updateInfo && r.updateInfo.version;
    if (!r || !r.isUpdateAvailable || !v || v === app.getVersion()) return 'À jour (version ' + app.getVersion() + ').';
    return 'Version ' + v + ' disponible : téléchargement en cours.';
  } catch (e) {
    updateState = 'idle';
    return 'GitHub injoignable : vérifiez la connexion Internet.';
  }
});

ipcMain.handle('backup:now', () => {
  const folder = readSettings().folder;
  return { name: store.manualSnapshot(folder, store.load(folder), Date.now()), folder: store.backupDir(folder) };
});

ipcMain.handle('backup:restore', async () => {
  const folder = readSettings().folder;
  fs.mkdirSync(store.backupDir(folder), { recursive: true });
  const r = await dialog.showOpenDialog(win, {
    title: 'Choisir une sauvegarde à restaurer',
    defaultPath: store.backupDir(folder),
    filters: [{ name: 'Sauvegarde AGOA CG', extensions: ['json', 'bak'] }],
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  let backup;
  try {
    backup = store.readFile(r.filePaths[0]);
  } catch (e) {
    throw new Error('Ce fichier n’est pas une sauvegarde valide.');
  }
  const live = (list) => list.filter((x) => !x.deleted).length;
  const c = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Restaurer', 'Annuler'],
    defaultId: 1,
    cancelId: 1,
    title: 'Restaurer une sauvegarde',
    message: 'Remplacer le calendrier actuel par cette sauvegarde ?',
    detail:
      path.basename(r.filePaths[0]) + ' contient ' + live(backup.people) + ' collaborateur(s), ' + live(backup.leaves) +
      ' absence(s) et ' + live(backup.closures) + ' jour(s) férié(s) ajouté(s).\n\nLe calendrier actuel est d’abord sauvegardé dans le dossier « sauvegardes » : vous pourrez le restaurer ensuite.',
  });
  if (c.response !== 0) return null;
  const out = store.restore(folder, backup, Date.now());
  remember(out.data);
  return { data: out.data, name: path.basename(r.filePaths[0]) };
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
    initUpdater();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => app.quit());
}
