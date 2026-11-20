const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, screen, shell, Notification, globalShortcut, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const store = require('./store');
const logic = require('./renderer/logic.js');

// ---------- error log ----------
// Errors from any window or from here go to <data folder>/logs/errors.log (kept under ~300 KB).
const LOG_DIR = path.join(process.env.ELFAR_DATA_DIR || path.join(app.getPath('appData'), 'Elfar Tasks'), 'logs');
function logError(where, msg) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const f = path.join(LOG_DIR, 'errors.log');
    if (fs.existsSync(f) && fs.statSync(f).size > 300 * 1024) { const keep = fs.readFileSync(f, 'utf8').slice(-150 * 1024); fs.writeFileSync(f, keep); }
    fs.appendFileSync(f, `${new Date().toISOString()} [${where}] v${app.getVersion()} ${msg}
`);
  } catch { /* never let logging break the app */ }
}
process.on('uncaughtException', (err) => logError('main', err && err.stack || err));
process.on('unhandledRejection', (err) => logError('main', err && err.stack || err));
logic.configure({ weekStart: () => store.get().settings.weekStart });

const APP_NAME = 'Elfar Tasks';
const CREDIT = 'Mamdouh Elfar';
const REPO_URL = 'https://github.com/MamdouhElfar/elfar-tasks';
const QUICK_ADD_KEYS = ['CommandOrControl+Alt+Space', 'CommandOrControl+Shift+Space', 'CommandOrControl+Alt+N'];
let quickKeyInUse = null;
const prettyKey = (k) => (k || '').replace('CommandOrControl', 'Ctrl');

// Keep the data folder stable under the new name, and bring over data saved under the old name.
app.setName(APP_NAME);
// ELFAR_DATA_DIR: for test runs only — a separate data folder, so a test copy can run next to
// the real app without touching its data.
const USER_DIR = process.env.ELFAR_DATA_DIR || path.join(app.getPath('appData'), APP_NAME);
app.setPath('userData', USER_DIR);
// The app was called "Elfar Notes" (and "Desktop Notes" before that). The newest old folder
// that has data is copied over once: tasks, backups, and config.json (which may point at a
// OneDrive data folder). The old folder is left in place as a fallback.
(function migrateOldName() {
  const has = (dir) => fs.existsSync(path.join(dir, 'data.json')) || fs.existsSync(path.join(dir, 'config.json'));
  try {
    if (has(USER_DIR) || process.env.ELFAR_DATA_DIR) return;
    const oldDir = ['Elfar Notes', 'Desktop Notes'].map((n) => path.join(app.getPath('appData'), n)).find(has);
    if (!oldDir) return;
    fs.mkdirSync(USER_DIR, { recursive: true });
    for (const f of ['data.json', 'data.json.bak', 'config.json']) {
      if (fs.existsSync(path.join(oldDir, f))) fs.copyFileSync(path.join(oldDir, f), path.join(USER_DIR, f));
    }
    if (fs.existsSync(path.join(oldDir, 'backups'))) fs.cpSync(path.join(oldDir, 'backups'), path.join(USER_DIR, 'backups'), { recursive: true });
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
    widgetWin.setResizable(false);
    widgetWin.setBounds(edgeBounds(edgeOf(), area, w.edgeOffset));
    // Tucked away: clicks pass through to the apps underneath until you hover the tab.
    widgetWin.setIgnoreMouseEvents(true, { forward: true });
  }
  widgetWin.__edge = edgeOf() !== 'off';
}

// Where the tucked-away widget sits. Sides: offset = distance from the top of the screen.
// Top: offset = distance from the left. No offset yet = about an inch down / near the right.
function edgeBounds(edge, area, offset) {
  const w = store.get().settings.widget;
  const clamp = (v, max) => Math.round(Math.max(0, Math.min(max, v)));
  if (edge === 'top') {
    const W = w.width || 320, H = (w.height || 420) + 6;
    return { x: area.x + clamp(offset ?? area.width - W - 40, area.width - W), y: area.y, width: W, height: H };
  }
  const W = (w.width || 320) + 12, H = w.height || 420;
  return { x: edge === 'right' ? area.x + area.width - W : area.x, y: area.y + clamp(offset ?? INCH, area.height - H), width: W, height: H };
}

// Drag the mouse by its tail: it follows the cursor along the edge, and docks to whichever
// edge is nearest (top of the screen, or the left / right half). Saved when you let go.
let tailDrag = null;
function tailDragTick() {
  if (!tailDrag || !widgetWin) return;
  if (Date.now() > tailDrag.until) return endTailDrag();
  const p = screen.getCursorScreenPoint();
  const disp = screen.getDisplayNearestPoint(p);
  const area = disp.workArea;
  const w = store.get().settings.widget;
  const edge = p.y - area.y < 70 ? 'top' : p.x < area.x + area.width / 2 ? 'left' : 'right';
  if (edge !== tailDrag.edge) { tailDrag.edge = edge; widgetWin.webContents.send('widget:dock', edge); }
  const offset = edge === 'top'
    ? p.x - area.x - (w.width || 320) / 2
    : p.y - area.y - (tailDrag.startEdge === edge ? tailDrag.grabY : 110);
  const b = edgeBounds(edge, area, offset);
  tailDrag.offset = edge === 'top' ? b.x - area.x : b.y - area.y;
  tailDrag.display = disp.id;
  widgetWin.setBounds(b);
}
function endTailDrag() {
  if (!tailDrag) return;
  clearInterval(tailDrag.timer);
  const { edge, offset, display, moved } = tailDrag;
  tailDrag = null;
  if (!moved) return;
  store.updateSettings({ widget: { ...store.get().settings.widget, edge, lastEdge: edge, edgeOffset: offset, display } });
  broadcast();
}
ipcMain.on('widget:tail-drag', (e, phase) => {
  if (!widgetWin || edgeOf() === 'off') return;
  if (phase === 'start') {
    stopHoverWatch();
    const p = screen.getCursorScreenPoint(), b = widgetWin.getBounds();
    tailDrag = { grabY: p.y - b.y, startEdge: edgeOf(), edge: edgeOf(), offset: null, display: widgetDisplay().id, moved: false, until: Date.now() + 60000, start: p };
    tailDrag.timer = setInterval(() => {
      if (!tailDrag) return;
      const q = screen.getCursorScreenPoint();
      if (!tailDrag.moved && Math.abs(q.x - tailDrag.start.x) + Math.abs(q.y - tailDrag.start.y) < 4) return;
      tailDrag.moved = true;
      tailDragTick();
    }, 16);
  } else endTailDrag();
});

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
let cursorTimer = null, cursorNear = false;
function startCursorWatch() {
  if (cursorTimer) return;
  cursorTimer = setInterval(() => {
    if (!widgetWin || widgetWin.isDestroyed()) { clearInterval(cursorTimer); cursorTimer = null; return; }
    if (edgeOf() === 'off' || hoverTimer || tailDrag) return;
    const p = screen.getCursorScreenPoint(), b = widgetWin.getBounds();
    const gap = Math.max(b.x - p.x, p.x - (b.x + b.width), b.y - p.y, p.y - (b.y + b.height), 0);
    const z = widgetWin.webContents.getZoomFactor() || 1;
    if (gap < 260) { cursorNear = true; widgetWin.webContents.send('widget:cursor', { x: (p.x - b.x) / z, y: (p.y - b.y) / z }); }
    else if (cursorNear) { cursorNear = false; widgetWin.webContents.send('widget:cursor', null); }
  }, 80);
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
    { label: ar() ? 'بلّغ عن مشكلة / اقترح فكرة' : 'Report a problem / suggest', click: () => openGithub('list') },
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
    if ((data.settings.remindStyle || 'mouse') === 'mouse') showReminder(t);
    else notify((ar() ? '🔔 تذكير: ' : '🔔 Reminder: ') + t.title, bits.join(' · ') || (ar() ? 'اضغط لفتح التاسك' : 'Click to open the task'), () => showMain(t.id));
  }
  const today = now.slice(0, 10);
  for (const h of data.habits || []) {
    if (!h.time || h.archived || h.remindedOn === today || now.slice(11) < h.time || !habitDueToday(h, today)) continue;
    h.remindedOn = today;
    changed = true;
    if ((data.settings.remindStyle || 'mouse') === 'mouse') {
      remindQueue.push({ id: 'habitr:' + h.id, kind: 'habit', title: `${h.emoji ? h.emoji + ' ' : ''}${h.name}`, duration: h.duration || null, mins: h.kind === 'minutes' });
      openRemindWin();
    } else notify((ar() ? '🔁 وقت ' : '🔁 Time for ') + h.name, ar() ? 'افتح عاداتي' : 'Open Habits', () => showMain());
  }
  const rv = { enabled: true, time: '17:00', ...(data.settings.review || {}) };
  if (rv.enabled && now.slice(11) >= rv.time && data.settings.lastReview !== today) {
    data.settings.lastReview = today;
    changed = true;
    const busy = data.tasks.some((t) => t.closure === today || (!t.closure && t.due && t.due <= today)) || (data.plan && data.plan.date === today);
    if (busy) {
      if ((data.settings.remindStyle || 'mouse') === 'mouse') {
        const lastDay = new Date(today + 'T00:00').getDay() === (logic.appWeekStart() + 6) % 7;
        remindQueue.push({ id: 'review:' + today, kind: 'review', week: lastDay, title: ar() ? 'يومك قرب يخلص 🌙' : 'Your day is almost over 🌙', done: data.tasks.filter((t) => t.closure === today).length });
        openRemindWin();
      } else notify(ar() ? '🌙 راجع يومك' : '🌙 Review your day', ar() ? 'شوف خلصت إيه وانقل الباقي لبكرة' : 'See what got done and move the rest to tomorrow', openReviewInApp);
    }
  }
  const s = data.settings.summary;
  if (s.enabled && now.slice(11) >= s.time && data.settings.lastSummary !== today) {
    data.settings.lastSummary = today;
    changed = true;
    morningSummary(data, today);
  }
  if (changed) { store.replace(data); broadcast(); }
}

// ---------- reminder pop-up: a mouse with a bell in the corner of the screen ----------
// It doesn't take the keyboard focus, so it never interrupts typing. Several reminders queue up.
let remindWin = null;
const remindQueue = [];
function showReminder(t, test) {
  if (remindQueue.some((r) => r.id === t.id)) return;
  remindQueue.push({ id: t.id, title: t.title, due: t.due || null, dueTime: t.dueTime || null, pinnedNote: t.pinnedNote || '',
    subs: (t.subtasks || []).length ? `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}` : '', test: !!test });
  openRemindWin();
}
function sendRemindList() {
  const s = store.get().settings;
  if (remindWin && !remindWin.isDestroyed()) remindWin.webContents.send('remind:list', { items: remindQueue, lang: s.lang, sound: s.remindSound || 'chime' });
}
function openRemindWin() {
  if (remindWin && !remindWin.isDestroyed()) { sendRemindList(); remindWin.showInactive(); return; }
  const area = screen.getPrimaryDisplay().workArea;
  const W = 440, H = 240;
  remindWin = new BrowserWindow({
    width: W, height: H, x: area.x + area.width - W - 8, y: area.y + area.height - H - 8,
    frame: false, transparent: true, hasShadow: false, resizable: false, skipTaskbar: true, alwaysOnTop: true,
    focusable: false, show: false, title: `${APP_NAME} reminder`,
    webPreferences: { ...webPrefs, autoplayPolicy: 'no-user-gesture-required' }
  });
  remindWin.setAlwaysOnTop(true, 'screen-saver');
  remindWin.loadFile(path.join(__dirname, 'renderer', 'remind.html'));
  remindWin.webContents.on('did-finish-load', () => { sendRemindList(); remindWin.showInactive(); });
  remindWin.on('closed', () => { remindWin = null; });
}
// Is a habit due today and not done yet? (shared rule, see logic.js)
const habitDueToday = (h, today) => logic.habitStillDue(h, today);

// Show the app with the end-of-day review open.
function openReviewInApp(kind) {
  const send = () => mainWin.webContents.send('review:open', kind || 'day');
  if (!mainWin) { createMain(); mainWin.webContents.once('did-finish-load', () => setTimeout(send, 800)); return; }
  showMain(); send();
}
// Ask the app window to close a task (it also starts the next round of a repeating one).
function closeTaskInApp(id) {
  const send = () => mainWin.webContents.send('task:close', id);
  if (!mainWin) { createMain(); mainWin.webContents.once('did-finish-load', send); } else send();
}
ipcMain.on('remind:action', (e, { id, action, minutes, what }) => {
  // The end-of-focus pop-up: keep going, take a break, stop, or the task is done.
  if (String(id).startsWith('review:')) {
    const i = remindQueue.findIndex((r) => r.id === id);
    if (i >= 0) remindQueue.splice(i, 1);
    if (action === 'review') openReviewInApp();
    if (action === 'weekreview') openReviewInApp('week');
    if (remindQueue.length) sendRemindList(); else if (remindWin) remindWin.close();
    return;
  }
  if (String(id).startsWith('habitr:')) {
    const hid = id.slice(7);
    const i = remindQueue.findIndex((r) => r.id === id);
    if (i >= 0) remindQueue.splice(i, 1);
    if (remindQueue.length) sendRemindList(); else if (remindWin) remindWin.close();
    const data = store.get();
    const h = (data.habits || []).find((x) => x.id === hid);
    if (h && action === 'hdone') { h.log = h.log || {}; h.log[localNow().slice(0, 10)] = 'done'; store.replace(data); broadcast(); }
    if (h && action === 'hfocus') focusAction('start', 'habit:' + hid, { mins: h.duration || focusLen(data) });
    return;
  }
  if (String(id).startsWith('focus:')) {
    if (action === 'focus') focusAction(what, id.slice(6));
    else if (action === 'open') { dropFocusPopup(); showMain(id.slice(6)); }
    else dropFocusPopup();
    return;
  }
  const i = remindQueue.findIndex((r) => r.id === id);
  if (i >= 0) remindQueue.splice(i, 1);
  if (!String(id).startsWith('test-')) {
    if (action === 'open') showMain(id);
    if (action === 'done') closeTaskInApp(id);
    if (action === 'snooze') {
      const data = store.get();
      const t = data.tasks.find((x) => x.id === id);
      if (t) {
        t.remindBefore = null;
        t.remindAt = localNow(new Date(Date.now() + (minutes || 10) * 60000));
        delete t.reminded;
        store.replace(data); broadcast();
      }
    }
  }
  if (remindQueue.length) sendRemindList();
  else if (remindWin) remindWin.close();
});
ipcMain.on('remind:test', () => showReminder({ id: 'test-' + Date.now(), title: ar() ? 'كده هيبان التذكير 🐭' : 'This is how a reminder looks 🐭', due: localNow().slice(0, 10), dueTime: localNow().slice(11) }, true));

// ---------- focus mode ----------
// One focus session at a time, owned here so the app window, the widget and the pop-up agree.
// data.focus = { taskId, mode, mins, workedMs, runFrom }
//   mode 'work'  : a work session; runFrom = when it last started running (null = paused)
//   mode 'break' : a short break
//   mode 'ended' / 'breakEnded' : time is up, waiting for what's next
// The time worked is added to the task (task.focusMs) and to data.focusLog when a work session ends.
const focusLen = (data) => Number(data.settings.focusMins) || 25;
const breakLen = (data) => Number(data.settings.breakMins) || 5;
const focusWorked = (f) => (f.workedMs || 0) + (f.runFrom ? Date.now() - f.runFrom : 0);
// What a session is on: a task, or a habit ('habit:<id>'), shaped the same way for the pop-ups.
function focusSubject(data, id) {
  if (String(id).startsWith('habit:')) {
    const h = (data.habits || []).find((x) => x.id === id.slice(6));
    return h ? { id, habit: h, title: `${h.emoji ? h.emoji + ' ' : ''}${h.name}`, subtasks: [] } : null;
  }
  return data.tasks.find((x) => x.id === id) || null;
}
function focusCredit(data) {
  const f = data.focus;
  if (!f || f.mode !== 'work') return;
  const ms = Math.min(focusWorked(f), f.mins * 60000);
  const sub = focusSubject(data, f.taskId);
  if (ms < 30000 || !sub) return;
  if (sub.habit) {
    // Time on a habit counts toward it; once a day's session reaches its length, the day is done.
    logic.habitAddMinutes(sub.habit, localNow().slice(0, 10), ms / 60000);
  } else sub.focusMs = (sub.focusMs || 0) + ms;
  data.focusLog = (data.focusLog || []).concat({ taskId: f.taskId, areaId: sub.habit ? null : sub.areaId || null, at: localNow(new Date(Date.now() - ms)), ms }).slice(-1000);
}
const workSession = (data, taskId, mins) => ({ taskId, mode: 'work', mins: mins || focusLen(data), workedMs: 0, runFrom: Date.now() });
function focusAction(what, taskId, extra) {
  const data = store.get();
  const f = data.focus;
  const id = taskId || (f && f.taskId);
  dropFocusPopup();
  if (what === 'start') {
    focusCredit(data);
    // The length you just picked is remembered for next time (and for "another round").
    if (extra && extra.mins) data.settings.focusMins = extra.mins;
    data.focus = workSession(data, id, extra && extra.mins);
  }
  else if (what === 'pause' && f && f.runFrom) { f.workedMs = focusWorked(f); f.runFrom = null; }
  else if (what === 'resume' && f && !f.runFrom && (f.mode === 'work' || f.mode === 'break')) f.runFrom = Date.now();
  else if (what === 'add5' && f && (f.mode === 'work' || f.mode === 'break')) f.mins += 5;
  else if (what === 'more') { focusCredit(data); data.focus = workSession(data, id); }
  else if (what === 'break') { focusCredit(data); data.focus = { taskId: id, mode: 'break', mins: breakLen(data), workedMs: 0, runFrom: Date.now() }; }
  else if (what === 'stop') { focusCredit(data); data.focus = null; }
  else if (what === 'done') {
    focusCredit(data); data.focus = null;
    const sub = focusSubject(data, id);
    if (sub && sub.habit) { sub.habit.log = sub.habit.log || {}; sub.habit.log[localNow().slice(0, 10)] = 'done'; store.replace(data); broadcast(); return store.get(); }
    store.replace(data); broadcast(); closeTaskInApp(id); return store.get();
  }
  store.replace(data); broadcast();
  return store.get();
}
ipcMain.handle('focus:action', (e, what, taskId, extra) => focusAction(what, taskId, extra));

// Every 2 s: has the running session reached its end?
function focusTick() {
  const data = store.get();
  const f = data.focus;
  if (!f || !f.runFrom || !['work', 'break'].includes(f.mode)) return;
  if (focusWorked(f) < f.mins * 60000) return;
  const t = focusSubject(data, f.taskId);
  if (f.mode === 'work') { focusCredit(data); data.focus = { taskId: f.taskId, mode: 'ended', mins: f.mins }; }
  else data.focus = { taskId: f.taskId, mode: 'breakEnded', mins: f.mins };
  store.replace(data); broadcast();
  if (!t) return;
  if ((data.settings.remindStyle || 'mouse') === 'mouse') showFocusPopup(t, data.focus);
  else notify(f.mode === 'work' ? (ar() ? `⏱ خلصت ${f.mins} دقيقة تركيز` : `⏱ ${f.mins} minutes of focus done`) : (ar() ? '☕ الاستراحة خلصت' : '☕ Break is over'), t.title, () => showMain(t.id));
}
function showFocusPopup(t, f) {
  dropFocusPopup();
  const next = (t.subtasks || []).find((s) => !s.done);
  remindQueue.unshift({ id: 'focus:' + t.id, kind: f.mode, taskId: t.id, title: t.title, habit: !!t.habit, mins: f.mins, next: next ? next.title : '',
    subs: (t.subtasks || []).length ? `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}` : '' });
  openRemindWin();
}
function dropFocusPopup() {
  const i = remindQueue.findIndex((r) => String(r.id).startsWith('focus:'));
  if (i < 0) return;
  remindQueue.splice(i, 1);
  if (remindQueue.length) sendRemindList();
  else if (remindWin) remindWin.close();
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
  // An update that's already downloaded stays ready while we keep looking for a newer one;
  // if a newer one shows up it's downloaded too, and "Restart and update" installs the newest.
  let downloaded = null;
  const readyOr = (s) => send(downloaded ? { status: 'ready', version: downloaded, checked: Date.now() } : s);
  autoUpdater.on('checking-for-update', () => readyOr({ status: 'checking' }));
  autoUpdater.on('update-not-available', () => readyOr({ status: 'latest', checked: Date.now() }));
  autoUpdater.on('update-available', (i) => send({ status: 'downloading', version: i.version, ready: downloaded }));
  autoUpdater.on('update-downloaded', (i) => {
    downloaded = i.version;
    send({ status: 'ready', version: i.version, checked: Date.now() });
    notify(ar() ? `تحديث جديد جاهز (${i.version})` : `Update ready (${i.version})`, ar() ? 'هيتسطب لما تقفل البرنامج، أو من الإعدادات دلوقتي.' : 'It installs when you quit, or from Settings now.');
  });
  autoUpdater.on('error', () => readyOr({ status: 'error' }));
  // The app stays open all day, so look often: every 30 min, and when you come back to a window.
  let lastCheck = 0;
  const check = () => {
    if (updateState?.status === 'downloading') return;
    lastCheck = Date.now();
    autoUpdater.checkForUpdates().catch(() => send({ status: 'error' }));
  };
  setTimeout(check, 10000);
  setInterval(check, 30 * 60 * 1000);
  app.on('browser-window-focus', () => { if (Date.now() - lastCheck > 10 * 60 * 1000) check(); });
  // Updates install quietly (no setup wizard: that's only for the first install, to pick a folder)
  // and the app opens again by itself when it's done.
  autoUpdater.autoInstallOnAppQuit = true;
  ipcMain.handle('app:install-update', () => { quitting = true; autoUpdater.quitAndInstall(true, true); });
  ipcMain.handle('app:check-update', () => check());
}

function applyTheme() {
  const m = store.get().settings.theme;
  nativeTheme.themeSource = ['light', 'dark'].includes(m) ? m : 'system';
}

// ---------- IPC ----------
ipcMain.handle('data:get', () => store.get());
ipcMain.on('log:error', (e, msg) => logError(BrowserWindow.fromWebContents(e.sender)?.getTitle() || 'window', msg));
ipcMain.handle('log:open', () => { fs.mkdirSync(LOG_DIR, { recursive: true }); const f = path.join(LOG_DIR, 'errors.log'); if (!fs.existsSync(f)) fs.writeFileSync(f, ''); shell.showItemInFolder(f); return true; });
// A window sent its changes (see makePatch in logic.js): apply them on the app's own copy.
ipcMain.handle('data:patch', (e, patch) => commitFromWindow(e, logic.applyPatch(JSON.parse(JSON.stringify(store.get())), patch)));
ipcMain.handle('data:save', (e, data) => commitFromWindow(e, data));
function commitFromWindow(e, data) {
  // Window positions are owned by the main process; don't let a stale renderer copy overwrite them.
  const cur = store.get().settings;
  const { x, y, width, height } = cur.widget;
  data.settings = { ...data.settings, mainBounds: cur.mainBounds, lastSummary: cur.lastSummary, lastReview: cur.lastReview, widget: { ...data.settings.widget, x, y, width, height } };
  // Keep "already notified" flags even if the window sent an older copy.
  const prev = new Map(store.get().tasks.map((t) => [t.id, t]));
  for (const t of data.tasks || []) {
    const o = prev.get(t.id);
    if (o && o.reminded && o.reminded === t.remindAt && !t.reminded) t.reminded = o.reminded;
  }
  const prevData = store.get();
  data.focus = prevData.focus || null;
  data.focusLog = prevData.focusLog || [];
  for (const t of data.tasks || []) {
    const o = prev.get(t.id);
    if (o && (o.focusMs || 0) > (t.focusMs || 0)) t.focusMs = o.focusMs;
  }
  const prevHabits = new Map((prevData.habits || []).map((h) => [h.id, h]));
  for (const h of data.habits || []) {
    const o = prevHabits.get(h.id);
    if (!o || !o.minutes) continue;
    h.minutes = h.minutes || {};
    for (const [d, m] of Object.entries(o.minutes)) if ((h.minutes[d] || 0) < m) h.minutes[d] = m;
  }
  // The task in focus was closed or deleted: the session ends with it.
  const ft = data.focus && focusSubject(data, data.focus.taskId);
  let focusEnded = false;
  if (data.focus && (!ft || ft.closure)) { focusCredit(data); data.focus = null; dropFocusPopup(); focusEnded = true; }
  const before = `${edgeOf()}|${cur.widget.display}`;
  const zoomBefore = cur.zoom;
  store.replace(data);
  broadcast(e.sender);
  if (focusEnded) e.sender.send('data-changed', store.get());
  applyTheme();
  refreshTray();
  const w = store.get().settings.widget;
  if (widgetWin && `${edgeOf()}|${w.display}` !== before) applyWidgetMode();
  if (widgetWin) widgetWin.setOpacity(w.opacity || 1);
  if (w.visible && !widgetWin) createWidget();
  if (!w.visible && widgetWin) widgetWin.close();
  if (store.get().settings.zoom !== zoomBefore) [mainWin, widgetWin, quickWin].forEach(applyZoom);
  return true;
}
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

ipcMain.handle('app:info', () => ({ version: app.getVersion(), name: APP_NAME, credit: CREDIT, quickKey: prettyKey(quickKeyInUse), update: updateState }));
// GitHub issue forms: the "version" field is filled in from the link.
function openGithub(kind) {
  const v = encodeURIComponent(app.getVersion());
  const url = kind === 'bug' ? `${REPO_URL}/issues/new?template=bug.yml&version=${v}`
    : kind === 'idea' ? `${REPO_URL}/issues/new?template=idea.yml`
    : `${REPO_URL}/issues`;
  shell.openExternal(url);
}
ipcMain.handle('app:github', (e, kind) => openGithub(kind));
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
  const r = await dialog.showSaveDialog(mainWin, { defaultPath: `elfar-tasks-backup-${stamp()}.json`, filters: [{ name: 'JSON', extensions: ['json'] }] });
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
ipcMain.handle('data:pick-copy', async () => {
  const r = await dialog.showOpenDialog(mainWin, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  const f = r.filePaths[0];
  try {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!d || !Array.isArray(d.tasks)) throw new Error('not a copy');
    return { file: f, name: path.basename(f), tasks: d.tasks.length };
  } catch { return { error: true, name: path.basename(f) }; }
});
ipcMain.handle('data:export-csv', async (e, csv, name) => {
  const r = await dialog.showSaveDialog(mainWin, { defaultPath: `${name || 'elfar-tasks'}-${stamp()}.csv`, filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }] });
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
  // The program's file name changed with the new app name: if "open at login" was on for the
  // old file, point it at this one so it keeps starting with Windows.
  if (app.isPackaged) {
    // Updates used to download into a folder under the old name; it's no longer used.
    try { fs.rmSync(path.join(process.env.LOCALAPPDATA || '', 'elfar-notes-updater'), { recursive: true, force: true }); } catch { /* not critical */ }
    try {
      const s = app.getLoginItemSettings({ args: ['--hidden'] });
      if (!s.openAtLogin && (s.launchItems || []).some((i) => i.enabled)) app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
    } catch { /* not critical */ }
  }
  // First run follows the Windows language.
  const lang = (app.getLocale() || '').startsWith('ar') ? 'ar' : 'en';
  store.init(USER_DIR, { lang, onExternalChange: () => broadcast() });
  applyTheme();
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
  setInterval(focusTick, 2000);
  setInterval(() => { if (widgetWin && !cursorTimer) startCursorWatch(); }, 2000);
  setupAutoUpdate();
});

app.on('before-quit', () => { quitting = true; store.flush(); });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { /* stay in tray */ });
