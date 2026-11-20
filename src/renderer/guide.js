// ---------------- App guide (Settings › Guide) ----------------
// Every feature in one place: what it does, where to find it, and a "Show me" button that
// takes you there. Grouped by how you'd use them during a day.

const GUIDE = [
  { group: 'day', items: [
    { ico: 'today', go: 'today', ar: ['صفحة النهارده', 'يومك كله في صفحة: كارت "دلوقتي" بحاجة واحدة تبدأ بيها، وخطتك، وعادات النهارده، واللي متأخر.', 'أول تاب'], en: ['The Today page', 'Your whole day on one page: a "Now" card with one thing to start, your plan, today\'s habits, and what\'s late.', 'The first tab'] },
    { ico: 'today', go: 'plan', ar: ['خطة النهارده', 'الصبح بتختار 3 لـ 5 حاجات بس، وبتشوف يومك اتملى ولا لسه من الوقت المتوقع لكل تاسك.', 'النهارده ← الخطة'], en: ["Today's plan", 'Each morning pick 3 to 5 things, and see from each task\'s time whether your day is full.', 'Today › Plan'] },
    { ico: 'clock', go: null, ar: ['وضع التركيز', 'تختار المدة وتشتغل على حاجة واحدة، والخطوة الجاية قدامك، والفار ماسك ساعة. ولما الوقت يخلص يسألك تكمّل ولا تستريح.', '▶ ركّز على الكارت، أو حرف F'], en: ['Focus mode', 'Pick a length and work on one thing with the next step in front of you while the mouse times you. When time is up it asks: another round or a break?', '▶ Focus on a card, or F'] },
    { ico: 'clock', go: null, ar: ['الوقت المتوقع', 'تحدد التاسك هتاخد قد إيه، والتطبيق يحسب يومك ويقارن تقديرك بالوقت الحقيقي.', 'صفحة التاسك ← هتاخد قد إيه'], en: ['Time estimates', 'Say how long a task takes; the app adds up your day and compares your guesses with the real time.', 'Task page › How long it takes'] },
    { ico: 'moon', go: 'review', ar: ['مراجعة آخر اليوم', 'الساعة 5 الفار يفكّرك: خلصت إيه، وانقل الباقي لبكرة بدوسة.', 'النهارده ← راجع يومك'], en: ['End-of-day review', 'At 5 PM the mouse reminds you: see what got done and move the rest to tomorrow in one click.', 'Today › Review your day'] }
  ] },
  { group: 'long', items: [
    { ico: 'habits', go: 'habits', ar: ['عاداتي', 'مذاكرة أو جيم أو قراية: أيام محددة، أو مرات في الأسبوع، أو وقت في الأسبوع. ومتابعة زي النتيجة، واليوم اللي يفوت بيتسجل فات.', 'تاب عاداتي'], en: ['Habits', 'Study, gym, reading: set days, times a week, or time a week, tracked like a calendar. A missed day stays missed.', 'Habits tab'] },
    { ico: 'calendar', go: 'week', ar: ['مراجعة الأسبوع', 'أرقام أسبوعك ومقارنتها باللي قبله، وحاجات عن نفسك، و3 أهداف للأسبوع الجاي.', 'المراجعة ← مراجعة الأسبوع'], en: ['Weekly review', 'Your week in numbers against the last one, what your data says about you, and 3 goals for next week.', 'Review › Weekly review'] },
    { ico: 'report', go: 'report', ar: ['التقرير', 'اللي اتقفل واتضاف، ومين عنده حاجات متعطلة، ووقت التركيز حسب الفولدر. وتقدر تنسخه أو تطلّعه Excel.', 'تاب المراجعة'], en: ['Report', 'What was closed and added, who is holding things up, focus time by folder. Copy it or export to Excel.', 'Review tab'] }
  ] },
  { group: 'tasks', items: [
    { ico: 'matrix', go: 'matrix', ar: ['المصفوفة', 'رتّب التاسكات بالأهمية والاستعجال: 1 اعملها دلوقتي، 2 خطط لها، 3 فوّضها، 4 استغنى عنها.', 'تاب المصفوفة، أو الأرقام 1–4'], en: ['Matrix', 'Sort tasks by importance and urgency: 1 do now, 2 plan, 3 delegate, 4 drop.', 'Matrix tab, or keys 1–4'] },
    { ico: 'calendar', go: 'calendar', ar: ['التقويم', 'كل تاسكاتك على أيام الشهر. اسحب تاسك ليوم تاني عشان تغيّر ميعادها.', 'تاب التقويم'], en: ['Calendar', 'All your tasks on the month. Drag one to another day to move it.', 'Calendar tab'] },
    { ico: 'folder', go: null, ar: ['الفولدرات', 'فولدرات جوه فولدرات. اسحب الفولدر عشان ترتّبه أو تحطه جوه فولدر تاني.', 'الشريط الجانبي'], en: ['Folders', 'Folders inside folders. Drag a folder to reorder it or put it inside another.', 'Sidebar'] },
    { ico: 'user', go: null, ar: ['مستني رد من', 'لما تاسك تبقى عند حد تاني، سجّل اسمه وتابع بقالها كام يوم عنده.', 'صفحة التاسك ← معلّق عند'], en: ['Waiting on people', "When a task is with someone else, add their name and see how long they've had it.", 'Task page › Pending with'] },
    { ico: 'repeat', go: null, ar: ['التاسكات المتكررة', 'يومي أو أسبوعي أو شهري أو سنوي. كل مرة بتبقى تاسك لوحدها في يومها.', 'صفحة التاسك ← تكرار'], en: ['Repeating tasks', 'Daily, weekly, monthly or yearly. Each round is its own task on its own day.', 'Task page › Repeat'] },
    { ico: 'note', go: null, ar: ['الملاحظات والسجل', 'صفحات ملاحظات منسّقة، وسجل متابعة بالتاريخ والساعة، وملفات ولينكات.', 'صفحة التاسك'], en: ['Notes and log', 'Formatted note pages, a follow-up log with date and time, files and links.', 'Task page'] },
    { ico: 'overdue', go: null, ar: ['عداد التأجيل', 'كل ما تأخّر موعد تاسك بيتحسب. وبعد 3 مرات الفار يسألك: تبدأ؟ تقسّمها؟ تديها لحد؟ ولا تشيلها؟', 'بيشتغل لوحده'], en: ['Put-off counter', 'Each time a due date moves later it counts. After 3 the mouse asks: start, split, hand off, or drop?', 'Works by itself'] }
  ] },
  { group: 'anywhere', items: [
    { ico: 'edgeRight', go: 'widget', ar: ['الويدجت', 'تاسكاتك وعاداتك والتايمر فوق كل البرامج، أو مستخبي على جنب الشاشة. ولو عايز تحرّكه، اسحب الفار من ديله.', 'الإعدادات ← ويدجت سطح المكتب'], en: ['Desktop widget', 'Your tasks, habits and timer above every app, or tucked at the screen edge. Drag the mouse by its tail to move it.', 'Settings › Desktop widget'] },
    { ico: 'plus', go: null, ar: ['إضافة سريعة', 'ضيف تاسك من أي برنامج من غير ما تفتح التطبيق.', 'Ctrl+Alt+Space'], en: ['Quick add', 'Add a task from any app without opening this one.', 'Ctrl+Alt+Space'] },
    { ico: 'bell', go: 'notifications', ar: ['التذكيرات', 'الفار بيطلع ويرن الجرس في الميعاد، وتقدر تقوله "فكّرني بعد 10 دقايق".', 'صفحة التاسك ← تذكير'], en: ['Reminders', 'The mouse walks in and rings a bell on time; you can say "remind me in 10 min".', 'Task page › Reminder'] },
    { ico: 'folder', go: 'data', ar: ['النسخ الاحتياطية', 'نسخة تلقائية كل يوم، وتقدر ترجع لأي واحدة أو تحفظ نسخة في أي مكان.', 'الإعدادات ← البيانات'], en: ['Backups', 'An automatic copy every day; restore any of them or save a copy anywhere.', 'Settings › Data & backups'] }
  ] }
];
const GUIDE_GROUPS = { day: ['يومك', 'Your day'], long: ['على المدى الطويل', 'The long run'], tasks: ['تنظيم التاسكات', 'Organizing tasks'], anywhere: ['في أي مكان', 'Anywhere'] };

function guideHtml() {
  const L = lang() === 'ar' ? 0 : 1;
  const k = lang() === 'ar' ? 'ar' : 'en';
  return `<p class="small muted guide-intro">${t('guideIntro')}</p>` + GUIDE.map((g) => `
    <h5 class="guide-h">${GUIDE_GROUPS[g.group][L]}</h5>
    <div class="guide-grid">${g.items.map((it) => `<div class="guide-card">
      <span class="g-ico">${icon(it.ico)}</span>
      <div class="g-txt"><b>${it[k][0]}</b><p>${it[k][1]}</p>
        <div class="g-foot"><small>${icon('pin')} ${it[k][2]}</small>${it.go ? `<button class="g-go" data-guide-go="${it.go}">${t('showMe')} ›</button>` : ''}</div></div></div>`).join('')}</div>`).join('');
}

// Every version's "what's new", newest first (Settings › Updates).
function changelogHtml() {
  const k = lang() === 'ar' ? 'ar' : 'en';
  return `<details class="cl-all"><summary>${t('allChanges')}</summary>${Object.entries(CHANGELOG).map(([v, c]) =>
    `<div class="cl-ver"><b>${v}</b><ul>${(c[k] || c.en).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</details>`;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-guide-go]');
  if (!b) return;
  const go = b.dataset.guideGo;
  if (['widget', 'notifications', 'data'].includes(go)) return openSettings(go);
  closeModal();
  if (go === 'plan') return openPlan();
  if (go === 'review') return openReview();
  if (go === 'week') return openWeekReview();
  ui.view = go; ui.selected = null; refresh(); animateIn($('list'));
});
