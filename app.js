/**
 * ═══════════════════════════════════════════════════════════
 *  Design Queue Management System — Frontend Logic (app.js)
 * ═══════════════════════════════════════════════════════════
 */

// ─── CONFIGURATION ──────────────────────────────────────────
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz9MsTZjgfiXj2wlqBx7mkLi25jAYRNTuGVMZett9lHodHSuztvCJ7AXsoZuV0GWBEB/exec';
const GOOGLE_CLIENT_ID = '60009065644-095bqh323s4b15bidi6sf7glat4ehmvs.apps.googleusercontent.com';

// ─── APPLICATION STATE ──────────────────────────────────────
const App = {
  user: null,          // { uid, email, profilePic, username, nickname, roles[], department }
  googleProfile: null, // raw Google profile from JWT
  currentView: null,
  designerTab: 'active',
  adminTab: 'jobs',
  designers: [],       // cached designer list for Exec2 view
};

// ─── DOM REFERENCES ─────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {
  loadingOverlay: $('#loadingOverlay'),
  loginScreen: $('#loginScreen'),
  mainApp: $('#mainApp'),
  sidebar: $('#sidebar'),
  sidebarNav: $('#sidebarNav'),
  sidebarAvatar: $('#sidebarAvatar'),
  sidebarName: $('#sidebarName'),
  sidebarRole: $('#sidebarRole'),
  sidebarToggle: $('#sidebarToggle'),
  sidebarOverlay: $('#sidebarOverlay'),
  logoutBtn: $('#logoutBtn'),
  viewTitle: $('#viewTitle'),
  viewSubtitle: $('#viewSubtitle'),
  topBarActions: $('#topBarActions'),
  viewContainer: $('#viewContainer'),
};

// ═══════════════════════════════════════════════════════════
//  1. GOOGLE SIGN‑IN
// ═══════════════════════════════════════════════════════════

window.addEventListener('load', () => {
  if (typeof google !== 'undefined' && google.accounts) {
    initGoogleSignIn();
  } else {
    const checkGsi = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts) {
        clearInterval(checkGsi);
        initGoogleSignIn();
      }
    }, 200);
  }
});

function initGoogleSignIn() {
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
    auto_select: false,
  });

  google.accounts.id.renderButton(
    document.getElementById('googleSignInBtn'),
    {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      shape: 'pill',
      text: 'signin_with',
      logo_alignment: 'left',
      width: 280,
    }
  );
}

function _decodeJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('JWT decode error', e);
    return {};
  }
}

function handleGoogleCredential(response) {
  const payload = _decodeJWT(response.credential);
  App.googleProfile = {
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };

  showLoading();

  apiCall('getUser', { email: payload.email })
    .then((res) => {
      hideLoading();
      if (res.success && res.user) {
        App.user = res.user;
        toast('success', 'เข้าสู่ระบบสำเร็จ', 'ยินดีต้อนรับคุณ ' + (res.user.nickname || res.user.username));
        enterApp();
      } else {
        promptFirstTimeRegistration(App.googleProfile);
      }
    })
    .catch((err) => {
      hideLoading();
      toast('error', 'เกิดข้อผิดพลาด', err.message);
    });
}

function promptFirstTimeRegistration(gp) {
  Swal.fire({
    title: 'ยินดีต้อนรับสู่ระบบ!',
    html: `
      <p class="text-sm text-gray-500 mb-4">เข้าสู่ระบบครั้งแรก — กรุณาระบุข้อมูลส่วนตัวของคุณเพื่อเริ่มใช้งาน</p>
      <div class="text-left space-y-3">
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">ชื่อ-นามสกุล <span class="text-red-500">*</span></label>
          <input id="swalUsername" class="swal2-input !mt-0 !text-sm" placeholder="เช่น นายสมชาย ใจดี" value="${gp.name || ''}" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">ชื่อเล่น / ชื่อเรียกสั้นๆ</label>
          <input id="swalNickname" class="swal2-input !mt-0 !text-sm" placeholder="เช่น บอย, ตาล" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">ฝ่าย / แผนก</label>
          <input id="swalDept" class="swal2-input !mt-0 !text-sm" placeholder="เช่น ฝ่ายการตลาด, ฝ่ายสารสนเทศ" />
        </div>
      </div>
    `,
    confirmButtonText: 'บันทึกข้อมูลและเข้าสู่ระบบ',
    confirmButtonColor: '#6366f1',
    showCancelButton: false,
    allowOutsideClick: false,
    preConfirm: () => {
      const username = document.getElementById('swalUsername').value.trim();
      const nickname = document.getElementById('swalNickname').value.trim();
      const dept = document.getElementById('swalDept').value.trim();
      if (!username) { Swal.showValidationMessage('กรุณาระบุชื่อ-นามสกุล'); return false; }
      return { username, nickname: nickname || username, department: dept };
    },
  }).then((result) => {
    if (result.isConfirmed) {
      showLoading();
      apiCall('registerUser', {
        email: gp.email,
        profilePic: gp.picture || '',
        username: result.value.username,
        nickname: result.value.nickname,
        department: result.value.department,
        roles: 'User',
      })
        .then((res) => {
          hideLoading();
          if (res.success && res.user) {
            App.user = res.user;
            toast('success', 'ลงทะเบียนสำเร็จ', 'ยินดีต้อนรับคุณ ' + res.user.nickname + ' เข้าสู่ระบบ');
            enterApp();
          } else {
            toast('error', 'เกิดข้อผิดพลาด', res.error || 'การลงทะเบียนไม่สำเร็จ');
          }
        })
        .catch((err) => {
          hideLoading();
          toast('error', 'เกิดข้อผิดพลาด', err.message);
        });
    }
  });
}

// ═══════════════════════════════════════════════════════════
//  2. APPLICATION ENTRY
// ═══════════════════════════════════════════════════════════

function enterApp() {
  DOM.loginScreen.classList.add('hidden');
  DOM.mainApp.classList.remove('hidden');
  DOM.mainApp.classList.add('flex');

  // Populate sidebar user card
  DOM.sidebarAvatar.src = App.user.profilePic || App.googleProfile?.picture || '';
  DOM.sidebarName.textContent = App.user.nickname || App.user.username;
  DOM.sidebarRole.textContent = App.user.roles.map(r => ROLE_LABELS[r] || r).join(', ');

  buildSidebarNav();
  bindGlobalEvents();

  // Navigate to the first appropriate view
  const roles = App.user.roles;
  if (roles.includes('Admin')) navigateTo('admin');
  else if (roles.includes('Designer')) navigateTo('designer');
  else if (roles.includes('Exec2')) navigateTo('exec2');
  else if (roles.includes('Exec1')) navigateTo('exec1');
  else navigateTo('user');
}

// ═══════════════════════════════════════════════════════════
//  3. SIDEBAR NAVIGATION
// ═══════════════════════════════════════════════════════════

const ROLE_LABELS = {
  'Admin': 'ผู้ดูแลระบบ (Admin)',
  'Exec1': 'หัวหน้าฝ่าย (Exec1)',
  'Exec2': 'ผู้จ่ายงาน (Exec2)',
  'Designer': 'ดีไซเนอร์ (Designer)',
  'User': 'ผู้ขอรับบริการ (User)',
};

const NAV_ITEMS = [
  { id: 'user', label: 'คำขอของฉัน', icon: 'inbox', roles: ['User', 'Exec1', 'Exec2', 'Designer', 'Admin'] },
  { id: 'exec1', label: 'รับทราบคำขอ (หัวหน้าฝ่าย)', icon: 'check', roles: ['Exec1', 'Admin'] },
  { id: 'exec2', label: 'มอบหมาย & อนุมัติ (จ่ายงาน)', icon: 'users', roles: ['Exec2', 'Admin'] },
  { id: 'designer', label: 'คิวงานออกแบบ', icon: 'palette', roles: ['Designer', 'Admin'] },
  { id: 'admin', label: 'แผงควบคุมระบบ (Admin)', icon: 'shield', roles: ['Admin'] },
];

const ICONS = {
  inbox: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" />',
  check: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
  users: '<path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />',
  palette: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.764m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />',
  shield: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />',
};

function buildSidebarNav() {
  const roles = App.user.roles;
  let html = '';

  NAV_ITEMS.forEach((item) => {
    const hasAccess = item.roles.some((r) => roles.includes(r));
    if (!hasAccess) return;

    html += `
      <button data-nav="${item.id}"
              class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-300 hover:bg-white/10 hover:text-white transition-all group">
        <svg class="w-5 h-5 text-surface-400 group-hover:text-brand-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">${ICONS[item.icon]}</svg>
        ${item.label}
      </button>`;
  });

  DOM.sidebarNav.innerHTML = html;

  // Bind click
  $$('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.nav));
  });
}

function setActiveNav(viewId) {
  $$('.nav-item').forEach((btn) => {
    const isActive = btn.dataset.nav === viewId;
    btn.classList.toggle('bg-white/10', isActive);
    btn.classList.toggle('text-white', isActive);
    btn.classList.toggle('text-surface-300', !isActive);
    const icon = btn.querySelector('svg');
    if (icon) {
      icon.classList.toggle('text-brand-400', isActive);
      icon.classList.toggle('text-surface-400', !isActive);
    }
  });
}

// ═══════════════════════════════════════════════════════════
//  4. VIEW ROUTING
// ═══════════════════════════════════════════════════════════

function navigateTo(viewId) {
  // Hide all view panels
  $$('.view-panel').forEach((el) => el.classList.add('hidden'));

  // Show the target panel
  const panel = $(`#${viewId}View`);
  if (panel) {
    panel.classList.remove('hidden');
    panel.classList.add('animate-fade-in');
  }

  App.currentView = viewId;
  setActiveNav(viewId);
  updateTopBar(viewId);

  // Load data for the view
  switch (viewId) {
    case 'user': loadUserView(); break;
    case 'requestForm': loadRequestForm(); break;
    case 'exec1': loadExec1View(); break;
    case 'exec2': loadExec2View(); break;
    case 'designer': loadDesignerView(); break;
    case 'admin': loadAdminView(); break;
  }
}

function updateTopBar(viewId) {
  const titles = {
    user: ['คำขอของฉัน', 'ติดตามและตรวจสอบสถานะคำขอรับบริการงานออกแบบของคุณ'],
    requestForm: ['สร้างคำขอใหม่', 'กรอกรายละเอียดเพื่อส่งคำขอรับบริการงานออกแบบ'],
    exec1: ['รับทราบคำขอของแผนก', 'ตรวจสอบและรับทราบคำขอรับบริการงานออกแบบของฝ่าย'],
    exec2: ['มอบหมายงานและอนุมัติ', 'เลือกดีไซเนอร์ผู้รับผิดชอบและอนุมัติคิวงาน'],
    designer: ['คิวงานออกแบบ', 'รายการงานออกแบบที่ได้รับมอบหมายและบันทึกผลการดำเนินงาน'],
    admin: ['แผงควบคุมระบบ', 'จัดการและตรวจสอบงานทั้งหมด รวมถึงสิทธิ์ผู้ใช้งาน'],
  };
  const [title, subtitle] = titles[viewId] || ['', ''];
  DOM.viewTitle.textContent = title;
  DOM.viewSubtitle.textContent = subtitle;

  // Top bar action buttons
  let actionsHtml = '';
  if (viewId === 'user') {
    actionsHtml = `<button id="newRequestBtn" class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-brand-500 to-purple-600 hover:from-brand-600 hover:to-purple-700 shadow-md shadow-brand-500/20 transition-all hover:shadow-lg">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
      + สร้างคำขอใหม่
    </button>`;
  }
  DOM.topBarActions.innerHTML = actionsHtml;

  // Bind the new request button
  const nrBtn = $('#newRequestBtn');
  if (nrBtn) nrBtn.addEventListener('click', () => navigateTo('requestForm'));
}

// ═══════════════════════════════════════════════════════════
//  5. GLOBAL EVENT BINDINGS
// ═══════════════════════════════════════════════════════════

function bindGlobalEvents() {
  // Logout
  DOM.logoutBtn.addEventListener('click', () => {
    Swal.fire({
      title: 'ต้องการออกจากระบบหรือไม่?',
      text: 'คุณจะถูกนำกลับไปยังหน้าเข้าสู่ระบบ',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#6366f1',
      confirmButtonText: 'ออกจากระบบ',
      cancelButtonText: 'ยกเลิก',
    }).then((result) => {
      if (result.isConfirmed) {
        google.accounts.id.disableAutoSelect();
        App.user = null;
        App.googleProfile = null;
        DOM.mainApp.classList.add('hidden');
        DOM.loginScreen.classList.remove('hidden');
        location.reload();
      }
    });
  });

  // Mobile sidebar toggle
  DOM.sidebarToggle.addEventListener('click', toggleSidebar);
  DOM.sidebarOverlay.addEventListener('click', toggleSidebar);

  // Request form: category change → show/hide qty
  $('#rfCategory').addEventListener('change', (e) => {
    $('#rfQtyWrap').classList.toggle('hidden', e.target.value !== 'Print');
  });

  // Request form: delivery change → show/hide detail
  $('#rfDelivery').addEventListener('change', (e) => {
    $('#rfDeliveryDetailWrap').classList.toggle('hidden', e.target.value !== 'Other');
  });

  // Request form: cancel button
  $('#rfCancelBtn').addEventListener('click', () => navigateTo('user'));

  // Request form: submit
  $('#requestForm').addEventListener('submit', handleRequestSubmit);

  // Designer tabs
  $$('.designer-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchDesignerTab(tab.dataset.tab));
  });

  // Admin tabs
  $$('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchAdminTab(tab.dataset.admintab));
  });

  // Admin search / filter
  const adminSearch = $('#adminSearch');
  const adminFilter = $('#adminFilterStatus');
  const adminSort = $('#adminSort');
  if (adminSearch) adminSearch.addEventListener('input', debounce(renderAdminJobs, 300));
  if (adminFilter) adminFilter.addEventListener('change', renderAdminJobs);
  if (adminSort) adminSort.addEventListener('change', renderAdminJobs);

  // Designer sort
  const dSort = $('#designerSort');
  if (dSort) dSort.addEventListener('change', () => renderDesignerActive());
}

function toggleSidebar() {
  DOM.sidebar.classList.toggle('-translate-x-full');
  DOM.sidebarOverlay.classList.toggle('hidden');
}

// ═══════════════════════════════════════════════════════════
//  6. VIEW LOADERS
// ═══════════════════════════════════════════════════════════

// ─── 6a. User View ──────────────────────────────────────────

let _userJobs = [];

function loadUserView() {
  showLoading();
  apiCall('getJobs', { filterType: 'user', email: App.user.email })
    .then((res) => {
      hideLoading();
      _userJobs = res.jobs || [];
      renderUserView();
    })
    .catch((err) => { hideLoading(); toast('error', 'เกิดข้อผิดพลาด', err.message); });
}

function renderUserView() {
  const jobs = _userJobs;
  const statsEl = $('#userStats');
  const listEl = $('#userJobsList');
  const emptyEl = $('#userEmpty');

  // Stats
  const counts = { Pending: 0, Acknowledged: 0, 'In Progress': 0, Completed: 0, Cancelled: 0 };
  jobs.forEach((j) => { if (counts[j.JobStatus] !== undefined) counts[j.JobStatus]++; });

  statsEl.innerHTML = `
    ${_statCard('รอรับทราบ', counts.Pending, 'bg-red-50 text-red-600 border-red-200')}
    ${_statCard('รับทราบแล้ว', counts.Acknowledged, 'bg-amber-50 text-amber-600 border-amber-200')}
    ${_statCard('กำลังดำเนินการ', counts['In Progress'], 'bg-blue-50 text-blue-600 border-blue-200')}
    ${_statCard('เสร็จสิ้นแล้ว', counts.Completed, 'bg-emerald-50 text-emerald-600 border-emerald-200')}
  `;

  if (jobs.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  listEl.innerHTML = jobs.map((job) => `
    <div class="bg-white rounded-xl border border-surface-200 p-5 hover:shadow-md transition-shadow animate-slide-up">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="font-semibold text-surface-900 truncate">${_esc(job.ProjectName)}</h3>
            ${_statusBadge(job.JobStatus)}
          </div>
          <p class="text-xs text-surface-400 mb-2">${_esc(job.JobID)}</p>
          <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm text-surface-500">
            <span>📂 แผนก: ${_esc(job.Department)}</span>
            <span>🎨 ประเภท: ${_esc(job.JobCategory)}${job.JobDetails ? ' — ' + _esc(job.JobDetails) : ''}</span>
            <span>📅 กำหนดส่ง: ${_esc(job.DueDate)}</span>
            ${job.AssignedDesigner ? '<span>👤 ดีไซเนอร์: ' + _esc(job.AssignedDesigner) + '</span>' : ''}
          </div>
          ${job.CancelReason ? '<p class="mt-2 text-sm text-red-500">❌ เหตุผลยกเลิก: ' + _esc(job.CancelReason) + '</p>' : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function _statCard(label, count, colorClasses) {
  return `<div class="rounded-xl border p-4 ${colorClasses}">
    <p class="text-2xl font-bold">${count}</p>
    <p class="text-xs font-medium mt-0.5">${label}</p>
  </div>`;
}

// ─── 6b. Request Form ───────────────────────────────────────

function loadRequestForm() {
  const now = new Date();
  $('#rfDate').value = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
  $('#rfEmail').value = App.user.email;
  $('#rfName').value = App.user.username || App.user.nickname;
  $('#rfDepartment').value = App.user.department || '';

  // Reset dynamic fields
  $('#rfCategory').value = '';
  $('#rfQtyWrap').classList.add('hidden');
  $('#rfQty').value = '';
  $('#rfProject').value = '';
  $('#rfUseDate').value = '';
  $('#rfDueDate').value = '';
  $('#rfDelivery').value = '';
  $('#rfDeliveryDetailWrap').classList.add('hidden');
  $('#rfDeliveryDetail').value = '';
  $('#rfDetails').value = '';
}

function handleRequestSubmit(e) {
  e.preventDefault();

  const payload = {
    requesterEmail: $('#rfEmail').value,
    requesterName: $('#rfName').value,
    department: $('#rfDepartment').value.trim(),
    jobCategory: $('#rfCategory').value,
    jobDetails: _buildJobDetails(),
    projectName: $('#rfProject').value.trim(),
    useDate: $('#rfUseDate').value,
    deliveryMethod: $('#rfDelivery').value,
    deliveryDetail: $('#rfDeliveryDetail').value.trim(),
    dueDate: $('#rfDueDate').value,
  };

  Swal.fire({
    title: 'ยืนยันการส่งคำขอรับบริการ?',
    html: `<p class="text-sm text-gray-500">ชื่องาน/โครงการ: <strong>${_esc(payload.projectName)}</strong></p>`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#6366f1',
    confirmButtonText: 'ยืนยันส่งคำขอ',
    cancelButtonText: 'ยกเลิก',
  }).then((result) => {
    if (!result.isConfirmed) return;

    showLoading();
    apiCall('createJob', payload)
      .then((res) => {
        hideLoading();
        if (res.success) {
          toast('success', 'ส่งคำขอสำเร็จ!', 'บันทึกคำขอรับบริการงานออกแบบเรียบร้อยแล้ว');
          navigateTo('user');
        } else {
          toast('error', 'เกิดข้อผิดพลาด', res.error);
        }
      })
      .catch((err) => { hideLoading(); toast('error', 'เกิดข้อผิดพลาด', err.message); });
  });
}

function _buildJobDetails() {
  const parts = [];
  const cat = $('#rfCategory').value;
  if (cat === 'Print') {
    const qty = $('#rfQty').value;
    if (qty) parts.push('จำนวน: ' + qty + ' ชุด/แผ่น');
  }
  const extra = $('#rfDetails').value.trim();
  if (extra) parts.push(extra);
  return parts.join(' | ');
}

// ─── 6c. Exec1 View ────────────────────────────────────────

function loadExec1View() {
  showLoading();
  apiCall('getJobs', { filterType: 'exec1', department: App.user.department })
    .then((res) => {
      hideLoading();
      renderExec1(res.jobs || []);
    })
    .catch((err) => { hideLoading(); toast('error', 'เกิดข้อผิดพลาด', err.message); });
}

function renderExec1(jobs) {
  const listEl = $('#exec1List');
  const emptyEl = $('#exec1Empty');

  if (jobs.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  listEl.innerHTML = jobs.map((job) => `
    <div class="bg-white rounded-xl border border-surface-200 p-5 hover:shadow-md transition-shadow">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="font-semibold text-surface-900 truncate">${_esc(job.ProjectName)}</h3>
            ${_statusBadge(job.JobStatus)}
          </div>
          <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm text-surface-500 mt-1">
            <span>👤 ผู้ขอ: ${_esc(job.RequesterName)}</span>
            <span>🎨 ประเภท: ${_esc(job.JobCategory)}</span>
            <span>📅 กำหนดส่ง: ${_esc(job.DueDate)}</span>
            <span>📨 รับงาน: ${_esc(job.DeliveryMethod)}</span>
          </div>
          ${job.JobDetails ? '<p class="text-sm text-surface-400 mt-1">' + _esc(job.JobDetails) + '</p>' : ''}
        </div>
        <button onclick="handleAcknowledge('${_esc(job.JobID)}')"
                class="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 shadow-sm transition-all">
          ✓ รับทราบคำขอ
        </button>
      </div>
    </div>
  `).join('');
}

function handleAcknowledge(jobId) {
  Swal.fire({
    title: 'ยืนยันการรับทราบคำขอ?',
    text: 'คำขอนี้จะถูกส่งต่อไปยังขั้นตอนการจ่ายงานและเลือกดีไซเนอร์',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    confirmButtonText: 'รับทราบคำขอ',
    cancelButtonText: 'ยกเลิก',
  }).then((result) => {
    if (!result.isConfirmed) return;
    showLoading();
    apiCall('acknowledgeJob', {
      jobId: jobId,
      approverEmail: App.user.email,
      approverName: App.user.username || App.user.nickname,
    })
      .then((res) => {
        hideLoading();
        if (res.success) {
          toast('success', 'รับทราบสำเร็จ', 'ส่งต่องานไปยังขั้นตอนมอบหมายเรียบร้อยแล้ว');
          loadExec1View();
        } else { toast('error', 'เกิดข้อผิดพลาด', res.error); }
      })
      .catch((err) => { hideLoading(); toast('error', 'เกิดข้อผิดพลาด', err.message); });
  });
}

// ─── 6d. Exec2 View ────────────────────────────────────────

function loadExec2View() {
  showLoading();
  Promise.all([
    apiCall('getJobs', { filterType: 'exec2' }),
    apiCall('getDesigners', {}),
  ])
    .then(([jobsRes, designersRes]) => {
      hideLoading();
      App.designers = designersRes.designers || [];
      renderExec2(jobsRes.jobs || []);
    })
    .catch((err) => { hideLoading(); toast('error', 'เกิดข้อผิดพลาด', err.message); });
}

function renderExec2(jobs) {
  const listEl = $('#exec2List');
  const emptyEl = $('#exec2Empty');

  if (jobs.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  const designerOptions = App.designers.map((d) =>
    `<option value="${_esc(d.email)}">${_esc(d.username)} (${_esc(d.nickname)})</option>`
  ).join('');

  listEl.innerHTML = jobs.map((job) => `
    <div class="bg-white rounded-xl border border-surface-200 p-5 hover:shadow-md transition-shadow">
      <div class="flex flex-col lg:flex-row lg:items-center gap-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="font-semibold text-surface-900 truncate">${_esc(job.ProjectName)}</h3>
            ${_statusBadge(job.JobStatus)}
          </div>
          <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm text-surface-500 mt-1">
            <span>👤 ผู้ขอ: ${_esc(job.RequesterName)}</span>
            <span>📂 แผนก: ${_esc(job.Department)}</span>
            <span>🎨 ประเภท: ${_esc(job.JobCategory)}</span>
            <span>📅 กำหนดส่ง: ${_esc(job.DueDate)}</span>
          </div>
          <p class="text-xs text-surface-400 mt-1">รับทราบโดย: ${_esc(job.Exec1_Name)}</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <select id="designer-${_esc(job.JobID)}" class="px-3 py-2 rounded-xl border border-surface-200 text-sm focus:ring-2 focus:ring-brand-400">
            <option value="">เลือกดีไซเนอร์ผู้รับผิดชอบ…</option>
            ${designerOptions}
          </select>
          <button onclick="handleExec2Approve('${_esc(job.JobID)}')"
                  class="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 shadow-sm transition-all">
            อนุมัติ & จ่ายงาน
          </button>
          <button onclick="handleExec2Cancel('${_esc(job.JobID)}')"
                  class="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 shadow-sm transition-all">
            ยกเลิกงาน
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function handleExec2Approve(jobId) {
  const designerEmail = $(`#designer-${jobId}`)?.value;
  if (!designerEmail) {
    toast('warning', 'โปรดระบุดีไซเนอร์', 'กรุณาเลือกดีไซเนอร์ผู้รับผิดชอบก่อนกดอนุมัติ');
    return;
  }

  Swal.fire({
    title: 'ยืนยันการอนุมัติและมอบหมายงาน?',
    text: 'ระบบจะส่งอีเมลแจ้งเตือนไปยังดีไซเนอร์และผู้ขอรับบริการโดยอัตโนมัติ',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#6366f1',
    confirmButtonText: 'อนุมัติงาน',
    cancelButtonText: 'ยกเลิก',
  }).then((result) => {
    if (!result.isConfirmed) return;
    showLoading();
    apiCall('approveJob', {
      jobId: jobId,
      approverEmail: App.user.email,
      approverName: App.user.username || App.user.nickname,
      designerEmail: designerEmail,
    })
      .then((res) => {
        hideLoading();
        if (res.success) {
          toast('success', 'อนุมัติสำเร็จ!', res.message);
          loadExec2View();
        } else { toast('error', 'เกิดข้อผิดพลาด', res.error); }
      })
      .catch((err) => { hideLoading(); toast('error', 'เกิดข้อผิดพลาด', err.message); });
  });
}

function handleExec2Cancel(jobId) {
  Swal.fire({
    title: 'ต้องการยกเลิกคำขอนี้หรือไม่?',
    input: 'textarea',
    inputLabel: 'ระบุเหตุผลในการยกเลิก',
    inputPlaceholder: 'โปรดอธิบายสาเหตุที่ต้องยกเลิกงานนี้เพื่อแจ้งผู้ขอ…',
    inputValidator: (value) => { if (!value) return 'กรุณาระบุเหตุผลในการยกเลิก'; },
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'ยืนยันยกเลิกงาน',
    cancelButtonText: 'ย้อนกลับ',
  }).then((result) => {
    if (!result.isConfirmed) return;
    showLoading();
    apiCall('cancelJob', {
      jobId: jobId,
      approverEmail: App.user.email,
      approverName: App.user.username || App.user.nickname,
      reason: result.value,
    })
      .then((res) => {
        hideLoading();
        if (res.success) {
          toast('success', 'ยกเลิกงานสำเร็จ', res.message);
          loadExec2View();
        } else { toast('error', 'เกิดข้อผิดพลาด', res.error); }
      })
      .catch((err) => { hideLoading(); toast('error', 'เกิดข้อผิดพลาด', err.message); });
  });
}

// ─── 6e. Designer View ──────────────────────────────────────

let _designerJobs = [];

function loadDesignerView() {
  showLoading();
  apiCall('getJobs', { filterType: 'designer', email: App.user.email })
    .then((res) => {
      hideLoading();
      _designerJobs = res.jobs || [];
      switchDesignerTab(App.designerTab);
    })
    .catch((err) => { hideLoading(); toast('error', 'เกิดข้อผิดพลาด', err.message); });
}

function switchDesignerTab(tabName) {
  App.designerTab = tabName;

  // Update tab styling
  $$('.designer-tab').forEach((t) => {
    const isActive = t.dataset.tab === tabName;
    t.classList.toggle('border-brand-500', isActive);
    t.classList.toggle('text-brand-600', isActive);
    t.classList.toggle('font-semibold', isActive);
    t.classList.toggle('border-transparent', !isActive);
    t.classList.toggle('text-surface-400', !isActive);
    t.classList.toggle('font-medium', !isActive);
  });

  // Show/hide sort bar (only for active)
  $('#designerSortBar').classList.toggle('hidden', tabName !== 'active');

  // Show/hide lists
  $('#designerActiveList').classList.toggle('hidden', tabName !== 'active');
  $('#designerPlaceholderList').classList.toggle('hidden', tabName !== 'placeholder');
  $('#designerHistoryList').classList.toggle('hidden', tabName !== 'history');

  if (tabName === 'active') renderDesignerActive();
  if (tabName === 'placeholder') renderDesignerPlaceholders();
  if (tabName === 'history') renderDesignerHistory();
}

function renderDesignerActive() {
  const activeJobs = _designerJobs.filter((j) =>
    j.JobStatus === 'In Progress' &&
    j.AssignedDesigner.toLowerCase() === App.user.email.toLowerCase()
  );

  // Sort
  const sortBy = $('#designerSort').value;
  activeJobs.sort((a, b) => {
    const keyA = sortBy === 'dueDate' ? a.DueDate : a.RequestDate;
    const keyB = sortBy === 'dueDate' ? b.DueDate : b.RequestDate;
    return String(keyA).localeCompare(String(keyB));
  });

  const listEl = $('#designerActiveList');
  const emptyEl = $('#designerEmpty');

  if (activeJobs.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  listEl.innerHTML = activeJobs.map((job) => `
    <div class="bg-white rounded-xl border border-surface-200 p-5 hover:shadow-md transition-shadow">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="font-semibold text-surface-900 truncate">${_esc(job.ProjectName)}</h3>
            ${_statusBadge(job.JobStatus)}
          </div>
          <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm text-surface-500 mt-1">
            <span>👤 ผู้ขอ: ${_esc(job.RequesterName)}</span>
            <span>📂 แผนก: ${_esc(job.Department)}</span>
            <span>🎨 ประเภท: ${_esc(job.JobCategory)}</span>
            <span>📅 กำหนดส่ง: ${_esc(job.DueDate)}</span>
            <span>📨 รับงาน: ${_esc(job.DeliveryMethod)}</span>
          </div>
          ${job.JobDetails ? '<p class="text-sm text-surface-400 mt-1">' + _esc(job.JobDetails) + '</p>' : ''}
        </div>
        <button onclick="handleComplete('${_esc(job.JobID)}')"
                class="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 shadow-sm transition-all">
          ✓ เสร็จสิ้นงาน
        </button>
      </div>
    </div>
  `).join('');
}

function renderDesignerPlaceholders() {
  const placeholders = _designerJobs.filter((j) => j.JobStatus === 'Acknowledged');

  const listEl = $('#designerPlaceholderList');
  const emptyEl = $('#designerEmpty');

  if (placeholders.length === 0) {
    listEl.innerHTML = '<div class="text-center py-12 text-surface-400 text-sm">ไม่มีงานที่รออยู่ในขั้นตอนถัดไป</div>';
    emptyEl.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  listEl.innerHTML = placeholders.map((job) => `
    <div class="bg-surface-50 rounded-xl border border-dashed border-surface-300 p-5 opacity-70">
      <div class="flex items-center gap-2 mb-1">
        <h3 class="font-medium text-surface-600 truncate">${_esc(job.ProjectName)}</h3>
        <span class="status-badge bg-surface-200 text-surface-500">รอมอบหมายดีไซเนอร์</span>
      </div>
      <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm text-surface-400 mt-1">
        <span>👤 ผู้ขอ: ${_esc(job.RequesterName)}</span>
        <span>📂 แผนก: ${_esc(job.Department)}</span>
        <span>🎨 ประเภท: ${_esc(job.JobCategory)}</span>
        <span>📅 กำหนดส่ง: ${_esc(job.DueDate)}</span>
      </div>
    </div>
  `).join('');
}

function renderDesignerHistory() {
  const completed = _designerJobs.filter((j) =>
    (j.JobStatus === 'Completed' || j.JobStatus === 'Cancelled') &&
    j.AssignedDesigner.toLowerCase() === App.user.email.toLowerCase()
  );

  const listEl = $('#designerHistoryList');

  if (completed.length === 0) {
    listEl.innerHTML = '<div class="text-center py-12 text-surface-400 text-sm">ยังไม่มีประวัติงานที่เสร็จสิ้น</div>';
    return;
  }

  listEl.innerHTML = completed.map((job) => `
    <div class="bg-white rounded-xl border border-surface-200 p-5 opacity-80">
      <div class="flex items-center gap-2 mb-1">
        <h3 class="font-semibold text-surface-700 truncate">${_esc(job.ProjectName)}</h3>
        ${_statusBadge(job.JobStatus)}
      </div>
      <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm text-surface-400 mt-1">
        <span>📂 แผนก: ${_esc(job.Department)}</span>
        <span>🎨 ประเภท: ${_esc(job.JobCategory)}</span>
        ${job.CompletedDate ? '<span>✅ เสร็จเมื่อ: ' + _esc(job.CompletedDate) + '</span>' : ''}
      </div>
      ${job.CancelReason ? '<p class="text-sm text-red-400 mt-1">❌ เหตุผลยกเลิก: ' + _esc(job.CancelReason) + '</p>' : ''}
    </div>
  `).join('');
}

function handleComplete(jobId) {
  Swal.fire({
    title: 'ยืนยันการเสร็จสิ้นงาน?',
    text: 'งานนี้จะถูกบันทึกว่าเสร็จสมบูรณ์และย้ายไปยังประวัติงาน',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    confirmButtonText: 'เสร็จสิ้นงาน',
    cancelButtonText: 'ยกเลิก',
  }).then((result) => {
    if (!result.isConfirmed) return;
    showLoading();
    apiCall('completeJob', { jobId: jobId })
      .then((res) => {
        hideLoading();
        if (res.success) {
          toast('success', 'เสร็จสิ้นงาน!', res.message);
          loadDesignerView();
        } else { toast('error', 'เกิดข้อผิดพลาด', res.error); }
      })
      .catch((err) => { hideLoading(); toast('error', 'เกิดข้อผิดพลาด', err.message); });
  });
}

// ─── 6f. Admin View ─────────────────────────────────────────

let _adminJobs = [];
let _adminUsers = [];

function loadAdminView() {
  showLoading();
  Promise.all([
    apiCall('getJobs', { filterType: 'admin' }),
    apiCall('getAllUsers', {}),
    apiCall('getDesigners', {}),
  ])
    .then(([jobsRes, usersRes, designersRes]) => {
      hideLoading();
      _adminJobs = jobsRes.jobs || [];
      _adminUsers = usersRes.users || [];
      App.designers = designersRes.designers || [];
      switchAdminTab(App.adminTab);
    })
    .catch((err) => { hideLoading(); toast('error', 'เกิดข้อผิดพลาด', err.message); });
}

function switchAdminTab(tabName) {
  App.adminTab = tabName;

  $$('.admin-tab').forEach((t) => {
    const isActive = t.dataset.admintab === tabName;
    t.classList.toggle('border-brand-500', isActive);
    t.classList.toggle('text-brand-600', isActive);
    t.classList.toggle('font-semibold', isActive);
    t.classList.toggle('border-transparent', !isActive);
    t.classList.toggle('text-surface-400', !isActive);
    t.classList.toggle('font-medium', !isActive);
  });

  $('#adminJobsPanel').classList.toggle('hidden', tabName !== 'jobs');
  $('#adminUsersPanel').classList.toggle('hidden', tabName !== 'users');

  if (tabName === 'jobs') renderAdminJobs();
  if (tabName === 'users') renderAdminUsers();
}

function renderAdminJobs() {
  let jobs = [..._adminJobs];
  const search = ($('#adminSearch')?.value || '').toLowerCase();
  const status = $('#adminFilterStatus')?.value || '';
  const sort = $('#adminSort')?.value || 'newest';

  // Filter
  if (search) {
    jobs = jobs.filter((j) =>
      j.ProjectName.toLowerCase().includes(search) ||
      j.RequesterName.toLowerCase().includes(search) ||
      j.Department.toLowerCase().includes(search) ||
      j.JobCategory.toLowerCase().includes(search)
    );
  }
  if (status) {
    jobs = jobs.filter((j) => j.JobStatus === status);
  }

  // Sort
  jobs.sort((a, b) => {
    if (sort === 'newest') return String(b.RequestDate).localeCompare(String(a.RequestDate));
    if (sort === 'oldest') return String(a.RequestDate).localeCompare(String(b.RequestDate));
    if (sort === 'dueDate') return String(a.DueDate).localeCompare(String(b.DueDate));
    return 0;
  });

  const tbody = $('#adminJobsBody');
  if (jobs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-surface-400">ไม่พบข้อมูลคำของาน</td></tr>';
    return;
  }

  tbody.innerHTML = jobs.map((job) => `
    <tr class="hover:bg-surface-50 transition-colors">
      <td class="px-4 py-3">
        <p class="font-medium text-surface-900 truncate max-w-[180px]">${_esc(job.ProjectName)}</p>
        <p class="text-xs text-surface-400 mt-0.5">${_esc(job.JobID)}</p>
      </td>
      <td class="px-4 py-3 text-surface-600">${_esc(job.RequesterName)}</td>
      <td class="px-4 py-3 text-surface-600">${_esc(job.Department)}</td>
      <td class="px-4 py-3 text-surface-600">${_esc(job.JobCategory)}</td>
      <td class="px-4 py-3 text-surface-600">${_esc(job.DueDate)}</td>
      <td class="px-4 py-3">${_statusBadge(job.JobStatus)}</td>
      <td class="px-4 py-3 text-surface-600 truncate max-w-[120px]">${_esc(job.AssignedDesigner || '—')}</td>
      <td class="px-4 py-3">
        <div class="flex items-center justify-center gap-1">
          <button onclick="adminEditJob('${_esc(job.JobID)}')" title="แก้ไขข้อมูล"
                  class="p-1.5 rounded-lg hover:bg-brand-50 text-brand-500 transition">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
          </button>
          <button onclick="adminDeleteJob('${_esc(job.JobID)}')" title="ลบรายการ"
                  class="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function adminEditJob(jobId) {
  const job = _adminJobs.find((j) => j.JobID === jobId);
  if (!job) return;

  const designerOptions = App.designers.map((d) =>
    `<option value="${_esc(d.email)}" ${job.AssignedDesigner === d.email ? 'selected' : ''}>${_esc(d.username)}</option>`
  ).join('');

  const statusOptions = [
    { val: 'Pending', label: 'รอรับทราบ (Pending)' },
    { val: 'Acknowledged', label: 'รับทราบแล้ว (Acknowledged)' },
    { val: 'In Progress', label: 'กำลังดำเนินการ (In Progress)' },
    { val: 'Completed', label: 'เสร็จสิ้นแล้ว (Completed)' },
    { val: 'Cancelled', label: 'ยกเลิกแล้ว (Cancelled)' },
  ];

  Swal.fire({
    title: 'แก้ไขข้อมูลคำขอ',
    html: `
      <div class="text-left space-y-3">
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">ชื่องาน / โครงการ</label>
          <input id="editProject" class="swal2-input !mt-0 !text-sm" value="${_esc(job.ProjectName)}" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">สถานะงาน</label>
          <select id="editStatus" class="swal2-select !mt-0 !text-sm">
            ${statusOptions.map((s) =>
      `<option value="${s.val}" ${job.JobStatus === s.val ? 'selected' : ''}>${s.label}</option>`
    ).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">ดีไซเนอร์ผู้รับผิดชอบ</label>
          <select id="editDesigner" class="swal2-select !mt-0 !text-sm">
            <option value="">— ไม่ระบุ —</option>
            ${designerOptions}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">กำหนดส่งงาน (Due Date)</label>
          <input id="editDueDate" type="date" class="swal2-input !mt-0 !text-sm" value="${_esc(job.DueDate)}" />
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonColor: '#6366f1',
    confirmButtonText: 'บันทึกข้อมูล',
    cancelButtonText: 'ยกเลิก',
    preConfirm: () => {
      return {
        ProjectName: document.getElementById('editProject').value.trim(),
        JobStatus: document.getElementById('editStatus').value,
        AssignedDesigner: document.getElementById('editDesigner').value,
        DueDate: document.getElementById('editDueDate').value,
      };
    },
  }).then((result) => {
    if (!result.isConfirmed) return;
    showLoading();
    apiCall('editJob', { jobId: jobId, updates: result.value })
      .then((res) => {
        hideLoading();
        if (res.success) {
          toast('success', 'บันทึกสำเร็จ', 'อัปเดตข้อมูลคำขอเรียบร้อยแล้ว');
          loadAdminView();
        } else { toast('error', 'เกิดข้อผิดพลาด', res.error); }
      })
      .catch((err) => { hideLoading(); toast('error', 'เกิดข้อผิดพลาด', err.message); });
  });
}

function adminDeleteJob(jobId) {
  Swal.fire({
    title: 'ต้องการลบคำขอนี้หรือไม่?',
    text: 'การกระทำนี้ไม่สามารถย้อนกลับได้ ข้อมูลจะถูกลบถาวร',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'ยืนยันลบ',
    cancelButtonText: 'ยกเลิก',
  }).then((result) => {
    if (!result.isConfirmed) return;
    showLoading();
    apiCall('deleteJob', { jobId: jobId })
      .then((res) => {
        hideLoading();
        if (res.success) {
          toast('success', 'ลบสำเร็จ', 'ลบคำของานเรียบร้อยแล้ว');
          loadAdminView();
        } else { toast('error', 'เกิดข้อผิดพลาด', res.error); }
      })
      .catch((err) => { hideLoading(); toast('error', 'เกิดข้อผิดพลาด', err.message); });
  });
}

// ─── Admin: Manage Users ────────────────────────────────────

function renderAdminUsers() {
  const tbody = $('#adminUsersBody');
  const allRoles = [
    { code: 'User', label: 'User (ผู้ขอ)' },
    { code: 'Exec1', label: 'Exec1 (หัวหน้าฝ่าย)' },
    { code: 'Exec2', label: 'Exec2 (ผู้จ่ายงาน)' },
    { code: 'Designer', label: 'Designer (ดีไซเนอร์)' },
    { code: 'Admin', label: 'Admin (แอดมิน)' },
  ];

  tbody.innerHTML = _adminUsers.map((user) => {
    const checkboxes = allRoles.map((r) => {
      const checked = user.roles.includes(r.code) ? 'checked' : '';
      return `<label class="inline-flex items-center gap-1 text-xs">
        <input type="checkbox" value="${r.code}" ${checked} class="role-cb rounded border-surface-300 text-brand-500 focus:ring-brand-400" data-email="${_esc(user.email)}" /> ${r.label}
      </label>`;
    }).join(' ');

    return `
      <tr class="hover:bg-surface-50 transition-colors">
        <td class="px-4 py-3">
          <div class="flex items-center gap-2">
            ${user.profilePic
        ? `<img src="${_esc(user.profilePic)}" class="w-7 h-7 rounded-full object-cover" />`
        : `<div class="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-xs font-bold">${(user.username || 'U').charAt(0).toUpperCase()}</div>`
      }
            <div>
              <p class="font-medium text-surface-900 text-sm">${_esc(user.username)}</p>
              <p class="text-xs text-surface-400">${_esc(user.nickname)}</p>
            </div>
          </div>
        </td>
        <td class="px-4 py-3 text-surface-600 text-sm">${_esc(user.email)}</td>
        <td class="px-4 py-3">
          <input type="text" value="${_esc(user.department)}" data-dept-email="${_esc(user.email)}"
                 placeholder="ระบุแผนก"
                 class="dept-input px-2 py-1 rounded-lg border border-surface-200 text-sm w-36 focus:ring-2 focus:ring-brand-400" />
        </td>
        <td class="px-4 py-3">
          <div class="flex flex-wrap gap-2">${checkboxes}</div>
        </td>
        <td class="px-4 py-3 text-center">
          <button onclick="adminSaveUser('${_esc(user.email)}')"
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 transition">
            บันทึก
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function adminSaveUser(email) {
  // Gather checked roles
  const checkboxes = document.querySelectorAll(`.role-cb[data-email="${email}"]`);
  const roles = [];
  checkboxes.forEach((cb) => { if (cb.checked) roles.push(cb.value); });

  if (roles.length === 0) {
    toast('warning', 'ต้องมีอย่างน้อยหนึ่งบทบาท', 'ผู้ใช้งานต้องมีสิทธิ์อย่างน้อย 1 บทบาท');
    return;
  }

  // Department
  const deptInput = document.querySelector(`.dept-input[data-dept-email="${email}"]`);
  const department = deptInput ? deptInput.value.trim() : '';

  showLoading();
  apiCall('updateUserRoles', {
    email: email,
    roles: roles.join(','),
    department: department,
  })
    .then((res) => {
      hideLoading();
      if (res.success) {
        toast('success', 'บันทึกสำเร็จ', 'อัปเดตสิทธิ์และฝ่ายของผู้ใช้เรียบร้อยแล้ว');
        // Update local cache
        const u = _adminUsers.find((u) => u.email === email);
        if (u) { u.roles = roles; u.department = department; }
      } else { toast('error', 'เกิดข้อผิดพลาด', res.error); }
    })
    .catch((err) => { hideLoading(); toast('error', 'เกิดข้อผิดพลาด', err.message); });
}

// ═══════════════════════════════════════════════════════════
//  7. API HELPER
// ═══════════════════════════════════════════════════════════

/**
 * Call the GAS Web App. Uses POST with text/plain content-type
 * to avoid CORS preflight (OPTIONS) requests.
 */
function apiCall(action, data) {
  const payload = Object.assign({}, data, { action: action });

  return fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  })
    .then((response) => {
      if (!response.ok) throw new Error('Network response was not ok (' + response.status + ')');
      return response.json();
    })
    .then((result) => {
      if (result.success === false) throw new Error(result.error || 'Unknown error');
      return result;
    });
}

// ═══════════════════════════════════════════════════════════
//  8. UI UTILITIES
// ═══════════════════════════════════════════════════════════

function showLoading() {
  DOM.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  DOM.loadingOverlay.classList.add('hidden');
}

/** SweetAlert2 toast helper */
function toast(icon, title, text) {
  Swal.fire({
    icon: icon,
    title: title,
    text: text,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
  });
}

/** HTML‑escape a string to prevent XSS */
function _esc(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/** Status badge HTML with Thai label */
function _statusBadge(status) {
  const badgeConfig = {
    'Pending':      { cls: 'bg-red-100 text-red-700', text: 'รอรับทราบ' },
    'Acknowledged': { cls: 'bg-amber-100 text-amber-700', text: 'รับทราบแล้ว' },
    'In Progress':  { cls: 'bg-blue-100 text-blue-700', text: 'กำลังดำเนินการ' },
    'Completed':    { cls: 'bg-emerald-100 text-emerald-700', text: 'เสร็จสิ้นแล้ว' },
    'Cancelled':    { cls: 'bg-surface-200 text-surface-500', text: 'ยกเลิกแล้ว' },
  };
  const conf = badgeConfig[status] || { cls: 'bg-surface-100 text-surface-500', text: status || '—' };
  return `<span class="status-badge ${conf.cls}">${_esc(conf.text)}</span>`;
}

/** Simple debounce */
function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}
