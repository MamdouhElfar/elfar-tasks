// ---------------- small charts (plain HTML, no library) ----------------
// Built on the app's colour tokens, so they follow light / dark and both languages.
// Specs: columns ≤ 22px thick with 4px rounded tops from one baseline; a hairline baseline;
// values labelled sparingly (the highest and the current one); every mark has a hover tooltip.

const chFmtN = (v) => (Math.round(v * 10) / 10).toLocaleString('en');
const shortDay = (d) => `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`;

// Columns. items: [{ value, label, tip, cur }]. Options: fmt(value), color, height, target (a line), targetLabel.
function colChart({ items, fmt = chFmtN, color = 'var(--accent)', height = 110, target = null, targetLabel = '', empty = '' }) {
  const max = Math.max(1, target || 0, ...items.map((i) => i.value || 0));
  if (!items.some((i) => i.value > 0) && empty) return `<div class="ch-empty small muted">${empty}</div>`;
  const top = items.reduce((b, i, n) => (i.value > (items[b] ? items[b].value : -1) ? n : b), -1);
  const pct = (v) => Math.max(0, Math.min(100, (v / max) * 100));
  return `<div class="ch-col" style="--ch-h:${height}px;--ch-c:${color}">
    <div class="ch-plot">
      ${target ? `<div class="ch-target" style="bottom:${pct(target)}%"><span>${esc(targetLabel)}</span></div>` : ''}
      ${items.map((i, n) => `<div class="ch-c ${i.cur ? 'cur' : ''}" data-tip="${esc(i.tip || `${i.label}: ${fmt(i.value || 0)}`)}">
        ${(n === top && i.value > 0) || i.cur ? `<b class="ch-v" style="bottom:calc(${pct(i.value || 0)}% + 3px)">${fmt(i.value || 0)}</b>` : ''}
        <i style="height:${i.value > 0 ? `max(3px, ${pct(i.value)}%)` : '0'}"></i></div>`).join('')}
    </div>
    <div class="ch-x">${items.map((i) => `<small class="${i.cur ? 'cur' : ''}">${i.label || ''}</small>`).join('')}</div>
  </div>`;
}

// One whole split into parts, with a legend that names every part and its count.
function segBar(parts, { fmt = chFmtN } = {}) {
  const live = parts.filter((p) => p.value > 0);
  const total = live.reduce((a, p) => a + p.value, 0);
  if (!total) return '';
  return `<div class="ch-seg">${live.map((p) => `<i style="flex-grow:${p.value};background:${p.color}" data-tip="${esc(`${p.label}: ${fmt(p.value)}`)}"${p.go ? ` data-chgo="${p.go}"` : ''}></i>`).join('')}</div>
    <div class="ch-legend">${parts.map((p) => `<span class="${p.value ? '' : 'zero'}"${p.go && p.value ? ` data-chgo="${p.go}"` : ''}><i style="background:${p.color}"></i>${esc(p.label)} <b>${fmt(p.value)}</b></span>`).join('')}</div>`;
}

// A ring (0–1) with the number in the middle.
function ringChart(v, { size = 76, color = 'var(--accent)', label = '' } = {}) {
  const p = v === null || v === undefined ? null : Math.round(v * 100);
  return `<div class="ch-ring" style="--size:${size}px;--p:${p || 0};--ch-c:${color}" data-tip="${esc(label ? `${label}: ${p === null ? '—' : p + '%'}` : '')}"><b>${p === null ? '—' : p + '<small>%</small>'}</b></div>`;
}

// A number tile: label, value, change against before, and a small trend.
function statTile({ label, value, sub = '', delta = null, deltaGood = true, deltaFmt = (d) => chFmtN(Math.abs(d)), vs = '', spark = null, sparkColor = 'var(--accent)', cls = '' }) {
  let dl = '';
  if (delta !== null && delta !== undefined && !Number.isNaN(delta)) {
    const up = delta > 0, flat = delta === 0;
    const good = flat ? null : (up === deltaGood);
    dl = `<span class="st-delta ${good === true ? 'good' : good === false ? 'bad' : ''}" title="${esc(vs)}">${flat ? '＝' : up ? '▲' : '▼'} ${flat ? '' : deltaFmt(delta)} <em>${esc(vs)}</em></span>`;
  }
  const sp = spark && spark.some((v) => v > 0) ? (() => {
    const m = Math.max(...spark, 1);
    return `<span class="st-spark" style="--ch-c:${sparkColor}">${spark.map((v, i) => `<i class="${i === spark.length - 1 ? 'cur' : ''}" style="height:${v > 0 ? Math.max(8, (v / m) * 100) : 0}%"></i>`).join('')}</span>`;
  })() : '';
  return `<div class="st-tile ${cls}"><span class="st-label">${label}</span><div class="st-row"><b class="st-val">${value}</b>${sp}</div>${sub ? `<span class="st-sub">${sub}</span>` : ''}${dl}</div>`;
}

// One tooltip for every chart: follows the cursor over anything with data-tip.
(() => {
  let tip = null;
  const show = (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (!el || !el.dataset.tip) { if (tip) tip.hidden = true; return; }
    if (!tip) { tip = document.createElement('div'); tip.className = 'ch-tip'; document.body.appendChild(tip); }
    tip.textContent = el.dataset.tip; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    const x = Math.min(window.innerWidth - r.width - 8, Math.max(8, e.clientX - r.width / 2));
    const y = e.clientY - r.height - 12 < 8 ? e.clientY + 16 : e.clientY - r.height - 12;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };
  document.addEventListener('mousemove', show);
  document.addEventListener('mouseleave', () => { if (tip) tip.hidden = true; });
})();
