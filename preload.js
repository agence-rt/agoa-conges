'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agoaApi', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  load: () => ipcRenderer.invoke('data:load'),
  save: (patch) => ipcRenderer.invoke('data:save', patch),
  chooseFolder: () => ipcRenderer.invoke('settings:chooseFolder'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  showFolder: () => ipcRenderer.invoke('shell:showFolder'),
  saveText: (name, text) => ipcRenderer.invoke('file:saveText', name, text),
  onChange: (cb) => {
    ipcRenderer.on('data:changed', (_e, data) => cb(data));
  },
});
