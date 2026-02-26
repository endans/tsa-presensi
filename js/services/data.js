// ============================================================
// DATA FETCH SERVICES
// Semua fungsi fetch ke Supabase dikumpulkan di sini
// ============================================================

async function fetchSettings() {
  const { data } = await sb.from('settings').select('*').limit(1).single();
  if (data) {
    settings.jamMasuk  = data.jam_masuk?.slice(0,5)  || '08:00';
    settings.jamKeluar = data.jam_keluar?.slice(0,5) || '17:00';
    settings.toleransi = data.toleransi ?? 0;
    loadSettingsUI();
  }
}

async function fetchOffices() {
  const { data, error } = await sb.from('offices').select('*').eq('is_active', true).order('nama');
  if (!error) offices = data || [];
}

async function fetchEmployees() {
  const { data, error } = await sb
    .from('employees')
    .select('*, offices(id,nama,kota)')
    .eq('is_active', true)
    .order('nama');
  if (!error) employees = data || [];
}

async function fetchAbsensi() {
  const ago = new Date(); ago.setDate(ago.getDate()-30);
  const from = ago.toISOString().split('T')[0];
  const { data, error } = await sb
    .from('absensi')
    .select('*, employees(nama,divisi), offices(nama,kota)')
    .gte('tanggal', from)
    .order('tanggal', { ascending:false })
    .limit(1000);
  if (!error) {
    absenRecords = (data||[]).map(r => ({
      id:         r.id,
      empId:      r.employee_id,
      empNama:    r.employees?.nama   || '—',
      divisi:     r.employees?.divisi || '—',
      officeId:   r.office_id,
      officeName: r.offices?.nama    || '—',
      officeKota: r.offices?.kota    || '',
      tanggal:    r.tanggal,
      masuk:      r.masuk?.slice(0,5)  || '',
      keluar:     r.keluar?.slice(0,5) || '',
      status:     r.status,
      selfie:     r.selfie_url,
    }));
  }
}

async function fetchDivisions() {
  const { data, error } = await sb.from('divisions').select('*').order('nama');
  if (!error) divisions = data || [];
}

async function fetchLeaveRequests() {
  const { data, error } = await sb
    .from('leave_requests')
    .select('*, employees(nama, divisi, offices(nama))')
    .order('created_at', { ascending: false })
    .limit(200);
  if (!error) leaveRequests = data || [];
}

async function fetchShifts() {
  try {
    const { data, error } = await sb.from('shifts').select('*').order('nama');
    if (!error) shifts = data || [];
  } catch(e) {
    shifts = [];
  }
}

// ---- Employee Portal Fetches ----

async function fetchEmpAbsenRecords() {
  const emp = currentEmployee;
  const ago = new Date(); ago.setDate(ago.getDate()-30);
  const from = ago.toISOString().split('T')[0];
  const { data: recs } = await sb
    .from('absensi')
    .select('*, offices(nama)')
    .eq('employee_id', emp.id)
    .gte('tanggal', from)
    .order('tanggal', { ascending: false });
  empAbsenRecords = recs || [];
}

async function fetchEmpLeaveRequests() {
  const { data, error } = await sb
    .from('leave_requests')
    .select('*')
    .eq('employee_id', currentEmployee.id)
    .order('created_at', { ascending: false });
  if (!error) empLeaveRequests = data || [];
}

// ---- Realtime Subscription ----

function subscribeRealtime() {
  sb.channel('rt-absensi')
    .on('postgres_changes', { event:'*', schema:'public', table:'absensi' }, async () => {
      await fetchAbsensi();
      renderDashboard();
      if (document.getElementById('page-absensi').classList.contains('active')) renderMyHistory();
      if (document.getElementById('page-rekap').classList.contains('active'))   renderRekap();
      if (document.getElementById('page-kantor').classList.contains('active'))  renderOfficeStats();
    }).subscribe();
}

// ---- Selfie Upload Helper ----

/**
 * Upload foto selfie ke Supabase Storage.
 *
 * PERUBAHAN PENTING:
 * - Jika capturedPhotoData null, undefined, atau 'simulated' → THROW ERROR
 *   sehingga proses absensi BERHENTI. Karyawan tidak bisa absen tanpa foto valid.
 * - Jika upload gagal karena network/storage error → THROW ERROR juga,
 *   agar absensi tidak tersimpan tanpa bukti selfie.
 *
 * @param {string} empId
 * @param {string} dateStr  - format YYYY-MM-DD
 * @param {string} type     - 'masuk' | 'keluar'
 * @param {string|null} capturedPhotoData - base64 data URL foto
 * @returns {Promise<string>} publicUrl foto yang terupload
 * @throws {Error} jika foto tidak ada atau upload gagal
 */
async function uploadSelfie(empId, dateStr, type, capturedPhotoData) {
  // FIX: wajib ada foto — throw agar confirmAbsenEmp() masuk blok catch
  if (!capturedPhotoData || capturedPhotoData === 'simulated') {
    throw new Error('Foto selfie wajib diambil sebelum melakukan absensi!');
  }

  try {
    const blob  = await (await fetch(capturedPhotoData)).blob();
    const fname = `${empId}/${dateStr}_${type}_${Date.now()}.jpg`;
    const { data: up, error: upErr } = await sb.storage
      .from('selfies')
      .upload(fname, blob, { contentType: 'image/jpeg', upsert: false });

    if (upErr) {
      // FIX: upload gagal → throw, jangan diam-diam lanjut tanpa foto
      throw new Error(`Upload foto gagal: ${upErr.message}`);
    }

    const { data: ud } = sb.storage.from('selfies').getPublicUrl(fname);
    if (!ud?.publicUrl) {
      throw new Error('Gagal mendapatkan URL foto. Coba lagi.');
    }

    return ud.publicUrl;

  } catch (e) {
    // Re-throw agar pemanggil (confirmAbsenEmp) tahu ada error
    throw e;
  }
}

async function fetchImageAsBase64(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror  = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

function stripDataPrefix(dataUrl) {
  return dataUrl ? dataUrl.split(',')[1] : null;
}
