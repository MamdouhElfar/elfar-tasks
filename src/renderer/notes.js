// ---------------- task page: formatted notes, on one or more pages ----------------
// Each task has pages ([{ id, title, html }]). The editor supports headings, bold/italic/
// underline/strike, bullet / numbered / check lists, quotes, links and dividers.
// Typing "# ", "## ", "- ", "1. ", "[] " or "> " at the start of a line formats it too.
// x.notes keeps the plain text of all pages, for search, the report, Excel and links.

const NOTE_TAGS = new Set(['H1', 'H2', 'H3', 'P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'A', 'BLOCKQUOTE', 'CODE', 'PRE', 'HR', 'SPAN']);
const NOTE_DROP = /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|LINK|META|IMG|PICTURE|SVG|VIDEO|AUDIO|CANVAS|FORM|INPUT|BUTTON|SELECT|TEXTAREA|TITLE|HEAD|NOSCRIPT|TEMPLATE)$/;
const BLOCKS = 'H1,H2,H3,P,DIV,LI,BLOCKQUOTE,PRE';

// Only plain formatting survives (pasted pages, old data): no styles, scripts, images or handlers.
function cleanNoteHtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  const walk = (node) => {
    for (const el of [...node.children]) {
      if (NOTE_DROP.test(el.tagName)) { el.remove(); continue; }
      walk(el);
      if (!NOTE_TAGS.has(el.tagName)) { el.replaceWith(...el.childNodes); continue; }
      for (const a of [...el.attributes]) {
        const keep = (el.tagName === 'A' && a.name === 'href' && /^(https?:|mailto:)/i.test(a.value.trim()))
          || (el.tagName === 'UL' && a.name === 'class' && a.value === 'checklist')
          || (el.tagName === 'LI' && a.name === 'data-done');
        if (!keep) el.removeAttribute(a.name);
      }
    }
  };
  walk(root);
  return root.innerHTML;
}

const textToNoteHtml = (text) => (text || '').split('\n').map((l) => `<div>${esc(l) || '<br>'}</div>`).join('');

// Plain text of a page: one line per block, list items marked.
function noteHtmlToText(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const out = [];
  let line = '';
  const flush = () => { out.push(line); line = ''; };
  const walk = (node) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { line += n.textContent; continue; }
      if (n.nodeType !== 1) continue;
      if (n.tagName === 'BR') { flush(); continue; }
      const block = BLOCKS.split(',').includes(n.tagName) || n.tagName === 'UL' || n.tagName === 'OL' || n.tagName === 'HR';
      if (block && line) flush();
      if (n.tagName === 'LI') line += n.parentElement?.classList.contains('checklist') ? (n.hasAttribute('data-done') ? '[x] ' : '[ ] ') : '• ';
      if (n.tagName === 'HR') { out.push('———'); continue; }
      walk(n);
      if (block && line) flush();
    }
  };
  walk(doc.body.firstElementChild);
  if (line) flush();
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Old tasks only had plain text: show it as the first page (saved as pages on the first edit).
function pagesOf(x) {
  if (Array.isArray(x.pages) && x.pages.length) return x.pages;
  return [{ id: 'p1', title: '', html: textToNoteHtml(x.notes || '') }];
}
function syncNotesText(x) {
  const pages = pagesOf(x);
  x.notes = pages.map((p, i) => {
    const body = noteHtmlToText(p.html);
    return pages.length > 1 ? `${p.title || pageName(i)}\n${body}` : body;
  }).join('\n\n').trim();
}
const pageName = (i) => t('pageN').replace('{n}', i + 1);
const notePageSel = {};

const NOTE_TOOLS = [
  ['h1', 'H1', 'toolH1'], ['h2', 'H2', 'toolH2'], ['|'],
  ['bold', '<b>B</b>', 'toolBold'], ['italic', '<i>I</i>', 'toolItalic'], ['underline', '<u>U</u>', 'toolUnderline'], ['strike', '<s>S</s>', 'toolStrike'], ['|'],
  ['ul', '•', 'toolBullets'], ['ol', '1.', 'toolNumbers'], ['check', '☑', 'toolChecks'], ['quote', '❝', 'toolQuote'], ['|'],
  ['link', 'link', 'toolLink'], ['hr', '―', 'toolLine'], ['clear', 'Tx', 'toolClear']
];

function notesHtml(x) {
  const pages = pagesOf(x);
  const cur = pages.find((p) => p.id === notePageSel[x.id]) || pages[0];
  const urls = (x.notes || '').match(/https?:\/\/[^\s]+/g) || [];
  return `<div class="d-sec notes-sec" id="notesSec">
    <h3>${icon('note')} ${t('notes')}</h3>
    <div class="pg-tabs">
      ${pages.map((p, i) => `<button class="pg-tab ${p === cur ? 'on' : ''}" data-pg="${p.id}" title="${t('pageRenameHint')}"><span dir="auto">${esc(p.title || pageName(i))}</span>${pages.length > 1 && p === cur ? `<i class="pg-x" data-pgdel="${p.id}" title="${t('del')}">✕</i>` : ''}</button>`).join('')}
      <button class="pg-add" data-pgadd title="${t('addPage')}">＋ ${t('page')}</button>
    </div>
    <div class="nt-bar">${NOTE_TOOLS.map(([cmd, label, tip]) => cmd === '|' ? '<span class="nt-sep"></span>'
      : `<button data-ncmd="${cmd}" title="${t(tip)}">${cmd === 'link' ? icon('link') : label}</button>`).join('')}</div>
    <div class="nt-ed" id="nEd" contenteditable="true" spellcheck="true" data-ph="${esc(t('notesPh'))}" data-pg="${cur.id}">${cleanNoteHtml(cur.html)}</div>
    <div class="nt-hint small muted">${t('notesHint')}</div>
    <div class="links" id="dLinks">${urls.map((u) => linkify(u)).join('<br>')}</div>
  </div>`;
}

function rerenderNotes(x, focus) {
  const sec = $('notesSec'); if (!sec) return;
  sec.outerHTML = notesHtml(x);
  if (focus) { const ed = $('nEd'); ed.focus(); placeCaretAtEnd(ed); }
}
function placeCaretAtEnd(el) {
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}

// Save what's in the editor into the task (and keep x.notes in step).
function saveNotes(x) {
  const ed = $('nEd'); if (!ed) return;
  if (!Array.isArray(x.pages) || !x.pages.length) x.pages = pagesOf(x).map((p) => ({ ...p }));
  const page = x.pages.find((p) => p.id === ed.dataset.pg) || x.pages[0];
  page.html = ed.innerHTML;
  syncNotesText(x);
  const urls = (x.notes || '').match(/https?:\/\/[^\s]+/g) || [];
  $('dLinks').innerHTML = urls.map((u) => linkify(u)).join('<br>');
  touch(x); refreshLists();
}

const blockOf = (node, ed) => {
  let n = node && node.nodeType === 3 ? node.parentElement : node;
  while (n && n !== ed && !BLOCKS.split(',').includes(n.tagName)) n = n.parentElement;
  return n && n !== ed ? n : null;
};

function runNoteCmd(cmd, x) {
  const ed = $('nEd'); if (!ed) return;
  ed.focus();
  const sel = getSelection();
  const block = blockOf(sel.anchorNode, ed);
  const fmt = (tag) => document.execCommand('formatBlock', false, block && block.tagName === tag.toUpperCase() ? 'div' : tag);
  if (cmd === 'h1') fmt('h1');
  if (cmd === 'h2') fmt('h2');
  if (cmd === 'quote') fmt('blockquote');
  if (cmd === 'bold') document.execCommand('bold');
  if (cmd === 'italic') document.execCommand('italic');
  if (cmd === 'underline') document.execCommand('underline');
  if (cmd === 'strike') document.execCommand('strikeThrough');
  if (cmd === 'ul') document.execCommand('insertUnorderedList');
  if (cmd === 'ol') document.execCommand('insertOrderedList');
  if (cmd === 'hr') document.execCommand('insertHorizontalRule');
  if (cmd === 'clear') { document.execCommand('removeFormat'); document.execCommand('formatBlock', false, 'div'); }
  if (cmd === 'check') {
    const ul = sel.anchorNode && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode).closest('ul');
    if (ul && ed.contains(ul)) ul.classList.toggle('checklist');
    else {
      document.execCommand('insertUnorderedList');
      const n = getSelection().anchorNode;
      const nu = n && (n.nodeType === 3 ? n.parentElement : n).closest('ul');
      if (nu) nu.classList.add('checklist');
    }
  }
  if (cmd === 'link') {
    const range = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    const picked = sel.toString().trim();
    askText({ title: t('toolLink'), value: /^https?:\/\//.test(picked) ? picked : 'https://', placeholder: 'https://…' }).then((url) => {
      if (!url || !/^(https?:|mailto:)/i.test(url)) return;
      ed.focus();
      if (range) { const s = getSelection(); s.removeAllRanges(); s.addRange(range); }
      if (range && !range.collapsed) document.execCommand('createLink', false, url);
      else document.execCommand('insertHTML', false, `<a href="${esc(url)}">${esc(url)}</a>&nbsp;`);
      saveNotes(x);
    });
    return;
  }
  saveNotes(x);
}

// Markdown-style shortcuts at the start of a line.
const NOTE_SHORTCUTS = [[/^#\s$/, 'h1'], [/^##\s$/, 'h2'], [/^[-*•]\s$/, 'ul'], [/^1[.)]\s$/, 'ol'], [/^\[\s?\]\s$/, 'check'], [/^>\s$/, 'quote']];
function noteShortcut(ed, x) {
  const sel = getSelection();
  const node = sel.anchorNode;
  if (!node || node.nodeType !== 3 || !ed.contains(node)) return false;
  const before = node.textContent.slice(0, sel.anchorOffset).replace(/ /g, ' ');
  const block = blockOf(node, ed);
  // Only when this text node starts the line.
  if (block ? block.textContent.replace(/ /g, ' ').indexOf(before) !== 0 : ed.firstChild !== node && node.previousSibling) return false;
  const hit = NOTE_SHORTCUTS.find(([re]) => re.test(before));
  if (!hit) return false;
  const r = document.createRange();
  r.setStart(node, 0); r.setEnd(node, sel.anchorOffset);
  sel.removeAllRanges(); sel.addRange(r);
  document.execCommand('delete');
  if (!blockOf(getSelection().anchorNode, ed)) document.execCommand('formatBlock', false, 'div');
  runNoteCmd(hit[1], x);
  return true;
}

function bindNotes() {
  const d = $('detail');
  document.execCommand('defaultParagraphSeparator', false, 'div');
  // Toolbar buttons keep the selection in the editor.
  d.addEventListener('mousedown', (e) => { if (e.target.closest('[data-ncmd]')) e.preventDefault(); });
  d.addEventListener('click', async (e) => {
    const x = taskById(ui.selected); if (!x) return;
    const cmd = e.target.closest('[data-ncmd]');
    if (cmd) return runNoteCmd(cmd.dataset.ncmd, x);
    const del = e.target.closest('[data-pgdel]');
    if (del) {
      e.stopPropagation();
      const pages = pagesOf(x);
      const p = pages.find((y) => y.id === del.dataset.pgdel);
      if (noteHtmlToText(p.html) && !(await askConfirm({ title: t('confirmDelPage'), text: p.title || pageName(pages.indexOf(p)), ok: t('del'), danger: true }))) return;
      x.pages = pages.filter((y) => y.id !== p.id);
      delete notePageSel[x.id];
      syncNotesText(x); touch(x); refreshLists();
      return rerenderNotes(x);
    }
    const tab = e.target.closest('[data-pg]');
    if (tab && tab.classList.contains('pg-tab')) { notePageSel[x.id] = tab.dataset.pg; return rerenderNotes(x, true); }
    if (e.target.closest('[data-pgadd]')) {
      x.pages = pagesOf(x).map((p) => ({ ...p }));
      const p = { id: uid(), title: '', html: '' };
      x.pages.push(p);
      notePageSel[x.id] = p.id;
      touch(x);
      return rerenderNotes(x, true);
    }
    // Check-list items: click the box to tick it.
    const li = e.target.closest('#nEd ul.checklist > li');
    if (li) {
      const r = li.getBoundingClientRect();
      const rtl = getComputedStyle(li).direction === 'rtl';
      const onBox = rtl ? e.clientX > r.right - 26 : e.clientX < r.left + 4;
      if (onBox) { li.toggleAttribute('data-done'); saveNotes(x); }
    }
    // Ctrl + click opens a link.
    const a = e.target.closest('#nEd a[href]');
    if (a && (e.ctrlKey || e.metaKey)) { e.preventDefault(); window.open(a.href); }
  });
  d.addEventListener('dblclick', async (e) => {
    const tab = e.target.closest('.pg-tab'); if (!tab) return;
    const x = taskById(ui.selected); if (!x) return;
    x.pages = pagesOf(x).map((p) => ({ ...p }));
    const p = x.pages.find((y) => y.id === tab.dataset.pg);
    const name = await askText({ title: t('renamePage'), value: p.title || pageName(x.pages.indexOf(p)) });
    if (name == null) return;
    p.title = name.trim();
    syncNotesText(x); touch(x); rerenderNotes(x);
  });
  d.addEventListener('input', (e) => {
    if (e.target.id !== 'nEd') return;
    const x = taskById(ui.selected); if (!x) return;
    if (e.inputType === 'insertText' && e.data === ' ' && noteShortcut(e.target, x)) return;
    saveNotes(x);
  });
  // Paste keeps simple formatting only.
  d.addEventListener('paste', (e) => {
    if (e.target.closest && !e.target.closest('#nEd')) return;
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    e.preventDefault();
    if (html) document.execCommand('insertHTML', false, cleanNoteHtml(html));
    else document.execCommand('insertText', false, text);
  });
}

// A small in-app "type a value" dialog (Electron has no window.prompt).
function askText({ title, value = '', placeholder = '' }) {
  return new Promise((resolve) => {
    const bg = document.createElement('div');
    bg.className = 'modal-bg confirm-bg';
    bg.innerHTML = `<div class="modal confirm ask-text"><h3 dir="auto">${esc(title)}</h3>
      <input type="text" id="atVal" dir="auto" value="${esc(value)}" placeholder="${esc(placeholder)}">
      <div class="actions"><button id="atNo">${t('cancel')}</button><button class="primary" id="atYes">${t('ok')}</button></div></div>`;
    document.body.appendChild(bg);
    const input = bg.querySelector('#atVal');
    const done = (v) => {
      document.removeEventListener('keydown', onKey, true);
      bg.classList.add('leaving'); setTimeout(() => bg.remove(), 150);
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); done(null); }
      if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); done(input.value); }
    };
    document.addEventListener('keydown', onKey, true);
    bg.onclick = (e) => { if (e.target === bg || e.target.closest('#atNo')) done(null); else if (e.target.closest('#atYes')) done(input.value); };
    setTimeout(() => { input.focus(); input.select(); }, 30);
  });
}
