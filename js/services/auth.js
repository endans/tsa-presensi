// ============================================================
// AUTH SERVICE — RBAC
// Login, logout, session management dengan role-based routing
// ============================================================

// ============================================================
// SESSION STORAGE KEYS — untuk persist employee login saat refresh
// ============================================================
const EMP_SESSION_KEY = 'tsa_emp_session';

function saveEmpSession(emp) {
  try {
    localStorage.setItem(EMP_SESSION_KEY, JSON.stringify(emp));
  } catch(e) {}
}
function clearEmpSession() {
  try {
    localStorage.removeItem(EMP_SESSION_KEY);
  } catch(e) {}
}
function loadEmpSession() {
  try {
    const d = localStorage.getItem(EMP_SESSION_KEY);
    // Tidak ada batas waktu — sesi bertahan sampai user logout manual
    return d ? JSON.parse(d) : null;
  } catch(e) { return null; }
}

// ============================================================
// BOOT — dipanggil saat halaman pertama kali load
// ============================================================

async function boot() {
  try {
    // Cek Supabase Auth session (admin/employee login via email)
    const { data:{ session } } = await sb.auth.getSession();
    if (session) {
      currentUser = session.user;
      await loadProfile();
      await routeByRole();
    } else {
      // Cek employee session yang disimpan (login via ID Karyawan)
      const savedEmp = loadEmpSession();
      if (savedEmp) {
        // Re-validasi ke database untuk memastikan akun masih aktif
        const { data, error } = await sb
          .from('employees')
          .select('*, offices(id,nama,kota,lat,lon,radius,alamat)')
          .eq('id', savedEmp.id)
          .eq('is_active', true)
          .limit(1);
        if (!error && data && data.length > 0) {
          isEmployeeMode  = true;
          currentEmployee = data[0];
          currentRole     = 'employee';
          saveEmpSession(data[0]); // refresh data terbaru
          await initEmpPortal();
          showEmpPortal();
        } else {
          clearEmpSession();
          showLogin();
        }
      } else {
        showLogin();
      }
    }
  } catch(e) {
    console.error('[boot] Error:', e);
    showLogin();
  }
  document.getElementById('loadingOverlay').style.display = 'none';
}

// ============================================================
// AUTH STATE CHANGE — handle session expire otomatis
// ============================================================
sb.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' && currentUser) {
    currentUser = null; currentProfile = null; currentRole = null;
    employees = []; offices = []; absenRecords = [];
    showLogin();
  }
});

// ============================================================
// LOAD PROFILE — ambil data dari tabel profiles
// ============================================================

async function loadProfile() {
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  if (error) {
    console.warn('[loadProfile] Profil tidak ditemukan, default ke employee:', error.message);
    currentProfile = null;
    currentRole    = 'employee';
    return;
  }

  currentProfile = data;
  currentRole    = data?.role || 'employee';
}

// ============================================================
// ROUTING — pisahkan inisialisasi berdasarkan role
// ============================================================

async function routeByRole() {
  if (currentRole === 'employee') {
    // Employee login via email → cari data karyawan berdasarkan user_id
    await _initAsEmployee();
  } else {
    // admin / main_admin → portal admin
    await initApp();               // init data & UI admin
    applyRoleMenuVisibility();     // terapkan filter menu RBAC
    showMain();
  }
}

async function _initAsEmployee() {
  const { data, error } = await sb
    .from('employees')
    .select('*, offices(id,nama,kota,lat,lon,radius,alamat)')
    .eq('user_id', currentUser.id)
    .eq('is_active', true)
    .limit(1);

  if (error || !data || data.length === 0) {
    console.error('[_initAsEmployee] Tidak ada data karyawan:', error?.message);
    await sb.auth.signOut();
    currentUser = null; currentProfile = null; currentRole = null;
    showLogin();
    setTimeout(() => {
      document.getElementById('loginError').textContent =
        'Akun Anda belum terhubung ke data karyawan. Hubungi admin.';
    }, 100);
    return;
  }

  isEmployeeMode  = true;
  currentEmployee = data[0];
  saveEmpSession(data[0]); // persist agar tidak logout saat refresh
  await initEmpPortal();
  showEmpPortal();
}

// ============================================================
// LOGIN TERPADU — email (admin/main_admin/employee) atau ID karyawan
// ============================================================

async function doLoginUnified() {
  const identifier = document.getElementById('loginIdentifier').value.trim();
  const pass       = document.getElementById('loginPassUnified').value;
  const errEl      = document.getElementById('loginError');
  const btn        = document.getElementById('loginBtn');

  if (!identifier) { errEl.textContent = 'Email atau ID Karyawan wajib diisi.'; return; }
  if (!pass)        { errEl.textContent = 'Password wajib diisi.'; return; }

  errEl.textContent = '';
  btn.disabled = true; btn.textContent = '⏳ Masuk...';

  try {
    const isEmail = identifier.includes('@');

    if (isEmail) {
      // Supabase Auth login
      const { data, error } = await sb.auth.signInWithPassword({
        email: identifier,
        password: pass,
      });
      if (error) throw error;

      currentUser = data.user;
      await loadProfile();
      await routeByRole();
      notify('✅', `Selamat datang, ${currentProfile?.nama || identifier}!`, 'green');

    } else {
      // Login via ID Karyawan (tidak melalui Supabase Auth)
      await loginAsEmployee(identifier.toUpperCase(), pass, errEl);
    }
  } catch(e) {
    errEl.textContent = e.message === 'Invalid login credentials'
      ? 'Email atau password salah.'
      : (e.message || 'Gagal masuk. Coba lagi.');
  } finally {
    btn.disabled = false; btn.textContent = '🔐 Masuk';
  }
}

// Login via ID Karyawan (employee only)
async function loginAsEmployee(empId, pass, errEl) {
  const { data: empList, error } = await sb
    .from('employees')
    .select('*, offices(id,nama,kota,lat,lon,radius,alamat)')
    .eq('employee_id', empId)
    .eq('is_active', true)
    .limit(1);

  if (error) { errEl.textContent = 'Gagal menghubungi database.'; return; }
  if (!empList || empList.length === 0) {
    errEl.textContent = 'ID Karyawan tidak ditemukan.'; return;
  }

  const emp       = empList[0];
  const validPass = emp.employee_password || '123456';
  if (pass !== validPass) {
    errEl.textContent = 'Password salah.'; return;
  }

  isEmployeeMode  = true;
  currentEmployee = emp;
  currentRole     = 'employee';
  saveEmpSession(emp); // persist agar tidak logout saat refresh
  await initEmpPortal();
  showEmpPortal();
  notify('✅', `Selamat datang, ${emp.nama}!`, 'green');
}

// ============================================================
// LOGOUT
// ============================================================

async function doLogout() {
  const ok = await showConfirm({
  icon: '↩️',
  title: 'Keluar dari Akun',
  message: 'Sesi Anda akan diakhiri. Yakin ingin keluar?',
  okText: 'Ya, Keluar',
  okColor: 'var(--accent)',
});
if (!ok) return;
  await sb.auth.signOut();
  currentUser = null; currentProfile = null; currentRole = null;
  employees = []; offices = []; absenRecords = [];
  showLogin();
}

async function doLogoutEmp() {
  const ok = await showConfirm({
  icon: '↩️',
  title: 'Keluar dari Akun',
  message: 'Sesi Anda akan diakhiri. Yakin ingin keluar?',
  okText: 'Ya, Keluar',
  okColor: 'var(--accent)',
});
if (!ok) return;
  // Jika employee login via Supabase Auth (email), sign out juga
  if (currentUser) await sb.auth.signOut();
  clearEmpSession(); // hapus session tersimpan
  isEmployeeMode  = false;
  currentEmployee = null;
  currentUser     = null;
  currentProfile  = null;
  currentRole     = null;
  empAbsenRecords = [];
  showLogin();
}

// Legacy alias — dipakai di beberapa tempat lama
async function loadAdminProfile() { return loadProfile(); }
