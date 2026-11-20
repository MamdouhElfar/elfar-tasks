// Quick-add popup (Ctrl+Alt+Space from any app): type, Enter, gone.
let data = null;
let prio = null;
const $ = (id) => document.getElementById(id);
const t = (k) => (I18N[data.settings.lang] || I18N.ar)[k] || k;

function areaOpts() {
  let h = `<option value="">${t('inbox')}</option>`;
  // Folders and their subfolders, as a tree.
  const add = (a, path, depth) => {
    h += `<option value="${a.id}">${'&nbsp;&nbsp;&nbsp;'.repeat(depth)}${esc(path)}</option>`;
    data.areas.filter((x) => x.parentId === a.id).forEach((c) => add(c, `${path} / ${c.name}`, depth + 1));
  };
  data.areas.filter((x) => !x.parentId).forEach((a) => add(a, a.name, 0));
  return h;
}

function render() {
  applyLang(data.settings.lang);
  prio = null;
  $('qa').innerHTML = `
    <div class="qa-head">${mouseLogo('brand-mini')}<span>Elfar Tasks · ${t('newTask')}</span></div>
    <input type="text" class="qa-title" id="qTitle" dir="auto" placeholder="${t('newTask')}…" autocomplete="off">
    <div class="qa-err" id="qErr">${t('titleRequired')}</div>
    <div class="qa-row">
      <select id="qArea">${areaOpts()}</select>
      <select id="qDue">
        <option value="">${t('noDue')}</option>
        <option value="today">${t('today')}</option>
        <option value="tomorrow">${t('tomorrowLbl')}</option>
        <option value="week">${t('nextWeek')}</option>
      </select>
    </div>
    <div class="qa-prio">${QUADS.map((q) => `<button class="${q}" data-p="${q}" title="${t(q + 'a')}">${t(q)}</button>`).join('')}</div>
    <div class="qa-foot">${t('composerHint')}</div>`;
  setTimeout(() => $('qTitle').focus(), 20);
}

function dueValue(v) {
  const d = new Date();
  if (v === 'today') return todayStr(d);
  if (v === 'tomorrow') { d.setDate(d.getDate() + 1); return todayStr(d); }
  if (v === 'week') { d.setDate(d.getDate() + 7); return todayStr(d); }
  return null;
}

async function submit() {
  const title = $('qTitle').value.trim();
  if (!title) { $('qErr').classList.add('show'); return; }
  await window.api.quickAdd({
    id: uid(), areaId: $('qArea').value || null, title, start: todayStr(), due: dueValue($('qDue').value), closure: null,
    priority: prio, starred: false, notes: '', subtasks: [], log: [], pendingWith: [], created: Date.now(), updated: Date.now()
  });
  render();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-p]');
  if (!b) return;
  prio = prio === b.dataset.p ? null : b.dataset.p;
  document.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('on', x.dataset.p === prio));
  $('qTitle').focus();
});
document.addEventListener('input', (e) => { if (e.target.id === 'qTitle') $('qErr').classList.remove('show'); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { window.api.quickClose(); render(); }
  if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); submit(); }
});

(async () => {
  data = await window.api.getData();
  render();
  window.api.onDataChanged((d) => { data = d; });
  window.api.onQuickReset(() => render());
})();
