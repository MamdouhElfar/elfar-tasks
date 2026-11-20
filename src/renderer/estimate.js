// ---------------- how long a task will take ----------------
// task.estimate = minutes. Set it on the task page or in the plan. It's used to:
//  • show "how much of my day is already planned" (against the hours you work, Settings › General)
//  • suggest the focus length (the time left on the task)
//  • tell you, over time, whether you tend to under- or over-estimate (weekly review).

const EST_QUICK = [15, 30, 60, 120];
const dayCapacity = () => Math.round((Number(data.settings.dayHours) || 6) * 60);

function estimateFieldHtml(x) {
  const worked = Math.round((x.focusMs || 0) / 60000);
  const custom = x.estimate && !EST_QUICK.includes(x.estimate);
  return `<div class="d-field est-field"><label>${icon('clock')} ${t('estimate')}</label>
    <div class="est-pick">${EST_QUICK.map((m) => `<button type="button" class="${x.estimate === m ? 'on' : ''}" data-est="${m}">${fmtMins(m, lang())}</button>`).join('')}
      <label class="est-own ${custom ? 'on' : ''}"><input type="number" id="dEst" min="1" max="1440" placeholder="${t('estOwn')}" value="${custom ? x.estimate : ''}"><small>${t('minShort')}</small></label>
      ${x.estimate ? `<button type="button" class="ghost est-clear" data-est="0" title="${t('estClear')}">✕</button>` : ''}</div>
    ${x.estimate && worked ? `<div class="est-prog"><span class="est-bar"><i style="width:${Math.min(100, (worked / x.estimate) * 100)}%" class="${worked > x.estimate ? 'over' : ''}"></i></span><small>${t('estWorked').replace('{a}', fmtMins(worked, lang())).replace('{b}', fmtMins(x.estimate, lang()))}</small></div>` : ''}
  </div>`;
}
// On a card: "⏱ 1h", or "⏱ 45m / 1h" once you've worked on it.
function estChip(x) {
  if (!x.estimate || x.closure) return '';
  const worked = Math.round((x.focusMs || 0) / 60000);
  return `<span class="est-chip" title="${t('estimate')}">${icon('clock')}${worked ? `${fmtMins(worked, lang())} / ` : ''}${fmtMins(x.estimate, lang())}</span>`;
}
// Planned minutes for a set of tasks (what's left on each) + today's habits that take time.
function plannedLoad(tasks) {
  let mins = 0, unknown = 0;
  for (const x of tasks) { if (x.closure) continue; const left = minutesLeft(x); if (left === null) unknown++; else mins += left; }
  for (const h of habitsToday()) if (h.duration && h.kind !== 'minutes' && hLog(h, todayStr()) !== 'done') mins += Math.max(0, h.duration - hMins(h, todayStr()));
  return { mins, unknown, cap: dayCapacity() };
}
function capacityHtml(load) {
  const pct = Math.min(100, Math.round((load.mins / load.cap) * 100));
  const over = load.mins > load.cap;
  return `<div class="cap ${over ? 'over' : ''}"><span class="cap-bar"><i style="width:${pct}%"></i></span>
    <small>${icon('clock')} ${t('capPlanned').replace('{a}', fmtMins(load.mins, lang())).replace('{b}', fmtMins(load.cap, lang()))}${load.unknown ? ` · ${t('capUnknown').replace('{n}', load.unknown)}` : ''}${over ? ` · <b>${t('capOver')}</b>` : ''}</small></div>`;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('#detail [data-est]');
  if (!b) return;
  const x = taskById(ui.selected); if (!x) return;
  const m = Number(b.dataset.est);
  x.estimate = m || null;
  touch(x); refreshLists(); renderDetail();
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'dEst') {
    const x = taskById(ui.selected); if (!x) return;
    x.estimate = Math.round(Number(e.target.value)) || null;
    touch(x); refreshLists(); renderDetail();
  }
  const sel = e.target.closest && e.target.closest('[data-est-for]');
  if (sel) {
    const x = taskById(sel.dataset.estFor); if (!x) return;
    x.estimate = Number(sel.value) || null;
    touch(x);
    sel.dispatchEvent(new CustomEvent('est-changed', { bubbles: true }));
  }
});
