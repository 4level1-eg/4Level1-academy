let db = JSON.parse(document.getElementById('kb-database').textContent);
let isAdmin = false;
let currentUserDisplayName = 'أحمد عيد';
let currentCatId = null;
let currentUpdateTopicId = null;
let newUpdateDraft = null;
let lastSearchQuery = '';
let activeRichImage = null;
let pendingCategoryIconImage = null;
let pendingNewPageIconImage = null;
let draggedNodeId = null;
let categoryHistory = [];
let headerLinksDraft = [];
const APP_SESSION_KEY = '4level1-kb-session';
let activeRichEditor = null;
let savedRichRange = null;
let draggedDropMode = null;
let suppressNextCardClick = false;
let pendingSearchReveal = null;
let bulkDeleteMode = false;
let bulkDeleteScopeId = null;
let bulkDeleteSelection = new Set();
let copiedRichFormat = null;
let formatPainterArmed = false;
let formatPainterSticky = false, formatPainterLastClick = 0, paintSourceSignature = '', paintSourceEditor = null, lastPaintSignature = '', lastPaintEditor = null;
const ICON_CHOICES = ['📁','📂','📄','📚','📝','📋','📌','📊','💻','🖥️','📱','⚙️','🛠️','🔧','💬','☎️','🎧','👥','👤','🏢','🏫','🎓','📅','⏰','✅','❓','⚠️','🔔','🔒','🔑'];

function getCurrentDisplayName() {
  return String(currentUserDisplayName || db.userProfile?.displayName || db.userDisplayName || 'أحمد عيد').trim() || 'أحمد عيد';
}
function renderHeaderProfile() {
  const name = getCurrentDisplayName();
  const label = document.getElementById('headerUserName');
  const menuName = document.getElementById('profileMenuName');
  if (label) label.textContent = name;
  if (menuName) menuName.textContent = name;
}


function getIconSettings(node) {
  return Object.assign({ width: 52, height: 52, fontSize: 24, color: '#0B57D0', bgColor: '#EBF3FE', gap: 15, align: 'center' }, node.iconSettings || {});
}
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]);
}
function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!file.type.startsWith('image/')) return reject(new Error('يرجى اختيار ملف صورة صالح.'));
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('تعذر قراءة الصورة.')); reader.readAsDataURL(file);
  });
}
function allNodes(nodes = db.nodes || []) { return nodes.flatMap(n => [n, ...(n.children ? allNodes(n.children) : [])]); }
function findNode(id, nodes = db.nodes || []) { for (const n of nodes) { if (String(n.id) === String(id)) return n; const found = n.children ? findNode(id, n.children) : null; if (found) return found; } return null; }
function findParentList(id, nodes = db.nodes || []) { if (nodes.some(n => String(n.id) === String(id))) return nodes; for (const n of nodes) { const found = n.children ? findParentList(id, n.children) : null; if (found) return found; } return null; }
function nextNodeId() { const ids = allNodes().map(n => Number(n.id) || 0); return Math.max(0, ...ids) + 1; }
function normalizeDatabase() {
  if (Array.isArray(db.nodes)) return;
  let nextId = Math.max(0, ...(db.categories || []).map(c => Number(c.id) || 0)) + 1;
  db.nodes = (db.categories || []).map(cat => ({
    id: Number(cat.id), type: 'folder', viewMode: 'browse', content: '', icon: cat.icon || '📁', iconImage: cat.iconImage || null,
    iconSettings: cat.iconSettings || {}, title: cat.title, subtitle: cat.subtitle || '', children: (cat.articles || []).map(article => ({
      id: nextId++, type: 'page', icon: '📄', title: article.title, subtitle: '', content: article.content || '', children: []
    }))
  }));
  delete db.categories;
}
normalizeDatabase();
if (!Array.isArray(db.headerLinks)) db.headerLinks = [
  {label:'الإجراءات والسياسات',targetId:2,visible:true},{label:'الأنظمة والأدوات',targetId:1,visible:true},{label:'الحالات والسيناريوهات',targetId:3,visible:true},{label:'الأسئلة الشائعة',targetId:7,visible:true}
];
allNodes().forEach(n => { if (!Array.isArray(n.sections)) n.sections = n.content ? [{id:'s'+n.id+'a',title:'',content:n.content}] : []; });
function saveLocalChanges(showMessage = true) {
  try { localStorage.setItem('4level1-kb-data', JSON.stringify(db)); if (showMessage) alert('تم حفظ التعديلات على هذا الجهاز والمتصفح بنجاح.'); }
  catch (error) { console.warn('تعذر الحفظ المحلي. قد تكون مساحة التخزين ممتلئة بسبب الصور.', error); if (showMessage) alert('تعذر الحفظ المحلي. قد تكون مساحة التخزين ممتلئة بسبب الصور. صدّر نسخة احتياطية أو جرّب صورة أصغر.'); }
}
function loadLocalChanges() {
  try { const saved = localStorage.getItem('4level1-kb-data'); if (saved) { const parsed = JSON.parse(saved); if (parsed && Array.isArray(parsed.nodes)) db = parsed; } } catch (e) { console.warn('تعذر تحميل الحفظ المحلي', e); }
}
loadLocalChanges();
if (!Array.isArray(db.headerLinks)) db.headerLinks = [
  {label:'الإجراءات والسياسات',targetId:2,visible:true},{label:'الأنظمة والأدوات',targetId:1,visible:true},{label:'الحالات والسيناريوهات',targetId:3,visible:true},{label:'الأسئلة الشائعة',targetId:7,visible:true}
];
if (!Array.isArray(db.updates)) db.updates=[];
db.updates.forEach((item,index)=>{if(!item.id)item.id=`legacy-update-${index+1}`;if(!item.type)item.type='quick';if(!item.badge)item.badge='جديد';if(!item.badgeClass)item.badgeClass=badgeClassFor(item.badge);});
if (!db.texts) db.texts={};
allNodes().forEach(n => {
  if (!Array.isArray(n.sections) || (!n.sections.length && n.content)) n.sections = n.content ? [{id:`s${n.id}a`,title:'',content:n.content,format:'text'}] : [];
  n.sections.forEach((sec, i) => { if (!sec.id) sec.id = `sec-${n.id}-${i+1}`; if (!sec.format) sec.format = 'text'; });
});

// أقسام الصفحة الرئيسية بيانات قابلة للإدارة وليست عناوين ثابتة داخل HTML.
const DEFAULT_HOME_GROUPS = [
  { id: 'general', title: 'المعرفة العامة للشركة', subtitle: 'المعلومات والإجراءات المشتركة التي يحتاج إليها فريق 4Level1', icon: '🌐' },
  { id: 'departments', title: 'معرفة الإدارات', subtitle: 'اختر الإدارة للوصول إلى محتواها وإجراءاتها وأدلتها', icon: '🏢' }
];
function normalizeHomeGroupTitle(value) {
  return String(value || '').replace(/[أإآ]/g, 'ا').replace(/[ً-ٰٟـ]/g, '').replace(/\s+/g, '').toLowerCase();
}
function ensureHomeGroups() {
  let changed = false;
  if (!Array.isArray(db.homeGroups) || !db.homeGroups.length) {
    db.homeGroups = DEFAULT_HOME_GROUPS.map(group => ({...group}));
    changed = true;
  }
  db.homeGroups = db.homeGroups.filter(group => group && group.id && group.title);
  if (!db.homeGroups.length) { db.homeGroups = DEFAULT_HOME_GROUPS.map(group => ({...group})); changed = true; }
  (db.nodes || []).forEach(node => {
    if (!node.homeGroup) { node.homeGroup = 'general'; changed = true; }
    if (!db.homeGroups.some(group => String(group.id) === String(node.homeGroup))) {
      node.homeGroup = db.homeGroups[0].id;
      changed = true;
    }
  });
  if (changed) saveLocalChanges(false);
}
function ensureDefaultDepartments() {
  // تُنشأ الإدارات الافتراضية مرة واحدة فقط؛ بعد ذلك تكون الإضافة والحذف بيد الإدارة.
  if (db.departmentDefaultsInitialized) return;
  const defaults = [
    { key: 'support', title: 'إدارة الدعم', subtitle: 'Support Department', icon: '🎧', aliases: ['الدعم', 'الدعم الفني', 'إدارة الدعم الفني'] },
    { key: 'customer-service', title: 'خدمة العملاء', subtitle: 'Customer Service Department', icon: '📞', aliases: ['خدمة العملاء', 'إدارة خدمة العملاء'] },
    { key: 'complaints', title: 'الشكاوى', subtitle: 'Complaints Department', icon: '💬', aliases: ['الشكاوى', 'إدارة الشكاوى'] }
  ];
  const departmentsGroup = db.homeGroups.find(group => group.id === 'departments') || db.homeGroups[1] || db.homeGroups[0];
  let changed = false;
  defaults.forEach(department => {
    let existing = (db.nodes || []).find(node => node.departmentKey === department.key);
    if (!existing) {
      const candidates = [department.title, ...department.aliases].map(normalizeHomeGroupTitle);
      existing = (db.nodes || []).find(node => node.type === 'folder' && candidates.includes(normalizeHomeGroupTitle(node.title)));
    }
    if (existing) {
      if (existing.homeGroup !== departmentsGroup.id) { existing.homeGroup = departmentsGroup.id; changed = true; }
      if (!existing.departmentKey) { existing.departmentKey = department.key; changed = true; }
    } else {
      db.nodes.push({
        id: nextNodeId(), type: 'folder', viewMode: 'browse', content: '', sections: [],
        title: department.title, subtitle: department.subtitle, icon: department.icon,
        homeGroup: departmentsGroup.id, departmentKey: department.key, children: []
      });
      changed = true;
    }
  });
  db.departmentDefaultsInitialized = true;
  if (changed || db.departmentDefaultsInitialized) saveLocalChanges(false);
}
ensureHomeGroups();
ensureDefaultDepartments();

function persistSession(role) {
  const value=JSON.stringify({ authenticated: true, role, displayName: getCurrentDisplayName() });
  try { sessionStorage.setItem(APP_SESSION_KEY, value); }
  catch (error) { try { localStorage.setItem(APP_SESSION_KEY, value); } catch (fallbackError) { console.warn('تعذر حفظ جلسة الدخول.', fallbackError); } }
  document.body.classList.add('app-authenticated');
  updateFloatingNav();
}
function clearSession() {
  try { sessionStorage.removeItem(APP_SESSION_KEY); } catch (_) {}
  try { localStorage.removeItem(APP_SESSION_KEY); } catch (_) {}
  document.body.classList.remove('app-authenticated');
  updateFloatingNav();
}
function restoreAppSession() {
  let session = null;
  try { session = JSON.parse(sessionStorage.getItem(APP_SESSION_KEY) || 'null'); } catch (_) {}
  if(!session){try{session=JSON.parse(localStorage.getItem(APP_SESSION_KEY)||'null');}catch(_){}}
  if (!session || !session.authenticated || !['staff','admin'].includes(session.role)) {
    document.getElementById('login-overlay').style.display = 'flex';
    return;
  }
  currentUserDisplayName = session.displayName || db.userProfile?.displayName || db.userDisplayName || 'أحمد عيد';
  renderHeaderProfile();
  document.getElementById('login-overlay').style.display = 'none';
  document.body.classList.add('app-authenticated');
  if (session.role === 'admin') toggleAdminMode(true, false);
  else { isAdmin = false; renderAll(); }
  if (location.hash.startsWith('#category-')) {
    const id = Number(location.hash.replace('#category-', ''));
    if (findNode(id)) openCategory(id, false);
  } else {
    const topicMatch=location.hash.match(/^#update-topic-(.+)$/);
    if(topicMatch){const topicId=decodeURIComponent(topicMatch[1]);if(findUpdate(topicId))openUpdateTopic(topicId,false);}
  }
  updateFloatingNav();
}
function doLogin() {
  const val = document.getElementById('loginPassInput').value.trim();
  if (val === db.staffPass || val === db.adminPass) {
    currentUserDisplayName = db.userProfile?.displayName || db.userDisplayName || 'أحمد عيد';
    renderHeaderProfile();
    document.getElementById('login-overlay').style.display = 'none';
    if (val === db.adminPass) toggleAdminMode(true);
    else { isAdmin = false; persistSession('staff'); renderAll(); }
    if (location.hash.startsWith('#category-')) { const id = Number(location.hash.replace('#category-', '')); if (findNode(id)) openCategory(id, false); }
  } else document.getElementById('login-error').style.display = 'block';
}
function logoutUser() {
  clearSession();
  isAdmin = false;
  currentCatId = null;
  categoryHistory = [];
  closeQuickSearch();
  document.getElementById('admin-bar').style.display = 'none';
  document.getElementById('addUpdateBtn').style.display = 'none';
  document.getElementById('categoryPage').style.display = 'none';
  document.querySelector('.hero').style.display = '';
  document.querySelector('.main-container').style.display = '';
  document.getElementById('loginPassInput').value = '';
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('login-error').style.display = 'none';
  history.replaceState({ home: true }, '', location.pathname + location.search);
  window.scrollTo({ top: 0, behavior: 'auto' });
}
function requestAdminAccess() {
  if (isAdmin) return;
  const pass = prompt('أدخل كلمة مرور الإدارة لتفعيل وضع التعديل (الافتراضية: admin):');
  if (pass === db.adminPass) toggleAdminMode(true); else if (pass !== null) alert('كلمة مرور الإدارة غير صحيحة!');
}
function toggleAdminMode(state, saveRole = true) {
  isAdmin = state;
  if(!state)hideFloatingRichToolbar(true);
  renderHeaderProfile();
  document.getElementById('admin-bar').style.display = isAdmin ? 'flex' : 'none';
  document.getElementById('addUpdateBtn').style.display = isAdmin ? 'inline-block' : 'none';
  if (saveRole) persistSession(isAdmin ? 'admin' : 'staff');
  document.querySelectorAll('.editable-text').forEach(el => {
    el.contentEditable = isAdmin;
    el.style.outline = isAdmin ? '1px dashed #FACC15' : 'none';
    el.onblur = () => { if (!db.texts) db.texts = {}; db.texts[el.dataset.key] = el.innerText; saveLocalChanges(false); };
  });
  renderAll();
}
function folderItemCounts(node) {
  const childrenCount = (node.children || []).length;
  const sectionsCount = (node.viewMode || 'browse') === 'content' ? (node.sections || []).length : 0;
  return { childrenCount, sectionsCount };
}
function folderCountLabel(node) {
  const { childrenCount, sectionsCount } = folderItemCounts(node);
  if (childrenCount && sectionsCount) return `${childrenCount} عنصر · ${sectionsCount} جزء`;
  if (sectionsCount) return `${sectionsCount} عنصر`;
  return `${childrenCount} عنصر`;
}
function nodeCardMarkup(node) {
  const s = getIconSettings(node);
  return `<span class="article-count-badge">${node.type === 'folder' ? folderCountLabel(node) : 'صفحة محتوى'}</span>
    <div class="kb-card-right" style="gap:${s.gap}px;align-items:${s.align || 'center'};">
      <div class="kb-icon-box" style="width:${s.width}px;height:${s.height}px;font-size:${s.fontSize}px;color:${s.color};background:${s.bgColor};">${node.iconImage ? `<img src="${node.iconImage}" alt="" style="width:100%;height:100%;object-fit:contain;">` : escapeHTML(node.icon || (node.type === 'folder' ? '📁' : '📄'))}</div>
      <div class="kb-card-text"><h3>${escapeHTML(node.title)}</h3><p>${escapeHTML(node.subtitle || (node.type === 'folder' ? 'مجلد' : 'صفحة محتوى'))}</p></div>
    </div><span class="kb-arrow">‹</span>`;
}
function getCardDropMode(event, card, node) {
  const rect = card.getBoundingClientRect();
  const parent = card.parentElement;
  const cols = parent ? getComputedStyle(parent).gridTemplateColumns.split(' ').filter(Boolean).length : 1;
  const multiColumn = cols > 1 && rect.width < (parent?.clientWidth || rect.width) * 0.92;
  if (multiColumn) {
    const ratioX = (event.clientX - rect.left) / Math.max(1, rect.width);
    if (ratioX >= 0.68) return 'before'; // RTL: the right edge is before
    if (ratioX <= 0.32) return 'after';
    return node.type === 'folder' ? 'inside' : (ratioX > 0.5 ? 'before' : 'after');
  }
  const ratioY = (event.clientY - rect.top) / Math.max(1, rect.height);
  if (ratioY <= 0.28) return 'before';
  if (ratioY >= 0.72) return 'after';
  return node.type === 'folder' ? 'inside' : (ratioY < 0.5 ? 'before' : 'after');
}
function findNearestGridCard(grid, x, y) {
  const cards=[...grid.querySelectorAll(':scope > .tree-card')];
  if(!cards.length)return null;
  let best=null,bestDistance=Infinity;
  cards.forEach(card=>{
    const r=card.getBoundingClientRect();
    const nearX=Math.max(r.left,Math.min(x,r.right));
    const nearY=Math.max(r.top,Math.min(y,r.bottom));
    const distance=Math.hypot(x-nearX,y-nearY);
    if(distance<bestDistance){bestDistance=distance;best=card;}
  });
  return best;
}
function createNodeCard(node, parentId = null) {
  const card = document.createElement('div');
  card.className = 'kb-card tree-card';
  card.draggable = isAdmin;
  card.dataset.nodeId = node.id;
  card.innerHTML = nodeCardMarkup(node);
  if (isBulkDeleteActiveForCurrentNode() && String(parentId) === String(currentCatId)) {
    const selected = bulkDeleteSelection.has(`node:${node.id}`);
    const selector = document.createElement('label');
    selector.className = 'bulk-delete-control bulk-node-delete-control';
    selector.title = 'تحديد العنصر للحذف';
    selector.innerHTML = `<input type="checkbox" data-bulk-kind="node" data-bulk-id="${escapeHTML(node.id)}" ${selected ? 'checked' : ''} onchange="toggleBulkDeleteItemFromControl(this)">`;
    selector.addEventListener('click', event => event.stopPropagation());
    card.appendChild(selector);
    card.classList.toggle('bulk-delete-selected', selected);
  }
  card.onclick = event => {
    if (suppressNextCardClick) { suppressNextCardClick = false; event.preventDefault(); event.stopPropagation(); return; }
    openCategory(node.id);
  };
  if (isAdmin) {
    card.addEventListener('dragstart', event => {
      draggedNodeId = node.id;
      event.dataTransfer.setData('text/plain', String(node.id));
      event.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      draggedNodeId = null; draggedDropMode = null; suppressNextCardClick = true;
      document.querySelectorAll('.drop-target,.dragging,.drop-before,.drop-after,.drop-inside').forEach(el => el.classList.remove('drop-target','dragging','drop-before','drop-after','drop-inside'));
      setTimeout(() => { suppressNextCardClick = false; }, 80);
    });
    card.addEventListener('dragover', event => {
      if (draggedNodeId == null || String(node.id) === String(draggedNodeId) || isDescendant(draggedNodeId, node.id)) return;
      event.preventDefault();
      draggedDropMode = getCardDropMode(event, card, node);
      card.classList.remove('drop-before','drop-after','drop-inside');
      card.classList.add(draggedDropMode === 'before' ? 'drop-before' : draggedDropMode === 'after' ? 'drop-after' : 'drop-inside');
      event.dataTransfer.dropEffect = 'move';
    });
    card.addEventListener('dragleave', event => {
      if (!card.contains(event.relatedTarget)) card.classList.remove('drop-before','drop-after','drop-inside','drop-target');
    });
    card.addEventListener('drop', event => {
      event.preventDefault(); event.stopPropagation();
      const mode = getCardDropMode(event, card, node);
      card.classList.remove('drop-target','drop-before','drop-after','drop-inside');
      moveNode(draggedNodeId, node.id, mode);
      suppressNextCardClick = true;
    });
  }
  return card;
}
function renderAll() {
  renderHeaderProfile();
  renderHeaderLinks();
  document.querySelectorAll('.editable-text').forEach(el => { if (db.texts && db.texts[el.dataset.key]) el.innerText = db.texts[el.dataset.key]; });
  renderHomeGroupSections();
  const groupGrids = [...document.querySelectorAll('[data-home-group-grid]')];
  groupGrids.forEach(grid => { grid.innerHTML = ''; });
  (db.nodes || []).forEach(node => {
    const targetGrid = groupGrids.find(grid => String(grid.dataset.homeGroupGrid) === String(node.homeGroup));
    if (targetGrid) targetGrid.appendChild(createNodeCard(node));
  });
  groupGrids.forEach(grid => {
    const groupId=grid.dataset.homeGroupGrid;
    const empty=[...grid.parentElement.querySelectorAll('[data-home-group-empty]')].find(el=>String(el.dataset.homeGroupEmpty)===String(groupId));
    if(empty)empty.hidden=grid.children.length>0;
    setupRootDropGrid(grid, groupId);
  });
  const uGrid = document.getElementById('updatesGrid'); uGrid.innerHTML = '';
  (db.updates || []).forEach((u, idx) => {
    const c = document.createElement('div'); c.className = 'upd-card'; c.tabIndex = 0; c.setAttribute('role','button');
    const isTopic = u.type === 'topic';
    c.innerHTML = `<div class="kb-icon-box" style="width:46px;height:46px;font-size:20px;">${escapeHTML(u.icon || (isTopic?'📘':'📌'))}</div><div class="upd-info" style="flex:1;">${isAdmin ? `<button class="btn-del-small" onclick="event.stopPropagation();deleteUpdate(${idx})">حذف</button>` : ''}<span class="badge ${escapeHTML(u.badgeClass || (isTopic?'b-topic':'b-new'))}">${escapeHTML(u.badge || (isTopic?'موضوع':'جديد'))}</span><h4>${escapeHTML(u.title)}</h4><p>${escapeHTML(u.desc || (isTopic?'موضوع تفصيلي':'اضغط لعرض الرسالة'))}</p>${isTopic?'<span class="upd-card-action">اقرأ الموضوع ←</span>':''}</div>`;
    const open = () => isTopic ? openUpdateTopic(u.id) : openQuickNotice(u);
    c.addEventListener('click',open); c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}}); uGrid.appendChild(c);
  });
  if (currentCatId !== null && document.getElementById('categoryPage').style.display !== 'none') renderCategoryPage(currentCatId);
}
function setupRootDropGrid(grid, rootGroup) {
  if (!grid) return;
  grid.classList.toggle('admin-drop-root', isAdmin);
  if (!isAdmin) { grid.ondragover = null; grid.ondrop = null; grid.ondragleave = null; return; }
  grid.ondragover = event => {
    if (event.target !== grid || draggedNodeId == null) return;
    event.preventDefault();
    const nearest = findNearestGridCard(grid, event.clientX, event.clientY);
    grid.querySelectorAll('.drop-before,.drop-after,.drop-inside').forEach(card => card.classList.remove('drop-before','drop-after','drop-inside'));
    if (nearest && String(nearest.dataset.nodeId) !== String(draggedNodeId)) {
      const targetNode = findNode(nearest.dataset.nodeId);
      if (targetNode && !isDescendant(draggedNodeId, targetNode.id)) {
        const mode = getCardDropMode(event, nearest, targetNode);
        nearest.classList.add(mode === 'before' ? 'drop-before' : mode === 'after' ? 'drop-after' : 'drop-inside');
        grid.classList.remove('drop-target-root');
        return;
      }
    }
    grid.classList.add('drop-target-root');
  };
  grid.ondragleave = event => {
    if (event.target === grid && !grid.contains(event.relatedTarget)) {
      grid.classList.remove('drop-target-root');
      grid.querySelectorAll('.drop-before,.drop-after,.drop-inside').forEach(card => card.classList.remove('drop-before','drop-after','drop-inside'));
    }
  };
  grid.ondrop = event => {
    if (event.target !== grid) return;
    event.preventDefault();
    grid.classList.remove('drop-target-root');
    const nearest = findNearestGridCard(grid, event.clientX, event.clientY);
    const targetNode = nearest ? findNode(nearest.dataset.nodeId) : null;
    if (targetNode && String(targetNode.id) !== String(draggedNodeId) && !isDescendant(draggedNodeId, targetNode.id)) {
      const mode = getCardDropMode(event, nearest, targetNode);
      moveNode(draggedNodeId, targetNode.id, mode, rootGroup);
    } else {
      moveNode(draggedNodeId, null, false, rootGroup);
    }
    grid.querySelectorAll('.drop-before,.drop-after,.drop-inside').forEach(card => card.classList.remove('drop-before','drop-after','drop-inside'));
  };
}

function isDescendant(parentId, possibleChildId) { const parent = findNode(parentId); return !!parent && (parent.children || []).some(ch => String(ch.id) === String(possibleChildId) || isDescendant(ch.id, possibleChildId)); }
function moveNode(nodeId, targetId, mode, rootGroup = null) {
  if (nodeId == null || String(nodeId) === String(targetId)) return;
  const node = findNode(nodeId); if (!node) return;
  if (targetId != null && isDescendant(nodeId, targetId)) return alert('لا يمكن نقل المجلد داخل نفسه أو داخل أحد المجلدات التابعة له.');
  if (mode === 'inside' && targetId != null && findNode(targetId)?.type !== 'folder') return;
  const oldList = findParentList(nodeId); if (!oldList) return;
  oldList.splice(oldList.findIndex(n => String(n.id) === String(nodeId)), 1);
  let destination, index;
  if (targetId == null) {
    destination = db.nodes;
    index = destination.length;
    node.homeGroup = rootGroup || node.homeGroup || 'general';
  } else if (mode === 'inside') {
    const target = findNode(targetId);
    destination = target.children || (target.children = []);
    index = destination.length;
    delete node.homeGroup;
  } else {
    destination = findParentList(targetId);
    const targetIndex = destination.findIndex(n => String(n.id) === String(targetId));
    index = targetIndex + (mode === 'after' ? 1 : 0);
    if (destination === db.nodes) node.homeGroup = findNode(targetId)?.homeGroup || rootGroup || 'general';
    else delete node.homeGroup;
  }
  destination.splice(Math.max(0, Math.min(index, destination.length)), 0, node);
  saveLocalChanges(false);
  renderAll();
}

function openCategory(id, addHistory = true) {
  const node = findNode(id); if (!node) return;
  hideFloatingRichToolbar(true);
  if (currentCatId !== null && String(currentCatId) !== String(id)) categoryHistory.push(currentCatId);
  if (String(bulkDeleteScopeId) !== String(id)) { bulkDeleteMode = false; bulkDeleteScopeId = null; bulkDeleteSelection.clear(); }
  currentUpdateTopicId=null; document.getElementById('updateTopicPage').style.display='none';
  currentCatId = id; document.querySelector('.hero').style.display = 'none'; document.querySelector('.main-container').style.display = 'none';
  document.getElementById('categoryPage').style.display = 'block'; document.getElementById('categoryModal').style.display = 'none';
  if (addHistory) history.pushState({ categoryId: id }, '', `#category-${id}`);
  renderCategoryPage(id); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function breadcrumbFor(node) {
  const chain = []; let current = node;
  while (current) { chain.unshift(current); current = findParentNode(current.id); }
  return `<a href="#" onclick="goHome();return false;">قاعدة المعرفة</a>${chain.map((n, i) => ` / ${i === chain.length - 1 ? `<strong>${escapeHTML(n.title)}</strong>` : `<a href="#" onclick="openCategory(${n.id});return false;">${escapeHTML(n.title)}</a>`}`).join('')}`;
}
function findParentNode(id, nodes = db.nodes || [], parent = null) { for (const n of nodes) { if (String(n.id) === String(id)) return parent; const found = n.children ? findParentNode(id, n.children, n) : null; if (found) return found; } return null; }
function renderCategoryPage(id) {
  const node = findNode(id); if (!node) return goHome(false);
  const s = getIconSettings(node); document.getElementById('categoryPageBreadcrumb').innerHTML = breadcrumbFor(node);
  document.getElementById('categoryPageTitle').textContent = node.title; document.getElementById('categoryPageSubtitle').textContent = node.subtitle || '';
  const icon = document.getElementById('categoryPageIcon'); icon.style.color = s.color; icon.style.background = s.bgColor; icon.style.width = `${Math.max(64,s.width)}px`; icon.style.height = `${Math.max(64,s.height)}px`; icon.style.flexBasis = `${Math.max(64,s.width)}px`; icon.style.fontSize = `${s.fontSize}px`;
  icon.innerHTML = node.iconImage ? `<img src="${node.iconImage}" alt="">` : escapeHTML(node.icon || (node.type === 'folder' ? '📁' : '📄'));
  const heading = document.querySelector('.category-content-heading h2'); const count = document.getElementById('categoryArticleCount'); const content = document.getElementById('categoryArticles');
  if (node.type === 'folder' && ((node.viewMode || 'browse') === 'content' || (pendingSearchReveal && String(pendingSearchReveal.nodeId) === String(id)))) {
    const children = node.children || []; const sections = node.sections || [];
    heading.textContent = 'محتوى القسم'; count.textContent = folderCountLabel(node);
    content.className = 'category-articles direct-content-layout';
    content.innerHTML = sections.map(sec => renderContentSection(sec)).join('') || (node.content ? renderContentSection({id:`sec-${node.id}-legacy`,content:node.content,format:'text'}) : '');
    if (children.length) { content.insertAdjacentHTML('beforeend','<h3 class="child-items-heading">صفحات ومجلدات ذات صلة</h3>'); children.forEach(child => content.appendChild(createNodeCard(child,node.id))); }
    if (!sections.length && !node.content && !children.length) content.innerHTML = '<p class="empty-category">لا يوجد محتوى مضاف لهذا المجلد بعد.</p>';
  } else if (node.type === 'folder') {
    heading.textContent = 'المجلدات وصفحات المحتوى'; const children = node.children || []; count.textContent = `${children.length} عنصر`;
    content.className = 'category-articles cards-grid'; content.innerHTML = '';
    if (!children.length) content.innerHTML = '<p class="empty-category">المجلد فارغ حالياً. يمكن للإدارة إضافة مجلد فرعي أو صفحة محتوى.</p>';
    children.forEach(child => content.appendChild(createNodeCard(child, node.id)));
  } else {
    heading.textContent = 'محتوى الصفحة'; const sections = node.sections || [];
    count.textContent = `${sections.length || 1} جزء`;
    content.className = 'category-articles direct-content-layout';
    const parts = sections.length ? sections : [{title:'',content:node.content || ''}];
    content.innerHTML = parts.map(sec => renderContentSection(sec)).join('') || '<p class="empty-category">لا يوجد محتوى مضاف لهذه الصفحة بعد.</p>';
  }
  document.getElementById('categoryAdminEditor').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('categoryArticleEditor').innerHTML = '';
  if (isAdmin) renderNodeAdminEditor(node);
  renderBulkDeleteToolbar();
}
function iconPickerMarkup() {
  return `<div class="icon-picker" id="categoryIconPicker" hidden>${ICON_CHOICES.map(icon => `<button type="button" class="icon-choice" aria-label="اختيار ${icon}" onclick="chooseCategoryIcon('${icon}')">${icon}</button>`).join('')}</div>`;
}
function renderNodeAdminEditor(node) {
  const s = getIconSettings(node); const editor = document.getElementById('categoryAdminEditor');
  const isFolder = node.type === 'folder';
  editor.innerHTML = `<h3>إدارة ${isFolder ? 'المجلد' : 'صفحة المحتوى'} والأيقونة</h3>
    <div class="category-admin-grid">
      <div><label for="editCatTitle">الاسم</label><input id="editCatTitle" value="${escapeHTML(node.title)}"></div>
      <div><label for="editCatSub">الوصف المختصر</label><input id="editCatSub" value="${escapeHTML(node.subtitle || '')}"></div>
      ${isFolder ? `<div class="folder-view-mode"><label for="folderViewMode">طريقة فتح المجلد</label><select id="folderViewMode"><option value="browse" ${(node.viewMode || 'browse')==='browse'?'selected':''}>مجلد تصفح: يعرض مجلدات وصفحات بداخله</option><option value="content" ${node.viewMode==='content'?'selected':''}>محتوى مباشر: يعرض الكلام فور الضغط عليه</option></select></div>` : ''}
      <div class="icon-field-wrap"><label for="editCatIcon">الأيقونة (Emoji أو رمز)</label><input id="editCatIcon" value="${escapeHTML(node.icon || '')}" maxlength="8" autocomplete="off" onfocus="toggleCategoryIconPicker(true)" onclick="toggleCategoryIconPicker(true)">${iconPickerMarkup()}</div>
      <div><label for="editCatIconFile">رفع صورة للأيقونة</label><input id="editCatIconFile" type="file" accept="image/*" onchange="previewCategoryIcon(event)"></div>
      <div><label for="iconWidth">عرض خلفية الأيقونة (px)</label><input id="iconWidth" type="number" min="24" max="180" value="${s.width}"></div>
      <div><label for="iconHeight">ارتفاع خلفية الأيقونة (px)</label><input id="iconHeight" type="number" min="24" max="180" value="${s.height}"></div>
      <div><label for="iconFontSize">حجم الرمز (px)</label><input id="iconFontSize" type="number" min="10" max="100" value="${s.fontSize}"></div>
      <div><label for="iconGap">المسافة بين الأيقونة والنص (px)</label><input id="iconGap" type="number" min="0" max="60" value="${s.gap}"></div>
      <div><label for="iconAlign">محاذاة الأيقونة والنص</label><select id="iconAlign"><option value="center" ${s.align==='center'?'selected':''}>منتصف</option><option value="flex-start" ${s.align==='flex-start'?'selected':''}>أعلى</option><option value="flex-end" ${s.align==='flex-end'?'selected':''}>أسفل</option></select></div>
      <div><label for="iconColor">لون الأيقونة</label><input id="iconColor" type="color" value="${s.color}"></div>
      <div><label for="iconBgColor">لون خلفية الأيقونة</label><input id="iconBgColor" type="color" value="${s.bgColor}"></div>
    </div>
    <div class="sections-editor">
      <h4>أجزاء المحتوى</h4>
      <div id="nodeSectionsEditor">${(node.sections || (node.content ? [{title:'',content:node.content,format:'text'}] : [])).map((sec,i)=>sectionEditorMarkup(sec,i)).join('')}</div>
      <button type="button" class="btn-add-art" onclick="addContentSection()">＋ إضافة جزء محتوى</button>
    </div>
    <div class="icon-settings-preview" id="categoryIconPreview" style="width:${s.width}px;height:${s.height}px;font-size:${s.fontSize}px;color:${s.color};background:${s.bgColor};">${node.iconImage?`<img src="${node.iconImage}" alt="">`:escapeHTML(node.icon || '📁')}</div>
    <div class="category-admin-actions">
      <button class="btn-add-art" onclick="saveCategorySettings(${node.id})">حفظ بيانات ${isFolder?'المجلد':'الصفحة'}</button>
      ${isFolder ? `<button class="btn-add-art" onclick="createChildNode(${node.id},'folder')">＋ إنشاء مجلد فرعي</button><button class="btn-add-art" onclick="createChildNode(${node.id},'page')">＋ إنشاء صفحة محتوى مستقلة</button>` : ''}
      <button type="button" class="btn-admin btn-select-delete" onclick="toggleBulkDeleteMode()">${bulkDeleteMode && String(bulkDeleteScopeId)===String(node.id) ? 'إلغاء تحديد العناصر' : (isFolder ? '☑ تحديد محتويات للحذف' : '☑ تحديد أجزاء للحذف')}</button>
      <button type="button" class="btn-del-small btn-delete-container" onclick="deleteCategory(${node.id})">${isFolder?'حذف المجلد نفسه':'حذف الصفحة نفسها'}</button>
      <button class="btn-admin btn-pass" onclick="clearCategoryIconImage(${node.id})">استخدام الرمز بدل الصورة</button>
    </div><p class="drag-help">الحذف منفصل: يمكنك تحديد أجزاء المحتوى أو الصفحات والمجلدات الفرعية وحذفها دون حذف المجلد الحالي. حذف المجلد نفسه إجراء مستقل.</p>`;
  editor.addEventListener('input', syncCurrentEditorToDatabase);
  editor.addEventListener('change', syncCurrentEditorToDatabase);
  editor.addEventListener('focusin', event => { const target=event.target.closest('.section-content-editor'); if(target) setActiveRichEditor(target); });
}
function toggleCategoryIconPicker(force) {
  const picker=document.getElementById('categoryIconPicker'); if(!picker)return;
  picker.hidden = typeof force === 'boolean' ? !force : !picker.hidden;
}
function chooseCategoryIcon(icon) {
  const input=document.getElementById('editCatIcon'); if(input)input.value=icon;
  const preview=document.getElementById('categoryIconPreview'); if(preview)preview.textContent=icon;
  const node=findNode(currentCatId); if(node){node.icon=icon; delete node.iconImage; pendingCategoryIconImage=null; saveLocalChanges(false);}
  toggleCategoryIconPicker(false);
}
async function previewCategoryIcon(event) { try { pendingCategoryIconImage = await readImageFile(event.target.files[0]); const p=document.getElementById('categoryIconPreview'); if(p&&pendingCategoryIconImage)p.innerHTML=`<img src="${pendingCategoryIconImage}" alt="">`; } catch(e){alert(e.message);} }
function clearCategoryIconImage(id) { const node=findNode(id); if(!node)return; delete node.iconImage; pendingCategoryIconImage=null; saveLocalChanges(false); renderAll(); renderCategoryPage(id); }
function syncCurrentEditorToDatabase() {
  if (!isAdmin) return;
  { const _ed=document.activeElement?.closest?.('.section-content-editor')||activeRichEditor; if(_ed) recordRichHistory(_ed); }
  const topicForm=document.getElementById('topicUpdateForm');
  if(topicForm && !topicForm.hidden && newUpdateDraft && newUpdateDraft.mode==='topic'){newUpdateDraft.sections=readSectionsFromContainer('topicSectionsEditor');return;}
  if(currentCatId==null)return;
  const node=findNode(currentCatId);if(!node)return;
  const title=document.getElementById('editCatTitle');
  const subtitle=document.getElementById('editCatSub');
  if(title)node.title=title.value.trim()||node.title;
  if(subtitle)node.subtitle=subtitle.value;
  const icon=document.getElementById('editCatIcon'); if(icon)node.icon=icon.value.trim()||(node.type==='folder'?'📁':'📄');
  const ids=['iconWidth','iconHeight','iconFontSize','iconGap'];
  if(ids.every(id=>document.getElementById(id))) node.iconSettings={
    width:clampNumber('iconWidth',24,180,52),height:clampNumber('iconHeight',24,180,52),fontSize:clampNumber('iconFontSize',10,100,24),gap:clampNumber('iconGap',0,60,15),
    align:document.getElementById('iconAlign').value,color:document.getElementById('iconColor').value,bgColor:document.getElementById('iconBgColor').value
  };
  if(pendingCategoryIconImage)node.iconImage=pendingCategoryIconImage;
  if(node.type==='folder' && document.getElementById('folderViewMode'))node.viewMode=document.getElementById('folderViewMode').value;
  if(document.getElementById('nodeSectionsEditor')) {
    node.sections=readContentSections();
    node.content=node.sections.map(x=>richContentToPlainText(x.content)).filter(Boolean).join('\n\n');
  }
  saveLocalChanges(false);
}
function saveCategorySettings(id) {
  const node=findNode(id); if(!node)return;
  syncCurrentEditorToDatabase();
  pendingCategoryIconImage=null;
  renderAll(); renderCategoryPage(id);
  saveLocalChanges(false);
}
function clampNumber(id,min,max,fallback){const value=Number(document.getElementById(id).value);return Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;}
function goBack(){ if(currentUpdateTopicId!==null){closeUpdateTopic();return;} if(categoryHistory.length){const previous=categoryHistory.pop();openCategory(previous,false);return;} const parent=findParentNode(currentCatId); if(parent) openCategory(parent.id,false); else goHome(); }
function goHome(addHistory=true){hideFloatingRichToolbar(true);categoryHistory=[];bulkDeleteMode=false;bulkDeleteScopeId=null;bulkDeleteSelection.clear();currentCatId=null;currentUpdateTopicId=null;document.getElementById('categoryPage').style.display='none';document.getElementById('updateTopicPage').style.display='none';document.querySelector('.hero').style.display='';document.querySelector('.main-container').style.display='';document.getElementById('categoryModal').style.display='none';if(addHistory)history.pushState({home:true},'',location.pathname+location.search);window.scrollTo({top:0,behavior:'smooth'});updateFloatingNav();}
window.addEventListener('popstate',()=>{const topicMatch=location.hash.match(/^#update-topic-(.+)$/);if(topicMatch&&findUpdate(topicMatch[1])){openUpdateTopic(topicMatch[1],false);return;}const m=location.hash.match(/^#category-(\d+)$/);if(m&&findNode(m[1]))openCategory(Number(m[1]),false);else goHome(false);});
function createChildNode(parentId,type){const parent=findNode(parentId);if(!parent||parent.type!=='folder')return;const title=prompt(type==='folder'?'اسم المجلد الفرعي:':'عنوان صفحة المحتوى المستقلة:');if(!title||!title.trim())return;const node={id:nextNodeId(),type,viewMode:type==='folder'?'browse':undefined,content:'',sections:[],title:title.trim(),subtitle:'',icon:type==='folder'?'📁':'📄',children:[]};parent.children=parent.children||[];parent.children.push(node);saveLocalChanges(false);renderAll();renderCategoryPage(parentId);}
function openNewPageForm(){const group=(db.homeGroups||[])[0];if(group)addRootNodeToGroup(group.id);}
function renderHomeGroupSections(){
  const host=document.getElementById('homeLibrarySections');if(!host)return;
  host.innerHTML=(db.homeGroups||[]).map((group,index)=>{
    const gid=String(group.id);
    const actions=isAdmin?`<div class="home-group-admin-actions">
      <button type="button" class="home-group-action" onclick="addRootNodeToGroup('${escapeHTML(gid)}')">＋ ${gid==='departments'?'إضافة إدارة':'إضافة مجلد'}</button>
      <button type="button" class="home-group-action" title="تعديل اسم القسم ووصفه وأيقونته" onclick="editHomeGroup('${escapeHTML(gid)}')">✎ تعديل القسم</button>
      <button type="button" class="home-group-action" title="تحريك القسم لأعلى" onclick="moveHomeGroup('${escapeHTML(gid)}',-1)" ${index===0?'disabled':''}>↑</button>
      <button type="button" class="home-group-action" title="تحريك القسم لأسفل" onclick="moveHomeGroup('${escapeHTML(gid)}',1)" ${index===db.homeGroups.length-1?'disabled':''}>↓</button>
      <button type="button" class="home-group-action home-group-delete" title="حذف القسم الفارغ" onclick="deleteHomeGroup('${escapeHTML(gid)}')">حذف القسم</button>
    </div>`:'';
    return `<section class="home-library-section" data-home-group-section="${escapeHTML(gid)}">
      <div class="home-library-heading">
        <div class="home-library-heading-main">
          <span class="home-library-heading-icon" aria-hidden="true">${escapeHTML(group.icon||'📁')}</span>
          <div><h2>${escapeHTML(group.title)}</h2>${group.subtitle?`<p>${escapeHTML(group.subtitle)}</p>`:''}</div>
        </div>${actions}
      </div>
      <div class="cards-grid" data-home-group-grid="${escapeHTML(gid)}"></div>
      <div class="empty-category home-group-empty" data-home-group-empty="${escapeHTML(gid)}" hidden>لا توجد مجلدات في هذا القسم بعد.</div>
    </section>`;
  }).join('');
}
function addHomeGroup(){
  if(!isAdmin)return alert('إضافة قسم رئيسي متاحة في وضع الإدارة فقط.');
  const title=prompt('اسم القسم الرئيسي الجديد:');if(!title||!title.trim())return;
  if((db.homeGroups||[]).some(group=>normalizeHomeGroupTitle(group.title)===normalizeHomeGroupTitle(title)))return alert('يوجد قسم بهذا الاسم بالفعل.');
  const subtitle=prompt('وصف مختصر للقسم (اختياري):')||'';
  const icon=prompt('رمز القسم (Emoji) — يمكن تغييره لاحقًا:','📁')||'📁';
  const id=`home-group-${Date.now()}`;
  db.homeGroups.push({id,title:title.trim(),subtitle:subtitle.trim(),icon});
  saveLocalChanges(false);renderAll();
}
function editHomeGroup(groupId){
  if(!isAdmin)return;
  const group=(db.homeGroups||[]).find(item=>String(item.id)===String(groupId));if(!group)return;
  const title=prompt('اسم القسم:',group.title);if(title===null)return;
  if(!title.trim())return alert('اسم القسم لا يمكن أن يكون فارغًا.');
  const duplicate=(db.homeGroups||[]).find(item=>item!==group&&normalizeHomeGroupTitle(item.title)===normalizeHomeGroupTitle(title));
  if(duplicate)return alert('يوجد قسم آخر بهذا الاسم بالفعل.');
  const subtitle=prompt('وصف القسم:',group.subtitle||'');if(subtitle===null)return;
  const icon=prompt('أيقونة القسم:',group.icon||'📁');if(icon===null)return;
  group.title=title.trim();group.subtitle=subtitle.trim();group.icon=icon.trim()||'📁';
  saveLocalChanges(false);renderAll();
}
function deleteHomeGroup(groupId){
  if(!isAdmin)return;
  const group=(db.homeGroups||[]).find(item=>String(item.id)===String(groupId));if(!group)return;
  if(db.homeGroups.length<=1)return alert('يجب الاحتفاظ بقسم رئيسي واحد على الأقل.');
  const items=(db.nodes||[]).filter(node=>String(node.homeGroup)===String(groupId));
  if(items.length)return alert(`لا يمكن حذف قسم "${group.title}" لأنه يحتوي على ${items.length} مجلد/صفحة. انقل محتوياته إلى قسم آخر أولاً.`);
  if(!confirm(`هل تريد حذف القسم الرئيسي "${group.title}"؟`))return;
  db.homeGroups=db.homeGroups.filter(item=>String(item.id)!==String(groupId));
  saveLocalChanges(false);renderAll();
}
function moveHomeGroup(groupId,delta){
  const groups=db.homeGroups||[];const index=groups.findIndex(group=>String(group.id)===String(groupId));const next=index+delta;
  if(index<0||next<0||next>=groups.length)return;
  [groups[index],groups[next]]=[groups[next],groups[index]];saveLocalChanges(false);renderAll();
}
function addRootNodeToGroup(groupId){
  if(!isAdmin)return alert('إضافة مجلد متاحة في وضع الإدارة فقط.');
  const group=(db.homeGroups||[]).find(item=>String(item.id)===String(groupId));if(!group)return;
  const title=prompt(`اسم المجلد الجديد داخل "${group.title}":`);if(!title||!title.trim())return;
  const cleanTitle=title.trim();
  const duplicate=(db.nodes||[]).find(node=>String(node.homeGroup)===String(groupId)&&normalizeHomeGroupTitle(node.title)===normalizeHomeGroupTitle(cleanTitle));
  if(duplicate)return alert('يوجد مجلد بهذا الاسم داخل القسم بالفعل.');
  const subtitle=prompt('وصف مختصر (اختياري):')||'';
  db.nodes.push({id:nextNodeId(),type:'folder',viewMode:'browse',content:'',sections:[],title:cleanTitle,subtitle:subtitle.trim(),icon:groupId==='departments'?'🏢':'📁',homeGroup:groupId,children:[]});
  saveLocalChanges(false);renderAll();
}
function addDepartment(){addRootNodeToGroup('departments');}
function closeNewPageForm(){document.getElementById('newPageModal').style.display='none';}
function createCategoryPage(){openNewPageForm();}
function closeModal(){document.getElementById('categoryModal').style.display='none';goHome();}
function saveCatInfo(id){saveCategorySettings(id);}
function addArticle(id){createChildNode(id,'page');}
function deleteArticle(catId,artIdx){const folder=findNode(catId);if(!folder||!folder.children)return;const pages=folder.children.filter(n=>n.type==='page');const page=pages[artIdx];if(page)deleteCategory(page.id);}
function deleteCategory(id){
  const node=findNode(id); if(!node)return;
  const descendantNodes=node.type==='folder'?allNodes(node.children||[]):[];
  const childCount=node.type==='folder'?(node.children||[]).length:0;
  const nestedOnlyCount=Math.max(0,descendantNodes.length-childCount);
  const sectionCount=(node.sections||[]).length;
  const nestedSectionCount=descendantNodes.reduce((sum,item)=>sum+(item.sections||[]).length,0);
  const message=node.type==='folder'
    ? `أنت على وشك حذف المجلد نفسه: "${node.title}".\nسيتم حذف ${childCount} عنصر مباشر و${nestedOnlyCount} عنصر داخل المجلدات الفرعية و${sectionCount+nestedSectionCount} جزء محتوى في المجلد وكل ما بداخله.\nلا يمكن التراجع عن الحذف. هل تريد المتابعة؟`
    : `أنت على وشك حذف صفحة المحتوى: "${node.title}" بما تحتويه من ${sectionCount} جزء.\nلا يمكن التراجع عن الحذف. هل تريد المتابعة؟`;
  if(!confirm(message))return;
  const parent=findParentNode(id);
  const deletingCurrentPage=String(currentCatId)===String(id)||isDescendant(id,currentCatId);
  const list=findParentList(id); if(!list)return;
  list.splice(list.findIndex(n=>String(n.id)===String(id)),1);
  saveLocalChanges(false);
  bulkDeleteMode=false;bulkDeleteScopeId=null;bulkDeleteSelection.clear();
  if(deletingCurrentPage){
    if(parent){categoryHistory=[];currentCatId=parent.id;openCategory(parent.id,false);}else goHome();
  } else renderAll();
}
function isBulkDeleteActiveForCurrentNode(){return !!(isAdmin&&bulkDeleteMode&&bulkDeleteScopeId!==null&&String(bulkDeleteScopeId)===String(currentCatId));}
function toggleBulkDeleteMode(){
  if(!isAdmin||currentCatId===null)return;
  if(isBulkDeleteActiveForCurrentNode()){bulkDeleteMode=false;bulkDeleteScopeId=null;bulkDeleteSelection.clear();}
  else{bulkDeleteMode=true;bulkDeleteScopeId=currentCatId;bulkDeleteSelection.clear();}
  renderCategoryPage(currentCatId);
}
function toggleBulkDeleteItemFromControl(control){
  if(!control)return;
  toggleBulkDeleteItem(control.dataset.bulkKind,control.dataset.bulkId,control.checked);
}
function toggleBulkDeleteItem(kind,id,checked){
  const key=`${kind}:${id}`;
  if(checked)bulkDeleteSelection.add(key);else bulkDeleteSelection.delete(key);
  document.querySelectorAll('[data-bulk-kind][data-bulk-id]').forEach(input=>{
    if(input.dataset.bulkKind===kind&&String(input.dataset.bulkId)===String(id))input.checked=!!checked;
  });
  document.querySelectorAll('.content-section[data-search-section]').forEach(section=>{
    if(kind==='section'&&String(section.dataset.searchSection)===String(id))section.classList.toggle('bulk-delete-selected',!!checked);
  });
  document.querySelectorAll('.tree-card[data-node-id]').forEach(card=>{
    if(kind==='node'&&String(card.dataset.nodeId)===String(id))card.classList.toggle('bulk-delete-selected',!!checked);
  });
  document.querySelectorAll('.section-editor-item[data-section-id]').forEach(item=>{
    if(kind==='section'&&String(item.dataset.sectionId)===String(id))item.classList.toggle('bulk-delete-selected',!!checked);
  });
  renderBulkDeleteToolbar();
}
function renderBulkDeleteToolbar(){
  const bar=document.getElementById('bulkDeleteToolbar');if(!bar)return;
  if(!isBulkDeleteActiveForCurrentNode()){
    bar.hidden=true;bar.innerHTML='';return;
  }
  const count=bulkDeleteSelection.size;
  bar.hidden=false;
  bar.innerHTML=`<div class="bulk-delete-summary"><strong>${count} عنصر محدد</strong><span>اختر صفحات أو مجلدات فرعية أو أجزاء محتوى. يمكنك تحديد أكثر من عنصر.</span></div><div class="bulk-delete-actions"><button type="button" class="btn-del-small" ${count?'':'disabled'} onclick="deleteBulkSelectedItems()">حذف المحدد (${count})</button><button type="button" class="btn-admin btn-pass" onclick="toggleBulkDeleteMode()">إلغاء</button></div>`;
}
function deleteBulkSelectedItems(){
  if(!isBulkDeleteActiveForCurrentNode()||!bulkDeleteSelection.size)return;
  const node=findNode(currentCatId);if(!node)return;
  const sectionIds=[...bulkDeleteSelection].filter(k=>k.startsWith('section:')).map(k=>k.slice(8));
  const nodeIds=[...bulkDeleteSelection].filter(k=>k.startsWith('node:')).map(k=>k.slice(5));
  const selectedNodes=(node.children||[]).filter(child=>nodeIds.includes(String(child.id)));
  const nestedCount=selectedNodes.reduce((sum,child)=>sum+allNodes(child.children||[]).length,0);
  const nestedSections=selectedNodes.reduce((sum,child)=>sum+allNodes([child]).reduce((part,item)=>part+(item.sections||[]).length,0),0);
  const confirmText=`سيتم حذف ${sectionIds.length} جزء محتوى و${selectedNodes.length} عنصر من هذا القسم${nestedCount?`، بالإضافة إلى ${nestedCount} عنصر تابع داخل المجلدات المحددة`:''}${nestedSections?`، و${nestedSections} جزء محتوى تابع`:''}.\nلن يتم حذف المجلد الحالي. هل تريد المتابعة؟`;
  if(!confirm(confirmText))return;
  if(sectionIds.length){
    node.sections=(node.sections||[]).filter(section=>!sectionIds.includes(String(section.id)));
    node.content=(node.sections||[]).map(section=>richContentToPlainText(section.content||'')).filter(Boolean).join('\n\n');
  }
  if(nodeIds.length)node.children=(node.children||[]).filter(child=>!nodeIds.includes(String(child.id)));
  bulkDeleteSelection.clear();bulkDeleteMode=false;bulkDeleteScopeId=null;
  saveLocalChanges(false);renderAll();renderCategoryPage(node.id);
}
function addNewUpdateItem(){
  if(!isAdmin)return;
  newUpdateDraft={mode:'quick',sections:[]};
  ['quickUpdateTitle','quickUpdateDesc','quickUpdateDetails','topicUpdateTitle','topicUpdateDesc'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('quickUpdateBadge').value='جديد';
  document.getElementById('topicSectionsEditor').innerHTML='';
  document.getElementById('newUpdateModal').style.display='flex';
  setNewUpdateMode('quick');
}
function closeNewUpdateModal(){document.getElementById('newUpdateModal').style.display='none';newUpdateDraft=null;activeRichEditor=null;savedRichRange=null;activeRichImage=null;hideFloatingRichToolbar(true);}
function setNewUpdateMode(mode){
  if(!newUpdateDraft)newUpdateDraft={sections:[]};
  newUpdateDraft.mode=mode;
  document.getElementById('quickUpdateForm').hidden=mode!=='quick';
  document.getElementById('topicUpdateForm').hidden=mode!=='topic';
  document.getElementById('quickUpdateTab').classList.toggle('active',mode==='quick');
  document.getElementById('topicUpdateTab').classList.toggle('active',mode==='topic');
  if(mode==='topic'){
    document.getElementById('topicRichToolbar').innerHTML='';
    const box=document.getElementById('topicSectionsEditor');
    if(!box.children.length){box.insertAdjacentHTML('beforeend',sectionEditorMarkup({id:`topic-sec-${Date.now()}`,title:'',content:'',format:'html'},0));}
    const first=box.querySelector('.section-content-editor');if(first)setActiveRichEditor(first);
  }
}
function badgeClassFor(label){return label==='تذكير'?'b-reminder':label==='تحديث'?'b-update':label==='إعلان'?'b-announcement':'b-new';}
function saveQuickUpdate(){
  const title=document.getElementById('quickUpdateTitle').value.trim();
  const details=document.getElementById('quickUpdateDetails').value.trim();
  if(!title||!details)return alert('اكتب عنوان الرسالة ومحتواها أولاً.');
  const badge=document.getElementById('quickUpdateBadge').value;
  db.updates.unshift({id:`quick-${Date.now()}`,type:'quick',badge,badgeClass:badgeClassFor(badge),icon:'📌',title,desc:document.getElementById('quickUpdateDesc').value.trim()||details.slice(0,90),details});
  saveLocalChanges(false);closeNewUpdateModal();renderAll();
}
function readSectionsFromContainer(containerId){
  const box=document.getElementById(containerId);if(!box)return[];
  return [...box.querySelectorAll(':scope > .section-editor-item')].map((el,i)=>({id:el.dataset.sectionId||`${containerId}-${i+1}`,title:el.querySelector('.section-title-input')?.value.trim()||'',content:sanitizeRichHTML(el.querySelector('.section-content-editor')?.innerHTML||''),format:'html'}));
}
function saveTopicUpdate(){
  if(!isAdmin)return;
  const title=document.getElementById('topicUpdateTitle').value.trim();
  const sections=readSectionsFromContainer('topicSectionsEditor');
  const meaningful=sections.some(s=>s.title||htmlToPlainText(s.content)||/<img\b/i.test(s.content));
  if(!title||!meaningful)return alert('اكتب عنوان الموضوع وأضف جزء محتوى واحدًا على الأقل.');
  const desc=document.getElementById('topicUpdateDesc').value.trim();
  db.updates.unshift({id:`topic-${Date.now()}`,type:'topic',badge:'موضوع',badgeClass:'b-topic',icon:'📘',title,desc,sections});
  saveLocalChanges(false);closeNewUpdateModal();renderAll();
}
function deleteUpdate(idx){if(confirm('حذف هذا التحديث؟')){db.updates.splice(idx,1);saveLocalChanges(false);renderAll();}}
function findUpdate(id){return (db.updates||[]).find(item=>String(item.id)===String(id));}
function openQuickNotice(item){
  document.getElementById('quickNoticeTitle').textContent=item.title||'التحديث';
  const badge=document.getElementById('quickNoticeBadge');badge.textContent=item.badge||'جديد';badge.className=`badge ${item.badgeClass||'b-new'}`;
  document.getElementById('quickNoticeBody').textContent=item.details||item.desc||'';
  document.getElementById('quickNoticeModal').style.display='flex';
}
function closeQuickNotice(){document.getElementById('quickNoticeModal').style.display='none';}
function openUpdateTopic(id,addHistory=true){
  const item=findUpdate(id);if(!item||item.type!=='topic')return;
  hideFloatingRichToolbar(true);
  currentUpdateTopicId=id;currentCatId=null;
  document.querySelector('.hero').style.display='none';document.querySelector('.main-container').style.display='none';document.getElementById('categoryPage').style.display='none';
  document.getElementById('updateTopicPage').style.display='block';
  document.getElementById('updateTopicTitle').textContent=item.title;document.getElementById('updateTopicDesc').textContent=item.desc||'';
  const badge=document.getElementById('updateTopicBadge');badge.textContent=item.badge||'موضوع';badge.className=`badge ${item.badgeClass||'b-topic'}`;
  const host=document.getElementById('updateTopicSections');host.innerHTML=(item.sections||[]).map((sec,i)=>`<section class="content-section" data-topic-section="${escapeHTML(sec.id||i)}">${sec.title?`<h3>${escapeHTML(sec.title)}</h3>`:''}<div class="art-content">${renderSectionBody(sec)}</div></section>`).join('')||'<p class="empty-category">لا يوجد محتوى مضاف لهذا الموضوع.</p>';
  if(addHistory)history.pushState({updateTopicId:id},'',`#update-topic-${encodeURIComponent(id)}`);
  window.scrollTo({top:0,behavior:'smooth'});updateFloatingNav();
}
function closeUpdateTopic(){currentUpdateTopicId=null;goHome(true);}

function normalizeArabicSearch(value) {
  return String(value || '').toLowerCase()
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ى/g, 'ي')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
function arabicTokenVariants(token) {
  const variants=new Set([token]); let current=token;
  for(let i=0;i<3;i++) {
    let changed=false;
    if(current.startsWith('ال') && current.length>3){current=current.slice(2);variants.add(current);changed=true;}
    else if(/^[وفبكلس]/.test(current) && current.length>3){current=current.slice(1);variants.add(current);changed=true;}
    if(!changed)break;
  }
  return [...variants].filter(x=>x.length>1);
}
function searchTokens(query) {
  const stop=new Set(['من','في','على','عن','الى','مع','هو','هي','هذا','هذه','ذلك','التي','الذي']);
  return normalizeArabicSearch(query).split(' ').filter(token=>token.length>1 && !stop.has(token));
}
function htmlToPlainText(value) {
  const div=document.createElement('div');div.innerHTML=sanitizeRichHTML(value||'');
  div.querySelectorAll('br').forEach(br=>br.replaceWith(document.createTextNode('\n')));
  div.querySelectorAll('p,li,blockquote').forEach(el=>{if(el.previousSibling)el.parentNode.insertBefore(document.createTextNode('\n'),el);el.appendChild(document.createTextNode('\n'));});
  return (div.textContent||div.innerText||'').replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{2,}/g,'\n').trim();
}
function richContentToPlainText(value) { return htmlToPlainText(value); }
function searchWordMatchesToken(word, token){
  const wordVariants=arabicTokenVariants(normalizeArabicSearch(word));
  const tokenVariants=arabicTokenVariants(token);
  return tokenVariants.some(variant=>wordVariants.includes(variant));
}
function tokensMatchText(tokens, text) {
  const words=normalizeArabicSearch(text).split(' ').filter(Boolean);
  if(!words.length)return false;
  return tokens.every(token=>words.some(word=>searchWordMatchesToken(word,token)));
}
function highlightSearchMatches(container, query){
  if(!container)return;
  const tokens=searchTokens(query);if(!tokens.length)return;
  const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT,{acceptNode(node){
    if(!node.nodeValue||!/[\p{L}\p{N}]/u.test(node.nodeValue))return NodeFilter.FILTER_REJECT;
    const parent=node.parentElement;if(!parent||parent.closest('mark,script,style,button'))return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  }});
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{
    const text=node.nodeValue;const re=/[\p{L}\p{N}]+/gu;let match,last=0,hasMatch=false;const fragment=document.createDocumentFragment();
    while((match=re.exec(text))){
      fragment.appendChild(document.createTextNode(text.slice(last,match.index)));
      if(tokens.some(token=>searchWordMatchesToken(match[0],token))){
        const mark=document.createElement('mark');mark.className='search-match';mark.textContent=match[0];fragment.appendChild(mark);hasMatch=true;
      }else fragment.appendChild(document.createTextNode(match[0]));
      last=match.index+match[0].length;
    }
    if(!hasMatch)return;fragment.appendChild(document.createTextNode(text.slice(last)));node.parentNode.replaceChild(fragment,node);
  });
}
function buildSearchExcerpt(bodyText,query){
  const tokens=searchTokens(query);
  const chunks=String(bodyText||'').split(/\n+|(?<=[.!؟])\s+/u).map(x=>x.trim()).filter(Boolean);
  const matching=chunks.filter(chunk=>tokens.some(token=>normalizeArabicSearch(chunk).split(' ').some(word=>searchWordMatchesToken(word,token))));
  return matching.length?matching.join(' … '):String(bodyText||'').slice(0,220);
}
function getNodePath(node) {
  const path=[]; let current=node;
  while(current){path.unshift(current.title);current=findParentNode(current.id);}
  return path.join(' ← ');
}
function collectGlobalSearchResults(query) {
  const tokens=searchTokens(query);if(!tokens.length)return[];
  const results=[];
  allNodes().forEach(node=>{
    const sections=Array.isArray(node.sections)&&node.sections.length?node.sections:(node.content?[{id:`sec-${node.id}-legacy`,title:'',content:node.content,format:'text'}]:[]);
    let matchedAny=false;
    sections.forEach((section,index)=>{
      const bodyText=section.format==='html'?richContentToPlainText(section.content):String(section.content||'');
      const searchable=[node.title,node.subtitle,section.title,bodyText].join(' ');
      if(tokensMatchText(tokens,searchable)){
        matchedAny=true;const titleMatch=tokensMatchText(tokens,`${node.title} ${section.title||''}`);
        const phrase=normalizeArabicSearch(query);const score=(normalizeArabicSearch(searchable).includes(phrase)?100:0)+(titleMatch?20:0);
        results.push({type:'section',nodeId:node.id,sectionId:section.id||`sec-${node.id}-${index+1}`,nodeTitle:node.title,sectionTitle:section.title||'المحتوى',path:getNodePath(node),section,bodyText,excerpt:buildSearchExcerpt(bodyText,query),score});
      }
    });
    if(!matchedAny&&tokensMatchText(tokens,`${node.title} ${node.subtitle||''}`))results.push({type:'node',nodeId:node.id,sectionId:null,nodeTitle:node.title,sectionTitle:'',path:getNodePath(node),bodyText:node.subtitle||'',excerpt:node.subtitle||'',score:30});
  });
  (db.updates||[]).forEach(item=>{
    if(item.type==='topic'){
      (item.sections||[]).forEach((section,index)=>{
        const bodyText=section.format==='html'?richContentToPlainText(section.content):String(section.content||'');
        if(tokensMatchText(tokens,[item.title,item.desc,section.title,bodyText].join(' '))){
          results.push({type:'topicUpdate',updateId:item.id,nodeTitle:item.title,sectionTitle:section.title||'موضوع',path:'آخر التحديثات ← '+item.title,section,sectionId:section.id||`topic-sec-${index}`,bodyText,excerpt:buildSearchExcerpt(bodyText,query),score:35});
        }
      });
    }else{
      const text=[item.title,item.desc,item.details].join(' ');
      if(tokensMatchText(tokens,text))results.push({type:'quickUpdate',updateId:item.id,nodeTitle:item.title,sectionTitle:item.badge||'رسالة سريعة',path:'آخر التحديثات',bodyText:item.details||item.desc||'',excerpt:buildSearchExcerpt(item.details||item.desc||'',query),score:25});
    }
  });
  return results.sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path,'ar'));
}
function positionQuickSearchPanel(){
  const panel=document.getElementById('quickSearchPanel');if(!panel)return;
  // البحث يظل ثابتًا داخل الهيدر. يتحول إلى نافذة عائمة فقط عند فتحه من الاختصار أثناء التمرير.
  if(!panel.classList.contains('is-open')){
    panel.classList.remove('is-floating');panel.style.removeProperty('top');return;
  }
  const header=document.querySelector('header');const rect=header?.getBoundingClientRect();
  const headerVisible=rect&&rect.bottom>0&&rect.top<window.innerHeight;
  if(headerVisible){panel.classList.remove('is-floating');panel.style.removeProperty('top');}
  else{
    panel.classList.add('is-floating');
    const admin=document.getElementById('admin-bar');
    const adminVisible=admin&&getComputedStyle(admin).display!=='none'&&admin.getBoundingClientRect().bottom>0;
    panel.style.top=adminVisible?`${Math.max(12,admin.getBoundingClientRect().bottom+10)}px`:'12px';
  }
}
function openQuickSearch(focusInput=true, query=null) {
  const panel=document.getElementById('quickSearchPanel');if(!panel)return;
  panel.classList.add('is-open');
  const input=document.getElementById('quickSearchInput');
  const initial=query!==null?query:(input.value||'');
  input.value=initial;lastSearchQuery=initial;
  renderGlobalSearchResults(initial,'quickSearchResults');positionQuickSearchPanel();
  if(focusInput)input.focus();
  updateFloatingNav();
}
function closeQuickSearch(){
  const panel=document.getElementById('quickSearchPanel');if(!panel)return;
  panel.classList.remove('is-open','is-floating');panel.style.removeProperty('top');
  updateFloatingNav();
}
function clearQuickSearch(){
  const panelInput=document.getElementById('quickSearchInput');if(panelInput)panelInput.value='';
  renderGlobalSearchResults('','quickSearchResults');closeQuickSearch();
}
function clearHeroSearch(){
  const input=document.getElementById('globalSearch');if(input)input.value='';
  const box=document.getElementById('heroSearchResults');if(box){box.hidden=true;box.innerHTML='';box.removeAttribute('style');}
}
function closeSearchResultsPanel(containerId){
  if(containerId==='heroSearchResults'){const box=document.getElementById('heroSearchResults');if(box){box.hidden=true;box.innerHTML='';}}
  else closeQuickSearch();
}
function renderGlobalSearchResults(query,containerId='quickSearchResults'){
  const box=document.getElementById(containerId);if(!box)return;
  const clean=String(query||'').trim();
  if(containerId==='quickSearchResults')lastSearchQuery=clean;
  if(!clean){box.innerHTML='<div class="search-empty-state">اكتب كلمة أو عبارة للبحث في جميع المجلدات والأجزاء.</div>';if(containerId==='heroSearchResults')box.hidden=true;return;}
  if(containerId==='heroSearchResults')box.hidden=false;
  const results=collectGlobalSearchResults(clean);
  if(!results.length){box.innerHTML='<div class="search-empty-state">لا توجد نتائج مطابقة. جرّب كلمة أخرى أو صيغة مختلفة.</div>';return;}
  box.innerHTML=`<div class="search-results-count">تم العثور على ${results.length} نتيجة</div>`;
  results.forEach(result=>{
    const card=document.createElement('article');card.className='search-result-card';
    const isContentSection=result.type==='section'&&result.sectionTitle&&result.sectionTitle!=='المحتوى';
    const isTopicSection=result.type==='topicUpdate'&&result.sectionTitle&&result.sectionTitle!=='موضوع';
    const headingText=(isContentSection||isTopicSection)?result.sectionTitle:result.nodeTitle;
    const title=document.createElement('div');title.className='search-result-title';title.textContent=headingText;highlightSearchMatches(title,clean);
    const path=document.createElement('div');path.className='search-result-path';path.textContent=result.path;
    const sub=document.createElement('div');sub.className='search-result-section-title';
    sub.textContent=(isContentSection||isTopicSection)?`داخل: ${result.nodeTitle}`:(result.sectionTitle||'القسم');
    const excerpt=document.createElement('div');excerpt.className='search-result-body search-result-excerpt';excerpt.textContent=result.excerpt||result.bodyText||'';highlightSearchMatches(excerpt,clean);
    card.append(title,path,sub);
    if(result.section&&result.section.format==='html'){
      const details=document.createElement('details');details.className='search-result-full';
      const summary=document.createElement('summary');summary.textContent='عرض المحتوى بالكامل';
      const body=document.createElement('div');body.className='search-result-body';body.innerHTML=renderSectionBody(result.section);highlightSearchMatches(body,clean);
      details.append(summary,body);card.append(excerpt,details);
    }else if(result.section){
      const details=document.createElement('details');details.className='search-result-full';
      const summary=document.createElement('summary');summary.textContent='عرض المحتوى بالكامل';
      const body=document.createElement('div');body.className='search-result-body';body.textContent=result.bodyText||'';highlightSearchMatches(body,clean);
      details.append(summary,body);card.append(excerpt,details);
    }else card.appendChild(excerpt);
    const button=document.createElement('button');button.type='button';button.className='search-result-open';button.textContent=result.type==='topicUpdate'?'فتح الموضوع ←':result.type==='quickUpdate'?'فتح الرسالة ←':'فتح المعلومة في مكانها ←';
    button.addEventListener('click',()=>{
      closeSearchResultsPanel(containerId);
      if(result.type==='topicUpdate')openUpdateTopic(result.updateId);
      else if(result.type==='quickUpdate'){const item=(db.updates||[]).find(x=>String(x.id)===String(result.updateId))||{title:result.nodeTitle,details:result.bodyText};openQuickNotice(item);}
      else openSearchResult(result.nodeId,result.sectionId,clean,containerId);
    });
    card.appendChild(button);box.appendChild(card);
  });
}
function openSearchResult(nodeId,sectionId,query=lastSearchQuery,sourceId='quickSearchResults'){
  pendingSearchReveal=sectionId?{nodeId,sectionId}:null;
  closeSearchResultsPanel(sourceId);openCategory(nodeId);
  if(sectionId){
    const target=[...document.querySelectorAll('#categoryArticles .content-section')].find(el=>el.dataset.searchSection===String(sectionId));
    if(target){highlightSearchMatches(target,query);target.classList.add('search-target-highlight');target.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>target.classList.remove('search-target-highlight'),2800);}
  }
  pendingSearchReveal=null;
}
function positionHeroSearchResults(){
  const input=document.getElementById('globalSearch');const panel=document.getElementById('heroSearchResults');
  if(!input||!panel||panel.hidden)return;
  const rect=input.getBoundingClientRect();
  if(rect.bottom<=0||rect.top>=window.innerHeight){panel.hidden=true;return;}
  panel.style.top=`${Math.min(window.innerHeight-80,rect.bottom+8)}px`;
  panel.style.left=`${Math.max(8,rect.left)}px`;
  panel.style.width=`${Math.min(rect.width,window.innerWidth-16)}px`;
}
function handleSearch(){
  const query=document.getElementById('globalSearch')?.value||'';
  renderGlobalSearchResults(query,'heroSearchResults');
  if(query.trim())positionHeroSearchResults();
}
function handleQuickSearchInput(){
  const query=document.getElementById('quickSearchInput')?.value||'';
  const panel=document.getElementById('quickSearchPanel');
  if(query.trim()){
    panel?.classList.add('is-open');
    renderGlobalSearchResults(query,'quickSearchResults');positionQuickSearchPanel();
  }else{
    renderGlobalSearchResults('','quickSearchResults');closeQuickSearch();
  }
}
function resetSearch(){
  clearQuickSearch();clearHeroSearch();goHome();
}
function updateFloatingNav(){
  const rail=document.getElementById('quickNavRail');if(!rail)return;
  const authenticated=document.body.classList.contains('app-authenticated');
  const isDisplayed=el=>!!el && el.getClientRects().length>0 && getComputedStyle(el).display!=='none';
  const categoryPage=document.getElementById('categoryPage');
  const topicPage=document.getElementById('updateTopicPage');
  const homeHero=document.querySelector('.hero');
  let activeHero=null;
  if(isDisplayed(topicPage)) activeHero=topicPage.querySelector('.update-topic-hero');
  else if(isDisplayed(categoryPage)) activeHero=categoryPage.querySelector('.category-page-hero');
  else if(isDisplayed(homeHero)) activeHero=homeHero;
  // تظهر الاختصارات بمجرد اختفاء شريط الموقع العلوي، وليس بعد تجاوز الـ Hero بالكامل.
  const header=document.querySelector('header');
  const threshold=header ? header.getBoundingClientRect().bottom+window.scrollY : 140;
  const shouldShow=authenticated && window.scrollY>Math.max(90,threshold);
  rail.classList.toggle('is-visible',shouldShow);
  const searchPanel=document.getElementById('quickSearchPanel');
  if(searchPanel?.classList.contains('is-open'))positionQuickSearchPanel();
}
function goHomeFromQuickNav(){closeQuickSearch();resetSearch();}
function changePasswords(){const a=prompt('كلمة مرور دخول الموظفين الجديدة:',db.staffPass);const b=prompt('كلمة مرور الإدارة (وضع التعديل) الجديدة:',db.adminPass);if(a)db.staffPass=a;if(b)db.adminPass=b;saveLocalChanges(false);alert('تم تحديث كلمات المرور وحفظها تلقائيًا.');}
function exportDataBackup(){
  try{
    saveLocalChanges(false);
    const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    const stamp=new Date().toISOString().slice(0,10);
    a.href=url;a.download=`4Level1-KB-Backup-${stamp}.json`;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1200);
  }catch(error){alert('تعذر إنشاء النسخة الاحتياطية: '+error.message);}
}
function importDataBackup(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const imported=JSON.parse(String(reader.result||''));
      if(!imported || (!Array.isArray(imported.nodes) && !Array.isArray(imported.categories))) throw new Error('ملف النسخة الاحتياطية لا يحتوي على قاعدة معرفة صالحة.');
      if(!confirm('استعادة النسخة الاحتياطية ستستبدل البيانات الحالية بهذه النسخة. هل تريد المتابعة؟'))return;
      db=imported;normalizeDatabase();
      if(!Array.isArray(db.headerLinks)) db.headerLinks=[
        {label:'الإجراءات والسياسات',targetId:2,visible:true},{label:'الأنظمة والأدوات',targetId:1,visible:true},{label:'الحالات والسيناريوهات',targetId:3,visible:true},{label:'الأسئلة الشائعة',targetId:7,visible:true}
      ];
      if(!Array.isArray(db.updates)) db.updates=[];
      db.updates.forEach((item,index)=>{if(!item.id)item.id=`legacy-update-${index+1}`;if(!item.type)item.type='quick';if(!item.badge)item.badge='جديد';if(!item.badgeClass)item.badgeClass=badgeClassFor(item.badge);});
      if(!db.texts)db.texts={};
      if(!db.staffPass)db.staffPass='1234';if(!db.adminPass)db.adminPass='admin';
      allNodes().forEach(node=>{
        if(!Array.isArray(node.children))node.children=[];
        if(!Array.isArray(node.sections) || (!node.sections.length && node.content))node.sections=node.content?[{id:`legacy-${node.id}`,title:'',content:node.content,format:'text'}]:[];
        node.sections.forEach((section,index)=>{if(!section.id)section.id=`sec-${node.id}-${index+1}`;if(!section.format)section.format='text';});
      });
      ensureHomeGroups();
      ensureDefaultDepartments();
      saveLocalChanges(false);currentCatId=null;categoryHistory=[];goHome(false);renderAll();
      alert('تمت استعادة النسخة الاحتياطية بنجاح.');
    }catch(error){alert(error.message||'تعذر قراءة ملف النسخة الاحتياطية.');}
    finally{const input=document.getElementById('kbBackupFile');if(input)input.value='';}
  };
  reader.onerror=()=>alert('تعذر قراءة ملف النسخة الاحتياطية.');
  reader.readAsText(file);
}
function triggerBackupRestore(){document.getElementById('kbBackupFile')?.click();}
async function blobToDataURL(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('تعذر تجهيز الصور للتصدير.'));reader.readAsDataURL(blob);});}
async function exportUpdatedHTML(){
  try{
    const paths=['css/style.css','js/script.js','images/hero-banner.png','images/4level1-logo-white.png'];
    const responses=await Promise.all(paths.map(path=>fetch(path)));
    if(responses.some(response=>!response.ok))throw new Error('تعذر تحميل أحد ملفات المشروع أو الصور. شغّل نسخة التطوير باستخدام Live Server ثم حاول مرة أخرى.');
    const [cssTextRaw,jsText,heroBlob,logoBlob]=await Promise.all([responses[0].text(),responses[1].text(),responses[2].blob(),responses[3].blob()]);
    const [heroData,logoData]=await Promise.all([blobToDataURL(heroBlob),blobToDataURL(logoBlob)]);
    const cssText=cssTextRaw.replace(/\.\.\/images\/hero-banner\.png/g,heroData);
    document.getElementById('kb-database').textContent=JSON.stringify(db,null,2);
    const clone=document.documentElement.cloneNode(true);clone.querySelector('#login-overlay').style.display='flex';clone.querySelector('#admin-bar').style.display='none';clone.querySelector('#addUpdateBtn').style.display='none';clone.querySelector('#categoryModal').style.display='none';clone.querySelector('#newPageModal').style.display='none';clone.querySelector('#newUpdateModal')?.style.setProperty('display','none');clone.querySelector('#quickNoticeModal')?.style.setProperty('display','none');clone.querySelector('#categoryPage').style.display='none';clone.querySelector('#updateTopicPage').style.display='none';clone.querySelector('#profileMenu')?.setAttribute('hidden','');clone.querySelector('#quickSearchPanel')?.classList.remove('is-open','is-floating');clone.querySelector('#quickNavRail')?.classList.remove('is-visible');clone.querySelector('#quickSearchInput')?.setAttribute('value','');clone.querySelector('.hero').style.display='';clone.querySelector('.main-container').style.display='';clone.querySelector('#globalSearch').value='';
    clone.querySelectorAll('img[src="images/4level1-logo-white.png"]').forEach(img=>img.src=logoData);
    clone.querySelectorAll('.editable-text').forEach(el=>{el.removeAttribute('contenteditable');el.style.outline='none';});
    const link=clone.querySelector('link[href="css/style.css"]');if(link){const style=clone.ownerDocument.createElement('style');style.textContent=cssText;link.replaceWith(style);}
    const script=clone.querySelector('script[src="js/script.js"]');if(script){const inline=clone.ownerDocument.createElement('script');inline.textContent=jsText;script.replaceWith(inline);}
    const blob=new Blob(['<!DOCTYPE html>\n'+clone.outerHTML],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='4Level1-Knowledge-Base.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){alert(e.message||'حدث خطأ أثناء تصدير الملف.');}
}


function renderSectionBody(sec) {
  if(sec && sec.format==='html') return sanitizeRichHTML(sec.content || '');
  return escapeHTML(sec?.content || '').replace(/\n/g,'<br>');
}
function renderContentSection(sec) {
  const rawId=String(sec.id || `sec-${currentCatId}-legacy`); const sid=escapeHTML(rawId);
  const selected=bulkDeleteSelection.has(`section:${rawId}`);
  const selector=isBulkDeleteActiveForCurrentNode()?`<label class="bulk-delete-control bulk-section-delete-control" title="تحديد الجزء للحذف"><input type="checkbox" data-bulk-kind="section" data-bulk-id="${sid}" ${selected?'checked':''} onchange="toggleBulkDeleteItemFromControl(this)"></label>`:'';
  return `<section class="content-section ${selected?'bulk-delete-selected':''}" data-search-section="${sid}">${selector}${sec.title ? `<h3>${escapeHTML(sec.title)}</h3>` : ''}<div class="art-content">${renderSectionBody(sec)}</div></section>`;
}
function sanitizeRichHTML(html) {
  const source=document.createElement('template');
  source.innerHTML=String(html||'');

  const allowed=new Set(['B','STRONG','I','EM','U','S','SPAN','P','DIV','BR','UL','OL','LI','BLOCKQUOTE','SUB','SUP','IMG','TABLE','THEAD','TBODY','TFOOT','TR','TH','TD','CAPTION','COLGROUP','COL']);
  const safeStyleProperties=new Set([
    'color','background-color','font-size','font-weight','font-style','text-decoration','text-decoration-line',
    'text-align','direction','margin-left','margin-right','margin-top','margin-bottom','text-indent','unicode-bidi',
    'border','border-top','border-right','border-bottom','border-left','border-color','border-style','border-width',
    'border-collapse','border-spacing','padding','padding-top','padding-right','padding-bottom','padding-left',
    'width','min-width','max-width','height','vertical-align','white-space','float','display'
  ]);

  // Excel and some office applications keep table borders in CSS class rules.
  // Resolve the safe declarations onto the copied elements before removing STYLE tags/classes.
  const clipboardRules=[];
  source.content.querySelectorAll('style').forEach(styleNode=>{
    const css=styleNode.textContent||'';
    const rulePattern=/([^{}]+)\{([^{}]*)\}/g;
    let match;
    while((match=rulePattern.exec(css))){
      const declarations=[];
      match[2].split(';').forEach(declaration=>{
        const colon=declaration.indexOf(':');if(colon<1)return;
        const property=declaration.slice(0,colon).trim().toLowerCase();
        const value=declaration.slice(colon+1).trim();
        if(safeStyleProperties.has(property)&&value&&!/url\s*\(|expression|javascript|@import|behavior\s*:/i.test(value))declarations.push([property,value]);
      });
      if(declarations.length)match[1].split(',').forEach(selector=>clipboardRules.push({selector:selector.trim(),declarations}));
    }
  });
  const sourceElements=[...source.content.querySelectorAll('*')];
  clipboardRules.forEach(rule=>{
    // Only apply simple tag/class selectors to avoid importing broad or unsafe CSS selectors.
    const selector=rule.selector.replace(/\s+/g,'');
    const match=selector.match(/^(?:(table|thead|tbody|tfoot|tr|td|th|colgroup|col|caption|p|div|span))?(?:\.([a-zA-Z_][\w-]*))?$/i);
    if(!match||(!match[1]&&!match[2]))return;
    const tag=match[1]?.toUpperCase(),className=match[2];
    sourceElements.forEach(el=>{
      if(tag&&el.tagName!==tag)return;
      if(className&&!el.classList.contains(className))return;
      rule.declarations.forEach(([property,value])=>el.style.setProperty(property,value));
    });
  });

  const cleanNode=node=>{
    if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.nodeValue);
    if(node.nodeType!==Node.ELEMENT_NODE)return document.createDocumentFragment();
    const tag=node.tagName;
    if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','META','LINK'].includes(tag))return document.createDocumentFragment();
    if(!allowed.has(tag)){
      const frag=document.createDocumentFragment();
      [...node.childNodes].forEach(child=>frag.appendChild(cleanNode(child)));
      return frag;
    }
    if(tag==='IMG'){
      const src=node.getAttribute('src')||'';
      if(!/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(src))return document.createDocumentFragment();
      const img=document.createElement('img');img.src=src;img.alt=(node.getAttribute('alt')||'صورة مضافة').slice(0,180);img.className='kb-inline-image';
      const st=node.style;
      if(st.float==='left'||st.float==='right'||st.float==='none')img.style.float=st.float;
      if(/^\d{1,3}(?:px|%)$/.test(st.width||''))img.style.width=st.width;
      if(/^\d{1,3}(?:px|%)$/.test(st.maxWidth||''))img.style.maxWidth=st.maxWidth;
      img.style.height='auto';img.style.margin=st.margin||'8px 12px 8px 0';return img;
    }
    const clean=document.createElement(tag.toLowerCase());
    const dir=node.getAttribute('dir');if(dir==='rtl'||dir==='ltr')clean.setAttribute('dir',dir);
    if(tag==='TD'||tag==='TH'){
      ['colspan','rowspan','scope'].forEach(attr=>{const value=node.getAttribute(attr);if(value&&/^(?:[1-9]\d{0,2}|row|col|rowgroup|colgroup)$/i.test(value))clean.setAttribute(attr,value);});
      const align=node.getAttribute('align');if(['left','right','center','justify'].includes((align||'').toLowerCase()))clean.setAttribute('align',align.toLowerCase());
    }
    if(tag==='COL'||tag==='TD'||tag==='TH'){
      const width=node.getAttribute('width');if(width&&/^(?:\d{1,4}px|\d{1,3}%|\d{1,4})$/i.test(width))clean.setAttribute('width',width);
    }
    node.style&&safeStyleProperties.forEach(property=>{
      const value=node.style.getPropertyValue(property);
      if(value&&!/url\s*\(|expression|javascript|@import|behavior\s*:/i.test(value))clean.style.setProperty(property,value);
    });
    if(tag==='TABLE'){
      clean.style.borderCollapse=clean.style.borderCollapse||'collapse';
      clean.style.width=clean.style.width||'100%';clean.style.maxWidth='100%';
      const borderAttr=Number(node.getAttribute('border')||0);
      if(borderAttr>0)clean.setAttribute('border','1');
    }
    if(tag==='TD'||tag==='TH'){
      clean.style.border=clean.style.border||'1px solid #DCE5EF';
      clean.style.padding=clean.style.padding||'8px 10px';
      clean.style.verticalAlign=clean.style.verticalAlign||'middle';
    }
    [...node.childNodes].forEach(child=>clean.appendChild(cleanNode(child)));
    return clean;
  };
  const output=document.createElement('div');
  [...source.content.childNodes].forEach(child=>output.appendChild(cleanNode(child)));
  // If the source had a table-level border attribute but no cell borders, provide platform borders.
  output.querySelectorAll('table[border]').forEach(table=>table.querySelectorAll('td,th').forEach(cell=>{
    if(!cell.style.border)cell.style.border='1px solid #DCE5EF';
    if(!cell.style.padding)cell.style.padding='8px 10px';
  }));
  return output.innerHTML;
}
function richToolbarMarkup(){
  return `<div class="content-format-toolbar" role="toolbar" aria-label="أدوات تنسيق المحتوى">
    <button type="button" title="تراجع (Ctrl+Z)" onmousedown="preserveRichSelection(event)" onclick="richUndo()">↶</button>
    <button type="button" title="إعادة (Ctrl+Y)" onmousedown="preserveRichSelection(event)" onclick="richRedo()">↷</button>
    <span class="toolbar-separator"></span>
    <button type="button" title="عريض" onmousedown="preserveRichSelection(event)" onclick="formatCurrentContent('bold')"><b>B</b></button>
    <button type="button" title="مائل" onmousedown="preserveRichSelection(event)" onclick="formatCurrentContent('italic')"><i>I</i></button>
    <button type="button" title="تحته خط" onmousedown="preserveRichSelection(event)" onclick="formatCurrentContent('underline')"><u>U</u></button>
    <label class="toolbar-color" title="لون الخط">A <input type="color" value="#0F2342" onmousedown="preserveRichSelection(event)" onchange="formatCurrentContent('foreColor',this.value)"></label>
    <label class="toolbar-color fill-color" title="لون خلفية النص">▰ <input type="color" value="#FFF2B2" onmousedown="preserveRichSelection(event)" onchange="formatCurrentContent('hiliteColor',this.value)"></label>
    <span class="toolbar-separator"></span>
    <button type="button" title="محاذاة يمين" onmousedown="preserveRichSelection(event)" onclick="setRichAlignment('right')">≡</button>
    <button type="button" title="توسيط" onmousedown="preserveRichSelection(event)" onclick="setRichAlignment('center')">☰</button>
    <button type="button" title="محاذاة شمال" onmousedown="preserveRichSelection(event)" onclick="setRichAlignment('left')">≡</button>
    <button type="button" title="اتجاه عربي RTL" onmousedown="preserveRichSelection(event)" onclick="setRichDirection('rtl')">RTL</button>
    <button type="button" title="اتجاه إنجليزي LTR" onmousedown="preserveRichSelection(event)" onclick="setRichDirection('ltr')">LTR</button>
    <span class="toolbar-separator"></span>
    <button type="button" title="تكبير الخط" onmousedown="preserveRichSelection(event)" onclick="adjustRichFontSize(2)">A+</button>
    <button type="button" title="تصغير الخط" onmousedown="preserveRichSelection(event)" onclick="adjustRichFontSize(-2)">A−</button>
    <button type="button" title="زيادة المسافة البادئة" onmousedown="preserveRichSelection(event)" onclick="formatCurrentContent('indent')">⇥</button>
    <button type="button" title="تقليل المسافة البادئة" onmousedown="preserveRichSelection(event)" onclick="formatCurrentContent('outdent')">⇤</button>
    <button type="button" title="قائمة نقطية" onmousedown="preserveRichSelection(event)" onclick="formatCurrentContent('insertUnorderedList')">•</button>
    <button type="button" title="قائمة رقمية" onmousedown="preserveRichSelection(event)" onclick="formatCurrentContent('insertOrderedList')">1.</button>
    <select title="تغيير حالة الحروف الإنجليزية" onmousedown="preserveRichSelection(event)" onchange="changeSelectedTextCase(this.value);this.value=''"><option value="">Change Case</option><option value="upper">UPPERCASE</option><option value="lower">lowercase</option><option value="title">Capitalize Each Word</option></select>
    <button type="button" id="formatPainterButton" class="format-painter-button" title="حدد نصًا منسقًا ثم اضغط هنا وحدد النص الجديد (مرة واحدة). دبل كليك = يفضل شغال على أكثر من نص لحد ما تضغط Esc" onmousedown="preserveRichSelection(event)" onclick="formatPainterAction()">🖌 نسخ التنسيق</button>
    <span class="toolbar-separator"></span>
    <button type="button" class="toolbar-image-button" title="إضافة صورة أو أكثر" onmousedown="preserveRichSelection(event)" onclick="openRichImagePicker()">🖼 إضافة صورة</button>
    <button type="button" title="الصورة ناحية اليمين والنص بجانبها" onmousedown="preserveRichSelection(event)" onclick="setSelectedImageFloat('right')">صورة يمين</button>
    <button type="button" title="الصورة ناحية الشمال والنص بجانبها" onmousedown="preserveRichSelection(event)" onclick="setSelectedImageFloat('left')">صورة شمال</button>
    <button type="button" title="الصورة في المنتصف وأسفلها النص" onmousedown="preserveRichSelection(event)" onclick="setSelectedImageFloat('none')">صورة وسط</button>
  </div>`;
}
function setFormatPainterState(armed,sticky=false){
  formatPainterArmed=!!armed;formatPainterSticky=!!armed&&!!sticky;
  if(!armed){lastPaintSignature='';lastPaintEditor=null;}
  document.querySelectorAll('.format-painter-button').forEach(button=>{
    button.classList.toggle('is-armed',formatPainterArmed);
    button.classList.toggle('is-sticky',formatPainterSticky);
    button.textContent=!formatPainterArmed?'🖌 نسخ التنسيق':(formatPainterSticky?'🖌 تنسيق متكرر — Esc للإنهاء':'🖌 اختر النص الهدف');
  });
}
function cancelFormatPainter(){setFormatPainterState(false);copiedRichFormat=null;}
function formatPainterAction(){
  const now=Date.now();
  if(formatPainterArmed){
    // دبل كليك (كليكان سريعان) = وضع متكرر يفضل شغال لحد Esc، كليك عادي = إلغاء
    if(!formatPainterSticky&&now-formatPainterLastClick<450){setFormatPainterState(true,true);formatPainterLastClick=0;return;}
    cancelFormatPainter();return;
  }
  if(!restoreRichSelection()){alert('حدد نصًا منسقًا داخل جزء المحتوى أولاً.');return;}
  const selection=window.getSelection();if(!selection||!selection.rangeCount||selection.getRangeAt(0).collapsed){alert('حدد النص الذي تريد نسخ تنسيقه أولاً.');return;}
  const range=selection.getRangeAt(0);const anchor=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;
  const editor=anchor?.closest?.('.section-content-editor');if(!editor){alert('حدد نصًا داخل محرر المحتوى.');return;}
  const source=anchor.nodeType===1?anchor:anchor.parentElement;const computed=getComputedStyle(source);
  const sourceBlock=source.closest('p,li,blockquote')||editor;const blockStyle=getComputedStyle(sourceBlock);
  const weight=parseInt(computed.fontWeight,10)||400;
  copiedRichFormat={
    color:computed.color,
    backgroundColor:computed.backgroundColor==='rgba(0, 0, 0, 0)'?'':computed.backgroundColor,
    fontSize:computed.fontSize,
    fontWeight:weight>=600?'bold':'normal',
    fontStyle:computed.fontStyle==='italic'?'italic':'normal',
    textDecoration:computed.textDecorationLine.includes('underline')?'underline':'none',
    direction:source.getAttribute('dir')||computed.direction,
    paragraph:sourceBlock!==editor?{textAlign:blockStyle.textAlign,marginLeft:blockStyle.marginLeft,marginRight:blockStyle.marginRight,textIndent:blockStyle.textIndent}:null
  };
  const offsets=richGetOffsets(editor);paintSourceSignature=offsets?`${offsets.start}-${offsets.end}`:'';paintSourceEditor=editor;
  formatPainterLastClick=now;setFormatPainterState(true,false);
}
function richFullyInRange(range,el){
  const r=document.createRange();r.selectNode(el);
  return range.compareBoundaryPoints(Range.START_TO_START,r)<=0&&range.compareBoundaryPoints(Range.END_TO_END,r)>=0;
}
// يشيل التنسيقات القديمة من النص المحدد حتى يظهر التنسيق المنسوخ بوضوح بدل ما يتداخل معها
function stripRichFormattingInRange(editor,range){
  const props=['color','background-color','background','font-size','font-weight','font-style','text-decoration','text-decoration-line'];
  [...editor.querySelectorAll('span,font,b,strong,i,em,u,s,strike,mark')].forEach(el=>{
    try{if(!range.intersectsNode(el)||!richFullyInRange(range,el))return;}catch(_){return;}
    if(el.tagName==='SPAN'){props.forEach(p=>el.style.removeProperty(p));}
    else{while(el.firstChild)el.parentNode.insertBefore(el.firstChild,el);el.remove();}
  });
}
function maybeApplyRichFormatPainter(){
  if(!formatPainterArmed||!copiedRichFormat)return;
  rememberRichSelection();
  const selection=window.getSelection();if(!selection||!selection.rangeCount)return;
  const range=selection.getRangeAt(0);if(range.collapsed)return;
  const anchor=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
  const editor=anchor?.closest?.('.section-content-editor');if(!editor)return;
  activeRichEditor=editor;
  const offsets=richGetOffsets(editor);const sig=offsets?`${offsets.start}-${offsets.end}`:'';
  if(sig&&editor===paintSourceEditor&&sig===paintSourceSignature)return;   // نفس النص المنسوخ منه
  if(sig&&editor===lastPaintEditor&&sig===lastPaintSignature)return;       // نفس التحديد اتطبّق عليه قبل كده
  const f=copiedRichFormat;
  try{
    recordRichHistory(editor);                       // نقطة رجوع قبل التطبيق
    stripRichFormattingInRange(editor,range);
    richSetOffsets(editor,offsets);
    const sel2=window.getSelection();const r2=sel2.rangeCount?sel2.getRangeAt(0):range;
    if(f.paragraph){
      // الفقرات التي بها نص محدد فعلاً فقط (التحديد بتلات كليك قد يلمس بداية الفقرة التالية دون أن يشمل منها حرفًا)
      const blocks=new Set();
      selectedTextNodes(r2,editor).forEach(node=>{
        const from=r2.startContainer===node?r2.startOffset:0;const to=r2.endContainer===node?r2.endOffset:node.length;
        if(to<=from)return;
        const block=node.parentElement?.closest('p,li,blockquote,div');if(block&&editor.contains(block)&&block!==editor)blocks.add(block);
      });
      [...blocks].filter(b=>![...blocks].some(o=>o!==b&&b.contains(o))).forEach(b=>{
        Object.entries(f.paragraph).forEach(([k,v])=>{if(v&&v!=='auto'&&v!=='start')b.style[k]=v;});
      });
    }
    const styles={color:f.color,backgroundColor:f.backgroundColor,fontSize:f.fontSize,fontWeight:f.fontWeight,fontStyle:f.fontStyle,textDecoration:f.textDecoration};
    const attrs={};
    if(f.direction==='rtl'||f.direction==='ltr'){attrs.dir=f.direction;styles.unicodeBidi='isolate';}
    if(!wrapRichSelection(styles,attrs)){syncCurrentEditorToDatabase();}
  }catch(error){console.warn('تعذر تطبيق نسخ التنسيق',error);return;}
  if(formatPainterSticky){lastPaintSignature=sig;lastPaintEditor=editor;}
  else cancelFormatPainter();
  rememberRichSelection();
}

/* ===== التراجع والإعادة (Undo / Redo) للمحرر =====
   المتصفح لا يسجّل في سجله التعديلات التي تتم عبر JavaScript (تغيير الألوان والخطوط ونسخ التنسيق...)،
   لذلك نحتفظ بسجل خاص بكل محرر محتوى. */
const richHistory=new WeakMap();
let richHistoryRestoring=false,richHistoryCoalesce=false;
function richGetOffsets(editor){
  const sel=window.getSelection();if(!sel||!sel.rangeCount)return null;
  const r=sel.getRangeAt(0);if(!editor.contains(r.startContainer)||!editor.contains(r.endContainer))return null;
  const pre=document.createRange();pre.selectNodeContents(editor);pre.setEnd(r.startContainer,r.startOffset);
  const start=pre.toString().length;return{start,end:start+r.toString().length};
}
function richSetOffsets(editor,o){
  if(!o||!editor)return;
  const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);let pos=0,sNode=null,sOff=0,eNode=null,eOff=0,n;
  while((n=walker.nextNode())){
    const len=n.nodeValue.length;
    if(!sNode&&o.start<=pos+len){sNode=n;sOff=o.start-pos;}
    if(!eNode&&o.end<=pos+len){eNode=n;eOff=o.end-pos;break;}
    pos+=len;
  }
  const r=document.createRange();
  try{
    if(sNode&&eNode){r.setStart(sNode,sOff);r.setEnd(eNode,eOff);}else{r.selectNodeContents(editor);r.collapse(false);}
    const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);savedRichRange=r.cloneRange();
  }catch(_){}
}
function richHistoryOf(editor){
  let h=richHistory.get(editor);
  if(!h){h={stack:[{html:editor.innerHTML,sel:richGetOffsets(editor),t:0,typing:false}],idx:0};richHistory.set(editor,h);}
  return h;
}
function recordRichHistory(editor){
  const coalesce=richHistoryCoalesce;richHistoryCoalesce=false;
  if(!editor||!editor.isConnected||richHistoryRestoring)return;
  const h=richHistoryOf(editor);const html=editor.innerHTML;const cur=h.stack[h.idx];
  if(cur.html===html)return;
  const now=Date.now();const sel=richGetOffsets(editor);
  h.stack.splice(h.idx+1);
  if(coalesce&&cur.typing&&h.idx>0&&now-cur.t<1200){cur.html=html;cur.sel=sel;cur.t=now;}
  else{
    h.stack.push({html,sel,t:now,typing:coalesce});h.idx=h.stack.length-1;
    const max=html.length>500000?15:80;while(h.stack.length>max){h.stack.shift();h.idx--;}
  }
}
function richHistoryEditor(){
  const a=document.activeElement?.closest?.('.section-content-editor');
  return a||(activeRichEditor&&activeRichEditor.isConnected?activeRichEditor:null);
}
function richApplySnapshot(editor,snap){
  richHistoryRestoring=true;
  try{editor.innerHTML=snap.html;activeRichImage=null;editor.focus({preventScroll:true});richSetOffsets(editor,snap.sel);}
  finally{richHistoryRestoring=false;}
  syncCurrentEditorToDatabase();
}
function richUndo(){
  const ed=richHistoryEditor();if(!ed)return;
  recordRichHistory(ed);const h=richHistoryOf(ed);
  if(h.idx<=0)return;h.idx--;richApplySnapshot(ed,h.stack[h.idx]);
}
function richRedo(){
  const ed=richHistoryEditor();if(!ed)return;
  const h=richHistoryOf(ed);if(h.idx>=h.stack.length-1)return;
  h.idx++;richApplySnapshot(ed,h.stack[h.idx]);
}
document.addEventListener('keydown',event=>{
  if(typeof isAdmin==='undefined'||!isAdmin)return;
  if(!event.target?.closest?.('.section-content-editor'))return;
  if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
  // نستخدم event.code حتى يعمل الاختصار مع لوحة المفاتيح العربية أيضًا
  if(event.code==='KeyZ'&&!event.shiftKey){event.preventDefault();richUndo();}
  else if(event.code==='KeyY'||(event.code==='KeyZ'&&event.shiftKey)){event.preventDefault();richRedo();}
},true);
document.addEventListener('beforeinput',event=>{
  if(event.inputType!=='historyUndo'&&event.inputType!=='historyRedo')return;
  if(!event.target?.closest?.('.section-content-editor'))return;
  event.preventDefault();event.inputType==='historyUndo'?richUndo():richRedo();
},true);
document.addEventListener('input',event=>{
  if(event.target?.closest?.('.section-content-editor'))richHistoryCoalesce=/^(insertText|insertCompositionText|deleteContent)/.test(event.inputType||'');
},true);

function sectionEditorMarkup(sec,i){
  const id=sec.id||`sec-${currentCatId??'new'}-${i+1}`;
  const content=sec.format==='html'?sanitizeRichHTML(sec.content||''):escapeHTML(sec.content||'').replace(/\n/g,'<br>');
  const sectionSelected=isBulkDeleteActiveForCurrentNode()&&bulkDeleteSelection.has(`section:${id}`);
  const selector=isBulkDeleteActiveForCurrentNode()?`<label class="bulk-delete-control section-editor-delete-control" title="تحديد الجزء للحذف"><input type="checkbox" data-bulk-kind="section" data-bulk-id="${escapeHTML(id)}" ${sectionSelected?'checked':''} onchange="toggleBulkDeleteItemFromControl(this)"></label>`:'';
  return `<div class="section-editor-item ${sectionSelected?'bulk-delete-selected':''}" data-section-index="${i}" data-section-id="${escapeHTML(id)}">
    <div class="section-editor-head">${selector}<strong>جزء ${i+1}</strong><button type="button" class="btn-del-small" onclick="removeContentSection(this)">حذف الجزء</button></div>
    <label>عنوان الجزء</label><input class="section-title-input" value="${escapeHTML(sec.title||'')}" placeholder="مثال: الرؤية والرسالة" oninput="syncCurrentEditorToDatabase()">
    <label>المحتوى</label><div class="section-content-editor" contenteditable="true" dir="rtl" data-placeholder="اكتب محتوى الجزء هنا..." onfocus="setActiveRichEditor(this)" oninput="rememberRichSelection();syncCurrentEditorToDatabase()" onkeyup="rememberRichSelection()" onmouseup="rememberRichSelection();maybeApplyRichFormatPainter()" onpaste="handleRichPaste(event)">${content}</div>
    <div class="section-order"><button type="button" onclick="moveContentSection(this,-1)">↑ لأعلى</button><button type="button" onclick="moveContentSection(this,1)">↓ لأسفل</button></div>
  </div>`;
}
function setActiveRichEditor(editor){
  if(!editor||!editor.isConnected)return;
  activeRichEditor=editor;richHistoryOf(editor);rememberRichSelection();
  const launcher=document.getElementById('richToolbarLauncher');
  if(launcher&&isAdmin){launcher.hidden=false;document.body.classList.add('has-active-rich-editor');}
}
function initFloatingRichToolbar(){
  const host=document.getElementById('floatingRichToolbarContent');
  if(host&&!host.querySelector('.content-format-toolbar'))host.innerHTML=richToolbarMarkup();
}
function toggleFloatingRichToolbar(){
  if(!isAdmin||!activeRichEditor||!activeRichEditor.isConnected){alert('اضغط داخل جزء المحتوى أولاً حتى تظهر أدوات التنسيق.');return;}
  initFloatingRichToolbar();
  const dock=document.getElementById('floatingRichToolbar');if(!dock)return;
  dock.hidden=!dock.hidden;
  const launcher=document.getElementById('richToolbarLauncher');
  if(launcher)launcher.classList.toggle('is-open',!dock.hidden);
  if(!dock.hidden)positionFloatingRichToolbar();
}
function positionFloatingRichToolbar(){
  const dock=document.getElementById('floatingRichToolbar');if(!dock||dock.hidden)return;
  const admin=document.getElementById('admin-bar');
  const adminVisible=admin&&getComputedStyle(admin).display!=='none'&&admin.getBoundingClientRect().bottom>0;
  dock.style.top=adminVisible?`${Math.max(10,Math.min(90,admin.getBoundingClientRect().bottom+8))}px`:'10px';
}
function hideFloatingRichToolbar(resetActive=false){
  const dock=document.getElementById('floatingRichToolbar');if(dock)dock.hidden=true;
  const launcher=document.getElementById('richToolbarLauncher');if(launcher){launcher.classList.remove('is-open');if(resetActive)launcher.hidden=true;}
  if(resetActive){document.body.classList.remove('has-active-rich-editor');activeRichEditor=null;savedRichRange=null;activeRichImage=null;setFormatPainterState(false);copiedRichFormat=null;}
}
function rememberRichSelection(){
  const selection=window.getSelection();if(!selection||!selection.rangeCount)return;
  const range=selection.getRangeAt(0);const anchor=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
  const editor=anchor?.closest?.('.section-content-editor');
  if(editor){activeRichEditor=editor;savedRichRange=range.cloneRange();}
}
function preserveRichSelection(event){
  rememberRichSelection();
  if(event?.currentTarget?.tagName==='BUTTON')event.preventDefault();
}
function restoreRichSelection(){
  if(!activeRichEditor||!activeRichEditor.isConnected)return false;
  activeRichEditor.focus({preventScroll:true});
  if(savedRichRange){
    try{
      const boundary=savedRichRange.commonAncestorContainer;
      if(!activeRichEditor.contains(boundary)&&boundary!==activeRichEditor)throw new Error('نطاق التحديد خارج محرر المحتوى الحالي.');
      const selection=window.getSelection();selection.removeAllRanges();selection.addRange(savedRichRange);return true;
    }catch(error){
      console.warn('تعذر استعادة نطاق التحديد السابق؛ سيتم استخدام موضع المؤشر الحالي.',error);
      savedRichRange=null;
    }
  }
  return true;
}
function selectedTextNodes(range,editor){
  const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);const nodes=[];
  while(walker.nextNode()){const node=walker.currentNode;if(!node.nodeValue)continue;try{if(range.intersectsNode(node))nodes.push(node);}catch(_){}}
  return nodes;
}
function wrapRichSelection(styles={},attributes={}){
  if(!restoreRichSelection())return false;
  const selection=window.getSelection();if(!selection||!selection.rangeCount)return false;
  const range=selection.getRangeAt(0).cloneRange();if(range.collapsed)return false;
  const nodes=selectedTextNodes(range,activeRichEditor);if(!nodes.length)return false;
  const wrappers=[];
  [...nodes].reverse().forEach(node=>{
    const start=range.startContainer===node?range.startOffset:0;
    const end=range.endContainer===node?range.endOffset:node.length;
    if(end<=start)return;
    const selected=node.splitText(start);
    if(end-start<selected.length)selected.splitText(end-start);
    const span=document.createElement('span');
    Object.entries(styles).forEach(([key,value])=>{if(value!==''&&value!=null)span.style[key]=value;});
    Object.entries(attributes).forEach(([key,value])=>{if(value!=null)span.setAttribute(key,String(value));});
    selected.parentNode.replaceChild(span,selected);span.appendChild(selected);wrappers.push(span);
  });
  if(!wrappers.length)return false;
  try{
    const next=document.createRange();next.setStartBefore(wrappers[wrappers.length-1]);next.setEndAfter(wrappers[0]);
    selection.removeAllRanges();selection.addRange(next);savedRichRange=next.cloneRange();
  }catch(_){rememberRichSelection();}
  syncCurrentEditorToDatabase();return true;
}
function formatCurrentContent(command,value=null){
  if(['bold','italic','underline','foreColor','hiliteColor','backColor'].includes(command)){
    if(!restoreRichSelection())return;
    const selection=window.getSelection();if(!selection||!selection.rangeCount||selection.getRangeAt(0).collapsed){alert('حدد النص الذي تريد تنسيقه أولاً.');return;}
    const range=selection.getRangeAt(0);const anchor=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;
    const computed=getComputedStyle(anchor);const weight=parseInt(computed.fontWeight,10)||400;let styles={};
    if(command==='bold')styles.fontWeight=weight>=600?'400':'700';
    else if(command==='italic')styles.fontStyle=computed.fontStyle==='italic'?'normal':'italic';
    else if(command==='underline')styles.textDecoration=computed.textDecorationLine.includes('underline')?'none':'underline';
    else if(command==='foreColor')styles.color=value;
    else styles.backgroundColor=value;
    wrapRichSelection(styles);return;
  }
  if(!restoreRichSelection())return;
  try{document.execCommand(command,false,value||null);}catch(error){console.warn('تعذر تطبيق التنسيق',error);}
  rememberRichSelection();syncCurrentEditorToDatabase();
}
function setRichAlignment(align){
  if(!['right','center','left'].includes(align)||!restoreRichSelection())return;
  const selection=window.getSelection();
  const range=selection?.rangeCount?selection.getRangeAt(0):null;
  const blocks=[...activeRichEditor.querySelectorAll('p,div,li,blockquote,td,th')].filter(block=>{
    if(!range||range.collapsed){const anchor=selection?.anchorNode;return !!anchor&&(block.contains(anchor)||block===anchor);}
    try{return range.intersectsNode(block);}catch(_){return false;}
  });
  // Keep alignment on the nearest text blocks; if the editor contains plain text, align the editor itself.
  if(blocks.length){
    const deepest=blocks.filter(block=>!blocks.some(other=>other!==block&&other.contains(block)));
    (deepest.length?deepest:blocks).forEach(block=>block.style.textAlign=align);
  }else{
    // Contenteditable stores only its innerHTML; wrap plain/inline content in a block
    // so the alignment survives saving and reopening the section.
    const paragraph=document.createElement('div');paragraph.style.textAlign=align;
    while(activeRichEditor.firstChild)paragraph.appendChild(activeRichEditor.firstChild);
    activeRichEditor.appendChild(paragraph);
  }
  rememberRichSelection();syncCurrentEditorToDatabase();
}
function setRichDirection(direction){
  if(direction!=='rtl'&&direction!=='ltr')return;
  if(!restoreRichSelection())return;
  const selection=window.getSelection();const range=selection?.rangeCount?selection.getRangeAt(0):null;
  if(range&&!range.collapsed)wrapRichSelection({direction,unicodeBidi:'isolate'},{dir:direction});
  else{
    const anchor=selection?.anchorNode;const block=(anchor?.nodeType===1?anchor:anchor?.parentElement)?.closest('p,div,li,blockquote,td,th')||activeRichEditor;
    block.dir=direction;block.style.direction=direction;block.style.textAlign=direction==='rtl'?'right':'left';syncCurrentEditorToDatabase();
  }
}
function adjustRichFontSize(delta){
  if(!restoreRichSelection())return;
  const selection=window.getSelection();if(!selection||!selection.rangeCount||selection.getRangeAt(0).collapsed){alert('حدد النص الذي تريد تكبيره أو تصغيره أولاً.');return;}
  const range=selection.getRangeAt(0);const anchor=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;
  const current=parseFloat(getComputedStyle(anchor).fontSize)||15;const next=Math.max(10,Math.min(40,current+delta));
  wrapRichSelection({fontSize:`${next}px`});
}
function changeSelectedTextCase(mode){
  if(!mode||!restoreRichSelection())return;
  const selection=window.getSelection();if(!selection||!selection.rangeCount)return;
  const range=selection.getRangeAt(0).cloneRange();if(range.collapsed)return;
  const nodes=selectedTextNodes(range,activeRichEditor);if(!nodes.length)return;
  [...nodes].reverse().forEach(node=>{
    const start=range.startContainer===node?range.startOffset:0;const end=range.endContainer===node?range.endOffset:node.length;
    if(end<=start)return;
    const selected=node.splitText(start);if(end-start<selected.length)selected.splitText(end-start);
    const raw=selected.nodeValue;selected.nodeValue=mode==='upper'?raw.toUpperCase():mode==='lower'?raw.toLowerCase():raw.replace(/\b([a-z])/gi,letter=>letter.toUpperCase());
  });
  syncCurrentEditorToDatabase();rememberRichSelection();
}
function handleRichPaste(event){
  const editor=event.currentTarget?.closest?.('.section-content-editor')||event.target?.closest?.('.section-content-editor');
  if(!editor||!event.clipboardData)return;
  const clipboardHTML=event.clipboardData.getData('text/html')||'';
  const clipboardText=event.clipboardData.getData('text/plain')||'';
  let safeHTML='';
  if(/<table[\s>]/i.test(clipboardHTML)){
    safeHTML=sanitizeRichHTML(clipboardHTML);
  }else{
    // Some spreadsheet sources place tab/newline text on the clipboard without HTML.
    const lines=clipboardText.replace(/\r/g,'').split('\n').filter((line,index,array)=>line.length||index<array.length-1);
    const rows=lines.map(line=>line.split('\t'));
    const columnCount=Math.max(0,...rows.map(row=>row.length));
    const looksTabular=rows.length>=2&&columnCount>=2&&rows.filter(row=>row.length>=2).length>=2;
    if(!looksTabular)return;
    const tableRows=rows.map(row=>`<tr>${Array.from({length:columnCount},(_,index)=>`<td>${escapeHTML(row[index]||'')}</td>`).join('')}</tr>`).join('');
    safeHTML=sanitizeRichHTML(`<table><tbody>${tableRows}</tbody></table>`);
  }
  if(!safeHTML)return;
  event.preventDefault();
  setActiveRichEditor(editor);rememberRichSelection();
  const template=document.createElement('template');template.innerHTML=safeHTML;
  const selection=window.getSelection();let range=selection&&selection.rangeCount?selection.getRangeAt(0):null;
  if(!range||!editor.contains(range.commonAncestorContainer)){
    range=document.createRange();range.selectNodeContents(editor);range.collapse(false);
  }
  range.deleteContents();
  const fragment=template.content;const last=fragment.lastChild;
  range.insertNode(fragment);
  const insertedLast=last&&last.parentNode?last:editor.lastChild;
  const next=document.createRange();
  if(insertedLast)next.setStartAfter(insertedLast);else next.selectNodeContents(editor);
  next.collapse(true);selection.removeAllRanges();selection.addRange(next);
  rememberRichSelection();syncCurrentEditorToDatabase();
}
function addContentSection(){const box=document.getElementById('nodeSectionsEditor');if(!box)return;box.insertAdjacentHTML('beforeend',sectionEditorMarkup({id:`sec-${currentCatId}-${Date.now()}`,title:'',content:'',format:'html'},box.children.length));const editor=box.lastElementChild?.querySelector('.section-content-editor');if(editor){setActiveRichEditor(editor);editor.focus();}syncCurrentEditorToDatabase();}
function addTopicContentSection(){const box=document.getElementById('topicSectionsEditor');if(!box)return;box.insertAdjacentHTML('beforeend',sectionEditorMarkup({id:`topic-sec-${Date.now()}`,title:'',content:'',format:'html'},box.children.length));const editor=box.lastElementChild?.querySelector('.section-content-editor');if(editor){setActiveRichEditor(editor);editor.focus();}if(newUpdateDraft)newUpdateDraft.sections=readSectionsFromContainer('topicSectionsEditor');}
function readContentSections(){return readSectionsFromContainer('nodeSectionsEditor');}
function removeContentSection(btn){const item=btn.closest('.section-editor-item');if(!item)return;const title=item.querySelector('.section-title-input')?.value.trim()||'هذا الجزء';if(!confirm(`هل تريد حذف جزء المحتوى: \"${title}\"؟`))return;const id=item.dataset.sectionId;bulkDeleteSelection.delete(`section:${id}`);const box=item.parentElement;item.remove();renumberSections(box);syncCurrentEditorToDatabase();if(currentCatId!==null)renderCategoryPage(currentCatId);renderBulkDeleteToolbar();}
function moveContentSection(btn,delta){const el=btn.closest('.section-editor-item'),box=el.parentElement,items=[...box.children],i=items.indexOf(el),to=i+delta;if(to<0||to>=items.length)return;if(delta<0)box.insertBefore(el,items[to]);else box.insertBefore(items[to],el);renumberSections(box);syncCurrentEditorToDatabase();}
function renumberSections(box=document.getElementById('nodeSectionsEditor')){if(!box)return;box.querySelectorAll(':scope > .section-editor-item').forEach((el,i)=>{el.dataset.sectionIndex=i;const label=el.querySelector('.section-editor-head strong');if(label)label.textContent=`جزء ${i+1}`;});}
function openRichImagePicker(){rememberRichSelection();document.getElementById('richImageUpload')?.click();}
function optimizeRichImage(file){
  return new Promise((resolve,reject)=>{
    if(!file||!file.type.startsWith('image/'))return reject(new Error('اختر ملف صورة صالحًا.'));
    const reader=new FileReader();reader.onerror=()=>reject(new Error('تعذرت قراءة الصورة.'));
    reader.onload=()=>{
      const img=new Image();img.onerror=()=>reject(new Error('تعذر فتح الصورة.'));
      img.onload=()=>{
        const maxSide=1500,scale=Math.min(1,maxSide/Math.max(img.width,img.height));
        if(file.size<350*1024&&scale===1){resolve(reader.result);return;}
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
        const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const type=file.type==='image/png'&&file.size<900*1024?'image/png':'image/jpeg';resolve(canvas.toDataURL(type,type==='image/png'?undefined:.84));
      };img.src=reader.result;
    };reader.readAsDataURL(file);
  });
}
async function insertRichImages(event){
  const files=[...(event.target.files||[])];if(!files.length)return;
  if(!restoreRichSelection()){alert('اضغط داخل مكان المحتوى أولاً ثم أضف الصورة.');event.target.value='';return;}
  try{
    for(const file of files){
      const src=await optimizeRichImage(file);
      if(src.length>2_400_000){alert(`الصورة ${file.name} ما زالت كبيرة بعد ضغطها. اختر صورة أصغر.`);continue;}
      restoreRichSelection();
      const markup=`<img class="kb-inline-image" src="${src}" alt="${escapeHTML(file.name)}" style="float:right;width:38%;max-width:320px;height:auto;margin:8px 12px 8px 0;">`;
      document.execCommand('insertHTML',false,markup);
      const selection=window.getSelection();const anchor=selection?.anchorNode;activeRichImage=(anchor?.nodeType===1?anchor:anchor?.parentElement)?.closest('img')||activeRichEditor?.querySelector('img:last-of-type');
      rememberRichSelection();
    }
    syncCurrentEditorToDatabase();
  }catch(error){alert(error.message||'تعذر إضافة الصور.');}
  finally{event.target.value='';}
}
function setSelectedImageFloat(position){
  if(!restoreRichSelection())return;
  const selection=window.getSelection();const anchor=selection?.anchorNode;
  let image=(anchor?.nodeType===1?anchor:anchor?.parentElement)?.closest('img')||activeRichImage;
  if(!image||!activeRichEditor?.contains(image)){alert('حدد صورة داخل المحتوى أولاً أو أضف صورة جديدة.');return;}
  image.classList.add('kb-inline-image');image.style.float=position;image.style.width=position==='none'?'min(72%,520px)':'38%';image.style.maxWidth=position==='none'?'72%':'320px';image.style.display=position==='none'?'block':'inline-block';image.style.margin=position==='none'?'12px auto':'8px 12px 8px 0';
  if(position==='none')image.style.clear='both';else image.style.removeProperty('clear');
  syncCurrentEditorToDatabase();
}
function renderHeaderLinks(){
  const nav=document.querySelector('header nav'); if(!nav)return;
  const home='<a class="active-nav" onclick="resetSearch()">🏠 الرئيسية</a>';
  const links=(db.headerLinks||[]).filter(x=>x.visible!==false).map((x,i)=>{
    const hasChildren=Array.isArray(x.children)&&x.children.length>0;
    const sub=hasChildren?`<div class="nav-dropdown">${x.children.filter(c=>c.visible!==false).map(c=>`<a onclick="openCategory(${Number(c.targetId)})">${escapeHTML(c.label)}</a>`).join('')}</div>`:'';
    return `<div class="nav-item"><a class="nav-main-link" onclick="openCategory(${Number(x.targetId)})">${escapeHTML(x.label)}${hasChildren?' ▾':''}</a>${sub}</div>`;
  }).join('');
  nav.innerHTML=home+links;
}
function manageHeaderLinks(){headerLinksDraft=JSON.parse(JSON.stringify(db.headerLinks||[]));headerLinksDraft.forEach(x=>{if(!Array.isArray(x.children))x.children=[];});renderHeaderLinksEditor();document.getElementById('headerLinksModal').style.display='flex';}
function renderHeaderLinksEditor(){
  const box=document.getElementById('headerLinksEditor');
  const opts=allNodes().filter(n=>n.type==='folder').map(n=>`<option value="${n.id}">${escapeHTML(n.title)}</option>`).join('');
  box.innerHTML=headerLinksDraft.map((x,i)=>`<div class="header-link-editor" data-i="${i}">
    <div class="section-editor-head"><strong>الرابط الرئيسي ${i+1}</strong><button type="button" class="btn-del-small" onclick="deleteHeaderLink(${i})">حذف الرابط</button></div>
    <label>اسم الرابط</label><input class="hl-label" value="${escapeHTML(x.label||'')}" placeholder="اكتب الاسم الذي سيظهر في القائمة">
    <label>القسم الذي يفتحه</label><select class="hl-target">${opts}</select>
    <label class="hl-visible"><input type="checkbox" class="hl-show" ${x.visible!==false?'checked':''}> إظهار الرابط</label>
    <div class="section-order"><button type="button" onclick="moveHeaderLink(${i},-1)">↑ لأعلى</button><button type="button" onclick="moveHeaderLink(${i},1)">↓ لأسفل</button><button type="button" onclick="addHeaderSubLink(${i})">＋ إضافة عنصر منسدل</button></div>
    <div class="header-sublinks">${(x.children||[]).map((c,j)=>`<div class="header-sublink-editor" data-sub-index="${j}"><strong>عنصر فرعي ${j+1}</strong><label>اسم العنصر</label><input class="hls-label" value="${escapeHTML(c.label||'')}" placeholder="اكتب اسم العنصر"><label>القسم الذي يفتحه</label><select class="hls-target">${opts}</select><label class="hl-visible"><input type="checkbox" class="hls-show" ${c.visible!==false?'checked':''}> إظهار العنصر</label><div class="section-order"><button type="button" onclick="moveHeaderSubLink(${i},${j},-1)">↑</button><button type="button" onclick="moveHeaderSubLink(${i},${j},1)">↓</button><button type="button" class="btn-del-small" onclick="deleteHeaderSubLink(${i},${j})">حذف</button></div></div>`).join('')}</div>
  </div>`).join('')+`<button class="btn-add-art" onclick="addHeaderLink()">＋ إضافة رابط رئيسي</button><button class="btn-add-art" onclick="saveHeaderLinks()">حفظ روابط القائمة</button>`;
  [...box.querySelectorAll('.header-link-editor')].forEach((el,i)=>{el.querySelector('.hl-target').value=headerLinksDraft[i].targetId;[...el.querySelectorAll('.header-sublink-editor')].forEach((sub,j)=>sub.querySelector('.hls-target').value=headerLinksDraft[i].children[j].targetId);});
}
function addHeaderLink(){const first=allNodes().find(n=>n.type==='folder');if(!first)return alert('أنشئ مجلداً أولاً.');headerLinksDraft.push({label:'',targetId:first.id,visible:true,children:[]});renderHeaderLinksEditor();}
function addHeaderSubLink(i){const first=allNodes().find(n=>n.type==='folder');if(!first)return;headerLinksDraft[i].children=headerLinksDraft[i].children||[];headerLinksDraft[i].children.push({label:'',targetId:first.id,visible:true});renderHeaderLinksEditor();}
function deleteHeaderSubLink(i,j){headerLinksDraft[i].children.splice(j,1);renderHeaderLinksEditor();}
function moveHeaderSubLink(i,j,d){const a=headerLinksDraft[i].children,k=j+d;if(k<0||k>=a.length)return;[a[j],a[k]]=[a[k],a[j]];renderHeaderLinksEditor();}
function deleteHeaderLink(i){headerLinksDraft.splice(i,1);renderHeaderLinksEditor();}
function moveHeaderLink(i,d){const j=i+d;if(j<0||j>=headerLinksDraft.length)return;[headerLinksDraft[i],headerLinksDraft[j]]=[headerLinksDraft[j],headerLinksDraft[i]];renderHeaderLinksEditor();}
function saveHeaderLinks(){
  headerLinksDraft=[...document.querySelectorAll('.header-link-editor')].map(el=>({
    label:el.querySelector('.hl-label').value.trim(),targetId:Number(el.querySelector('.hl-target').value),visible:el.querySelector('.hl-show').checked,
    children:[...el.querySelectorAll('.header-sublink-editor')].map(sub=>({label:sub.querySelector('.hls-label').value.trim(),targetId:Number(sub.querySelector('.hls-target').value),visible:sub.querySelector('.hls-show').checked})).filter(c=>c.label)
  })).filter(x=>x.label);
  db.headerLinks=headerLinksDraft;renderHeaderLinks();closeHeaderLinks();saveLocalChanges(false);alert('تم حفظ روابط القائمة تلقائيًا.');
}
function closeHeaderLinks(){document.getElementById('headerLinksModal').style.display='none';}


function toggleProfileMenu(){const menu=document.getElementById('profileMenu');if(menu)menu.hidden=!menu.hidden;}

// استعادة جلسة المستخدم عند تحديث الصفحة، مع إبقاء صلاحية الدخول في نفس التبويب فقط.
window.addEventListener('scroll', updateFloatingNav, { passive: true });
window.addEventListener('scroll',positionFloatingRichToolbar,{passive:true});
window.addEventListener('scroll',positionHeroSearchResults,{passive:true});
window.addEventListener('resize',()=>{const panel=document.getElementById('quickSearchPanel');if(panel?.classList.contains('is-open'))positionQuickSearchPanel();positionHeroSearchResults();positionFloatingRichToolbar();},{passive:true});
document.addEventListener('keydown', event => { if(event.key==='Escape'){closeQuickSearch();clearHeroSearch();if(formatPainterArmed)cancelFormatPainter();} });
document.addEventListener('selectionchange', rememberRichSelection);
document.addEventListener('click', event => {
  const panel=document.getElementById('quickSearchPanel');
  if(panel?.classList.contains('is-open')&&!panel.contains(event.target)&&!event.target.closest('.quick-search-trigger')&&!event.target.closest('.search-wrapper')&&!event.target.closest('#heroSearchResults'))closeQuickSearch();
  const picker=document.getElementById('categoryIconPicker');
  if(picker&&!picker.hidden&&!event.target.closest('.icon-field-wrap'))picker.hidden=true;
  const profile=document.getElementById('profileMenu');
  if(profile&&!profile.hidden&&!profile.contains(event.target)&&!event.target.closest('.icon-btn-profile'))profile.hidden=true;
});
initFloatingRichToolbar();
restoreAppSession();
