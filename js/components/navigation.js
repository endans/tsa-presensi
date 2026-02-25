// ============================================================
// COMPONENT: NAVIGATION & SIDEBAR — RBAC
// Navigasi dinamis berdasarkan role: employee | admin | main_admin
// ============================================================

// ============================================================
// DEFINISI MENU PER ROLE
// ============================================================

const ROLE_MENUS = {
  // admin: fitur operasional harian
  admin: ['dashboard', 'absensi', 'rekap', 'laporan', 'persetujuan', 'bantuan'],

  // main_admin: akses penuh
  main_admin: ['dashboard', 'absensi', 'rekap', 'laporan', 'persetujuan',
               'bantuan', 'karyawan', 'kantor', 'pengaturan'],
};

// Label role untuk tampilan UI
const ROLE_LABELS = {
  employee:   'Karyawan',
  admin:      'Admin',
  main_admin: 'Main Administrator',
};

// ============================================================
// applyRoleMenuVisibility()
// Dipanggil setelah initApp() selesai.
// Menyembunyikan/menampilkan menu berdasarkan currentRole.
// ============================================================

function applyRoleMenuVisibility() {
  const role    = currentRole || 'admin';
  const allowed = ROLE_MENUS[role] || ROLE_MENUS.admin;

  // ── Sidebar: tampilkan/sembunyikan nav-item ──
  document.querySelectorAll('#sidebar .nav-item[data-page]').forEach(el => {
    const page = el.getAttribute('data-page');
    el.style.display = allowed.includes(page) ? '' : 'none';
  });

  // ── Sidebar: sembunyikan section label jika semua item-nya hidden ──
  document.querySelectorAll('#sidebar .nav-section').forEach(section => {
    let next = section.nextElementSibling;
    let hasVisible = false;
    while (next && !next.classList.contains('nav-section') && !next.classList.contains('sidebar-footer')) {
      if (next.classList.contains('nav-item') && next.style.display !== 'none') hasVisible = true;
      next = next.nextElementSibling;
    }
    section.style.display = hasVisible ? '' : 'none';
  });

  // ── Bottom nav primary: tampilkan/sembunyikan ──
  document.querySelectorAll('#adminBottomNav .bottom-nav-item[data-page]').forEach(el => {
    const page = el.getAttribute('data-page');
    // Untuk admin: tampilkan dashboard, absensi, rekap — karyawan disembunyikan
    // Untuk main_admin: semua tampil (dashboard, absensi, rekap, karyawan)
    el.style.display = allowed.includes(page) ? '' : 'none';
  });

  // ── Bottom nav "More" menu ──
  document.querySelectorAll('#adminMoreMenu .bottom-more-item[data-page]').forEach(el => {
    const page = el.getAttribute('data-page');
    el.style.display = allowed.includes(page) ? '' : 'none';
  });

  // ── Update label role di sidebar footer ──
  const nameEl = document.getElementById('sidebarName');
  const roleEl = document.getElementById('sidebarRole');
  const avatEl = document.getElementById('sidebarAvatar');
  if (nameEl) nameEl.textContent = currentProfile?.nama || currentUser?.email || 'Admin';
  if (roleEl) roleEl.textContent = ROLE_LABELS[role] || 'Admin';
  if (avatEl) avatEl.textContent = (currentProfile?.nama || currentUser?.email || 'A')[0].toUpperCase();

  // ── Tab "Manajemen User" di Pengaturan: hanya main_admin ──
  const userMgmtTab = document.getElementById('setting-tab-users');
  if (userMgmtTab) userMgmtTab.style.display = (role === 'main_admin') ? '' : 'none';
}

// ============================================================
// PAGE NAVIGATION — ADMIN
// ============================================================

function showPage(name) {
  // ── RBAC Guard: cegah akses halaman yang tidak diizinkan ──
  const allowed = ROLE_MENUS[currentRole] || ROLE_MENUS.admin;
  if (!allowed.includes(name)) {
    notify('🚫', 'Anda tidak memiliki akses ke halaman ini.', 'red');
    return;
  }

  document.querySelectorAll('#mainApp .page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#sidebar .nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name)?.classList.add('active');
  document.querySelectorAll('#sidebar .nav-item[data-page="' + name + '"]').forEach(n => n.classList.add('active'));

  // Trigger render sesuai halaman
  if (name === 'absensi')     renderMyHistory();
  if (name === 'rekap')       renderRekap();
  if (name === 'laporan')     renderPreview();
  if (name === 'karyawan')    renderEmployees();
  if (name === 'dashboard')   renderDashboard();
  if (name === 'kantor')      renderOffices();
  if (name === 'persetujuan') { fetchLeaveRequests().then(renderLeaveRequests); }
  if (name === 'pengaturan')  { switchSettingTab('jam'); }

  setAdminBottomActive(name);
}

// ============================================================
// PAGE NAVIGATION — EMPLOYEE PORTAL
// ============================================================

function showEmpPage(name) {
  document.querySelectorAll('#empPortal .page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#sidebarEmp .nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name)?.classList.add('active');
  document.querySelectorAll('#sidebarEmp .nav-item[data-page="' + name + '"]').forEach(n => n.classList.add('active'));

  if (name === 'emp-riwayat') renderEmpHistory();
  if (name === 'emp-profil')  renderEmpProfil();
  if (name === 'emp-izin')    { renderEmpLeaveHistory(); setDefaultLeaveDates(); }
  setEmpBottomActive(name);
}

// ============================================================
// PORTAL VISIBILITY
// ============================================================

function showLogin() {
  document.getElementById('loginPage').style.display  = 'flex';
  document.getElementById('mainApp').style.display    = 'none';
  document.getElementById('empPortal').style.display  = 'none';
  _hideAllBottomNav();
}

function showMain() {
  document.getElementById('loginPage').style.display  = 'none';
  document.getElementById('mainApp').style.display    = 'block';
  document.getElementById('empPortal').style.display  = 'none';
  _showAdminBottomNav();
}

function showEmpPortal() {
  document.getElementById('loginPage').style.display  = 'none';
  document.getElementById('mainApp').style.display    = 'none';
  document.getElementById('empPortal').style.display  = 'block';
  _showEmpBottomNav();
}

// ============================================================
// SIDEBAR MOBILE TOGGLE
// ============================================================

function toggleSidebar() {
  const s1 = document.getElementById('sidebar');
  const s2 = document.getElementById('sidebarEmp');
  const ov = document.getElementById('sidebarOverlay');
  const opening = !(s1?.classList.contains('open') || s2?.classList.contains('open'));
  s1?.classList.toggle('open');
  s2?.classList.toggle('open');
  ov?.classList.toggle('active', opening);
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarEmp')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('active');
}

// ============================================================
// BOTTOM NAV (MOBILE)
// ============================================================

const ADMIN_MORE_PAGES = ['laporan', 'kantor', 'karyawan', 'persetujuan', 'pengaturan', 'bantuan'];
const EMP_BOTTOM_PAGES = ['emp-absensi', 'emp-riwayat', 'emp-izin', 'emp-profil'];

function setAdminBottomActive(page) {
  document.querySelectorAll('#adminBottomNav .bottom-nav-item').forEach(el => el.classList.remove('active'));
  // Coba temukan tombol di primary bar dulu
  const primaryBtn = document.getElementById('bnadmin-' + page);
  if (primaryBtn && primaryBtn.style.display !== 'none') {
    primaryBtn.classList.add('active');
  } else {
    // Halaman ada di "More" menu
    document.getElementById('bnadmin-more')?.classList.add('active');
  }
  // Sync more menu items
  document.querySelectorAll('#adminMoreMenu .bottom-more-item').forEach(el => el.classList.remove('active'));
  const moreBtn = document.getElementById('bnmore-' + page);
  if (moreBtn) moreBtn.classList.add('active');
}

function setEmpBottomActive(page) {
  document.querySelectorAll('#empBottomNav .bottom-nav-item').forEach(el => el.classList.remove('active'));
  const btn = document.getElementById('bnemp-' + page);
  if (btn) btn.classList.add('active');
}

function toggleAdminMoreMenu() {
  const menu    = document.getElementById('adminMoreMenu');
  const overlay = document.getElementById('adminMoreOverlay');
  const isOpen  = menu.classList.contains('open');
  menu.classList.toggle('open', !isOpen);
  overlay.classList.toggle('open', !isOpen);
  document.getElementById('bnadmin-more')?.classList.toggle('active', !isOpen);
}

function closeAdminMoreMenu() {
  document.getElementById('adminMoreMenu')?.classList.remove('open');
  document.getElementById('adminMoreOverlay')?.classList.remove('open');
  // Cek apakah halaman aktif bukan di "More" menu
  const activePage = [...document.querySelectorAll('#mainApp .page.active')][0]
    ?.id?.replace('page-', '');
  if (!ADMIN_MORE_PAGES.includes(activePage)) {
    document.getElementById('bnadmin-more')?.classList.remove('active');
  }
}

function _showAdminBottomNav() {
  if (window.innerWidth <= 768) {
    document.getElementById('adminBottomNav').style.display = 'block';
    document.getElementById('empBottomNav').style.display   = 'none';
  }
}

function _showEmpBottomNav() {
  if (window.innerWidth <= 768) {
    document.getElementById('empBottomNav').style.display   = 'block';
    document.getElementById('adminBottomNav').style.display = 'none';
  }
}

function _hideAllBottomNav() {
  document.getElementById('adminBottomNav').style.display = 'none';
  document.getElementById('empBottomNav').style.display   = 'none';
}

// ── Responsive resize handler ──
window.addEventListener('resize', () => {
  const mainVisible = document.getElementById('mainApp').style.display !== 'none'
    && document.getElementById('mainApp').style.display !== '';
  const empVisible  = document.getElementById('empPortal').style.display === 'block';
  if (window.innerWidth <= 768) {
    if (mainVisible)     _showAdminBottomNav();
    else if (empVisible) _showEmpBottomNav();
  } else {
    _hideAllBottomNav();
  }
});
