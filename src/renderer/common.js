// Shared helpers for the main window and the widget.
const I18N = {
  ar: {
    appName: 'Elfar Tasks', views: 'العرض', areas: 'الفولدرات', today: 'النهارده', pending: 'Pending', overdue: 'متأخرة',
    starred: 'مميزة', waiting: 'معلّق عند', closed: 'مقفولة', all: 'الكل', inbox: 'من غير فولدر', calendar: 'التقويم',
    addTask: 'أضف تاسك واضغط Enter…', search: 'بحث…', addArea: 'فولدر جديد', addProject: 'فولدر فرعي جديد',
    start: 'البداية', due: 'الموعد النهائي', closure: 'الإغلاق', notSet: 'مش محدد', status: 'الحالة',
    stPending: 'Pending', stOverdue: 'متأخرة', stClosed: 'مقفولة', stDueToday: 'النهارده',
    subtasks: 'المهام الفرعية', addSubtask: 'أضف مهمة فرعية…', notes: 'الصفحة / الملاحظات',
    notesPh: 'اكتب أي حاجة تخص التاسك: تفاصيل، لينكات، أفكار…', log: 'سجل المتابعة', addLog: 'حصل إيه النهارده؟',
    closeToday: 'اقفل النهارده', reopen: 'افتح تاني', del: 'حذف', confirmDelTask: 'تمسح التاسك دي؟',
    confirmDelArea: 'حذف الفولدر؟ التاسكات اللي فيه هتبقى "من غير فولدر".', waitingOn: 'مستني رد من…', star: 'تمييز',
    area: 'الفولدر', noTask: 'اختار تاسك عشان تفتح صفحته', emptyList: 'مفيش تاسكات هنا', showClosed: 'اعرض المقفول',
    allSubsDone: 'كل المهام الفرعية خلصت. تقفل التاسك بتاريخ النهارده؟', settings: 'الإعدادات', language: 'اللغة',
    widget: 'ويدجت سطح المكتب', showWidget: 'اعرض الويدجت', onTop: 'فوق كل الشبابيك', opacity: 'الشفافية',
    widgetShows: 'الويدجت يعرض', focus: 'النهارده + المتأخر + المميز', launch: 'يفتح مع تشغيل الويندوز',
    backup: 'نسخة احتياطية', export: 'تصدير', import: 'استيراد', closeBtn: 'تم', rename: 'إعادة تسمية', color: 'اللون',
    name: 'الاسم', save: 'حفظ', cancel: 'إلغاء', days: 'يوم', openedFor: 'مفتوحة من', tookDays: 'خلصت في',
    closedThisMonth: 'اتقفل الشهر ده', openTasks: 'مفتوحة', sortBy: 'ترتيب', sortStart: 'الأقدم بداية',
    sortDue: 'الأقرب موعداً', sortUpdated: 'آخر تعديل', title: 'عنوان التاسك', nothingToday: 'مفيش حاجة مستعجلة 👌',
    openApp: 'افتح التطبيق', hide: 'إخفاء', prev: 'السابق', next: 'التالي', importDone: 'تم الاستيراد',
    confirmImport: 'الاستيراد هيستبدل كل البيانات الحالية. تكمل؟',
    people: 'الأشخاص', allPeople: 'كل الأشخاص', personPh: 'اكتب اسم واختار أو اضغط Enter…', since: 'من', followUp: 'سجّل متابعة', followedUpWith: 'تابعت مع', linkedTo: 'مرتبط بـ', editPerson: 'تعديل الشخص', addPerson: 'شخص جديد', confirmDelPerson: 'حذف الشخص؟ هيتشال من كل التاسكات.', noOne: 'مش معلّق عند حد', openWith: 'تاسكات مفتوحة معاه', remove: 'شيل', personHint: 'اربط الشخص بالفولدرات عشان يظهر أول في الاقتراحات.',
    logOwner: 'مسؤول (اختياري)…', logAt: 'الوقت (فاضي = دلوقتي)', me: 'أنا', nowWith: 'بقت عند', finishedPart: 'خلص الجزء بتاعه', backWithMe: 'رجعت عندي',
    timeline: 'مسار التاسك', longest: 'أطول مدة', handoff: 'تسليم', still: 'لسه عنده',
    reminder: 'تذكير', remindPh: 'من غير تذكير', in1h: 'بعد ساعة', tomorrow9: 'بكرة 9ص', dayBeforeDue: 'قبل الـ Due بيوم', dueMorning: 'يوم الـ Due 9ص', clear: 'شيل',
    autoHide: 'يختفي على جنب ويظهر بالـ hover', edgeRight: 'يمين', edgeLeft: 'شمال', edgeTop: 'فوق', dragTail: 'امسك الديل واسحب عشان تحرّك الفار، أو تنقله لفوق أو للجنب التاني', off: 'مقفول', widgetMode: 'وضع الظهور',
    about: 'عن التطبيق', creditBy: 'تنفيذ', sendFeedback: 'ابعت إيميل', feedbackHint: 'عندك فكرة أو لقيت مشكلة؟ ابعتها على GitHub (محتاج حساب مجاني) وهتتضاف في التحديث الجاي.', reportBug: 'بلّغ عن مشكلة', suggestIdea: 'اقترح فكرة', seeRequests: 'شوف الطلبات', version: 'الإصدار',
    tomorrowLbl: 'بكرة', nextWeek: 'بعد أسبوع', repeat: 'تكرار', noRepeat: 'مش متكررة', every: 'كل',
    rDay: 'أيام', rWeek: 'أسابيع', rMonth: 'شهور', rYear: 'سنين', r1day: 'كل يوم', r1week: 'كل أسبوع', r1month: 'كل شهر', r1year: 'كل سنة',
    undo: 'تراجع', closedMsg: 'اتقفلت', nextOn: 'الجاية', deleted: 'اتمسحت',
    files: 'ملفات ولينكات', attachFile: 'إرفاق ملف', pasteLink: 'الصق لينك (SharePoint، Drive…) واضغط Enter', dropFiles: 'أو اسحب ملفات من الجهاز هنا', showInFolder: 'افتح مكانه',
    searchAll: 'ابحث في كل التاسكات، الملاحظات، الأشخاص…', report: 'تقرير', reportFrom: 'من', copyReport: 'نسخ', exportCsv: 'Excel',
    rClosed: 'اتقفلت', rAdded: 'اتضافت', rByArea: 'المقفول حسب الفولدر', rStuck: 'متعطلة عند ناس', copied: 'اتنسخ، الصقه في إيميل أو Teams',
    whatsNew: 'الجديد في التحديث', gotIt: 'تمام',
    upDev: 'التحديث التلقائي بيشتغل في النسخة المتسطبة بس', upChecking: 'بيدوّر على تحديث…', upLatest: 'عندك آخر إصدار ✓', upDownloading: 'بينزّل التحديث', upReady: 'تحديث جاهز', upError: 'مقدرش يوصل لسيرفر التحديثات', restartUpdate: 'أعد التشغيل وحدّث', checkNow: 'دوّر دلوقتي', updates: 'التحديثات',
    general: 'عام', notifications: 'الإشعارات', morningSummary: 'ملخص الصبح', nudgeAfter: 'نبّهني لو حد مأخر تاسك أكتر من', textSize: 'حجم الخط',
    shortcutsHint: 'اختصارات: Ctrl+N تاسك · Ctrl+K بحث · Ctrl+Alt+Space إضافة من أي برنامج · ↑↓ تنقل · Space قفل · 1-4 تصنيف · S تمييز · Delete حذف',
    screen: 'الشاشة', dataSec: 'البيانات', dataFolder: 'مكان حفظ البيانات', changeFolder: 'تغيير…', syncHint: 'اختار فولدر OneDrive عشان نفس البيانات تبقى على جهاز الشغل والبيت.',
    backupsDaily: 'نسخ احتياطية تلقائية (آخر 30 يوم)', restore: 'استرجاع', confirmRestore: 'هترجع البيانات للنسخة دي. البيانات الحالية هتتحفظ في نسخة .bak. تكمل؟', tasksWord: 'تاسك',
    addOnDay: 'تاسك في اليوم ده', upcomingRepeats: 'المتكرر الجاي', onDay: 'يوم', atDueTime: 'في وقت الـ Due', minBefore: 'دقيقة قبلها', hourBefore: 'ساعة قبلها', dayBefore: 'أيام قبلها', dayBefore1: 'يوم قبلها', weekBefore: 'أسبوع قبلها',
    dueTime: 'وقت الـ Due (اختياري)', beforeDue: 'قبل الـ Due بـ', exactTime: 'أو وقت محدد', nextNote: 'ملاحظة للمرة الجاية', nextNotePh: 'حاجة تاخد بالك منها في التاسك الجاية (هتظهر فيها وفي التذكير بتاعها)', done: 'تم',
    newTask: 'تاسك جديد', addBtn: 'إضافة', titleRequired: 'اكتب عنوان التاسك الأول', added: 'اتضافت', open: 'افتح',
    composerHint: 'Enter للإضافة · Esc للإغلاق', noDue: 'من غير Due', noPrio: 'من غير تصنيف',
    matrix: 'المصفوفة', priority: 'التصنيف', unclassified: 'مش متصنفة', important: 'مهم', notImportant: 'مش مهم', urgent: 'مستعجل', notUrgent: 'مش مستعجل', sortPriority: 'الأهم أولاً', clearPriority: 'شيل التصنيف',
    q1: 'مهم ومستعجل', q2: 'مهم ومش مستعجل', q3: 'مش مهم ومستعجل', q4: 'لا مهم ولا مستعجل',
    q1a: 'اعملها دلوقتي', q2a: 'خطط لها', q3a: 'فوّضها', q4a: 'استغنى عنها', matrixHint: 'اسحب أي تاسك لمربع تاني عشان تغيّر تصنيفها، أو من "مش متصنفة" لأي مربع.',
    allAreas: 'كل التاسكات', dragHint: 'سيب التاسك على فولدر عشان تنقله', movedTo: 'اتنقلت إلى',
    dataTitle: 'البيانات والنسخ الاحتياطية', dataWhere: 'مكان حفظ التاسكات', autoBk: 'نسخ احتياطية تلقائية', autoBkDesc: 'التطبيق بيحفظ نسخة لوحده كل يوم، وبيحتفظ بآخر 30 يوم. لو حصلت مشكلة، اختار يوم وارجع له.', restoreBtn: 'استرجاع', openBackups: 'افتح فولدر النسخ',
    manualCopies: 'نسخ بإيدك', saveCopy: 'حفظ نسخة في ملف', saveCopyDesc: 'كل التاسكات والفولدرات والأشخاص في ملف واحد. استخدمه عشان تنقل بياناتك لجهاز تاني، أو تحتفظ بنسخة في مكان آمن.', saveCopyBtn: 'حفظ نسخة…',
    loadCopy: 'فتح نسخة محفوظة', loadCopyDesc: 'بيستبدل كل اللي هنا بملف حفظته قبل كده. قبلها بيحفظ "نسخة أمان" من بياناتك الحالية، تقدر ترجعلها من النسخ التلقائية.', loadCopyBtn: 'فتح نسخة…',
    excelTitle: 'تصدير لـ Excel', excelDesc: 'جدول بكل التاسكات تقراه أو تفلتره أو تبعته لحد. ده للقراءة بس، ومينفعش يرجع للتطبيق.', excelBtn: 'تصدير…',
    safetyCopy: 'نسخة أمان', confirmLoadTitle: 'تستبدل بياناتك الحالية بالنسخة دي؟', confirmLoadText: 'هيتحفظ "نسخة أمان" من بياناتك الحالية الأول، فتقدر ترجع لها.', restoredMsg: 'اترجعت البيانات. نسخة الأمان موجودة في النسخ التلقائية', savedCopyMsg: 'اتحفظ ✓', badCopy: 'الملف ده مش نسخة من Elfar Tasks',
    launchDesc: 'بيفتح في الخلفية جنب الساعة أول ما تفتح الجهاز', textSizeDesc: 'أو Ctrl + و Ctrl − من أي مكان', shortcuts: 'الاختصارات', summaryDesc: 'إشعار كل صبح فيه تاسكات اليوم والمتأخر', nudgeTitle: 'تنبيه المتابعة', widgetDesc: 'قايمة صغيرة على سطح المكتب بتاسكاتك', widgetModeDesc: 'ثابت فوق كل الشبابيك، أو مستخبي على جنب ويظهر لما تقرّب الماوس', widgetShowsDesc: 'الكروت اللي فوق في الويدجت بتغيّر ده مؤقتًا', updatesDesc: 'التحديثات بتنزل لوحدها من GitHub', urgency: 'الاستعجال', importance: 'الأهمية', mxHow: 'كل مربع معناه إيه؟',
    q1tip: 'اللي لازم يتعمل النهارده', q2tip: 'شغل مهم ليه وقت', q3tip: 'حاجات حد تاني يقدر يعملها', q4tip: 'حاجات ممكن تستغنى عنها',
    q1how: 'مواعيد تسليم، مشاكل، حاجات عليها الدور النهارده. ابدأ بيها.', q2how: 'تخطيط، تطوير، متابعة قبل ما تبقى مشكلة. حطلها ميعاد في التقويم.', q3how: 'مقاطعات وطلبات بسيطة. سلّمها لحد تاني من "معلّق عند".', q4how: 'حاجات بتضيّع الوقت. استغنى عنها أو سيبها لبعدين.',
    page: 'صفحة', pageN: 'صفحة {n}', addPage: 'صفحة جديدة', pageRenameHint: 'دوسة مرتين لتغيير الاسم', renamePage: 'اسم الصفحة', confirmDelPage: 'تمسح الصفحة دي؟',
    notesHint: 'اكتب # للعنوان، - للنقط، [] لقايمة تشيك، وCtrl+B للتقيل. Ctrl + دوسة على اللينك يفتحه.',
    toolH1: 'عنوان كبير', toolH2: 'عنوان صغير', toolBold: 'تقيل (Ctrl+B)', toolItalic: 'مايل (Ctrl+I)', toolUnderline: 'تحته خط (Ctrl+U)', toolStrike: 'متشطب', toolBullets: 'نقط', toolNumbers: 'ترقيم', toolChecks: 'قايمة تشيك', toolQuote: 'اقتباس', toolLink: 'لينك', toolLine: 'خط فاصل', toolClear: 'شيل التنسيق',
    quickMode: 'سريع', fullMode: 'كامل', subsPh: 'مهمة فرعية في كل سطر', composerHintFull: 'Ctrl+Enter للإضافة · Esc للإغلاق',
    remindStyle: 'شكل التذكير', remindStyleDesc: 'فار بيطلع على جنب الشاشة ومعاه جرس، أو إشعار ويندوز العادي', styleMouse: 'فار بيرن الجرس 🐭🔔', styleNotif: 'إشعار ويندوز', remindSound: 'صوت التذكير',
    soundChime: 'نغمة', soundBell: 'جرس', soundSqueak: 'صوت فار 🐭', soundNone: 'من غير صوت', tryIt: 'جرّب', testReminder: 'كده هيبان التذكير 🐭', snoozeLbl: 'فكّرني تاني بعد', minShort: 'د', hourShort: 'س',
    confirmDelLog: 'تمسح السطر ده من سجل المتابعة؟', hDoneToday: 'خلصت من النهارده', fmQ: 'هتركز قد إيه؟', fmOwn: 'وقت تاني', fmHint: 'دوس على مدة تبدأ على طول، أو اكتب الدقايق اللي تناسبك', theme: 'شكل التطبيق', themeDesc: 'فاتح، غامق، أو زي ويندوز', theme_system: 'زي ويندوز', theme_light: 'فاتح', theme_dark: 'غامق', pkAnnoyed: 'آي! ديلي 😤', planTitle: 'خطة النهارده', planEdit: 'عدّل', planEmpty: 'الخطة فاضية. دوس "عدّل" واختار.', planCta: 'خطط يومك في دقيقة', planCtaSub: 'اختار 3 لـ 5 حاجات بس تخلّصهم النهارده', planIntro: 'اختار من 3 لـ {n} حاجات بس تخلّصهم النهارده. الباقي في مكانه ومش هيضيع.', planNothing: 'مفيش تاسكات مفتوحة. يوم رايق 🧀', planAuto: 'افتحلي الخطة لوحدها أول ما أفتح التطبيق كل يوم', planSkip: 'مش النهارده', planGo: 'يلا نبدأ', planPicked: 'اخترت', planTooMany: 'اخترت {n}. أكتر من 5 بيخلّي اليوم تقيل ويسهّل التأجيل', fromYesterday: 'نقلتها من امبارح', hDoNow: 'اعملها دلوقتي', planSoon: 'جاية في يومين', planOthers: 'باقي التاسكات', review: 'المراجعة', reviewBtn: 'راجع يومك', reviewTip: 'شوف خلصت إيه، وانقل الباقي لبكرة', reviewTitle: 'مراجعة النهارده', rvDone: 'خلصت النهارده', rvFocus: 'ركزت', rvPlan: 'من الخطة', rvWeek: 'اللي خلص كل يوم في آخر 7 أيام', rvDoneList: 'اللي خلص', rvLeft: 'لسه فاضل', rvAllDone: 'مفيش حاجة فاضلة من النهارده 🎉', rvMoveAll: 'انقل الباقي كله لبكرة', rvBye: 'تمام، نشوفك بكرة', reviewSet: 'مراجعة آخر اليوم', reviewSetDesc: 'في الوقت ده الفار يفكّرك تراجع يومك وتنقل اللي فاضل لبكرة', rvAsk: 'يومك قرب يخلص', rvAskSub: 'تعالى نشوف خلصت إيه ونرتب بكرة في دقيقة', rvGo: 'يلا نراجع', rvLater: 'بعدين', nextStep: 'الخطوة الجاية', fStart: 'ركّز فيها', fStartTip: 'ابدأ جلسة تركيز على التاسك دي (F)', fWorkingOn: 'شغال على', fPaused: 'واقف مؤقتًا', fOnBreak: 'استراحة', fEnded: 'خلصت {n} دقيقة تركيز', fBreakOver: 'الاستراحة خلصت', fPause: 'وقفة', fResume: 'كمّل', fStop: 'وقف', fTaskDone: 'التاسك خلصت', fMore: 'كمّل', fBreak: 'استراحة', fSkipBreak: 'كفاية استراحة', fBack: 'يلا نرجع', fEnough: 'كفاية كده', fExpand: 'شاشة التركيز', fMinimize: 'صغّر', fOf: 'من', fNoSteps: 'مفيش خطوات. اكتب أول خطوة صغيرة تقدر تبدأ بيها 👇', fAddStep: 'أضف خطوة…', fSoFar: 'ركزت فيها لحد دلوقتي', focusTime: 'وقت التركيز', focusLen: 'مدة جلسة التركيز', focusLenDesc: 'مدة الاستراحة بعد جلسة التركيز. ومدة الجلسة نفسها بتختارها كل مرة تبدأ', breakLen: 'استراحة التركيز', fAdd5: 'زوّد 5 دقايق', minWord: 'دقيقة', rFocus: 'ركزت', rFocusByArea: 'وقت التركيز حسب الفولدر', pnTitle: 'التاسك دي اتأجلت {n}', pnText: 'غالبًا فيها حاجة مخلياها تقيلة. تحب نعمل فيها إيه؟', pnFocus: 'ابدأ فيها دلوقتي', pnFocusSub: 'البداية أصعب حاجة، والباقي بييجي لوحده', pnSplit: 'قسّمها لخطوات أصغر', pnSplitSub: 'اكتب أول خطوة تاخد 10 دقايق', pnHand: 'اديها لحد', pnHandSub: 'لو حد تاني يقدر يعملها', pnDrop: 'مبقتش مهمة، شيلها', pnDropSub: 'مش كل حاجة لازم تتعمل', pnKeep: 'سيبها زي ما هي', postponedTip: 'عدد المرات اللي الموعد اتأجل فيها', lateBy: 'متأخرة', closedOn: 'اتقفلت', sinceDate: 'من', openNow: 'مفتوحة دلوقتي', prioFilter: 'التصنيف', openOn: 'يفتح إمتى', openOnDesc: 'لما الويدجت مستخبي على جنب: يفتح أول ما الماوس يعدّي على الفار، ولا لما تدوس عليه بس', openHover: 'لما الماوس يعدّي', openClick: 'لما أدوس عليه', langSwitch: 'غيّر اللغة', closeTaskQ: 'تقفل التاسك دي؟', closeTaskQText: 'هتتسجل إنها خلصت النهارده.', yesClose: 'أيوه، اقفلها', noBack: 'لا، رجوع', closedThanks: 'اتقفلت ✓ شكرًا!', closedThanksSub: 'الفار مبسوط منك 🧀', stopReminder: 'وقف التذكير بس', closeTaskBtn: 'اقفل التاسك', dayClear: 'مفيش حاجة فاضلة النهارده، الفار مبسوط 🧀', cheerTitle: 'عاش! خلصت كل تاسكات النهارده 🎉', cheerSub: 'الفار فخور بيك', stScheduled: 'يبدأ', later: 'مجدولة', scheduledHint: 'دي تاسكات لسه ميعادها مجاش (زي المرة الجاية من تاسك متكررة). هتظهر في Pending يوم ما تبدأ.', wWeek: '7 أيام', wOthers: 'عند غيري',
    calHint: 'اضغط ＋ في أي يوم تضيف تاسك عليه · اسحب تاسك ليوم تاني يغيّر الـ Due · الباهت = المرات الجاية من تاسك متكررة.',
    ok: 'تمام', home: 'الرئيسية', mine: 'عندي أنا', withOthers: 'عند حد تاني', show: 'عرض', remindCustom: 'وقت محدد…', remindNeedsDue: 'حط Due عشان تقدر تتفكّر قبله بوقت', remindAt9: 'الـ Due من غير وقت، فالتذكير محسوب على 9 الصبح', dueTimeShort: 'الوقت',
    gMorning: 'صباح الخير', gAfternoon: 'مساء الخير', gEvening: 'مساء الخير', hWeek: 'الـ 7 أيام الجايين', hOthers: 'عند ناس تانية', hClosedWeek: 'اتقفلت الأسبوع ده',
    hFocus: 'ابدأ بدول', hComing: 'جاي قريب', hWaiting: 'مستني رد من', hReminders: 'تذكيرات النهارده', hAllClear: 'مفيش حاجة متأخرة ولا مستعجلة النهارده 🎉', hNothing: 'مفيش حاجة', avgClose: 'متوسط وقت الإنجاز', more: 'كمان', oldestDays: 'أقدم واحدة من', hAreasTitle: 'الفولدرات', hOpenN: 'مفتوحة', hSeeAll: 'اعرض الكل'
  },
  en: {
    appName: 'Elfar Tasks', views: 'Views', areas: 'Folders', today: 'Today', pending: 'Pending', overdue: 'Overdue',
    starred: 'Starred', waiting: 'Pending with', closed: 'Closed', all: 'All', inbox: 'No folder', calendar: 'Calendar',
    addTask: 'Add a task and press Enter…', search: 'Search…', addArea: 'New folder', addProject: 'New subfolder',
    start: 'Start', due: 'Due', closure: 'Closure', notSet: 'Not set', status: 'Status',
    stPending: 'Pending', stOverdue: 'Overdue', stClosed: 'Closed', stDueToday: 'Due today',
    subtasks: 'Subtasks', addSubtask: 'Add a subtask…', notes: 'Page / notes',
    notesPh: 'Write anything about this task: details, links, ideas…', log: 'Follow-up log', addLog: 'What happened today?',
    closeToday: 'Close today', reopen: 'Reopen', del: 'Delete', confirmDelTask: 'Delete this task?',
    confirmDelArea: 'Delete this folder? Its tasks will have no folder.', waitingOn: 'Waiting on…', star: 'Star',
    area: 'Folder', noTask: 'Pick a task to open its page', emptyList: 'No tasks here', showClosed: 'Show closed',
    allSubsDone: 'All subtasks are done. Close the task with today\'s date?', settings: 'Settings', language: 'Language',
    widget: 'Desktop widget', showWidget: 'Show widget', onTop: 'Always on top', opacity: 'Opacity',
    widgetShows: 'Widget shows', focus: 'Today + overdue + starred', launch: 'Open when Windows starts',
    backup: 'Backup', export: 'Export', import: 'Import', closeBtn: 'Done', rename: 'Rename', color: 'Color',
    name: 'Name', save: 'Save', cancel: 'Cancel', days: 'days', openedFor: 'Open for', tookDays: 'Took',
    closedThisMonth: 'Closed this month', openTasks: 'Open', sortBy: 'Sort', sortStart: 'Oldest start',
    sortDue: 'Nearest due', sortUpdated: 'Last updated', title: 'Task title', nothingToday: 'Nothing urgent 👌',
    openApp: 'Open app', hide: 'Hide', prev: 'Previous', next: 'Next', importDone: 'Imported',
    confirmImport: 'Importing replaces all current data. Continue?',
    people: 'People', allPeople: 'All people', personPh: 'Type a name, pick or press Enter…', since: 'since', followUp: 'Log a follow-up', followedUpWith: 'Followed up with', linkedTo: 'Linked to', editPerson: 'Edit person', addPerson: 'New person', confirmDelPerson: 'Delete this person? They will be removed from all tasks.', noOne: 'Not pending with anyone', openWith: 'Open tasks with them', remove: 'Remove', personHint: 'Link people to folders so they show first in suggestions.',
    logOwner: 'Owner (optional)…', logAt: 'Time (empty = now)', me: 'Me', nowWith: 'Now with', finishedPart: 'finished their part', backWithMe: 'Back with me',
    timeline: 'Task timeline', longest: 'Longest hold', handoff: 'Handoff', still: 'still there',
    reminder: 'Reminder', remindPh: 'No reminder', in1h: 'In 1 hour', tomorrow9: 'Tomorrow 9am', dayBeforeDue: '1 day before due', dueMorning: 'Due day 9am', clear: 'Clear',
    autoHide: 'Hide at screen edge, show on hover', edgeRight: 'Right', edgeLeft: 'Left', edgeTop: 'Top', dragTail: 'Hold the tail and drag to move the mouse, or to dock it at the top or the other side', off: 'Off', widgetMode: 'Show mode',
    about: 'About', creditBy: 'Credit', sendFeedback: 'Email', feedbackHint: 'Have an idea or found a problem? Post it on GitHub (free account) and it can make the next update.', reportBug: 'Report a problem', suggestIdea: 'Suggest an idea', seeRequests: 'See requests', version: 'Version',
    tomorrowLbl: 'Tomorrow', nextWeek: 'In a week', repeat: 'Repeat', noRepeat: "Doesn't repeat", every: 'Every',
    rDay: 'days', rWeek: 'weeks', rMonth: 'months', rYear: 'years', r1day: 'Every day', r1week: 'Every week', r1month: 'Every month', r1year: 'Every year',
    undo: 'Undo', closedMsg: 'Closed', nextOn: 'next one', deleted: 'Deleted',
    files: 'Files and links', attachFile: 'Attach file', pasteLink: 'Paste a link (SharePoint, Drive…) and press Enter', dropFiles: 'or drop files from your computer here', showInFolder: 'Show in folder',
    searchAll: 'Search all tasks, notes, people…', report: 'Report', reportFrom: 'From', copyReport: 'Copy', exportCsv: 'Excel',
    rClosed: 'Closed', rAdded: 'Added', rByArea: 'Closed by folder', rStuck: 'Stuck with people', copied: 'Copied. Paste it into an email or Teams',
    whatsNew: "What's new", gotIt: 'Got it',
    upDev: 'Auto-update works in the installed app only', upChecking: 'Checking for updates…', upLatest: "You're on the latest version ✓", upDownloading: 'Downloading update', upReady: 'Update ready', upError: "Couldn't reach the update server", restartUpdate: 'Restart and update', checkNow: 'Check now', updates: 'Updates',
    general: 'General', notifications: 'Notifications', morningSummary: 'Morning summary', nudgeAfter: 'Nudge me when someone holds a task over', textSize: 'Text size',
    shortcutsHint: 'Shortcuts: Ctrl+N task · Ctrl+K search · Ctrl+Alt+Space add from any app · ↑↓ move · Space close · 1-4 priority · S star · Delete',
    screen: 'Screen', dataSec: 'Data', dataFolder: 'Data folder', changeFolder: 'Change…', syncHint: 'Pick a OneDrive folder to keep the same data on your work and home computers.',
    backupsDaily: 'Automatic backups (last 30 days)', restore: 'Restore', confirmRestore: 'Your data goes back to this backup. Current data is kept as .bak. Continue?', tasksWord: 'tasks',
    addOnDay: 'Task on this day', upcomingRepeats: 'Upcoming repeats', onDay: 'day', atDueTime: 'At due time', minBefore: 'min before', hourBefore: 'h before', dayBefore: 'days before', dayBefore1: '1 day before', weekBefore: '1 week before',
    dueTime: 'Due time (optional)', beforeDue: 'Before due', exactTime: 'or an exact time', nextNote: 'Note for next time', nextNotePh: 'Something to keep in mind for the next one (shows on it and in its reminder)', done: 'Done',
    newTask: 'New task', addBtn: 'Add', titleRequired: 'Enter a task title first', added: 'Added', open: 'Open',
    composerHint: 'Enter to add · Esc to close', noDue: 'No due date', noPrio: 'No priority',
    matrix: 'Matrix', priority: 'Priority', unclassified: 'Unclassified', important: 'Important', notImportant: 'Not important', urgent: 'Urgent', notUrgent: 'Not urgent', sortPriority: 'Priority first', clearPriority: 'Clear priority',
    q1: 'Important & urgent', q2: 'Important & not urgent', q3: 'Not important & urgent', q4: 'Not important & not urgent',
    q1a: 'Do it now', q2a: 'Schedule it', q3a: 'Delegate it', q4a: 'Drop it', matrixHint: 'Drag a task to another box to change its priority, or from Unclassified into any box.',
    allAreas: 'All tasks', dragHint: 'Drop a task on a folder to move it', movedTo: 'Moved to',
    dataTitle: 'Data & backups', dataWhere: 'Where your tasks are saved', autoBk: 'Automatic backups', autoBkDesc: 'The app saves a copy by itself every day and keeps the last 30 days. If something goes wrong, pick a day and go back to it.', restoreBtn: 'Restore', openBackups: 'Open the backups folder',
    manualCopies: 'Copies you make', saveCopy: 'Save a copy to a file', saveCopyDesc: 'All your tasks, folders and people in one file. Use it to move your data to another computer, or to keep a copy somewhere safe.', saveCopyBtn: 'Save copy…',
    loadCopy: 'Load a saved copy', loadCopyDesc: 'Replaces everything here with a file you saved before. A "safety copy" of what is here now is kept first, and you can go back to it from the automatic backups.', loadCopyBtn: 'Load copy…',
    excelTitle: 'Export to Excel', excelDesc: 'A spreadsheet of all your tasks to read, filter or send to someone. It is for reading only and cannot be loaded back.', excelBtn: 'Export…',
    safetyCopy: 'Safety copy', confirmLoadTitle: 'Replace your current data with this copy?', confirmLoadText: 'A "safety copy" of your current data is saved first, so you can go back to it.', restoredMsg: 'Data restored. The safety copy is in the automatic backups', savedCopyMsg: 'Saved ✓', badCopy: 'This file is not an Elfar Tasks copy',
    launchDesc: 'Opens quietly next to the clock when you sign in', textSizeDesc: 'Or Ctrl + and Ctrl − anywhere', shortcuts: 'Shortcuts', summaryDesc: 'A notification each morning with the day\'s tasks and anything overdue', nudgeTitle: 'Follow-up nudge', widgetDesc: 'A small list of your tasks on the desktop', widgetModeDesc: 'Always on top, or tucked at the screen edge until the mouse comes near', widgetShowsDesc: 'The number cards on the widget change this for a while', updatesDesc: 'Updates download by themselves from GitHub', urgency: 'Urgency', importance: 'Importance', mxHow: 'What does each box mean?',
    q1tip: 'What has to be done today', q2tip: 'Important work that has time', q3tip: 'Things someone else can do', q4tip: 'Things you can let go',
    q1how: 'Deadlines, problems, things due today. Start with these.', q2how: 'Planning, growth, following up before it becomes a problem. Give them a date in the calendar.', q3how: 'Interruptions and small requests. Hand them to someone with "Pending with".', q4how: 'Time-wasters. Drop them or leave them for later.',
    page: 'Page', pageN: 'Page {n}', addPage: 'New page', pageRenameHint: 'Double-click to rename', renamePage: 'Page name', confirmDelPage: 'Delete this page?',
    notesHint: 'Type # for a heading, - for bullets, [] for a checklist, Ctrl+B for bold. Ctrl+click a link to open it.',
    toolH1: 'Heading', toolH2: 'Subheading', toolBold: 'Bold (Ctrl+B)', toolItalic: 'Italic (Ctrl+I)', toolUnderline: 'Underline (Ctrl+U)', toolStrike: 'Strikethrough', toolBullets: 'Bullets', toolNumbers: 'Numbers', toolChecks: 'Checklist', toolQuote: 'Quote', toolLink: 'Link', toolLine: 'Divider', toolClear: 'Clear formatting',
    quickMode: 'Quick', fullMode: 'Full', subsPh: 'One subtask per line', composerHintFull: 'Ctrl+Enter to add · Esc to close',
    remindStyle: 'Reminder style', remindStyleDesc: 'A mouse with a bell at the side of the screen, or the usual Windows notification', styleMouse: 'A mouse ringing a bell 🐭🔔', styleNotif: 'Windows notification', remindSound: 'Reminder sound',
    soundChime: 'Chime', soundBell: 'Bell', soundSqueak: 'Mouse squeak 🐭', soundNone: 'No sound', tryIt: 'Try it', testReminder: 'This is how a reminder looks 🐭', snoozeLbl: 'Remind me again in', minShort: 'min', hourShort: 'h',
    confirmDelLog: 'Delete this entry from the follow-up log?', hDoneToday: 'done today', fmQ: 'Focus for how long?', fmOwn: 'Other', fmHint: 'Click a length to start right away, or type the minutes you want', theme: 'App theme', themeDesc: 'Light, dark, or the same as Windows', theme_system: 'Same as Windows', theme_light: 'Light', theme_dark: 'Dark', pkAnnoyed: 'Ouch! My tail 😤', planTitle: "Today's plan", planEdit: 'Edit', planEmpty: 'The plan is empty. Press "Edit" to pick.', planCta: 'Plan your day in a minute', planCtaSub: 'Pick 3 to 5 things to finish today', planIntro: 'Pick 3 to {n} things to finish today. Everything else stays where it is.', planNothing: 'No open tasks. A calm day 🧀', planAuto: 'Open the plan by itself the first time I open the app each day', planSkip: 'Not today', planGo: "Let's go", planPicked: 'Picked', planTooMany: 'You picked {n}. More than 5 makes the day heavy and easy to put off', fromYesterday: 'Moved from yesterday', hDoNow: 'Do it now', planSoon: 'Due in 2 days', planOthers: 'Other tasks', review: 'Review', reviewBtn: 'Review your day', reviewTip: 'See what got done, and move the rest to tomorrow', reviewTitle: "Today's review", rvDone: 'done today', rvFocus: 'focused', rvPlan: 'of the plan', rvWeek: 'Tasks closed each day, last 7 days', rvDoneList: 'What got done', rvLeft: 'Still left', rvAllDone: 'Nothing left from today 🎉', rvMoveAll: 'Move all the rest to tomorrow', rvBye: 'Done, see you tomorrow', reviewSet: 'End-of-day review', reviewSetDesc: 'At this time the mouse reminds you to review your day and move what is left to tomorrow', rvAsk: 'Your day is almost over', rvAskSub: "Let's see what got done and set up tomorrow in a minute", rvGo: "Let's review", rvLater: 'Later', nextStep: 'Next step', fStart: 'Focus', fStartTip: 'Start a focus session on this task (F)', fWorkingOn: 'Working on', fPaused: 'Paused', fOnBreak: 'Break', fEnded: '{n} minutes of focus done', fBreakOver: 'Break is over', fPause: 'Pause', fResume: 'Resume', fStop: 'Stop', fTaskDone: 'Task done', fMore: 'Another', fBreak: 'Break', fSkipBreak: 'End break', fBack: 'Back to it', fEnough: "That's enough", fExpand: 'Focus screen', fMinimize: 'Minimize', fOf: 'of', fNoSteps: 'No steps yet. Write one small first step you can start with 👇', fAddStep: 'Add a step…', fSoFar: 'Focused on it so far:', focusTime: 'Focus time', focusLen: 'Focus session length', focusLenDesc: 'How long the break after a focus session is. You pick the session length each time you start', breakLen: 'Focus break', fAdd5: 'Add 5 minutes', minWord: 'min', rFocus: 'Focused', rFocusByArea: 'Focus time by folder', pnTitle: 'This task was put off {n}', pnText: 'Something probably makes it feel heavy. What would help?', pnFocus: 'Start on it now', pnFocusSub: 'Starting is the hardest part', pnSplit: 'Break it into smaller steps', pnSplitSub: 'Write a first step that takes 10 minutes', pnHand: 'Hand it to someone', pnHandSub: 'If someone else can do it', pnDrop: "It doesn't matter anymore, remove it", pnDropSub: 'Not everything has to get done', pnKeep: 'Leave it as is', postponedTip: 'How many times the due date was pushed back', lateBy: 'late', closedOn: 'Closed', sinceDate: 'since', openNow: 'Open now', prioFilter: 'Priority', openOn: 'Opens when', openOnDesc: 'When the widget is tucked at the screen edge: open it as soon as your cursor touches the little mouse, or only when you click it', openHover: 'Mouse passes over', openClick: 'I click it', langSwitch: 'Switch language', closeTaskQ: 'Close this task?', closeTaskQText: 'It will be marked done today.', yesClose: 'Yes, close it', noBack: 'No, go back', closedThanks: 'Closed ✓ Thank you!', closedThanksSub: 'The mouse is proud of you 🧀', stopReminder: 'Just stop the reminder', closeTaskBtn: 'Close the task', dayClear: 'Nothing left for today. Happy mouse 🧀', cheerTitle: 'Nice! Every task for today is done 🎉', cheerSub: 'The mouse is proud of you', stScheduled: 'Starts', later: 'Scheduled', scheduledHint: "Tasks that haven't started yet (like the next round of a repeating task). They move to Pending on their start day.", wWeek: '7 days', wOthers: 'Others',
    calHint: 'Click ＋ on a day to add a task there · drag a task to another day to change its due · faded = upcoming repeats.',
    ok: 'OK', home: 'Home', mine: 'On me', withOthers: 'With others', show: 'Show', remindCustom: 'Specific time…', remindNeedsDue: 'Set a due date to be reminded before it', remindAt9: 'No due time set, so this counts from 9:00 AM', dueTimeShort: 'Time',
    gMorning: 'Good morning', gAfternoon: 'Good afternoon', gEvening: 'Good evening', hWeek: 'Next 7 days', hOthers: 'With others', hClosedWeek: 'Closed this week',
    hFocus: 'Start with these', hComing: 'Coming up', hWaiting: 'Waiting on', hReminders: "Today's reminders", hAllClear: 'Nothing overdue or urgent today 🎉', hNothing: 'Nothing here', avgClose: 'Avg. time to close', more: 'more', oldestDays: 'oldest', hAreasTitle: 'Folders', hOpenN: 'open', hSeeAll: 'See all'
  }
};

// Monochrome line icons (inherit text color), so the UI doesn't depend on colored emoji.
const ICONS = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  pending: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  overdue: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/>',
  waiting: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  closed: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 2h6l1-2h5"/>',
  all: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  note: '<path d="M5 4h14v16H5z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  log: '<path d="M12 7v5l3 2"/><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v4h4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.01"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bug: '<rect x="7" y="7" width="10" height="13" rx="5"/><path d="M9.5 7a2.5 2.5 0 0 1 5 0M12 11v9M3 13h4M17 13h4M4 7l3 2M20 7l-3 2M4 19l3-2M20 19l-3-2"/>',
  idea: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  github: '<path d="M9 19c-4.5 1.5-4.5-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  pin: '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>',
  edgeRight: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M15 4v16"/><path d="M9 10l2 2-2 2"/>',
  edgeTop: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9.5h17"/><path d="M10 13l2 2 2-2"/>',
  edgeLeft: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M9 4v16"/><path d="M15 10l-2 2 2 2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6 8.5-6"/>',
  clip: '<path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7-7L13 4.5a3.4 3.4 0 0 1 4.8 4.8l-8.2 8.2a1.7 1.7 0 0 1-2.4-2.4L15 7.3"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  report: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  matrix: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M12 3.5v17M3.5 12h17"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>'
};
function icon(name) {
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// The Elfar mouse 🐭: the app's mascot and logo (fixed colors so it looks the same in light and dark).
// mood 'happy': nothing left for today, so it squints with joy and hugs a wedge of Roumy cheese 🧀
function mouseLogo(cls = '', mood = '') {
  const happy = mood === 'happy', annoyed = mood === 'annoyed';
  const eyes = mood === 'timer'
    ? `<circle cx="24.5" cy="36.3" r="3" fill="#1f1e1c"/><circle cx="39.5" cy="36.3" r="3" fill="#1f1e1c"/>
       <circle cx="25.3" cy="35.6" r="1" fill="#fff"/><circle cx="40.3" cy="35.6" r="1" fill="#fff"/>`
    : annoyed
    ? `<path d="M20 30.5l8 3.5M44 30.5l-8 3.5" stroke="#1f1e1c" stroke-width="2.2" stroke-linecap="round"/>
       <path d="M21.5 36.5q3-2.2 6 0M36.5 36.5q3-2.2 6 0" fill="none" stroke="#1f1e1c" stroke-width="2.4" stroke-linecap="round"/>
       <circle cx="18.5" cy="41.5" r="3.2" fill="#ef7f8f" opacity=".75"/><circle cx="45.5" cy="41.5" r="3.2" fill="#ef7f8f" opacity=".75"/>
       <g class="ml-anger" stroke="#e5484d" stroke-width="2" stroke-linecap="round"><path d="M52 9q2 3 0 6M56 9q-2 3 0 6M50.5 11h3M54.5 13h3"/></g>`
    : happy
    ? `<path d="M21.5 35.5q3-4 6 0M36.5 35.5q3-4 6 0" fill="none" stroke="#1f1e1c" stroke-width="2.2" stroke-linecap="round"/>
       <circle cx="19" cy="41" r="2.6" fill="#f3a6b8" opacity=".7"/><circle cx="45" cy="41" r="2.6" fill="#f3a6b8" opacity=".7"/>`
    : `<g class="ml-pupils"><circle cx="24.5" cy="35" r="3" fill="#1f1e1c"/><circle cx="39.5" cy="35" r="3" fill="#1f1e1c"/>
       <circle cx="25.6" cy="33.9" r="1" fill="#fff"/><circle cx="40.6" cy="33.9" r="1" fill="#fff"/></g>`;
  const cheese = happy
    ? `<g class="ml-cheese"><path d="M20 62 L44 50 L46 61 Z" fill="#f6c343" stroke="#d9a21b" stroke-width="1.2" stroke-linejoin="round"/>
       <path d="M44 50 L46 61" stroke="#e8b42f" stroke-width="2.2"/>
       <circle cx="31" cy="58" r="1.8" fill="#e0a92a"/><circle cx="38" cy="56.5" r="1.3" fill="#e0a92a"/><circle cx="41" cy="59.5" r="1" fill="#e0a92a"/>
       <ellipse cx="22" cy="58.5" rx="4" ry="3.2" fill="#b9c2cc"/><ellipse cx="44" cy="54" rx="4" ry="3.2" fill="#b9c2cc"/></g>`
    : '';
  return `<svg class="mouse-logo ${cls} ${mood}" viewBox="0 0 64 64" aria-hidden="true">
    <g class="ml-ear l"><circle cx="17" cy="21" r="12" fill="#8f99a5"/><circle cx="17" cy="21" r="7" fill="#f3a6b8"/></g>
    <g class="ml-ear r"><circle cx="47" cy="21" r="12" fill="#8f99a5"/><circle cx="47" cy="21" r="7" fill="#f3a6b8"/></g>
    <ellipse cx="32" cy="39" rx="20" ry="18" fill="#b9c2cc"/>
    <ellipse cx="32" cy="45" rx="11" ry="8" fill="#d6dce3"/>
    ${eyes}
    <ellipse cx="32" cy="42.5" rx="3.2" ry="2.5" fill="#e8798f"/>
    ${happy ? '<path d="M28.5 46.5q3.5 3 7 0" fill="none" stroke="#6b4a52" stroke-width="1.4" stroke-linecap="round"/>' : ''}
    ${annoyed ? '<path d="M27.5 49q2-1.6 4.5 0t4.5 0" fill="none" stroke="#6b4a52" stroke-width="1.4" stroke-linecap="round"/>' : ''}
    <path d="M27 44l-12-3M27 46.5l-12 1M37 44l12-3M37 46.5l12 1" stroke="#6b7380" stroke-width="1.1" stroke-linecap="round"/>
    ${cheese}
    ${mood === 'timer' ? `<g class="ml-watch">
       <ellipse cx="22.5" cy="56.5" rx="4" ry="3.2" fill="#b9c2cc"/><ellipse cx="41.5" cy="56.5" rx="4" ry="3.2" fill="#b9c2cc"/>
       <rect x="30.4" y="44.6" width="3.2" height="3" rx="1" fill="#6b7380"/>
       <circle cx="32" cy="54.2" r="7" fill="#fff" stroke="#5b6573" stroke-width="2"/>
       <path class="ml-hand" d="M32 54.2V49.8" stroke="#e5484d" stroke-width="1.8" stroke-linecap="round"/>
       <circle cx="32" cy="54.2" r="1.2" fill="#5b6573"/></g>` : ''}
  </svg>`;
}

// The mouse that pops up to give you a thumbs-up 👍 when the day's last task is closed.
function cheerMouseSvg() {
  return `<svg class="cheer-svg" viewBox="0 0 140 150" aria-hidden="true">
    <path class="cm-tail" d="M40 128 C 10 130, 8 104, 26 100 S 40 84, 24 76" fill="none" stroke="#f3a6b8" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="70" cy="122" rx="34" ry="28" fill="#b9c2cc"/>
    <ellipse cx="70" cy="128" rx="20" ry="17" fill="#d6dce3"/>
    <ellipse cx="50" cy="126" rx="8" ry="10" fill="#b9c2cc" transform="rotate(20 50 126)"/>
    <g class="cm-head">
      <circle cx="40" cy="36" r="19" fill="#8f99a5"/><circle cx="100" cy="36" r="19" fill="#8f99a5"/>
      <circle cx="40" cy="36" r="11" fill="#f3a6b8"/><circle cx="100" cy="36" r="11" fill="#f3a6b8"/>
      <ellipse cx="70" cy="64" rx="34" ry="30" fill="#b9c2cc"/>
      <ellipse cx="70" cy="75" rx="17" ry="12" fill="#d6dce3"/>
      <path d="M52 60q6-7 12 0M76 60q6-7 12 0" fill="none" stroke="#1f1e1c" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="47" cy="72" r="5" fill="#f3a6b8" opacity=".7"/><circle cx="93" cy="72" r="5" fill="#f3a6b8" opacity=".7"/>
      <ellipse cx="70" cy="70" rx="4.6" ry="3.6" fill="#e8798f"/>
      <path d="M62 78q8 7 16 0" fill="none" stroke="#6b4a52" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M62 73l-18-4M62 76.5l-18 2M78 73l18-4M78 76.5l18 2" stroke="#6b7380" stroke-width="1.4" stroke-linecap="round"/>
    </g>
    <g class="cm-thumb">
      <path d="M98 118 L112 98" stroke="#b9c2cc" stroke-width="12" stroke-linecap="round"/>
      <rect x="104" y="84" width="20" height="18" rx="7" fill="#b9c2cc" stroke="#9aa4af" stroke-width="1.2"/>
      <rect x="109" y="64" width="9" height="24" rx="4.5" fill="#b9c2cc" stroke="#9aa4af" stroke-width="1.2"/>
      <path d="M106 90h16M106 95h16" stroke="#9aa4af" stroke-width="1.1" stroke-linecap="round"/>
    </g>
  </svg>`;
}

// The mouse that rings a bell on a reminder 🔔
function remindMouseSvg() {
  return `<svg viewBox="0 0 140 150" aria-hidden="true">
    <path d="M38 132 C 12 134, 8 110, 24 104 S 36 90, 22 82" fill="none" stroke="#f3a6b8" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="66" cy="124" rx="32" ry="26" fill="#b9c2cc"/>
    <ellipse cx="66" cy="130" rx="19" ry="16" fill="#d6dce3"/>
    <circle cx="38" cy="40" r="17" fill="#8f99a5"/><circle cx="92" cy="40" r="17" fill="#8f99a5"/>
    <circle cx="38" cy="40" r="10" fill="#f3a6b8"/><circle cx="92" cy="40" r="10" fill="#f3a6b8"/>
    <ellipse cx="65" cy="66" rx="31" ry="28" fill="#b9c2cc"/>
    <ellipse cx="65" cy="76" rx="16" ry="11" fill="#d6dce3"/>
    <circle cx="54" cy="62" r="4" fill="#1f1e1c"/><circle cx="76" cy="62" r="4" fill="#1f1e1c"/>
    <circle cx="55.4" cy="60.6" r="1.4" fill="#fff"/><circle cx="77.4" cy="60.6" r="1.4" fill="#fff"/>
    <ellipse cx="65" cy="72" rx="4.4" ry="3.4" fill="#e8798f"/>
    <ellipse cx="65" cy="82" rx="5" ry="4" fill="#6b4a52"/>
    <path d="M58 75l-17-4M58 78.5l-17 2M72 75l17-4M72 78.5l17 2" stroke="#6b7380" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M92 112 L104 66" stroke="#b9c2cc" stroke-width="11" stroke-linecap="round"/>
    <g class="rm-waves"><path d="M120 22 q8 10 0 22"/><path d="M128 14 q13 17 0 38"/></g>
    <g class="rm-bell">
      <path d="M104 38 v-6" stroke="#b07d12" stroke-width="3" stroke-linecap="round"/>
      <path d="M90 62 q0-24 14-24 q14 0 14 24 l4 6 h-36 z" fill="#f6c343" stroke="#d9a21b" stroke-width="1.6" stroke-linejoin="round"/>
      <circle cx="104" cy="71" r="4" fill="#d9a21b"/>
      <circle cx="104" cy="64" r="5.5" fill="#b9c2cc"/>
    </g>
  </svg>`;
}

// Reminder sounds, made on the spot (no sound files needed).
const REMIND_SOUNDS = ['chime', 'bell', 'squeak', 'none'];
function playSound(kind) {
  if (!kind || kind === 'none' || !window.AudioContext) return;
  const C = new AudioContext();
  const now = C.currentTime;
  const tone = (f, t0, dur, type = 'sine', gain = 0.22) => {
    const o = C.createOscillator(), g = C.createGain();
    o.type = type; o.frequency.setValueAtTime(f, now + t0);
    g.gain.setValueAtTime(0.0001, now + t0);
    g.gain.exponentialRampToValueAtTime(gain, now + t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
    o.connect(g).connect(C.destination);
    o.start(now + t0); o.stop(now + t0 + dur + 0.05);
    return o;
  };
  if (kind === 'chime') { tone(1318.5, 0, 0.9); tone(1046.5, 0.18, 1.1); tone(1568, 0.36, 1.5, 'sine', 0.16); }
  if (kind === 'bell') for (const t0 of [0, 0.42, 0.84]) [880, 2420, 4750].forEach((f, i) => tone(f, t0, 1.3 - i * 0.35, 'sine', 0.2 / (i + 1)));
  if (kind === 'squeak') [0, 0.2, 0.4].forEach((t0) => { const o = tone(2100, t0, 0.15, 'triangle', 0.16); o.frequency.exponentialRampToValueAtTime(3400, now + t0 + 0.11); });
  setTimeout(() => C.close(), 3500);
}

// ---------- priority picker: four numbered buttons, the name shows on hover / when picked ----------
// 1 = important & urgent, 2 = important & not urgent, 3 = not important & urgent, 4 = neither.
const PRIO_NUM = { q1: 1, q2: 2, q3: 3, q4: 4 };
// names: { q1: 'Important & urgent', ... }; attr: the data attribute the page listens to.
function prioPicker(cur, attr, names, none) {
  const name = (q) => `${PRIO_NUM[q]} · ${names[q]}`;
  return `<div class="pp"><div class="pp-btns">${['q1', 'q2', 'q3', 'q4'].map((q) =>
    `<button type="button" class="pp-b ${q} ${cur === q ? 'on' : ''}" ${attr}="${q}" data-pname="${esc(name(q))}" title="${esc(name(q))}">${PRIO_NUM[q]}</button>`).join('')}</div>
    <span class="pp-name ${cur ? cur : 'none'}" data-none="${esc(none)}">${esc(cur ? name(cur) : none)}</span></div>`;
}
document.addEventListener('mouseover', (e) => {
  const b = e.target.closest && e.target.closest('.pp-b'); if (!b) return;
  const n = b.closest('.pp').querySelector('.pp-name');
  n.textContent = b.dataset.pname; n.className = 'pp-name hover ' + [...b.classList].find((c) => /^q\d$/.test(c));
});
document.addEventListener('mouseout', (e) => {
  const b = e.target.closest && e.target.closest('.pp-b'); if (!b) return;
  const pp = b.closest('.pp'), n = pp.querySelector('.pp-name'), on = pp.querySelector('.pp-b.on');
  n.textContent = on ? on.dataset.pname : n.dataset.none;
  n.className = 'pp-name ' + (on ? [...on.classList].find((c) => /^q\d$/.test(c)) : 'none');
});
// After a click picks / un-picks a button, keep the name in step.
function syncPrioPicker(pp, cur) {
  if (!pp) return;
  pp.querySelectorAll('.pp-b').forEach((b) => b.classList.toggle('on', [...b.classList].includes(cur)));
  const on = pp.querySelector('.pp-b.on'), n = pp.querySelector('.pp-name');
  n.textContent = on ? on.dataset.pname : n.dataset.none;
  n.className = 'pp-name ' + (cur || 'none');
}

// Eisenhower matrix: q1 important+urgent, q2 important, q3 urgent, q4 neither.
const QUADS = ['q1', 'q2', 'q3', 'q4'];
const QUAD_RANK = { q1: 0, q2: 1, q3: 2, q4: 3 };
// Row color class for open tasks (closed tasks stay neutral).
const quadClass = (x) => (!x.closure && QUADS.includes(x.priority) ? 'quad-' + x.priority : '');
// Matrix box first (unclassified last), then nearest due date (no due date last).
const byPriorityThenDue = (a, b) =>
  (QUAD_RANK[a.priority] ?? 9) - (QUAD_RANK[b.priority] ?? 9) || (a.due || '9999').localeCompare(b.due || '9999');

const COLORS =['blue', 'teal', 'coral', 'purple', 'pink', 'amber', 'green', 'gray'];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a, b) {
  const pa = new Date(a + 'T00:00:00'), pb = new Date(b + 'T00:00:00');
  return Math.round((pb - pa) / 86400000);
}

// Status is derived, never stored: no closure date => Pending (or Overdue once due has passed).
// A task whose start date is still ahead (like the next round of a repeating task) is
// "scheduled": it isn't Pending yet and shows up on its own day.
function statusOf(t) {
  if (t.closure) return 'closed';
  const td = todayStr();
  if (t.start && t.start > td && !(t.due && t.due <= td)) return 'scheduled';
  if (t.due && t.due < td) return 'overdue';
  if (t.due && t.due === td) return 'today';
  return 'pending';
}

// Open and already started (scheduled ones don't count yet).
const isActive = (x) => !x.closure && statusOf(x) !== 'scheduled';

// Arabic counts: 1 يوم, 2 يومين, 3–10 أيام, 11+ يوم.
// Before a focus session: how long? Quick picks (15 / 25 / 45 min) start right away, or type
// your own minutes. The last length you used is highlighted. Works in the app and the widget.
function askFocusMins(tt, cur, onGo) {
  document.querySelector('.fm-bg')?.remove();
  const quick = [15, 25, 45];
  const bg = document.createElement('div');
  bg.className = 'fm-bg';
  bg.innerHTML = `<div class="fm-card" role="dialog">
    <b class="fm-q">⏱ ${tt('fmQ')}</b>
    <div class="fm-chips">${quick.map((m) => `<button data-fm="${m}" class="${m === cur ? 'on' : ''}">${m}<small>${tt('minShort')}</small></button>`).join('')}
      <label class="fm-own ${quick.includes(cur) ? '' : 'on'}"><input type="number" id="fmOwn" min="1" max="240" placeholder="${tt('fmOwn')}" value="${quick.includes(cur) ? '' : cur}"><small>${tt('minShort')}</small></label></div>
    <p class="fm-hint">${tt('fmHint')}</p>
    <div class="fm-acts"><button class="ghost" data-fmx>${tt('cancel')}</button><button class="primary" data-fmgo>▶ ${tt('fStart')}</button></div></div>`;
  document.body.appendChild(bg);
  const own = bg.querySelector('#fmOwn');
  const close = () => { document.removeEventListener('keydown', onKey, true); bg.remove(); };
  const go = (m) => { m = Math.round(Number(m)); if (!(m >= 1 && m <= 240)) { own.focus(); own.classList.add('bad'); return; } close(); onGo(m); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); go(own.value || cur); }
  };
  document.addEventListener('keydown', onKey, true);
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  bg.addEventListener('click', (e) => {
    const c = e.target.closest('[data-fm]');
    if (c) return go(c.dataset.fm);
    if (e.target.closest('[data-fmx]')) return close();
    if (e.target.closest('[data-fmgo]')) return go(own.value || cur);
  });
  own.addEventListener('input', () => { own.classList.remove('bad'); bg.querySelectorAll('[data-fm]').forEach((b) => b.classList.remove('on')); own.parentElement.classList.add('on'); });
  setTimeout(() => (quick.includes(cur) ? bg.querySelector('.fm-chips .on') : own)?.focus(), 30);
}

function arCount(n, one, two, few, many) {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${n >= 3 && n <= 10 ? few : many}`;
}
const timesWord = (n, lang) => (lang === 'ar' ? arCount(n, 'مرة', 'مرتين', 'مرات', 'مرة') : `${n}×`);
const daysWord = (n, lang) => (lang === 'ar' ? arCount(n, 'يوم', 'يومين', 'أيام', 'يوم') : `${n} ${n === 1 ? 'day' : 'days'}`);

// The one date a task needs, said the way you'd say it: "2 days late", "Today · 2:00 PM",
// "Tomorrow", "Sunday", "29 Nov". The full date goes in the tooltip.
function whenOf(x, L) {
  const t = (k) => (I18N[L] || I18N.ar)[k] || k, lang = () => L;
  const s = statusOf(x), td = todayStr();
  const ar = lang() === 'ar';
  if (s === 'closed') return { cls: 'closed', text: `${t('closedOn')} ${fmtDate(x.closure, lang())}` };
  if (!x.due) return null;
  const time = x.dueTime ? fmtTime(`${x.due}T${x.dueTime}`, lang()) : '';
  const n = daysBetween(td, x.due);
  let text, cls = '';
  if (n < 0) { cls = 'overdue'; text = ar ? `${t('lateBy')} ${daysWord(-n, 'ar')}` : `${daysWord(-n, 'en')} ${t('lateBy')}`; }
  else if (n === 0) { cls = 'today'; text = t('stDueToday') + (time ? ` · ${time}` : ''); }
  else if (n === 1) { cls = 'soon'; text = t('tomorrowLbl') + (time ? ` · ${time}` : ''); }
  else if (n < 7) { cls = 'soon'; text = new Date(x.due + 'T00:00').toLocaleDateString(ar ? 'ar-EG-u-nu-latn' : 'en-GB', { weekday: 'long' }); }
  else text = fmtDate(x.due, lang());
  return { cls, text, title: `${t('due')}: ${fmtDate(x.due, lang())}${time ? ' · ' + time : ''}` };
}

function fmtDate(s, lang) {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

// Local date-time helpers ('YYYY-MM-DDTHH:MM', the format of <input type=datetime-local>).
function nowLocal(d = new Date()) {
  return `${todayStr(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function fmtTime(at, lang) {
  if (!at || !at.includes('T')) return '';
  return new Date(at).toLocaleTimeString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
function fmtDur(ms, lang) {
  const m = Math.max(0, Math.round(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (lang === 'ar') {
    const hw = (n) => arCount(n, 'ساعة', 'ساعتين', 'ساعات', 'ساعة'), mw = (n) => arCount(n, 'دقيقة', 'دقيقتين', 'دقايق', 'دقيقة');
    if (d) return daysWord(d, 'ar') + (h ? ` و${hw(h)}` : '');
    if (h) return hw(h) + (mm ? ` و${mw(mm)}` : '');
    return mw(mm);
  }
  const u = { d: 'd', h: 'h', m: 'm' };
  if (d) return `${d}${u.d}${h ? ' ' + h + u.h : ''}`;
  if (h) return `${h}${u.h}${mm ? ' ' + mm + u.m : ''}`;
  return `${mm}${u.m}`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Text with clickable links (opened in the default browser by the main process).
function linkify(s) {
  return esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
}

function applyLang(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}
