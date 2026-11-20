// ---------------- date picker: our own calendar instead of Windows' ----------------
// Every <input type="date"> in the page is turned into a read-only box that shows the date
// in the app's language ("Fri, 20 Nov" / "الجمعة 20 نوفمبر") and opens a small calendar.
// The rest of the code doesn't change: el.value still reads and writes 'YYYY-MM-DD',
// and 'input' + 'change' fire on the box when a date is picked.

const dpAr = () => document.documentElement.lang === 'ar';
const dpLoc = () => (dpAr() ? 'ar-EG-u-nu-latn' : 'en-GB');
const DP_NATIVE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

function dpLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return '';
  return d.toLocaleDateString(dpLoc(), { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

function dpEnhance(el) {
  if (el.dataset.dp) return;
  const start = DP_NATIVE.get.call(el);
  el.dataset.dp = '1';
  el.type = 'text';
  el.readOnly = true;
  el.classList.add('dp-input');
  if (!el.placeholder) el.placeholder = dpAr() ? 'اختار تاريخ' : 'Pick a date';
  Object.defineProperty(el, 'value', {
    configurable: true,
    get() { return this.dataset.iso || ''; },
    set(v) { this.dataset.iso = v || ''; DP_NATIVE.set.call(this, dpLabel(v)); }
  });
  el.value = start;
}

function dpEnhanceAll(root = document) {
  if (root.matches && root.matches('input[type=date]')) dpEnhance(root);
  if (root.querySelectorAll) root.querySelectorAll('input[type=date]').forEach(dpEnhance);
}
new MutationObserver((muts) => {
  for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) dpEnhanceAll(n);
}).observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', () => dpEnhanceAll());

let dpOpen = null; // { el, pop, month: 'YYYY-MM' }

function dpSet(el, iso) {
  const before = el.value;
  el.value = iso;
  if (before !== iso) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function openDatePicker(el) {
  closeDatePicker();
  const pop = document.createElement('div');
  pop.className = 'dp-pop';
  pop.dir = dpAr() ? 'rtl' : 'ltr';
  document.body.appendChild(pop);
  dpOpen = { el, pop, month: (el.value || todayStr()).slice(0, 7) };
  dpRender();
  const r = el.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let top = r.bottom + 6;
  if (top + ph > innerHeight - 8) top = Math.max(8, r.top - ph - 6);
  const left = Math.min(Math.max(8, dpAr() ? r.right - pw : r.left), innerWidth - pw - 8);
  pop.style.top = top + 'px';
  pop.style.left = left + 'px';
}

function dpRender() {
  const { el, pop, month } = dpOpen;
  const ar = dpAr();
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const weekStart = ar ? 6 : 1; // Saturday in Arabic, Monday in English (like the Calendar tab)
  const offset = (first.getDay() - weekStart + 7) % 7;
  const today = todayStr(), sel = el.value;
  const dows = [...Array(7)].map((_, i) => new Date(2024, 0, 7 + ((weekStart + i) % 7)).toLocaleDateString(dpLoc(), { weekday: 'narrow' }));
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(y, m - 1, 1 - offset + i);
    const ds = todayStr(d);
    cells += `<button type="button" class="dp-day ${d.getMonth() !== m - 1 ? 'other' : ''} ${ds === today ? 'today' : ''} ${ds === sel ? 'on' : ''}" data-d="${ds}">${d.getDate()}</button>`;
  }
  const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return todayStr(d); };
  const quick = ar
    ? [[plus(0), 'النهارده'], [plus(1), 'بكرة'], [plus(7), 'كمان أسبوع']]
    : [[plus(0), 'Today'], [plus(1), 'Tomorrow'], [plus(7), 'In a week']];
  pop.innerHTML = `<div class="dp-head">
      <button type="button" class="dp-nav" data-m="-1" title="${ar ? 'الشهر اللي فات' : 'Previous month'}">${ar ? '›' : '‹'}</button>
      <b>${first.toLocaleDateString(dpLoc(), { month: 'long', year: 'numeric' })}</b>
      <button type="button" class="dp-nav" data-m="1" title="${ar ? 'الشهر الجاي' : 'Next month'}">${ar ? '‹' : '›'}</button>
    </div>
    <div class="dp-grid">${dows.map((d) => `<span class="dp-dow">${d}</span>`).join('')}${cells}</div>
    <div class="dp-foot">${quick.map(([d, l]) => `<button type="button" data-d="${d}">${l}</button>`).join('')}
      ${sel ? `<button type="button" class="dp-clear" data-clear>${ar ? 'مسح' : 'Clear'}</button>` : ''}</div>`;
}

function closeDatePicker() {
  if (!dpOpen) return;
  const { pop } = dpOpen;
  dpOpen = null;
  pop.classList.add('leaving');
  setTimeout(() => pop.remove(), 120);
}

document.addEventListener('mousedown', (e) => {
  if (!dpOpen) return;
  if (dpOpen.pop.contains(e.target)) { e.preventDefault(); return; } // keep focus on the box
  if (e.target !== dpOpen.el) closeDatePicker();
}, true);
document.addEventListener('click', (e) => {
  if (dpOpen && dpOpen.pop.contains(e.target)) {
    const b = e.target.closest('button'); if (!b) return;
    const { el } = dpOpen;
    if (b.dataset.m) {
      const [y, m] = dpOpen.month.split('-').map(Number);
      const d = new Date(y, m - 1 + Number(b.dataset.m), 1);
      dpOpen.month = todayStr(d).slice(0, 7);
      return dpRender();
    }
    if (b.dataset.d) { closeDatePicker(); dpSet(el, b.dataset.d); }
    if (b.hasAttribute('data-clear')) { closeDatePicker(); dpSet(el, ''); }
    return;
  }
  const el = e.target.closest && e.target.closest('.dp-input');
  if (el && !el.disabled && (!dpOpen || dpOpen.el !== el)) openDatePicker(el);
});
document.addEventListener('keydown', (e) => {
  if (dpOpen && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDatePicker(); return; }
  const el = e.target.closest && e.target.closest('.dp-input');
  if (!el) return;
  if (['Enter', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); openDatePicker(el); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && el.value) { e.preventDefault(); e.stopPropagation(); closeDatePicker(); dpSet(el, ''); }
}, true);
window.addEventListener('resize', closeDatePicker);
