const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, screen, shell, Notification, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const store = require('./store');

const APP_NAME = 'Elfar Notes';
const CREDIT = 'Mamdouh Elfar';
const FEEDBACK_EMAIL = 'mamdouhelfar@gmail.com';
const QUICK_ADD_KEYS = ['CommandOrControl+Alt+Space', 'CommandOrControl+Shift+Space', 'CommandOrControl+Alt+N'];
let quickKeyInUse = null;
const prettyKey = (k) => (k || '').replace('CommandOrControl', 'Ctrl');

// Keep the data folder stable under the new name, and bring over data saved under the old name.
app.setName(APP_NAME);
const USER_DIR = path.join(app.getPath('appData'), APP_NAME);
app.setPath('userData', USER_DIR);
(function migrateOldName() {
  const oldDir = path.join(app.getPath('appData'), 'Desktop Notes');
  try {
    if (!fs.existsSync(path.join(USER_DIR, 'data.json')) && fs.existsSync(path.join(oldDir, 'data.json'))) {
      fs.mkdirSync(USER_DIR, { recursive: true });
      for (const f of ['data.json', 'data.json.bak']) {
        if (fs.existsSync(path.join(oldDir, f))) fs.copyFileSync(path.join(oldDir, f), path.join(USER_DIR, f));
      }
    }
  } catch { /* first run on a clean machine */ }
})();

// Links inside notes open in the default browser, never inside the app.
app.on('web-contents-created', (e, wc) => {
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (ev, url) => { if (!url.startsWith('file:')) ev.preventDefault(); });
});

let mainWin = null;
let widgetWin = null;
let quickWin = null;
let tray = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showMain());

const ar = () => store.get().settings.lang === 'ar';

// ---------- icon: the Elfar mouse (assets/icon.png, made by tools/make-icon.js) ----------
const ICON_FILE = path.join(__dirname, 'assets', 'icon.png');
function makeIcon(size) {
  const img = nativeImage.createFromPath(ICON_FILE);
  if (!img.isEmpty()) return img.resize({ width: size, height: size, quality: 'best' });
  return drawFallbackIcon(size);
}
// Fallback if the image file is missing: a simple drawn check mark.
function drawFallbackIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const r = size * 0.18;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = Math.min(Math.max(x + 0.5, r), size - r);
      const cy = Math.min(Math.max(y + 0.5, r), size - r);
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r) continue;
      const u = (x + 0.5) / size, v = (y + 0.5) / size;
      const onCheck = Math.min(distSeg(u, v, 0.26, 0.52, 0.43, 0.68), distSeg(u, v, 0.43, 0.68, 0.75, 0.33)) < 0.075;
      if (onCheck) { buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255; }
      else { buf[i] = 0xDD; buf[i + 1] = 0x8A; buf[i + 2] = 0x37; }
      buf[i + 3] = 255;
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const webPrefs = { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false };
const applyZoom = (win) => win && !win.isDestroyed() && win.webContents.setZoomFactor(store.get().settings.zoom || 1);

// ---------- main window ----------
function createMain() {
  const b = store.get().settings.mainBounds || {};
  mainWin = new BrowserWindow({
    width: b.width || 1280, height: b.height || 800, x: b.x, y: b.y,
    minWidth: 720, minHeight: 560, title: APP_NAME, icon: makeIcon(64),
    autoHideMenuBar: true, show: false, webPreferences: webPrefs
  });
  mainWin.removeMenu();
  mainWin.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWin.webContents.on('did-finish-load', () => applyZoom(mainWin));
  mainWin.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) mainWin.show(); });
  const saveBounds = () => {
    if (!mainWin || mainWin.isMinimized() || mainWin.isMaximized()) return;
    store.updateSettings({ mainBounds: mainWin.getBounds() });
  };
  mainWin.on('resize', saveBounds);
  mainWin.on('move', saveBounds);
  mainWin.on('close', (e) => {
    // Closing the main window keeps the app (and widget) alive in the tray.
    if (!quitting) { e.preventDefault(); mainWin.hide(); }
  });
}

function showMain(taskId) {
  if (!mainWin) createMain();
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
  if (taskId) mainWin.webContents.send('open-task', taskId);
}

// ---------- widget ----------
const INCH = 96; // ~1 inch from the top of the screen
const edgeOf = () => store.get().settings.widget.edge || 'off';
function widgetDisplay() {
  const id = store.get().settings.widget.display;
  return screen.getAllDisplays().find((d) => d.id === id) || screen.getPrimaryDisplay();
}

function createWidget() {
  if (widgetWin) { widgetWin.show(); return; }
  const w = store.get().settings.widget;
  const area = widgetDisplay().workArea;
  widgetWin = new BrowserWindow({
    width: w.width || 320, height: w.height || 420,
    x: w.x ?? area.x + area.width - 340, y: w.y ?? area.y + 20,
    minWidth: 240, minHeight: 180, frame: false, transparent: true, hasShadow: false, resizable: true,
    skipTaskbar: true, alwaysOnTop: true, title: `${APP_NAME} widget`, icon: makeIcon(64), webPreferences: webPrefs
  });
  widgetWin.setOpacity(w.opacity || 1);
  widgetWin.loadFile(path.join(__dirname, 'renderer', 'widget.html'));
  widgetWin.webContents.on('did-finish-load', () => applyZoom(widgetWin));
  const saveBounds = () => {
    // In edge mode the position is set by the app, not by you, so don't remember it.
    if (!widgetWin || edgeOf() !== 'off') return;
    store.updateSettings({ widget: { ...store.get().settings.widget, ...widgetWin.getBounds() } });
  };
  widgetWin.on('resize', saveBounds);
  widgetWin.on('move', saveBounds);
  widgetWin.on('closed', () => { widgetWin = null; stopHoverWatch(); });
  applyWidgetMode();
}

// Two modes: pinned (always on top, movable) or edge (tucked at the screen edge, slides out on hover).
function applyWidgetMode() {
  if (!widgetWin) return;
  const w = store.get().settings.widget;
  const area = widgetDisplay().workArea;
  widgetWin.setAlwaysOnTop(true, 'screen-saver'); // stays above Outlook, WhatsApp, etc.
  if (edgeOf() === 'off') {
    stopHoverWatch();
    widgetWin.setIgnoreMouseEvents(false);
    widgetWin.setResizable(true);
    if (widgetWin.__edge) {
      widgetWin.setBounds({ x: w.x ?? area.x + area.width - 340, y: w.y ?? area.y + 20, width: w.width || 320, height: w.height || 420 });
    }
  } else {
    const W = (w.width || 320) + 12, H = w.height || 420;
    widgetWin.setResizable(false);
    widgetWin.setBounds({ x: edgeOf() === 'right' ? area.x + area.width - W : area.x, y: area.y + INCH, width: W, height: H });
    // Tucked away: clicks pass through to the apps underneath until you hover the tab.
    widgetWin.setIgnoreMouseEvents(true, { forward: true });
  }
  widgetWin.__edge = edgeOf() !== 'off';
}

// While the edge widget is out, watch the real cursor position. Windows doesn't always tell a
// transparent window that the mouse left, which made it stick open; this never misses.
let hoverTimer = null, outsideSince = 0;
function startHoverWatch() {
  stopHoverWatch();
  hoverTimer = setInterval(() => {
    if (!widgetWin || edgeOf() === 'off') return stopHoverWatch();
    const p = screen.getCursorScreenPoint();
    const b = widgetWin.getBounds();
    const inside = p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
    if (inside) { outsideSince = 0; return; }
    if (!outsideSince) outsideSince = Date.now();
    if (Date.now() - outsideSince > 300) {
      stopHoverWatch();
      widgetWin.webContents.send('widget:collapse');
    }
  }, 100);
}
function stopHoverWatch() { clearInterval(hoverTimer); hoverTimer = null; outsideSince = 0; }

function setWidgetVisible(visible) {
  store.updateSettings({ widget: { ...store.get().settings.widget, visible } });
  if (visible) createWidget();
  else if (widgetWin) widgetWin.close();
  broadcast();
  refreshTray();
}

// ---------- quick add from anywhere (global hotkey) ----------
function showQuickAdd() {
  if (quickWin) { quickWin.show(); quickWin.focus(); quickWin.webContents.send('quick:reset'); return; }
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  quickWin = new BrowserWindow({
    width: 520, height: 260, x: Math.round(area.x + (area.width - 520) / 2), y: Math.round(area.y + area.height * 0.22),
    frame: false, transparent: true, hasShadow: false, resizable: false, skipTaskbar: true, alwaysOnTop: true, show: false,
    title: `${APP_NAME} quick add`, webPreferences: webPrefs
  });
  quickWin.setAlwaysOnTop(true, 'screen-saver');
  quickWin.loadFile(path.join(__dirname, 'renderer', 'quick.html'));
  quickWin.webContents.on('did-finish-load', () => applyZoom(quickWin));
  quickWin.once('ready-to-show', () => { quickWin.show(); quickWin.focus(); });
  quickWin.on('blur', () => quickWin && quickWin.hide());
  quickWin.on('closed', () => { quickWin = null; });
}

function broadcast(except) {
  const data = store.get();
  for (const w of [mainWin, widgetWin, quickWin]) {
    if (w && !w.isDestroyed() && w.webContents !== except) w.webContents.send('data-changed', data);
  }
}

// ---------- tray ----------
function refreshTray() {
  if (!tray) return;
  const wv = !!store.get().settings.widget.visible;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: ar() ? 'فتح التطبيق' : 'Open app', click: () => showMain() },
    { label: (ar() ? 'إضافة سريعة' : 'Quick add') + (quickKeyInUse ? '   ' + prettyKey(quickKeyInUse) : ''), click: showQuickAdd },
    { label: ar() ? 'الويدجت على سطح المكتب' : 'Desktop widget', type: 'checkbox', checked: wv, click: () => setWidgetVisible(!wv) },
    { type: 'separator' },
    { label: ar() ? 'خروج' : 'Quit', click: () => { quitting = true; app.quit(); } }
  ]));
}

// ---------- reminders, morning summary, follow-up nudges ----------
function localNow(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function notify(title, body, onClick) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: makeIcon(64) });
  n.on('click', onClick || (() => showMain()));
  n.show();
}

// Every 30 s: due reminders (once each) and, once a day, the morning summary.
function tick() {
  const data = store.get();
  const now = localNow();
  let changed = false;
  for (const t of data.tasks) {
    if (t.closure || !t.remindAt || t.remindAt > now || t.reminded === t.remindAt) continue;
    t.reminded = t.remindAt;
    changed = true;
    const bits = [];
    if (t.due) bits.push((ar() ? 'الـ Due: ' : 'Due: ') + t.due);
    if ((t.subtasks || []).length) bits.push(`${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}`);
    if (t.pinnedNote) bits.unshift('📌 ' + t.pinnedNote);
    notify((ar() ? '🔔 تذكير: ' : '🔔 Reminder: ') + t.title, bits.join(' · ') || (ar() ? 'اضغط لفتح التاسك' : 'Click to open the task'), () => showMain(t.id));
  }
  const s = data.settings.summary;
  const today = now.slice(0, 10);
  if (s.enabled && now.slice(11) >= s.time && data.settings.lastSummary !== today) {
    data.settings.lastSummary = today;
    changed = true;
    morningSummary(data, today);
  }
  if (changed) { store.replace(data); broadcast(); }
}

function morningSummary(data, today) {
  const open = data.tasks.filter((t) => !t.closure);
  const overdue = open.filter((t) => t.due && t.due < today).length;
  const dueToday = open.filter((t) => t.due === today).length;
  const doNow = open.filter((t) => t.priority === 'q1').length;
  const days = data.settings.nudgeDays || 3;
  const ms = 86400000;
  // People holding tasks for longer than the nudge limit.
  const stale = [];
  for (const t of open) for (const pw of t.pendingWith || []) {
    const p = data.people.find((x) => x.id === pw.personId);
    const d = Math.floor((new Date(today) - new Date(pw.since || today)) / ms);
    if (p && d >= days) stale.push(`${p.name} (${d}${ar() ? 'ي' : 'd'}): ${t.title}`);
  }
  if (!overdue && !dueToday && !doNow && !stale.length) return;
  const lines = ar()
    ? [`متأخرة: ${overdue} · النهارده: ${dueToday} · اعملها دلوقتي: ${doNow}`]
    : [`Overdue: ${overdue} · Due today: ${dueToday} · Do it now: ${doNow}`];
  if (stale.length) lines.push((ar() ? 'محتاجة متابعة: ' : 'Follow up: ') + stale.slice(0, 3).join(' | ') + (stale.length > 3 ? ` +${stale.length - 3}` : ''));
  notify(ar() ? '☀ صباح الخير: ملخص النهارده' : '☀ Good morning: today at a glance', lines.join('\n'));
}

// ---------- auto-update (only in the installed app) ----------
let updateState = { status: 'idle' };
function setupAutoUpdate() {
  if (!app.isPackaged) { updateState = { status: 'dev' }; return; }
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch { return; }
  autoUpdater.autoDownload = true;
  const send = (s) => { updateState = s; mainWin && mainWin.webContents.send('update-status', s); };
  autoUpdater.on('checking-for-update', () => send({ status: 'checking' }));
  autoUpdater.on('update-not-available', () => send({ status: 'latest' }));
  autoUpdater.on('update-available', (i) => send({ status: 'downloading', version: i.version }));
  autoUpdater.on('update-downloaded', (i) => {
    send({ status: 'ready', version: i.version });
    notify(ar() ? `تحديث جديد جاهز (${i.version})` : `Update ready (${i.version})`, ar() ? 'هيتسطب لما تقفل البرنامج، أو من الإعدادات دلوقتي.' : 'It installs when you quit, or from Settings now.');
  });
  autoUpdater.on('error', () => send({ status: 'error' }));
  const check = () => autoUpdater.checkForUpdates().catch(() => send({ status: 'error' }));
  setTimeout(check, 10000);
  setInterval(check, 6 * 3600 * 1000);
  ipcMain.handle('app:install-update', () => { quitting = true; autoUpdater.quitAndInstall(); });
  ipcMain.handle('app:check-update', () => check());
}

// ---------- IPC ----------
ipcMain.handle('data:get', () => store.get());
ipcMain.handle('data:save', (e, data) => {
  // Window positions are owned by the main process; don't let a stale renderer copy overwrite them.
  const cur = store.get().settings;
  const { x, y, width, height } = cur.widget;
  data.settings = { ...data.settings, mainBounds: cur.mainBounds, lastSummary: cur.lastSummary, widget: { ...data.settings.widget, x, y, width, height } };
  // Keep "already notified" flags even if the window sent an older copy.
  const prev = new Map(store.get().tasks.map((t) => [t.id, t]));
  for (const t of data.tasks || []) {
    const o = prev.get(t.id);
    if (o && o.reminded && o.reminded === t.remindAt && !t.reminded) t.reminded = o.reminded;
  }
  const before = `${edgeOf()}|${cur.widget.display}`;
  const zoomBefore = cur.zoom;
  store.replace(data);
  broadcast(e.sender);
  refreshTray();
  const w = store.get().settings.widget;
  if (widgetWin && `${edgeOf()}|${w.display}` !== before) applyWidgetMode();
  if (widgetWin) widgetWin.setOpacity(w.opacity || 1);
  if (w.visible && !widgetWin) createWidget();
  if (!w.visible && widgetWin) widgetWin.close();
  if (store.get().settings.zoom !== zoomBefore) [mainWin, widgetWin, quickWin].forEach(applyZoom);
  return true;
});
ipcMain.handle('widget:set-visible', (e, v) => setWidgetVisible(v));
ipcMain.on('widget:ignore-mouse', (e, ignore) => {
  if (!widgetWin || edgeOf() === 'off') return;
  widgetWin.setIgnoreMouseEvents(!!ignore, { forward: true });
  if (ignore) stopHoverWatch(); else startHoverWatch();
});
ipcMain.handle('main:open-task', (e, id) => showMain(id));
ipcMain.handle('quick:add', (e, task) => {
  const data = store.get();
  data.tasks.push(task);
  store.replace(data);
  broadcast();
  if (quickWin) quickWin.hide();
  return true;
});
ipcMain.handle('quick:close', () => quickWin && quickWin.hide());

ipcMain.handle('app:info', () => ({ version: app.getVersion(), name: APP_NAME, credit: CREDIT, email: FEEDBACK_EMAIL, quickKey: prettyKey(quickKeyInUse), update: updateState }));
ipcMain.handle('app:feedback', () => {
  const subject = `${APP_NAME} feedback (v${app.getVersion()})`;
  const body = `\n\n\n---\nApp version: ${app.getVersion()}\nWindows: ${os.release()}\nLanguage: ${store.get().settings.lang}`;
  shell.openExternal(`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
});
ipcMain.handle('app:login-item', (e, enabled) => {
  // In dev (npm start) Electron itself must be told which app folder to open.
  const args = app.isPackaged ? ['--hidden'] : [app.getAppPath(), '--hidden'];
  if (typeof enabled === 'boolean') app.setLoginItemSettings({ openAtLogin: enabled, args });
  return app.getLoginItemSettings({ args }).openAtLogin;
});
ipcMain.handle('app:displays', () => screen.getAllDisplays().map((d, i) => ({
  id: d.id, label: `${i + 1}: ${d.size.width}×${d.size.height}${d.id === screen.getPrimaryDisplay().id ? ' ★' : ''}`
})));

// Data: export / import / CSV / backups / sync folder
const stamp = () => new Date().toISOString().slice(0, 10);
ipcMain.handle('data:export', async () => {
  const r = await dialog.showSaveDialog(mainWin, { defaultPath: `elfar-notes-backup-${stamp()}.json`, filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return false;
  store.exportTo(r.filePath);
  return true;
});
ipcMain.handle('data:import', async () => {
  const r = await dialog.showOpenDialog(mainWin, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths[0]) return false;
  store.importFrom(r.filePaths[0]);
  broadcast();
  return true;
});
ipcMain.handle('data:export-csv', async (e, csv, name) => {
  const r = await dialog.showSaveDialog(mainWin, { defaultPath: `${name || 'elfar-notes'}-${stamp()}.csv`, filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }] });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, '﻿' + csv, 'utf8'); // BOM so Excel reads Arabic correctly
  return true;
});
ipcMain.handle('backup:list', () => store.listBackups());
ipcMain.handle('backup:open-folder', () => shell.openPath(store.backupsDir()));
ipcMain.handle('backup:restore', (e, file) => { store.importFrom(file); broadcast(); return true; });
ipcMain.handle('data:folder', () => store.dataDir());
ipcMain.handle('data:choose-folder', async () => {
  const r = await dialog.showOpenDialog(mainWin, { properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const dir = r.filePaths[0];
  let useExisting = false;
  if (store.hasDataIn(dir)) {
    const c = await dialog.showMessageBox(mainWin, {
      type: 'question',
      buttons: ar() ? ['استخدم البيانات اللي هناك', 'استبدلها ببياناتي', 'إلغاء'] : ['Use the data there', 'Replace it with mine', 'Cancel'],
      defaultId: 0, cancelId: 2,
      message: ar() ? 'الفولدر ده فيه بيانات بالفعل (غالباً من جهاز تاني).' : 'This folder already has data (probably from another computer).'
    });
    if (c.response === 2) return null;
    useExisting = c.response === 0;
  }
  store.moveTo(dir, useExisting);
  broadcast();
  return store.dataDir();
});

// Files attached to tasks
ipcMain.handle('file:pick', async () => {
  const r = await dialog.showOpenDialog(mainWin, { properties: ['openFile', 'multiSelections'] });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('file:open', (e, p) => (/^https?:\/\//.test(p) ? shell.openExternal(p) : shell.openPath(p)));
ipcMain.handle('file:reveal', (e, p) => shell.showItemInFolder(p));

// ---------- lifecycle ----------
app.whenReady().then(() => {
  app.setAppUserModelId('com.elfar.notes');
  // First run follows the Windows language.
  const lang = (app.getLocale() || '').startsWith('ar') ? 'ar' : 'en';
  store.init(USER_DIR, { lang, onExternalChange: () => broadcast() });
  createMain();
  if (store.get().settings.widget.visible) createWidget();
  tray = new Tray(makeIcon(32));
  tray.setToolTip(APP_NAME);
  tray.on('click', () => showMain());
  refreshTray();
  // If another program already owns the first combo, fall back to the next one.
  quickKeyInUse = QUICK_ADD_KEYS.find((k) => { try { return globalShortcut.register(k, showQuickAdd); } catch { return false; } }) || null;
  console.log('[quick-add hotkey]', quickKeyInUse || 'none available');
  setTimeout(tick, 5000);
  setInterval(tick, 30000);
  setupAutoUpdate();
});

app.on('before-quit', () => { quitting = true; store.flush(); });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { /* stay in tray */ });
