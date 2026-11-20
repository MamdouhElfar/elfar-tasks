// Dragging tasks (to folders, the calendar, the matrix) and reordering folders.
// Part of the main window; loaded after app.js and shares its globals (data, ui, t, save, refresh…).

// ---------------- drag and drop ----------------
function bindDragAndDrop() {
  document.addEventListener('dragstart', (e) => {
    const el = e.target.closest && e.target.closest('[data-task][draggable=true]');
    if (!el) return;
    dragTaskId = el.dataset.task;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragTaskId);
    el.classList.add('dragging');
    document.body.classList.add('is-dragging');
  });
  let hoverTimer = null, hoverId = null;
  // Runs on dragend, and also right after a drop: the drop re-renders the list, and a
  // re-rendered source row never fires its own dragend.
  const endDrag = () => {
    if (!dragTaskId && !document.body.classList.contains('is-dragging')) return;
    dragTaskId = null;
    clearTimeout(hoverTimer); hoverId = null;
    // Folders opened only for the drag close again, smoothly.
    const temp = [...dragExpanded];
    dragExpanded.clear();
    for (const id of temp) {
      if (isExpanded(id)) continue;
      document.querySelector(`.kids[data-kids="${id}"]`)?.classList.remove('open');
      document.querySelector(`[data-toggle="${id}"]`)?.classList.remove('open');
    }
    document.body.classList.remove('is-dragging');
    document.querySelectorAll('.dragging, .drop-ok').forEach((el) => el.classList.remove('dragging', 'drop-ok'));
  };
  document.addEventListener('dragend', endDrag);
  const target = (e) => {
    if (!dragTaskId || !e.target.closest) return null;
    const scope = e.target.closest('#scopeNav [data-scope=inbox], #areasNav [data-scope]');
    if (scope) return scope;
    return e.target.closest('.cal-cell[data-date], [data-quad]');
  };
  document.addEventListener('dragover', (e) => {
    const el = target(e);
    document.querySelectorAll('.drop-ok').forEach((d) => d !== el && d.classList.remove('drop-ok'));
    // Hovering a closed folder that has projects opens it after a moment, so you can drop inside.
    const sid = el && el.dataset.scope;
    if (sid !== hoverId) {
      clearTimeout(hoverTimer); hoverId = sid;
      if (sid && childrenOf(sid).length && !isExpanded(sid)) {
        hoverTimer = setTimeout(() => {
          dragExpanded.add(sid);
          document.querySelector(`.kids[data-kids="${sid}"]`)?.classList.add('open');
          document.querySelector(`[data-toggle="${sid}"]`)?.classList.add('open');
        }, 500);
      }
    }
    if (!el) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('drop-ok');
  });
  document.addEventListener('drop', (e) => {
    const el = target(e);
    const x = dragTaskId && taskById(dragTaskId);
    if (!el || !x) return;
    e.preventDefault();
    if (el.dataset.quad) {
      x.priority = el.dataset.quad === 'none' ? null : el.dataset.quad;
    } else if (el.dataset.date) {
      if (!x.closure) { const before = x.due; x.due = el.dataset.date; notePostpone(x, before); syncReminder(x); }
    } else {
      x.areaId = el.dataset.scope === 'inbox' ? null : el.dataset.scope;
    }
    touch(x);
    refresh();
    // Two frames later, so a folder opened for the drag animates closed instead of snapping.
    requestAnimationFrame(() => requestAnimationFrame(endDrag));
  });
}

// ---------------- reordering folders ----------------
// Drag a folder in the sidebar: drop on the top or bottom edge of another folder to put it
// before / after it (same level), or on its middle to put it inside (as a subfolder).
let dragAreaId = null;
const treeHeight = (id) => { const k = childrenOf(id); return k.length ? 1 + Math.max(...k.map((c) => treeHeight(c.id))) : 0; };
function bindFolderDrag() {
  const clear = () => document.querySelectorAll('.drop-before, .drop-after, .drop-inside, .dragging-area').forEach((el) => el.classList.remove('drop-before', 'drop-after', 'drop-inside', 'dragging-area'));
  const spot = (e) => {
    if (!dragAreaId || !e.target.closest) return null;
    const el = e.target.closest('#areasNav [data-scope]');
    if (!el) return null;
    const id = el.dataset.scope;
    if (id === dragAreaId || descendantsOf(dragAreaId).includes(id)) return null;
    const r = el.getBoundingClientRect(), f = (e.clientY - r.top) / r.height;
    const h = treeHeight(dragAreaId);
    let pos = f < 0.3 ? 'before' : f > 0.7 ? 'after' : 'inside';
    if (pos === 'inside' && depthOf(id) + 1 + h > MAX_DEPTH) pos = f < 0.5 ? 'before' : 'after';
    if (pos !== 'inside' && depthOf(id) + h > MAX_DEPTH) return null;
    return { el, id, pos };
  };
  document.addEventListener('dragstart', (e) => {
    const el = e.target.closest && e.target.closest('#areasNav [data-scope][draggable=true]');
    if (!el) return;
    dragAreaId = el.dataset.scope;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'folder');
    el.classList.add('dragging-area');
    document.body.classList.add('is-dragging-folder');
  });
  document.addEventListener('dragover', (e) => {
    if (!dragAreaId) return;
    const s = spot(e);
    document.querySelectorAll('.drop-before, .drop-after, .drop-inside').forEach((el) => el.classList.remove('drop-before', 'drop-after', 'drop-inside'));
    if (!s) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    s.el.classList.add('drop-' + s.pos);
  });
  document.addEventListener('drop', (e) => {
    if (!dragAreaId) return;
    const s = spot(e);
    const a = areaById(dragAreaId);
    if (s && a) {
      e.preventDefault();
      const target = areaById(s.id);
      data.areas.splice(data.areas.indexOf(a), 1);
      if (s.pos === 'inside') {
        a.parentId = s.id;
        data.areas.push(a);
        if (!isExpanded(s.id)) toggleExpanded(s.id);
      } else {
        a.parentId = target.parentId || null;
        const i = data.areas.indexOf(target);
        data.areas.splice(s.pos === 'before' ? i : i + 1, 0, a);
      }
      save();
    }
    dragAreaId = null; clear(); document.body.classList.remove('is-dragging-folder');
    refresh();
  });
  document.addEventListener('dragend', () => { if (!dragAreaId) return; dragAreaId = null; clear(); document.body.classList.remove('is-dragging-folder'); });
}

