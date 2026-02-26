// ============================================================
// PAGE: EMPLOYEE PORTAL
// Init, Absensi, Riwayat, Profil, Izin/Cuti
// ============================================================

// ---- Helper: Tanggal lokal (fix BUG 2 — timezone mismatch) ----

/**
 * Mengembalikan string tanggal YYYY-MM-DD berdasarkan waktu LOKAL browser,
 * bukan UTC. Mencegah tanggal meleset 1 hari untuk pengguna WIB/WITA/WIT.
 */
function getLocalDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Mengembalikan string bulan YYYY-MM berdasarkan waktu lokal browser.
 */
function getLocalMonthStr(date = new Date()) {
  return getLocalDateStr(date).slice(0, 7);
}

// ---- Helper: Hitung keterlambatan (fix BUG 3 — toleransi overflow >60 menit) ----

/**
 * Cek apakah waktu sekarang melewati jam masuk + toleransi.
 * Menggunakan total menit agar tidak ada overflow ketika menit jam masuk + toleransi > 59.
 * Contoh: jamMasuk='08:55', toleransi=10 → batas=09:05, bukan menit ke-65 yang tidak valid.
 */
function isLateCheck(now = new Date()) {
  const [h, m] = settings.jamMasuk.split(':').map(Number);
  const nowTotal   = now.getHours() * 60 + now.getMinutes();
  const batasTotal = h * 60 + m + (settings.toleransi || 0);
  return nowTotal > batasTotal;
}

// ---- Helper: Hitung hari kerja aktual (fix BUG 4 — workDays hardcode 26) ----

/**
 * Menghitung jumlah hari kerja (Senin–Jumat) dalam bulan tertentu.
 * @param {string} yearMonth - format 'YYYY-MM'
 * @returns {number}
 */
function countWorkDays(yearMonth) {
  const [y, mo] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  let count = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    const day = new Date(y, mo - 1, i).getDay();
    if (day !== 0 && day !== 6) count++; // bukan Minggu (0) atau Sabtu (6)
  }
  return count;
}

// ---- Init Employee Portal ----

async function initEmpPortal() {
  const emp = currentEmployee;
  const now = new Date();
  const today = getLocalDateStr(now); // FIX BUG 2

  // Set sidebar info
  document.getElementById('sidebarEmpName').textContent   = emp.nama;
  document.getElementById('sidebarEmpId').textContent     = 'ID: ' + emp.employee_id;
  // FIX BUG 1 — crash jika nama null/kosong
  document.getElementById('sidebarEmpAvatar').textContent = emp.nama?.[0]?.toUpperCase() || '?';

  // Greeting
  const hour  = now.getHours();
  const greet = hour < 12 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 18 ? 'Selamat Sore' : 'Selamat Malam';
  document.getElementById('empGreeting').textContent = `${greet}, ${emp.nama || 'Karyawan'}! Semoga hari Anda menyenangkan.`;

  // Fetch data
  await fetchEmpAbsenRecords();
  await fetchEmpLeaveRequests();

  const { data: offData } = await sb.from('offices').select('*').eq('is_active', true);
  offices = offData || [];

  const { data: sData } = await sb.from('settings').select('*').limit(1).single();
  if (sData) {
    settings.jamMasuk  = sData.jam_masuk?.slice(0, 5)  || '08:00';
    settings.jamKeluar = sData.jam_keluar?.slice(0, 5) || '17:00';
    settings.toleransi = sData.toleransi ?? 0;
  }

  startEmpClock();
  // FIX BUG 8 — await GPS agar radius check akurat saat kamera dibuka pertama kali
  await getEmpLocation();
  renderEmpTodayStatus();
  renderEmpWeekGrid();
  renderEmpProfil();

  document.getElementById('empHistoryMonth').value = today.slice(0, 7);
  renderEmpHistory();
  showEmpPage('emp-absensi');
}

// ---- Absensi Status ----

function renderEmpTodayStatus() {
  const today    = getLocalDateStr(); // FIX BUG 2
  const todayRec = empAbsenRecords.find(r => r.tanggal === today);
  const badge    = document.getElementById('empStatusBadge');
  const info     = document.getElementById('empTodayInfo');
  if (todayRec) {
    badge.className = 'status-badge hadir';
    badge.innerHTML = `<span class="dot"></span> Sudah Absen Masuk — ${todayRec.masuk?.slice(0, 5) || ''}`;
    info.innerHTML  = todayRec.keluar
      ? `<span style="color:var(--green);font-weight:700;">✅ Sudah absen keluar jam ${todayRec.keluar.slice(0, 5)}</span>`
      : `<span style="color:var(--orange);">⏰ Belum absen keluar. Jangan lupa absen keluar!</span>`;
  } else {
    badge.className = 'status-badge belum';
    badge.innerHTML = `<span class="dot"></span> Belum Absen Hari Ini`;
    info.textContent = '';
  }
}

// ---- Week Grid ----

function renderEmpWeekGrid() {
  const today     = new Date();
  const todayStr  = getLocalDateStr(today); // FIX BUG 2 & BUG 5
  const dayOfWeek = today.getDay();
  const mon       = new Date(today);
  mon.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    days.push(d);
  }

  const grid = document.getElementById('empWeekGrid');
  if (!grid) return;
  grid.innerHTML = days.map(d => {
    const ds = getLocalDateStr(d); // FIX BUG 2
    const rec     = empAbsenRecords.find(r => r.tanggal === ds);
    const isToday = ds === todayStr;
    // FIX BUG 5 — bandingkan string tanggal, bukan objek Date (hindari masalah jam/milidetik)
    const isFuture = ds > todayStr;
    let bg    = 'var(--surface2)';
    let icon  = isFuture ? '—' : '❌';
    let label = '';
    if (rec) { bg = 'rgba(22,163,74,.08)'; icon = '✅'; label = rec.masuk?.slice(0, 5) || ''; }
    return `<div style="padding:12px;background:${bg};border-radius:12px;text-align:center;border:${isToday ? '2px solid var(--accent)' : '1px solid var(--border)'};">
      <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;">${d.toLocaleDateString('id-ID', { weekday: 'short' })}</div>
      <div style="font-size:20px;margin:6px 0;">${icon}</div>
      <div style="font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace;">${label}</div>
    </div>`;
  }).join('');
}

// ---- Riwayat Kehadiran ----

function renderEmpHistory() {
  const month = document.getElementById('empHistoryMonth')?.value;
  const recs  = empAbsenRecords.filter(r => !month || r.tanggal.startsWith(month));

  const summary = document.getElementById('empHistorySummary');
  if (summary) {
    const hadir     = recs.filter(r => r.status === 'Hadir' || r.status === 'Terlambat').length;
    const terlambat = recs.filter(r => r.status === 'Terlambat').length;
    const absen     = recs.filter(r => r.status === 'Absen').length;
    // FIX BUG 4 — hitung hari kerja aktual, bukan hardcode 26
    const workDays  = countWorkDays(month || getLocalMonthStr());
    const pct       = workDays > 0 ? Math.min(100, Math.round(hadir / workDays * 100)) : 0;
    summary.innerHTML = `
      <div style="padding:14px;background:rgba(26,79,160,.08);border-radius:12px;text-align:center;border:1px solid rgba(26,79,160,.15);">
        <div style="font-size:24px;font-weight:800;color:var(--accent);font-family:'JetBrains Mono',monospace;">${hadir}</div>
        <div style="font-size:11px;color:var(--muted);font-weight:600;margin-top:2px;">Hadir</div>
      </div>
      <div style="padding:14px;background:rgba(217,119,6,.08);border-radius:12px;text-align:center;border:1px solid rgba(217,119,6,.15);">
        <div style="font-size:24px;font-weight:800;color:var(--orange);font-family:'JetBrains Mono',monospace;">${terlambat}</div>
        <div style="font-size:11px;color:var(--muted);font-weight:600;margin-top:2px;">Terlambat</div>
      </div>
      <div style="padding:14px;background:rgba(220,38,38,.08);border-radius:12px;text-align:center;border:1px solid rgba(220,38,38,.15);">
        <div style="font-size:24px;font-weight:800;color:var(--red);font-family:'JetBrains Mono',monospace;">${absen}</div>
        <div style="font-size:11px;color:var(--muted);font-weight:600;margin-top:2px;">Absen</div>
      </div>
      <div style="padding:14px;background:rgba(22,163,74,.08);border-radius:12px;text-align:center;border:1px solid rgba(22,163,74,.15);">
        <div style="font-size:24px;font-weight:800;color:var(--green);font-family:'JetBrains Mono',monospace;">${pct}%</div>
        <div style="font-size:11px;color:var(--muted);font-weight:600;margin-top:2px;">Kehadiran</div>
      </div>`;
  }

  const list = document.getElementById('empHistoryList');
  if (!list) return;
  if (recs.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--muted);padding:40px;">Tidak ada data absensi.</p>';
    return;
  }
  list.innerHTML = recs.slice(0, 40).map(r => {
    const d   = new Date(r.tanggal + 'T00:00:00');
    const dur = r.masuk && r.keluar ? calcDuration(r.masuk.slice(0, 5), r.keluar.slice(0, 5)) : '—';
    return `<div class="history-item">
      <div class="history-date-box">
        <div class="day">${d.getDate()}</div>
        <div class="month">${d.toLocaleDateString('id-ID', { month: 'short' })}</div>
      </div>
      <div class="history-times">
        <div class="name">${d.toLocaleDateString('id-ID', { weekday: 'long' })}</div>
        <div class="times">Masuk: ${r.masuk?.slice(0, 5) || '—'} &nbsp;|&nbsp; Keluar: ${r.keluar?.slice(0, 5) || '—'} &nbsp;|&nbsp; Durasi: ${dur}</div>
      </div>
      ${statusBadge(r.status)}
    </div>`;
  }).join('');
}

// ---- Profil ----

function renderEmpProfil() {
  const emp = currentEmployee;
  // FIX BUG 1 — crash jika nama null/kosong
  document.getElementById('profilAvatar').textContent  = emp.nama?.[0]?.toUpperCase() || '?';
  document.getElementById('profilNama').textContent    = emp.nama || '—';
  document.getElementById('profilJabatan').textContent = emp.jabatan || '—';
  document.getElementById('profilEmpId').textContent   = 'ID: ' + emp.employee_id;
  document.getElementById('profilDivisi').textContent  = emp.divisi || '—';
  document.getElementById('profilKantor').textContent  = emp.offices?.nama || '—';
  document.getElementById('profilTelepon').textContent = emp.telepon || '—';
  document.getElementById('profilEmail').textContent   = emp.email || '—';
  document.getElementById('profilJoin').textContent    = emp.join_date
    ? new Date(emp.join_date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  const thisMonth = getLocalMonthStr(); // FIX BUG 2
  const monthRecs = empAbsenRecords.filter(r => r.tanggal.startsWith(thisMonth));
  const hadir     = monthRecs.filter(r => r.status === 'Hadir' || r.status === 'Terlambat').length;
  const late      = monthRecs.filter(r => r.status === 'Terlambat').length;
  const statsEl   = document.getElementById('empStats');
  if (statsEl) {
    statsEl.innerHTML = [
      { label: 'Hadir Bulan Ini', val: hadir,            color: 'var(--green)'  },
      { label: 'Terlambat',       val: late,             color: 'var(--orange)' },
      { label: 'Total Catatan',   val: monthRecs.length, color: 'var(--accent)' },
    ].map(s => `<div style="display:flex;justify-content:space-between;padding:14px;background:var(--surface2);border-radius:12px;border:1px solid var(--border);">
        <span style="font-size:13px;color:var(--muted);font-weight:600;">${s.label}</span>
        <span style="font-size:16px;font-weight:800;color:${s.color};font-family:'JetBrains Mono',monospace;">${s.val}</span>
      </div>`).join('');
  }
}

// ---- Konfirmasi Absen Karyawan ----

function checkAndConfirmEmp() {
  const off = currentEmployee?.offices;
  const now = new Date();

  // FIX BUG 3 — gunakan isLateCheck() agar toleransi tidak overflow
  const isLate = empCurrentAbsenType === 'masuk' && isLateCheck(now);

  let outsideRadius = false;
  if (off && empCurrentLocation) {
    const dist = getDistance(empCurrentLocation.lat, empCurrentLocation.lon, parseFloat(off.lat), parseFloat(off.lon));
    outsideRadius = dist > off.radius;
  }

  if ((isLate || outsideRadius) && empCurrentAbsenType === 'masuk') {
    const ket = document.getElementById('cameraKeteranganInput')?.value?.trim() || '';
    if (!ket) {
      notify('⚠️', 'Keterangan/alasan wajib diisi sebelum konfirmasi!', 'orange');
      return;
    }
    window._pendingKeterangan = ket;
  }
  confirmAbsenEmp();
}

function submitKeteranganAbsen() {
  const ket = document.getElementById('keteranganInput').value.trim();
  if (!ket) { notify('⚠️', 'Keterangan wajib diisi!', 'orange'); return; }
  document.getElementById('keteranganModal').style.display = 'none';
  window._pendingKeterangan = ket;
  if (pendingAbsenCallback) { pendingAbsenCallback(); pendingAbsenCallback = null; }
}

function cancelKeteranganAbsen() {
  document.getElementById('keteranganModal').style.display = 'none';
  window._pendingKeterangan = null;
  pendingAbsenCallback = null;
  closeCamera();
}

async function confirmAbsenEmp() {
  const emp = currentEmployee;
  const btn = document.getElementById('confirmBtn');
  btn.disabled = true; btn.textContent = '⏳ Menyimpan...';

  const now        = new Date();
  const timeStr    = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dateStr    = getLocalDateStr(now); // FIX BUG 2 — gunakan tanggal lokal
  const keterangan = window._pendingKeterangan || null;
  window._pendingKeterangan = null;

  try {
    if (empCurrentAbsenType === 'masuk') {
      // FIX BUG absen ganda — cek server-side sebelum insert
      const { data: existing } = await sb.from('absensi')
        .select('id, masuk')
        .eq('employee_id', emp.id)
        .eq('tanggal', dateStr)
        .maybeSingle();

      if (existing?.masuk) {
        notify('⚠️', 'Absen masuk hari ini sudah tercatat!', 'orange');
        closeCamera();
        return;
      }

      const selfieUrl = await uploadSelfie(emp.id, dateStr, empCurrentAbsenType, empCapturedPhoto);

      // FIX BUG 3 — gunakan isLateCheck()
      const late = isLateCheck(now);
      // FIX BUG absen ganda — ignoreDuplicates:true agar tidak overwrite masuk pertama
      const { error } = await sb.from('absensi').upsert({
        employee_id: emp.id,
        office_id:   emp.office_id,
        tanggal:     dateStr,
        masuk:       timeStr,
        status:      late ? 'Terlambat' : 'Hadir',
        selfie_url:  selfieUrl,
        lat:         empCurrentLocation?.lat,
        lon:         empCurrentLocation?.lon,
        keterangan:  keterangan,
      }, { onConflict: 'employee_id,tanggal', ignoreDuplicates: true });
      if (error) throw error;
      notify('✅', `Absen Masuk berhasil! Jam ${timeStr}${late ? ' (Terlambat)' : ''}`, 'green');

    } else {
      // FIX BUG absen keluar ganda — cek apakah sudah keluar
      const { data: existing } = await sb.from('absensi')
        .select('masuk, keluar')
        .eq('employee_id', emp.id)
        .eq('tanggal', dateStr)
        .maybeSingle();

      if (!existing?.masuk) {
        notify('⚠️', 'Belum ada data absen masuk hari ini!', 'orange');
        closeCamera();
        return;
      }
      if (existing?.keluar) {
        notify('⚠️', 'Absen keluar hari ini sudah tercatat!', 'orange');
        closeCamera();
        return;
      }

      const selfieUrl = await uploadSelfie(emp.id, dateStr, empCurrentAbsenType, empCapturedPhoto);

      const { error } = await sb.from('absensi')
        .update({ keluar: timeStr, keterangan_keluar: keterangan, selfie_keluar_url: selfieUrl })
        .eq('employee_id', emp.id)
        .eq('tanggal', dateStr);
      if (error) throw error;
      notify('✅', `Absen Keluar berhasil! Jam ${timeStr}`, 'green');
    }

    await fetchEmpAbsenRecords();
    renderEmpTodayStatus();
    renderEmpWeekGrid();
    // FIX BUG 10 — refresh stat profil setelah absen berhasil
    renderEmpProfil();

  } catch (e) {
    notify('❌', e.message || 'Gagal menyimpan absensi', 'red');
  } finally {
    btn.disabled = false; btn.textContent = '✅ Konfirmasi';
    closeCamera();
  }
}

// ---- Izin / Cuti ----

function selectLeaveType(type) {
  selectedLeaveType = type;
  document.getElementById('leaveType').value = type;
  ['izin', 'cuti', 'sakit'].forEach(t => {
    document.getElementById('lt-' + t)?.classList.toggle('selected', t === type.toLowerCase());
  });
}

function renderEmpLeaveHistory() {
  const el = document.getElementById('empLeaveHistory');
  if (!el) return;
  if (empLeaveRequests.length === 0) {
    el.innerHTML = '<p style="text-align:center;color:var(--muted);padding:32px;">Belum ada pengajuan.</p>';
    return;
  }
  const icons  = { Izin: '🌤️', Cuti: '🏖️', Sakit: '🏥' };
  const stCls  = { Menunggu: 'leave-pending', Disetujui: 'leave-approved', Ditolak: 'leave-rejected' };
  const stIcon = { Menunggu: '⏳', Disetujui: '✅', Ditolak: '❌' };

  el.innerHTML = empLeaveRequests.map(r => {
    // FIX BUG 6 — tambahkan 'T00:00:00' agar diparsing sebagai waktu lokal, bukan UTC
    const days = Math.max(1, Math.round(
      (new Date(r.tanggal_selesai + 'T00:00:00') - new Date(r.tanggal_mulai + 'T00:00:00')) / 86400000
    ) + 1);
    const durasi = r.tanggal_mulai === r.tanggal_selesai
      ? r.tanggal_mulai
      : `${r.tanggal_mulai} s/d ${r.tanggal_selesai}`;
    return `<div class="leave-card">
      <div class="leave-icon ${r.jenis?.toLowerCase()}">${icons[r.jenis] || '📝'}</div>
      <div class="leave-meta">
        <div class="leave-name">${r.jenis} <span style="font-weight:400;color:var(--muted);">· ${days} hari</span></div>
        <div class="leave-dates">📅 ${durasi}</div>
        <div class="leave-reason">"${r.keterangan || '-'}"</div>
        <div style="margin-top:8px;">
          <span class="status-badge-leave ${stCls[r.status] || 'leave-pending'}">${stIcon[r.status] || '⏳'} ${r.status}</span>
          <span style="font-size:11px;color:var(--muted);margin-left:10px;">${new Date(r.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          ${r.catatan_admin ? `<span style="font-size:11px;color:var(--orange);margin-left:8px;">· Admin: "${r.catatan_admin}"</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function submitLeaveRequest() {
  const jenis   = document.getElementById('leaveType').value;
  const mulai   = document.getElementById('leaveStart').value;
  const selesai = document.getElementById('leaveEnd').value;
  const reason  = document.getElementById('leaveReason').value.trim();

  if (!mulai)          { notify('⚠️', 'Pilih tanggal mulai!', 'orange'); return; }
  if (!selesai)        { notify('⚠️', 'Pilih tanggal selesai!', 'orange'); return; }
  if (!reason)         { notify('⚠️', 'Keterangan tidak boleh kosong!', 'orange'); return; }
  if (selesai < mulai) { notify('⚠️', 'Tanggal selesai tidak boleh sebelum tanggal mulai!', 'orange'); return; }

  // FIX BUG 7 — cek overlap pengajuan yang sudah ada dan belum ditolak
  const overlap = empLeaveRequests.find(r =>
    r.status !== 'Ditolak' &&
    r.tanggal_mulai <= selesai &&
    r.tanggal_selesai >= mulai
  );
  if (overlap) {
    notify('⚠️', `Sudah ada pengajuan ${overlap.jenis} (${overlap.status}) yang overlap pada tanggal tersebut!`, 'orange');
    return;
  }

  const btn = document.getElementById('submitLeaveBtn');
  btn.disabled = true; btn.textContent = '⏳ Mengirim...';
  try {
    const { error } = await sb.from('leave_requests').insert({
      employee_id:     currentEmployee.id,
      jenis,
      tanggal_mulai:   mulai,
      tanggal_selesai: selesai,
      keterangan:      reason,
      status:          'Menunggu',
    });
    if (error) throw error;
    document.getElementById('leaveStart').value  = '';
    document.getElementById('leaveEnd').value    = '';
    document.getElementById('leaveReason').value = '';
    selectLeaveType('Izin');
    await fetchEmpLeaveRequests();
    renderEmpLeaveHistory();
    notify('✅', 'Permohonan izin berhasil dikirim!', 'green');
  } catch (e) {
    notify('❌', e.message || 'Gagal mengirim permohonan', 'red');
  } finally {
    btn.disabled = false; btn.textContent = '📤 Kirim Permohonan';
  }
}

function setDefaultLeaveDates() {
  const today   = getLocalDateStr(); // FIX BUG 2
  const startEl = document.getElementById('leaveStart');
  const endEl   = document.getElementById('leaveEnd');
  if (startEl && !startEl.value) startEl.value = today;
  if (endEl   && !endEl.value)   endEl.value   = today;
}
