const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getData: () => ipcRenderer.invoke('data:get'),
  saveData: (d) => ipcRenderer.invoke('data:save', d),
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  exportCsv: (csv, name) => ipcRenderer.invoke('data:export-csv', csv, name),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  openBackups: () => ipcRenderer.invoke('backup:open-folder'),
  restoreBackup: (file) => ipcRenderer.invoke('backup:restore', file),
  dataFolder: () => ipcRenderer.invoke('data:folder'),
  chooseDataFolder: () => ipcRenderer.invoke('data:choose-folder'),

  setWidgetVisible: (v) => ipcRenderer.invoke('widget:set-visible', v),
  widgetIgnoreMouse: (ignore) => ipcRenderer.send('widget:ignore-mouse', ignore),
  onWidgetCollapse: (cb) => ipcRenderer.on('widget:collapse', () => cb()),
  displays: () => ipcRenderer.invoke('app:displays'),

  openTask: (id) => ipcRenderer.invoke('main:open-task', id),
  quickAdd: (task) => ipcRenderer.invoke('quick:add', task),
  quickClose: () => ipcRenderer.invoke('quick:close'),
  onQuickReset: (cb) => ipcRenderer.on('quick:reset', () => cb()),

  pickFiles: () => ipcRenderer.invoke('file:pick'),
  openFile: (p) => ipcRenderer.invoke('file:open', p),
  revealFile: (p) => ipcRenderer.invoke('file:reveal', p),
  // Real path of a file dropped from Explorer.
  pathForFile: (f) => webUtils.getPathForFile(f),

  loginItem: (enabled) => ipcRenderer.invoke('app:login-item', enabled),
  appInfo: () => ipcRenderer.invoke('app:info'),
  sendFeedback: () => ipcRenderer.invoke('app:feedback'),
  checkUpdate: () => ipcRenderer.invoke('app:check-update'),
  installUpdate: () => ipcRenderer.invoke('app:install-update'),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (e, s) => cb(s)),

  onDataChanged: (cb) => ipcRenderer.on('data-changed', (e, d) => cb(d)),
  onOpenTask: (cb) => ipcRenderer.on('open-task', (e, id) => cb(id))
});
