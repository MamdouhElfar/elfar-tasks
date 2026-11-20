const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getData: () => ipcRenderer.invoke('data:get'),
  saveData: (d) => ipcRenderer.invoke('data:save', d),
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  pickCopy: () => ipcRenderer.invoke('data:pick-copy'),
  exportCsv: (csv, name) => ipcRenderer.invoke('data:export-csv', csv, name),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  openBackups: () => ipcRenderer.invoke('backup:open-folder'),
  restoreBackup: (file) => ipcRenderer.invoke('backup:restore', file),
  dataFolder: () => ipcRenderer.invoke('data:folder'),
  chooseDataFolder: () => ipcRenderer.invoke('data:choose-folder'),

  setWidgetVisible: (v) => ipcRenderer.invoke('widget:set-visible', v),
  widgetIgnoreMouse: (ignore) => ipcRenderer.send('widget:ignore-mouse', ignore),
  tailDrag: (phase) => ipcRenderer.send('widget:tail-drag', phase),
  onWidgetDock: (cb) => ipcRenderer.on('widget:dock', (e, edge) => cb(edge)),
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
  openGithub: (kind) => ipcRenderer.invoke('app:github', kind),
  checkUpdate: () => ipcRenderer.invoke('app:check-update'),
  installUpdate: () => ipcRenderer.invoke('app:install-update'),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (e, s) => cb(s)),

  onRemindList: (cb) => ipcRenderer.on('remind:list', (e, s) => cb(s)),
  remindAction: (a) => ipcRenderer.send('remind:action', a),
  focus: (what, taskId, extra) => ipcRenderer.invoke('focus:action', what, taskId, extra),
  testReminder: () => ipcRenderer.send('remind:test'),
  onCloseTask: (cb) => ipcRenderer.on('task:close', (e, id) => cb(id)),

  onDataChanged: (cb) => ipcRenderer.on('data-changed', (e, d) => cb(d)),
  onOpenReview: (cb) => ipcRenderer.on('review:open', () => cb()),
  onOpenTask: (cb) => ipcRenderer.on('open-task', (e, id) => cb(id))
});
