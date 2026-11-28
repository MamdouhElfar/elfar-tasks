// ---------------- App guide (Settings › Guide) ----------------
// Two parts, so it helps instead of overwhelming:
//  1) "Your day in 4 steps": the one routine the app is built around.
//  2) Every feature as a short, searchable list. Open one to see what it does and where it is.
// "Show me" takes you to the exact place, highlights it, and leaves a small card with
// "Back to the guide", which reopens the guide on the same item.

// [id, icon, target, ar:[name, one line, where], en:[...]]
// target: how "Show me" gets there — a view, a dialog, a settings section, or a spot on a task page.
const GUIDE_STEPS = [
  ['plan', 'today', { open: 'plan' }, ['الصبح: خطط يومك', 'اختار 3 لـ 5 حاجات بس'], ['Morning: plan', 'Pick 3 to 5 things']],
  ['now', 'target', { view: 'today', spot: '.now-card, .plan-cta' }, ['طول اليوم: دلوقتي', 'ابدأ بحاجة واحدة وركّز'], ['All day: Now', 'Start one thing and focus']],
  ['review', 'moon', { open: 'review' }, ['بالليل: راجع يومك', 'انقل اللي فاضل لبكرة'], ['Evening: review', 'Move the rest to tomorrow']],
  ['week', 'calendar', { open: 'week' }, ['آخر الأسبوع: راجع أسبوعك', 'شوف أرقامك واختار أهدافك'], ['Week end: review', 'See your numbers, set goals']]
];
const GUIDE_GROUPS = [
  ['day', ['يومك', 'Your day'], [
    ['today', 'today', { view: 'today', spot: '.tab[data-view="today"]' }, ['صفحة النهارده', 'يومك كله في صفحة واحدة', 'أول تاب'], ['The Today page', 'Your whole day on one page', 'The first tab']],
    ['focus', 'clock', { task: '#detail .focus-btn' }, ['وضع التركيز', 'تايمر بالمدة اللي تختارها على حاجة واحدة', '▶ ركّز، أو حرف F'], ['Focus mode', 'A timer you set, on one thing', '▶ Focus, or F']],
    ['defer', 'calendar', { task: '#detail .d-defer' }, ['مش النهارده', 'أجّل تاسك ليوم تاني فتختفي من النهارده', 'الكارت أو صفحة التاسك'], ['Not today', 'Move a task to another day', 'Card or task page']]
  ]],
  ['long', ['على المدى الطويل', 'The long run'], [
    ['habits', 'habits', { view: 'habits', spot: '.tab[data-view="habits"]' }, ['عاداتي', 'مذاكرة وجيم وقراية، بمتابعة زي النتيجة', 'تاب عاداتي'], ['Habits', 'Study, gym, reading, tracked like a calendar', 'Habits tab']],
    ['report', 'report', { view: 'report', spot: '.tab[data-view="report"]' }, ['التقرير', 'اللي اتقفل، ومين معطّل حاجة، ووقت التركيز', 'تاب المراجعة'], ['Report', 'What got closed, who holds what, focus time', 'Review tab']]
  ]],
  ['tasks', ['تنظيم التاسكات', 'Organizing tasks'], [
    ['tasks', 'list', { view: 'pending', spot: '.tab[data-view="pending"]' }, ['التاسكات', 'كل تاسكاتك: قايمة أو مصفوفة أو تقويم', 'تاب التاسكات'], ['Tasks', 'All your tasks: as a list, a matrix or a calendar', 'Tasks tab']],
    ['matrix', 'matrix', { view: 'matrix', spot: '.tview [data-tview="matrix"]' }, ['المصفوفة', 'رتّب بالأهمية والاستعجال من 1 لـ 4', 'التاسكات ← المصفوفة'], ['Matrix', 'Sort by importance and urgency, 1 to 4', 'Tasks › Matrix']],
    ['calendar', 'calendar', { view: 'calendar', spot: '.cal-views' }, ['التقويم بالساعات', 'شهر أو أسبوع أو يوم، وقسّم يومك على الساعات', 'تاب التقويم'], ['Calendar with hours', 'Month, week or day; put tasks on hours', 'Calendar tab']],
    ['folders', 'folder', { view: 'today', spot: '#areasNav' }, ['الفولدرات', 'فولدرات جوه فولدرات، وبتترتب بالسحب', 'الشريط الجانبي'], ['Folders', 'Folders in folders, reordered by dragging', 'Sidebar']],
    ['people', 'user', { task: '#detail .pending-box' }, ['مستني رد من', 'تابع التاسكات اللي عند حد تاني', 'صفحة التاسك'], ['Waiting on people', "Track tasks someone else has", 'Task page']],
    ['repeat', 'repeat', { task: '#dRepeat' }, ['التكرار', 'يومي أو أسبوعي أو شهري أو سنوي', 'صفحة التاسك'], ['Repeating', 'Daily, weekly, monthly or yearly', 'Task page']],
    ['putoff', 'overdue', { coach: true }, ['عداد التأجيل', 'بعد 3 تأجيلات الفار يسألك تعمل إيه', 'بيشتغل لوحده'], ['Put-off counter', 'After 3 put-offs the mouse asks what would help', 'Works by itself']]
  ]],
  ['anywhere', ['في أي مكان', 'Anywhere'], [
    ['widget', 'edgeRight', { settings: 'widget' }, ['الويدجت', 'تاسكاتك وعاداتك والتايمر فوق كل البرامج', 'الإعدادات'], ['Desktop widget', 'Tasks, habits and timer above every app', 'Settings']],
    ['quick', 'plus', { coach: true }, ['إضافة سريعة', 'ضيف تاسك من أي برنامج', 'Ctrl+Alt+Space'], ['Quick add', 'Add a task from any app', 'Ctrl+Alt+Space']],
    ['reminders', 'bell', { settings: 'notifications' }, ['التذكيرات', 'الفار بيرن الجرس في الميعاد', 'الإعدادات'], ['Reminders', 'The mouse rings a bell on time', 'Settings']],
    ['sync', 'repeat', { settings: 'data' }, ['المزامنة', 'نفس التاسكات على كل أجهزتك', 'الإعدادات ← البيانات'], ['Sync', 'The same tasks on all your computers', 'Settings › Data']],
    ['backup', 'folder', { settings: 'data' }, ['النسخ الاحتياطية', 'نسخة كل يوم، وترجع لأي واحدة', 'الإعدادات'], ['Backups', 'A copy every day; restore any', 'Settings']]
  ]]
];
// Longer explanation shown when an item is opened.
const GUIDE_MORE = {
  today: ['فوق كارت "دلوقتي" بحاجة واحدة تبدأ بيها، وتحته خطتك وعادات النهارده واللي متأخر. واللي خلص بيتلم في سطر.', 'A "Now" card with one thing to start, then your plan, today\'s habits and what\'s late. What\'s done folds into one line.'],
  focus: ['تختار المدة، والخطوة الجاية بتبقى قدامك، والفار ماسك ساعة. ولما الوقت يخلص يسألك: تكمّل ولا تستريح؟ ووقتك بيتحسب على التاسك.', 'Pick a length; the next step stays in front of you and the mouse times you. When time is up it asks: another round or a break? The time counts on the task.'],
  defer: ['بكرة، أو بعد بكرة، أو الأسبوع الجاي، أو أي يوم. بتختفي من النهارده وترجع في يومها. ولو كانت متأخرة بتتحسب تأجيل.', 'Tomorrow, the day after, next week or any day. It leaves Today and comes back on its day. If it was late it counts as put off.'],
  habits: ['3 أنواع: أيام محددة، أو مرات في الأسبوع، أو وقت في الأسبوع. دوس على أي يوم عشان تعلّم اتعملت أو إجازة، وتسجل عملت قد إيه (صفحات، دقايق، Push ups…)، ووقفت فين، وملاحظة. وتاني يوم بيقولك "وقفت عند…".', 'Three kinds: set days, times a week, or time a week. Click any day to mark it done or a day off, log how much (pages, minutes, push ups…), where you stopped and a note. The next day it tells you "You were here…".'],
  report: ['من أي تاريخ: اتقفل كام، واتضاف كام، ومين عنده حاجات متعطلة، ووقت التركيز حسب الفولدر. وتقدر تنسخه أو تطلّعه Excel.', 'From any date: closed, added, who is holding things up, focus time by folder. Copy it or export to Excel.'],
  matrix: ['1 اعملها دلوقتي، 2 خطط لها، 3 فوّضها، 4 استغنى عنها. اسحب الكارت بين المربعات، أو دوس 1–4 على أي تاسك.', '1 do now, 2 plan, 3 delegate, 4 drop. Drag cards between boxes, or press 1–4 on any task.'],
  calendar: ['اختار شهر أو أسبوع أو يوم. في الأسبوع واليوم اسحب التاسك على ساعة، واسحب طرفها عشان تطوّلها، والخط الأحمر هو الساعة دلوقتي. وفي الشهر اسحب التاسك ليوم تاني.', 'Pick month, week or day. In week and day drag a task onto an hour and pull its edge to resize; the red line is now. In month, drag a task to another day.'],
  sync: ['خلّي بيانات التطبيق في OneDrive أو Dropbox بدوسة، وعلى الجهاز التاني اختار نفس الحاجة. التعديلات على الجهازين بتتدمج ومش بتمسح بعض.', 'Keep the data in OneDrive or Dropbox in one click, and pick the same on your other computer. Changes on both are merged, never overwritten.'],
  folders: ['اسحب الفولدر لفوق أو لتحت عشان ترتّبه، أو حطّه على فولدر تاني يبقى جواه.', 'Drag a folder up or down to reorder it, or onto another to put it inside.'],
  people: ['اكتب اسم الشخص في "معلّق عند"، والتطبيق بيعد بقالها كام يوم عنده وبيفكّرك تتابع.', 'Add a name under "Pending with"; the app counts the days and nudges you to follow up.'],
  repeat: ['كل مرة بتبقى تاسك لوحدها في يومها، ولو قفلتها المرة الجاية بتتعمل لوحدها.', 'Each round is its own task on its own day; closing one creates the next.'],
  putoff: ['كل ما تأخّر موعد تاسك بيتعد. وفي المرة التالتة الفار يسألك: تبدأ فيها؟ تقسّمها؟ تديها لحد؟ ولا تشيلها؟', 'Every time a due date moves later it counts. On the third time the mouse asks: start, split, hand off, or drop?'],
  widget: ['فوق كل البرامج، أو مستخبي على جنب الشاشة. وتقدر تسحب الفار من ديله عشان تحرّكه، أو تخلّيه يفتح بالدوس بس.', 'Above every app, or tucked at the screen edge. Drag the mouse by its tail to move it, or make it open on click only.'],
  quick: ['من أي برنامج دوس Ctrl+Alt+Space واكتب التاسك بالكلام: "اتصل بأحمد بكرة الساعة 3 ساعة !1 #الشغل". الميعاد والوقت والمدة والأولوية والفولدر بيتحطوا لوحدهم.', 'From any app press Ctrl+Alt+Space and type it in words: "Call Ahmed tomorrow 3pm 1h !1 #Work". The date, time, length, priority and folder are set for you.'],
  reminders: ['الفار بيطلع ويرن، وتقدر تقوله "فكّرني بعد 10 دقايق". وبيفكّرك كمان بمراجعة آخر اليوم والعادات.', 'The mouse rings; you can say "remind me in 10 min". It also reminds you of the evening review and your habits.'],
  backup: ['نسخة تلقائية كل يوم، وتقدر ترجع لأي واحدة، أو تحفظ نسخة في أي مكان زي OneDrive.', 'An automatic copy every day; restore any, or save a copy anywhere like OneDrive.']
};

const gLang = () => (lang() === 'ar' ? 0 : 1);
function guideHtml() {
  const L = gLang();
  const open = ui.guideOpen;
  const steps = GUIDE_STEPS.map(([id, ico, , ar, en], i) => { const x = L ? en : ar; return `<button class="g-step" data-guide-go="${id}">
      <span class="g-num">${i + 1}</span><span class="g-ico">${icon(ico)}</span><b>${x[0]}</b><small>${x[1]}</small></button>`; }).join('');
  const groups = GUIDE_GROUPS.map(([gid, names, items]) => `<div class="g-group" data-ggroup="${gid}"><h5 class="guide-h">${names[L]}</h5>
    ${items.map(([id, ico, , ar, en]) => { const x = L ? en : ar; return `<details class="g-item" data-gitem="${id}" ${open === id ? 'open' : ''}>
      <summary><span class="g-ico sm">${icon(ico)}</span><span class="g-name"><b>${x[0]}</b><small>${x[1]}</small></span><span class="g-chev">${icon('chevron')}</span></summary>
      <div class="g-body"><p>${(GUIDE_MORE[id] || [])[L] || ''}</p><div class="g-foot"><small>${icon('pin')} ${x[2]}</small><button class="primary g-go" data-guide-go="${id}">${t('showMe')}</button></div></div></details>`; }).join('')}</div>`).join('');
  return `<p class="small muted guide-intro">${t('guideIntro')}</p>
    <div class="g-steps-wrap"><div class="g-steps-t">${t('guideSteps')}</div><div class="g-steps">${steps}</div></div>
    <div class="g-search"><input type="search" id="gSearch" placeholder="${t('guideSearch')}"></div>
    <div class="g-list">${groups}<p class="g-none small muted" hidden>${t('guideNone')}</p></div>`;
}

// Every version's "what's new", newest first (Settings › Updates).
function changelogHtml() {
  const k = lang() === 'ar' ? 'ar' : 'en';
  return `<details class="cl-all"><summary>${t('allChanges')}</summary>${Object.entries(CHANGELOG).map(([v, c]) =>
    `<div class="cl-ver"><b>${v}</b><ul>${(c[k] || c.en).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</details>`;
}

function guideItem(id) {
  for (const s of GUIDE_STEPS) if (s[0] === id) return { id, ico: s[1], target: s[2], names: s[gLang() ? 4 : 3] };
  for (const [, , items] of GUIDE_GROUPS) for (const it of items) if (it[0] === id) return { id, ico: it[1], target: it[2], names: it[gLang() ? 4 : 3] };
  return null;
}

// "Show me": go there, light it up, and leave a card to come back to the guide.
function guideGo(id) {
  const it = guideItem(id); if (!it) return;
  const tg = it.target;
  ui.guideOpen = id;
  if (tg.settings) { openSettings(tg.settings); return coach(it, null); }
  closeModal();
  if (tg.open === 'plan') { openPlan(); return coach(it, null); }
  if (tg.open === 'review') { openReview(); return coach(it, null); }
  if (tg.open === 'week') { openWeekReview(); return coach(it, null); }
  if (tg.view) { ui.view = tg.view; ui.selected = null; refresh(); return setTimeout(() => coach(it, tg.spot), 60); }
  if (tg.task) {
    // Open a task page (the selected one, or the first open task) to show the spot on it.
    const x = taskById(ui.selected) || data.tasks.find((y) => isActive(y));
    if (x) { ui.view = ui.view === 'today' ? 'pending' : ui.view; ui.selected = x.id; ui.dShowAll = x.id; refresh(); } // show every field so the spot is there
    return setTimeout(() => coach(it, x ? tg.task : null), 120);
  }
  coach(it, null);
}
function coach(it, spot) {
  document.querySelector('.coach')?.remove();
  document.querySelectorAll('.coach-spot').forEach((e) => e.classList.remove('coach-spot'));
  const el = spot && document.querySelector(spot);
  if (el) { el.classList.add('coach-spot'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  const L = gLang();
  const card = document.createElement('div');
  card.className = 'coach';
  card.innerHTML = `<span class="g-ico">${icon(it.ico)}</span>
    <div class="coach-txt"><b>${it.names[0]}</b><span>${(GUIDE_MORE[it.id] || [])[L] || it.names[1]}</span></div>
    <div class="coach-acts"><button data-coach-back>${L ? '‹' : '›'} ${t('guideBack')}</button><button class="primary" data-coach-ok>${t('guideGotIt')}</button></div>`;
  document.body.appendChild(card);
  clearTimeout(coach.timer);
  coach.timer = setTimeout(() => el && el.classList.remove('coach-spot'), 6000);
}
function closeCoach() {
  document.querySelector('.coach')?.remove();
  document.querySelectorAll('.coach-spot').forEach((e) => e.classList.remove('coach-spot'));
}

document.addEventListener('click', (e) => {
  const q = (s) => e.target.closest && e.target.closest(s);
  let b;
  if ((b = q('[data-guide-go]'))) { e.preventDefault(); return guideGo(b.dataset.guideGo); }
  if (q('[data-coach-ok]')) return closeCoach();
  if (q('[data-coach-back]')) {
    closeCoach();
    document.querySelectorAll('.modal-bg').forEach((m) => { if (!m.closest('#modalRoot')) m.remove(); }); // a plan / review dialog
    openSettings('guide').then(() => document.querySelector(`[data-gitem="${ui.guideOpen}"]`)?.scrollIntoView({ block: 'center' }));
  }
});
// Only one item open at a time; remember it.
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (!d.matches || !d.matches('.g-item')) return;
  if (d.open) { ui.guideOpen = d.dataset.gitem; document.querySelectorAll('.g-item[open]').forEach((o) => o !== d && (o.open = false)); }
}, true);
// Search: filters the list as you type.
document.addEventListener('input', (e) => {
  if (e.target.id !== 'gSearch') return;
  const q = e.target.value.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll('.g-item').forEach((d) => { const hit = !q || d.textContent.toLowerCase().includes(q); d.hidden = !hit; if (hit) shown++; });
  document.querySelectorAll('.g-group').forEach((g) => { g.hidden = ![...g.querySelectorAll('.g-item')].some((d) => !d.hidden); });
  document.querySelector('.g-none').hidden = shown > 0;
});
