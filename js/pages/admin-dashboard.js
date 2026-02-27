// ============================================================
// PAGE: ADMIN INIT & DASHBOARD
// ============================================================

async function initApp() {
  const now = new Date();

  // Sidebar user info — akan di-override oleh applyRoleMenuVisibility() nanti
  const roleLabels = { employee: 'Karyawan', admin: 'Admin', main_admin: 'Main Administrator' };
  document.getElementById('sidebarName').textContent   = currentProfile?.nama  || currentUser?.email || 'Admin';
  document.getElementById('sidebarAvatar').textContent = (currentProfile?.nama || currentUser?.email || 'A')[0].toUpperCase();
  document.getElementById('sidebarRole').textContent   = roleLabels[currentRole] || 'Admin';
  document.getElementById('dashDate').innerHTML =
    `Selamat datang, <b>${currentProfile?.nama||'Admin'}</b> — ${now.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}`;

  const today = now.toISOString().split('T')[0];
  document.getElementById('rekapDate').value    = today;
  document.getElementById('previewMonth').value = today.slice(0,7);
  document.getElementById('pdfMonth').value     = today.slice(0,7);
  document.getElementById('exportMonth').value  = today.slice(0,7);
  document.getElementById('zipMonth').value     = today.slice(0,7);

  startClock();
  await Promise.all([
    fetchSettings(), fetchOffices(), fetchEmployees(),
    fetchAbsensi(), fetchDivisions(), fetchLeaveRequests(), fetchShifts()
  ]);

  renderDashboard();
  renderEmployees();
  renderOffices();
  populateAllDropdowns();
  refreshDivisiDropdowns();
  // showPage('dashboard') dipanggil di sini; applyRoleMenuVisibility() dipanggil SETELAH ini di routeByRole()
  showPage('dashboard');
  subscribeRealtime();
}

// ---- Dashboard Renders ----

function renderDashboard() {
  const today    = new Date().toISOString().split('T')[0];
  const todayRec = absenRecords.filter(r => r.tanggal === today);
  const hadirIds = [...new Set(todayRec.map(r => r.empId))];
  document.getElementById('statTotal').textContent  = employees.length;
  document.getElementById('statHadir').textContent  = hadirIds.length;
  document.getElementById('statAbsen').textContent  = Math.max(0, employees.length - hadirIds.length);
  document.getElementById('statKantor').textContent = offices.length;
  renderChart();
  renderRecentActivity();
  renderTodayTable();
}

function renderChart() {
  const wrap = document.getElementById('chartWrap');
  if (!wrap) return;
  const today = new Date();
  const days = [];
  for (let i=6; i>=0; i--) {
    const d = new Date(today); d.setDate(today.getDate()-i); days.push(d);
  }
  const max = employees.length || 1;
  wrap.innerHTML = days.map(d => {
    const ds    = d.toISOString().split('T')[0];
    const count = new Set(absenRecords.filter(r=>r.tanggal===ds).map(r=>r.empId)).size;
    const h     = Math.round((count/max)*140);
    const label = d.toLocaleDateString('id-ID',{weekday:'short'});
    const isToday = ds === today.toISOString().split('T')[0];
    return `<div class="bar-item">
      <div style="width:100%;height:160px;display:flex;align-items:flex-end;">
        <div class="bar" style="height:${Math.max(h,4)}px;background:${isToday?'var(--accent2)':'var(--accent)'};opacity:${isToday?'1':'0.5'};"></div>
      </div>
      <div class="bar-label">${label}</div>
    </div>`;
  }).join('');
}

function renderRecentActivity() {
  const el = document.getElementById('recentActivity');
  if (!el) return;
  const recent = [...absenRecords].sort((a,b)=>b.tanggal.localeCompare(a.tanggal)).slice(0,5);
  el.innerHTML = recent.map(r=>`
    <div style="display:flex;align-items:center;gap:10px;">
      <div class="avatar" style="width:32px;height:32px;font-size:12px;border-radius:8px;">${(r.empNama||'?')[0]}</div>
      <div>
        <div style="font-size:13px;font-weight:600;">${r.empNama}</div>
        <div style="font-size:11px;color:var(--muted);">${r.officeName} • ${r.masuk} • ${r.tanggal}</div>
      </div>
      <div style="margin-left:auto;">${statusBadge(r.status)}</div>
    </div>`).join('');
}

function renderTodayTable() {
  const today = new Date().toISOString().split('T')[0];
  const tbody = document.getElementById('todayTable');
  if (!tbody) return;
  const todayR = absenRecords.filter(r => r.tanggal === today);
  const seen = new Set(); const rows = [];
  todayR.forEach(r => { if (!seen.has(r.empId)) { seen.add(r.empId); rows.push(r); } });
  tbody.innerHTML = rows.map(r=>`<tr>
    <td><div style="display:flex;align-items:center;gap:10px;"><div class="avatar" style="width:30px;height:30px;font-size:11px;border-radius:8px;flex-shrink:0;">${(r.empNama||'?')[0]}</div>${r.empNama}</div></td>
    <td><span class="badge badge-purple">${r.officeName}</span></td>
    <td><span style="font-family:'JetBrains Mono',monospace;color:var(--green);font-weight:600;">${r.masuk||'—'}</span></td>
    <td><span style="font-family:'JetBrains Mono',monospace;color:var(--red);font-weight:600;">${r.keluar||'—'}</span></td>
    <td>${statusBadge(r.status)}</td>
  </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:32px;">Belum ada absensi hari ini</td></tr>';
}

// ---- Absensi Confirm (Admin) ----

async function confirmAbsen() {
  if (isEmployeeMode) { await confirmAbsenEmp(); return; }

  const empId    = document.getElementById('absenEmployee').value;
  const officeId = document.getElementById('absenOffice').value;
  if (!empId || !officeId) return;

  const btn = document.getElementById('confirmBtn');
  btn.disabled = true; btn.textContent = '⏳ Menyimpan...';

  const now     = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const dateStr = now.toISOString().split('T')[0];

  try {
    const selfieUrl = await uploadSelfie(empId, dateStr, currentAbsenType, capturedPhoto);

    if (currentAbsenType === 'masuk') {
      const [h,m] = settings.jamMasuk.split(':').map(Number);
      const isLate = now.getHours()>h || (now.getHours()===h && now.getMinutes()>m+settings.toleransi);
      const { error } = await sb.from('absensi').upsert({
        employee_id: empId,
        office_id:   officeId,
        tanggal:     dateStr,
        masuk:       timeStr,
        status:      isLate ? 'Terlambat' : 'Hadir',
        selfie_url:  selfieUrl,
        lat:         currentLocation?.lat,
        lon:         currentLocation?.lon,
        created_by:  currentUser?.id,
      }, { onConflict:'employee_id,tanggal', ignoreDuplicates:false });
      if (error) throw error;
      notify('✅', `Absen Masuk berhasil! Jam ${timeStr}${isLate?' (Terlambat)':''}`, 'green');
      document.getElementById('statusBadge').className = 'status-badge hadir';
      document.getElementById('statusBadge').innerHTML = `<span class="dot"></span> Sudah Absen Masuk — ${timeStr}`;
    } else {
      const { error } = await sb.from('absensi').update({ keluar: timeStr })
        .eq('employee_id', empId).eq('tanggal', dateStr);
      if (error) throw error;
      notify('✅', `Absen Keluar berhasil! Jam ${timeStr}`, 'green');
    }

    await fetchAbsensi();
    renderDashboard();
    renderMyHistory();
  } catch(e) {
    notify('❌', e.message||'Gagal menyimpan absensi', 'red');
  } finally {
    btn.disabled = false; btn.textContent = '✅ Konfirmasi';
    closeCamera();
  }
}

// ---- History Table (Admin) ----

function renderMyHistory() {
  const tbody = document.getElementById('myHistoryTable');
  if (!tbody) return;
  const filterEmp = document.getElementById('historyEmployee')?.value;
  const filterOff = document.getElementById('historyOffice')?.value;
  let recs = absenRecords
    .filter(r => (!filterEmp || r.empId===filterEmp) && (!filterOff || r.officeId===filterOff))
    .sort((a,b) => b.tanggal.localeCompare(a.tanggal)).slice(0,40);
  tbody.innerHTML = recs.map(r => {
    const dur = r.masuk&&r.keluar ? calcDuration(r.masuk, r.keluar) : '—';
    return `<tr>
      <td style="font-weight:600;">${r.empNama}</td>
      <td><span class="badge badge-purple">${r.officeName}</span></td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:12px;">${r.tanggal}</td>
      <td><span style="color:var(--green);font-family:'JetBrains Mono',monospace;font-weight:600;">${r.masuk||'—'}</span></td>
      <td><span style="color:var(--red);font-family:'JetBrains Mono',monospace;font-weight:600;">${r.keluar||'—'}</span></td>
      <td style="font-size:12px;color:var(--muted);">${dur}</td>
      <td>${r.selfie?`<img src="${r.selfie}" class="selfie-preview" loading="lazy">`:'<span style="color:var(--muted);font-size:12px;">—</span>'}</td>
      <td>${statusBadge(r.status)}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:32px;">Belum ada data</td></tr>';
}

// ---- Rekap ----

function switchRekapTab(mode) {
  rekapMode = mode;
  document.querySelectorAll('.content-tab').forEach((t,i) => {
    t.classList.toggle('active', ['harian','mingguan','bulanan'][i]===mode);
  });
  renderRekap();
}

function renderRekap() {
  const tbody    = document.getElementById('rekapTable');
  if (!tbody) return;
  const divisi   = document.getElementById('rekapDivisi').value;
  const officeId = document.getElementById('rekapOffice').value;
  const filterDate = document.getElementById('rekapDate').value;
  const filteredEmps = employees.filter(e => (!divisi||e.divisi===divisi) && (!officeId||e.office_id===officeId));

  tbody.innerHTML = filteredEmps.map(emp => {
    let recs = absenRecords.filter(r => r.empId===emp.id);
    if (rekapMode==='harian'&&filterDate) recs = recs.filter(r => r.tanggal===filterDate);
    const hadir    = recs.length;
    const late     = recs.filter(r => r.status==='Terlambat').length;
    const workdays = rekapMode==='harian' ? 1 : rekapMode==='mingguan' ? 6 : 26;
    const pct      = workdays>0 ? Math.round((hadir/workdays)*100) : 0;
    const officeName = emp.offices?.nama || '—';
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:10px;"><div class="avatar" style="width:30px;height:30px;font-size:11px;border-radius:8px;">${emp.nama[0]}</div>${emp.nama}</div></td>
      <td><span class="badge badge-blue">${emp.divisi}</span></td>
      <td><span class="badge badge-purple">${officeName}</span></td>
      <td style="font-weight:700;color:var(--green);">${hadir}</td>
      <td style="color:var(--orange);">${late}</td>
      <td style="color:var(--red);">${Math.max(0,workdays-hadir)}</td>
      <td><div style="display:flex;align-items:center;gap:8px;">
        <div style="flex:1;height:6px;background:var(--surface2);border-radius:3px;border:1px solid var(--border);">
          <div style="width:${Math.min(pct,100)}%;height:100%;background:${pct>=80?'var(--green)':pct>=60?'var(--orange)':'var(--red)'};border-radius:3px;"></div>
        </div>
        <span style="font-size:12px;font-weight:700;">${pct}%</span>
      </div></td>
    </tr>`;
  }).join('');
}

// ---- Dropdowns ----

function populateAllDropdowns() {
  const officeOpts = offices.map(o => `<option value="${o.id}">${o.nama} — ${o.kota}</option>`).join('');
  const empOpts    = employees.map(e => `<option value="${e.id}">${e.nama} (${e.offices?.nama||'—'})</option>`).join('');
  setOpts('absenEmployee',   '<option value="">Pilih Karyawan...</option>' + empOpts);
  setOpts('absenOffice',     '<option value="">— pilih kantor —</option>' + officeOpts);
  setOpts('historyEmployee', '<option value="">Semua Karyawan</option>'   + empOpts);
  setOpts('historyOffice',   '<option value="">Semua Kantor</option>'     + officeOpts);
  setOpts('rekapOffice',     '<option value="">Semua Kantor</option>'     + officeOpts);
  setOpts('filterEmpOffice', '<option value="">Semua Kantor</option>'     + officeOpts);
  setOpts('empOffice',       '<option value="">— Belum ditugaskan —</option>' + officeOpts);
  setOpts('exportOffice',    '<option value="">Semua Kantor</option>'     + officeOpts);
  setOpts('pdfOffice',       '<option value="">Semua Kantor</option>'     + officeOpts);
  setOpts('previewOffice',   '<option value="">Semua Kantor</option>'     + officeOpts);
  setOpts('zipOffice',       '<option value="">Semua Kantor</option>'     + officeOpts);
}
