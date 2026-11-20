// JSON file storage.
// - Writes are atomic (temp file + rename) and the previous version is kept as .bak.
// - One automatic backup per day is kept for 30 days (in the local app folder).
// - The data file can live in any folder (e.g. OneDrive) to sync between computers;
//   changes made by another computer are picked up automatically.
const fs = require('fs');
const path = require('path');

let appDir = null;      // local app folder (config + backups)
let file = null;        // the data file in use
let data = null;
let timer = null;
let lastOwnWrite = 0;   // mtime of our own last write, to tell it apart from a sync
let onExternal = null;

const KEEP_BACKUPS = 30;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SETTINGS_DEFAULTS = {
  lang: 'ar',
  widget: { visible: true, opacity: 1, filter: 'focus' },
  showClosed: false,
  summary: { enabled: true, time: '09:00' },
  nudgeDays: 3,
  zoom: 1
};

// What a brand-new user sees: neutral areas and one welcome task that explains the app.
function firstRun(lang) {
  const ar = lang === 'ar';
  const work = uid(), home = uid(), personal = uid();
  const sub = (title, done = false) => ({ id: uid(), title, done });
  return {
    version: 1,
    settings: { ...SETTINGS_DEFAULTS, lang },
    people: [],
    areas: [
      { id: work, name: ar ? 'الشغل' : 'Work', color: 'blue', parentId: null },
      { id: home, name: ar ? 'البيت' : 'Home', color: 'teal', parentId: null },
      { id: personal, name: ar ? 'شخصي' : 'Personal', color: 'purple', parentId: null }
    ],
    tasks: [{
      id: uid(), areaId: null, title: ar ? '👋 أهلاً بيك في Elfar Tasks' : '👋 Welcome to Elfar Tasks',
      start: today(), due: today(), closure: null, priority: 'q2', starred: true, pendingWith: [],
      notes: ar
        ? 'التطبيق مبني على روتين بسيط:\n• الصبح: خطط يومك (3 لـ 5 حاجات بس).\n• طول اليوم: ابدأ بكارت "دلوقتي" ودوس ▶ ابدأ عشان تركّز.\n• بالليل: راجع يومك وانقل اللي فاضل لبكرة.\n• آخر الأسبوع: راجع أسبوعك واختار أهدافك.\n\nزرار + (أو Ctrl+N) يضيف تاسك، و Ctrl+Alt+Space يضيف من أي برنامج.\nكل المميزات في الإعدادات ← دليل التطبيق.\n\nلما تخلص الخطوات اقفل التاسك دي ✓'
        : 'The app is built around a simple routine:\n• Morning: plan your day (3 to 5 things).\n• All day: start with the "Now" card and press ▶ Start to focus.\n• Evening: review your day and move the rest to tomorrow.\n• Week end: review your week and set goals.\n\nThe + button (or Ctrl+N) adds a task; Ctrl+Alt+Space adds one from any app.\nEvery feature is in Settings › App guide.\n\nClose this task ✓ when you are done.',
      estimate: 15,
      subtasks: ar
        ? [sub('ضيف أول تاسك حقيقية (زرار +)'), sub('خطط يومك (النهارده ← خطط يومك)'), sub('جرّب التركيز: ▶ ابدأ على أي تاسك'), sub('ضيف عادة (تاب عاداتي)'), sub('بص على الإعدادات ← دليل التطبيق')]
        : [sub('Add your first real task (the + button)'), sub('Plan your day (Today › Plan your day)'), sub('Try focus: ▶ Start on any task'), sub('Add a habit (Habits tab)'), sub('Look at Settings › App guide')],
      log: [], created: Date.now(), updated: Date.now()
    }]
  };
}

function normalize(d, lang = 'ar') {
  if (!d || typeof d !== 'object') d = firstRun(lang);
  d.settings = { ...SETTINGS_DEFAULTS, ...(d.settings || {}) };
  d.settings.widget = { ...SETTINGS_DEFAULTS.widget, ...(d.settings.widget || {}) };
  d.settings.summary = { ...SETTINGS_DEFAULTS.summary, ...(d.settings.summary || {}) };
  d.areas = Array.isArray(d.areas) ? d.areas : [];
  d.tasks = Array.isArray(d.tasks) ? d.tasks : [];
  d.people = Array.isArray(d.people) ? d.people : [];
  d.habits = Array.isArray(d.habits) ? d.habits : [];
  migrateWaitingOn(d);
  return d;
}

// Old free-text "waitingOn" becomes real people records + task.pendingWith.
function migrateWaitingOn(d) {
  for (const t of d.tasks) {
    if (!Array.isArray(t.pendingWith)) t.pendingWith = [];
    const text = (t.waitingOn || '').trim();
    if (text) {
      for (const name of text.split(/[,،]/).map((s) => s.trim()).filter(Boolean)) {
        let p = d.people.find((x) => x.name.toLowerCase() === name.toLowerCase());
        if (!p) { p = { id: uid(), name, areaIds: [] }; d.people.push(p); }
        if (t.areaId && !p.areaIds.includes(t.areaId)) p.areaIds.push(t.areaId);
        if (!t.pendingWith.some((x) => x.personId === p.id)) t.pendingWith.push({ personId: p.id, since: t.start || today() });
      }
    }
    delete t.waitingOn;
  }
}

// ---------- config (where the data file lives) ----------
const configPath = () => path.join(appDir, 'config.json');
function readConfig() { try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch { return {}; } }
function writeConfig(c) { fs.writeFileSync(configPath(), JSON.stringify(c, null, 2), 'utf8'); }
const backupsDir = () => path.join(appDir, 'backups');

function readFile(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }

function load(lang) {
  try {
    data = normalize(readFile(file), lang);
  } catch (e) {
    if (fs.existsSync(file)) {
      // Corrupt file: keep a copy instead of overwriting it silently, then try the backup.
      fs.copyFileSync(file, file + '.corrupt-' + Date.now());
      try { data = normalize(readFile(file + '.bak'), lang); }
      catch { data = firstRun(lang); }
    } else {
      data = firstRun(lang);
    }
    writeNow();
  }
}

function init(dir, { lang = 'ar', onExternalChange } = {}) {
  appDir = dir;
  onExternal = onExternalChange;
  fs.mkdirSync(appDir, { recursive: true });
  const cfg = readConfig();
  const dataDir = cfg.dataDir && fs.existsSync(cfg.dataDir) ? cfg.dataDir : appDir;
  file = path.join(dataDir, 'data.json');
  load(lang);
  dailyBackup();
  watch();
}

function writeNow() {
  clearTimeout(timer);
  timer = null;
  if (!file) return;
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');
  fs.renameSync(tmp, file);
  try { lastOwnWrite = fs.statSync(file).mtimeMs; } catch {}
  dailyBackup();
}

function scheduleWrite() {
  clearTimeout(timer);
  timer = setTimeout(writeNow, 300);
}

// ---------- daily backups ----------
function dailyBackup() {
  try {
    const dir = backupsDir();
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, `data-${today()}.json`);
    if (!fs.existsSync(target) && fs.existsSync(file)) fs.copyFileSync(file, target);
    const all = fs.readdirSync(dir).filter((f) => /^data-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    for (const old of all.slice(0, Math.max(0, all.length - KEEP_BACKUPS))) fs.unlinkSync(path.join(dir, old));
  } catch { /* a failed backup must never block saving */ }
}

// Before a restore or a loaded copy replaces everything, the data as it was is kept as a
// "safety copy" (the last 10), so a wrong restore can be undone from the same list.
const KEEP_SAFETY = 10;
function safetyCopy() {
  try {
    if (!fs.existsSync(file)) return;
    const dir = backupsDir();
    fs.mkdirSync(dir, { recursive: true });
    const d = new Date();
    const stamp = `${today()}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
    fs.copyFileSync(file, path.join(dir, `safety-${stamp}.json`));
    const all = fs.readdirSync(dir).filter((f) => /^safety-.+\.json$/.test(f)).sort();
    for (const old of all.slice(0, Math.max(0, all.length - KEEP_SAFETY))) fs.unlinkSync(path.join(dir, old));
  } catch { /* never block the restore itself */ }
}

// Newest first: safety copies (with their time) and the daily copies.
function listBackups() {
  try {
    return fs.readdirSync(backupsDir())
      .filter((f) => /^data-\d{4}-\d{2}-\d{2}\.json$/.test(f) || /^safety-\d{4}-\d{2}-\d{2}T\d{6}\.json$/.test(f))
      .map((f) => {
        const full = path.join(backupsDir(), f);
        const safety = f.startsWith('safety-');
        let tasks = 0;
        try { tasks = readFile(full).tasks.length; } catch {}
        const date = safety ? f.slice(7, 17) : f.slice(5, 15);
        const time = safety ? `${f.slice(18, 20)}:${f.slice(20, 22)}` : '';
        return { file: full, date, time, tasks, kind: safety ? 'safety' : 'daily', key: date + (safety ? 'T' + f.slice(18, 24) : 'T000000') };
      })
      .sort((a, b) => b.key.localeCompare(a.key));
  } catch { return []; }
}

// ---------- sync folder: pick up changes written by another computer ----------
function watch() {
  fs.unwatchFile(file);
  try { lastOwnWrite = fs.statSync(file).mtimeMs; } catch {}
  fs.watchFile(file, { interval: 2000 }, (cur) => {
    if (!cur.mtimeMs || Math.abs(cur.mtimeMs - lastOwnWrite) < 5 || timer) return;
    try {
      data = normalize(readFile(file), data.settings.lang);
      lastOwnWrite = cur.mtimeMs;
      if (onExternal) onExternal();
    } catch { /* half-synced file: wait for the next change */ }
  });
}

module.exports = {
  init,
  get: () => data,
  file: () => file,
  dataDir: () => path.dirname(file),
  backupsDir,
  listBackups,
  replace(d) { data = normalize(d, data && data.settings.lang); scheduleWrite(); },
  updateSettings(patch) { data.settings = { ...data.settings, ...patch }; scheduleWrite(); },
  flush() { if (timer) writeNow(); },
  exportTo(p) { fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8'); },
  importFrom(p) {
    const d = readFile(p);
    if (!d || !Array.isArray(d.tasks)) throw new Error('Invalid backup file');
    writeNow();
    safetyCopy(); // what's here now is kept first, so this can be undone
    data = normalize(d, data.settings.lang);
    writeNow();
  },
  // Move the data file to another folder (e.g. OneDrive). If that folder already
  // has data (from another computer), `useExisting` decides which one wins.
  moveTo(dir, useExisting) {
    const target = path.join(dir, 'data.json');
    writeNow();
    if (!(useExisting && fs.existsSync(target))) fs.copyFileSync(file, target);
    fs.unwatchFile(file);
    file = target;
    writeConfig({ ...readConfig(), dataDir: dir });
    load(data.settings.lang);
    watch();
  },
  hasDataIn(dir) { return fs.existsSync(path.join(dir, 'data.json')); }
};
