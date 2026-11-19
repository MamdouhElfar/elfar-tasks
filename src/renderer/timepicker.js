// ---------------- time picker: drag-to-spin wheels ----------------
// A time box is a read-only text field: timeBox('dDueTime', '14:30').
// Its value ('HH:MM', 24h, or '') lives in data-value; read it with timeValue(el).
// Click it to open three wheels (hour · minute · AM/PM). Hold the mouse and drag up/down
// to spin a wheel, or scroll it; click a number to pick it. Done / Enter / clicking outside
// keeps the time, Esc cancels. A 'change' event fires on the box when the time changes.

const TP_ROW = 34; // height of one row on a wheel, in px

const tpAr = () => document.documentElement.lang === 'ar';
const tpAmPm = () => (tpAr() ? ['ص', 'م'] : ['AM', 'PM']);
function timeLabel(v) {
  if (!v) return '';
  const [h, m] = v.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${tpAmPm()[h >= 12 ? 1 : 0]}`;
}
const timeValue = (el) => (el && el.dataset.value) || '';
function timeBox(id, value, attrs = '') {
  return `<input type="text" readonly class="tp-input" id="${id}" data-value="${value || ''}" value="${timeLabel(value)}" placeholder="--:--" ${attrs}>`;
}
function setTimeBox(el, v) {
  el.dataset.value = v || '';
  el.value = timeLabel(v);
}

let tpOpen = null; // { el, pop, before }

function openTimePicker(el) {
  closeTimePicker(true);
  const cur = timeValue(el) || (() => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(Math.round(d.getMinutes() / 5) * 5 % 60).padStart(2, '0')}`; })();
  const [h24, m] = cur.split(':').map(Number);
  const pop = document.createElement('div');
  pop.className = 'tp-pop';
  pop.dir = 'ltr';
  const col = (name, items) => `<div class="tp-col" data-col="${name}"><div class="tp-pad"></div>${items.map((txt, i) => `<div class="tp-item" data-i="${i}">${txt}</div>`).join('')}<div class="tp-pad"></div></div>`;
  pop.innerHTML = `<div class="tp-wheels"><div class="tp-band"></div>
      ${col('h', [...Array(12)].map((_, i) => String(i + 1).padStart(2, '0')))}
      <div class="tp-colon">:</div>
      ${col('m', [...Array(60)].map((_, i) => String(i).padStart(2, '0')))}
      ${col('ap', tpAmPm())}
    </div>
    <div class="tp-foot">
      <button class="tp-clear">${tpAr() ? 'مسح' : 'Clear'}</button>
      <button class="tp-now">${tpAr() ? 'دلوقتي' : 'Now'}</button>
      <button class="primary tp-done">${tpAr() ? 'تم' : 'Done'}</button>
    </div>`;
  document.body.appendChild(pop);
  tpOpen = { el, pop, before: timeValue(el) };

  // Place it under the box (or above, if there's no room), inside the window.
  const r = el.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let top = r.bottom + 6;
  if (top + ph > innerHeight - 8) top = Math.max(8, r.top - ph - 6);
  let left = Math.min(Math.max(8, r.left), innerWidth - pw - 8);
  pop.style.top = top + 'px';
  pop.style.left = left + 'px';

  const cols = { h: pop.querySelector('[data-col=h]'), m: pop.querySelector('[data-col=m]'), ap: pop.querySelector('[data-col=ap]') };
  const idx = (c) => Math.max(0, Math.min(c.querySelectorAll('.tp-item').length - 1, Math.round(c.scrollTop / TP_ROW)));
  const mark = () => Object.values(cols).forEach((c) => {
    const i = idx(c);
    c.querySelectorAll('.tp-item').forEach((it) => it.classList.toggle('on', Number(it.dataset.i) === i));
  });
  const read = () => {
    const h12 = idx(cols.h) + 1, mm = idx(cols.m), pm = idx(cols.ap) === 1;
    const h = (h12 % 12) + (pm ? 12 : 0);
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };
  const show = () => { mark(); setTimeBox(el, read()); };
  const goTo = (c, i, smooth) => c.scrollTo({ top: i * TP_ROW, behavior: smooth ? 'smooth' : 'auto' });
  const setAll = (v, smooth) => {
    const [hh, mi] = v.split(':').map(Number);
    goTo(cols.h, ((hh + 11) % 12), smooth); goTo(cols.m, mi, smooth); goTo(cols.ap, hh >= 12 ? 1 : 0, smooth);
  };
  setAll(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`, false);
  mark();
  if (!timeValue(el)) setTimeBox(el, read());

  for (const c of Object.values(cols)) {
    let endTimer = null;
    c.addEventListener('scroll', () => {
      mark();
      clearTimeout(endTimer);
      endTimer = setTimeout(() => { if (!c.classList.contains('dragging')) show(); }, 90);
    });
    // Hold and drag up/down to spin; a click without moving picks the row under the mouse.
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      const y0 = e.clientY, s0 = c.scrollTop;
      let moved = false, lastY = y0, lastT = performance.now(), vel = 0;
      c.classList.add('dragging');
      const move = (ev) => {
        const dy = ev.clientY - y0;
        if (Math.abs(dy) > 3) moved = true;
        const now = performance.now();
        vel = (ev.clientY - lastY) / Math.max(1, now - lastT);
        lastY = ev.clientY; lastT = now;
        c.scrollTop = s0 - dy;
      };
      const up = (ev) => {
        c.removeEventListener('pointermove', move);
        c.removeEventListener('pointerup', up);
        c.removeEventListener('pointercancel', up);
        c.classList.remove('dragging');
        if (!moved) {
          const it = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.tp-item');
          if (it && c.contains(it)) goTo(c, Number(it.dataset.i), true);
        } else {
          // A quick flick keeps spinning a little before it settles on a row.
          const target = c.scrollTop - (Math.abs(vel) > 0.4 ? vel * 120 : 0);
          const rows = c.querySelectorAll('.tp-item').length;
          goTo(c, Math.max(0, Math.min(rows - 1, Math.round(target / TP_ROW))), true);
        }
        setTimeout(show, 260);
      };
      c.addEventListener('pointermove', move);
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
    });
  }
  pop.querySelector('.tp-now').onclick = () => { setAll(nowLocal().slice(11), true); setTimeout(show, 260); };
  pop.querySelector('.tp-clear').onclick = () => { setTimeBox(el, ''); closeTimePicker(false, true); };
  pop.querySelector('.tp-done').onclick = () => { show(); closeTimePicker(false); };
}

// cancel: put the old time back. Otherwise the new time stays and 'change' fires if it changed.
function closeTimePicker(cancel, force) {
  if (!tpOpen) return;
  const { el, pop, before } = tpOpen;
  tpOpen = null;
  if (cancel) setTimeBox(el, before);
  pop.classList.add('leaving');
  setTimeout(() => pop.remove(), 120);
  if (!cancel && (force || timeValue(el) !== before)) el.dispatchEvent(new Event('change', { bubbles: true }));
}

document.addEventListener('mousedown', (e) => {
  if (tpOpen && !tpOpen.pop.contains(e.target) && e.target !== tpOpen.el) closeTimePicker(false);
}, true);
document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('.tp-input');
  if (el && !el.disabled && (!tpOpen || tpOpen.el !== el)) openTimePicker(el);
});
document.addEventListener('keydown', (e) => {
  if (tpOpen) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeTimePicker(true); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); closeTimePicker(false); }
    return;
  }
  const el = e.target.closest && e.target.closest('.tp-input');
  if (el && ['Enter', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); openTimePicker(el); }
  if (el && (e.key === 'Delete' || e.key === 'Backspace') && timeValue(el)) { e.preventDefault(); e.stopPropagation(); setTimeBox(el, ''); el.dispatchEvent(new Event('change', { bubbles: true })); }
}, true);
// The page under it scrolled or resized: close and keep the time.
window.addEventListener('resize', () => closeTimePicker(false));
