// ============================================================
// PAGE: ADMIN — PENGATURAN
// Jam kerja, divisi, shift
// ============================================================

// ---- Setting Tab Navigation ----

function switchSettingTab(tab) {
  // Match berdasarkan argument di onclick, bukan index — aman walau tab disembunyikan
  document.querySelectorAll('.setting-tab').forEach(t => {
    const m = t.getAttribute('onclick')?.match(/switchSettingTab\('(\w+)'\)/);
    t.classList.toggle('active', m && m[1] === tab);
  });
  document.querySelectorAll('.setting-page').forEach(p => p.classList.remove('active'));
  document.getElementById('stab-'+tab)?.classList.add('active');
  if (tab==='divisi') renderDivisiList();
  if (tab==='shift')  renderShiftList();
  if (tab==='users')  renderAdminUserList();
}

// ---- Jam Kerja ----

async function saveSettings() {
  const payload = {
    jam_masuk:  document.getElementById('setJamMasuk').value,
    jam_keluar: document.getElementById('setJamKeluar').value,
    toleransi:  parseInt(document.getElementById('setToleransi').value),
    updated_by: currentUser?.id,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('settings').update(payload)
    .neq('id','00000000-0000-0000-0000-000000000000');
  if (error) { notify('❌', error.message, 'red'); return; }
  settings = { jamMasuk:payload.jam_masuk, jamKeluar:payload.jam_keluar, toleransi:payload.toleransi };
  notify('✅','Pengaturan berhasil disimpan!','green');
}

function loadSettingsUI() {
  document.getElementById('setJamMasuk').value  = settings.jamMasuk;
  document.getElementById('setJamKeluar').value = settings.jamKeluar;
  document.getElementById('setToleransi').value = settings.toleransi;
}

// ---- Divisi ----

function renderDivisiList() {
  const el = document.getElementById('divisiList');
  if (!el) return;
  if (divisions.length === 0) {
    el.innerHTML = '<p style="color:var(--muted);font-size:13px;">Belum ada divisi. Tambahkan di bawah.</p>';
    return;
  }
  el.innerHTML = divisions.map(d => `
    <div class="divisi-chip">
      <span>${d.nama}</span>
      <span class="chip-edit" onclick="editDivisi('${d.id}','${d.nama}')" title="Edit">✏️</span>
      <span class="chip-del" onclick="deleteDivisi('${d.id}','${d.nama}')" title="Hapus">×</span>
    </div>`).join('');
}

function editDivisi(id, nama) {
  editingDivisiId = id;
  document.getElementById('newDivisiName').value         = nama;
  document.getElementById('editDivisiId').value          = id;
  document.getElementById('divisiFormTitle').textContent = '✏️ Edit Divisi';
  document.getElementById('cancelDivisiBtn').style.display = '';
  document.getElementById('newDivisiName').focus();
}

function cancelEditDivisi() {
  editingDivisiId = null;
  document.getElementById('newDivisiName').value         = '';
  document.getElementById('editDivisiId').value          = '';
  document.getElementById('divisiFormTitle').textContent = '+ Tambah Divisi Baru';
  document.getElementById('cancelDivisiBtn').style.display = 'none';
}

async function saveDivisi() {
  const nama = document.getElementById('newDivisiName').value.trim();
  if (!nama) { notify('⚠️','Nama divisi tidak boleh kosong!','orange'); return; }
  const btn = document.getElementById('saveDivisiBtn');
  btn.disabled = true; btn.textContent = '⏳';
  try {
    let error;
    if (editingDivisiId) {
      ({ error } = await sb.from('divisions').update({ nama, updated_by: currentUser?.id }).eq('id', editingDivisiId));
    } else {
      ({ error } = await sb.from('divisions').insert({ nama, created_by: currentUser?.id }));
    }
    if (error) throw error;
    await fetchDivisions();
    renderDivisiList();
    refreshDivisiDropdowns();
    cancelEditDivisi();
    notify('✅', editingDivisiId ? 'Divisi diperbarui!' : 'Divisi ditambahkan!', 'green');
  } catch(e) {
    notify('❌', e.message || 'Gagal menyimpan', 'red');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Simpan';
  }
}

async function deleteDivisi(id, nama) {
  if (!confirm(`Hapus divisi "${nama}"?`)) return;
  try {
    const { error } = await sb.from('divisions').delete().eq('id', id);
    if (error) throw error;
    await fetchDivisions();
    renderDivisiList();
    refreshDivisiDropdowns();
    notify('🗑️', `Divisi "${nama}" dihapus`, 'red');
  } catch(e) {
    notify('❌', e.message || 'Gagal menghapus', 'red');
  }
}

function refreshDivisiDropdowns() {
  const opts      = divisions.map(d => `<option value="${d.nama}">${d.nama}</option>`).join('');
  const filterOpt = '<option value="">Semua Divisi</option>' + opts;
  const empOpt    = '<option value="">— Pilih Divisi —</option>' + opts;

  ['rekapDivisi','exportDivisi'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = filterOpt;
    if (cur) el.value = cur;
  });

  const empDivEl = document.getElementById('empDivisi');
  if (empDivEl) {
    const cur = empDivEl.value;
    empDivEl.innerHTML = empOpt;
    if (cur) empDivEl.value = cur;
  }
}

// ---- Shift Kerja ----

function renderShiftList() {
  const el = document.getElementById('shiftList');
  if (!el) return;
  const hariNames = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

  const cards = shifts.length === 0
    ? `<div style="text-align:center;padding:40px 20px;background:var(--surface2);border-radius:14px;border:2px dashed var(--border);">
        <div style="font-size:40px;margin-bottom:12px;">🔄</div>
        <p style="font-weight:700;margin-bottom:6px;">Belum ada shift terdaftar</p>
        <p style="font-size:13px;color:var(--muted);margin-bottom:16px;">Buat shift kerja pertama dengan menekan tombol "Tambah Shift" di atas.</p>
        <button class="btn btn-sm btn-purple" onclick="showShiftModal()">+ Buat Shift Baru</button>
       </div>`
    : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">` +
      shifts.map(s => {
        const hariArr = (s.hari_aktif || [1,2,3,4,5]).map(h => hariNames[h]);
        return `<div class="office-card">
          <div class="office-card-header">
            <div>
              <div class="office-name">🔄 ${s.nama}</div>
              <div class="office-city">${s.deskripsi || 'Shift kerja'}</div>
            </div>
          </div>
          <div class="office-detail">⏰ Masuk: <span style="font-family:'JetBrains Mono',monospace;font-weight:700;">${s.jam_masuk?.slice(0,5)||'—'}</span></div>
          <div class="office-detail">🏁 Keluar: <span style="font-family:'JetBrains Mono',monospace;font-weight:700;">${s.jam_keluar?.slice(0,5)||'—'}</span></div>
          <div class="office-detail">⏳ Toleransi: <span>${s.toleransi_menit||15} menit</span></div>
          <div class="office-detail">📅 Hari: <span>${hariArr.join(', ')}</span></div>
          <div class="office-actions">
            <button class="btn btn-sm btn-outline" onclick="editShift('${s.id}')" style="flex:1;">✏️ Edit</button>
            <button class="btn btn-sm btn-red" onclick="deleteShift('${s.id}')" style="flex:1;">🗑️ Hapus</button>
          </div>
        </div>`;
      }).join('') + '</div>';

  el.innerHTML = cards;
}

function showShiftModal() {
  editingShiftId = null;
  document.getElementById('shiftModalTitle').textContent = 'Tambah Shift Kerja';
  document.getElementById('shiftNama').value      = '';
  document.getElementById('shiftJamMasuk').value  = '08:00';
  document.getElementById('shiftJamKeluar').value = '17:00';
  document.getElementById('shiftToleransi').value = '15';
  document.getElementById('shiftDeskripsi').value = '';
  document.querySelectorAll('#shiftHariPicker input[type=checkbox]').forEach(cb => {
    cb.checked = ['1','2','3','4','5'].includes(cb.value);
  });
  document.getElementById('shiftModal').style.display = 'flex';
}

function editShift(id) {
  const s = shifts.find(x => x.id===id);
  if (!s) return;
  editingShiftId = id;
  document.getElementById('shiftModalTitle').textContent = 'Edit Shift Kerja';
  document.getElementById('shiftNama').value      = s.nama;
  document.getElementById('shiftJamMasuk').value  = s.jam_masuk?.slice(0,5) || '08:00';
  document.getElementById('shiftJamKeluar').value = s.jam_keluar?.slice(0,5) || '17:00';
  document.getElementById('shiftToleransi').value = s.toleransi_menit || 15;
  document.getElementById('shiftDeskripsi').value = s.deskripsi || '';
  const aktif = s.hari_aktif || [1,2,3,4,5];
  document.querySelectorAll('#shiftHariPicker input[type=checkbox]').forEach(cb => {
    cb.checked = aktif.includes(parseInt(cb.value));
  });
  document.getElementById('shiftModal').style.display = 'flex';
}

async function saveShift() {
  const nama     = document.getElementById('shiftNama').value.trim();
  const jamMasuk  = document.getElementById('shiftJamMasuk').value;
  const jamKeluar = document.getElementById('shiftJamKeluar').value;
  const toleransi = parseInt(document.getElementById('shiftToleransi').value) || 15;
  const deskripsi = document.getElementById('shiftDeskripsi').value.trim();
  const hariAktif = [...document.querySelectorAll('#shiftHariPicker input[type=checkbox]:checked')]
    .map(cb => parseInt(cb.value)).sort();

  if (!nama)              { notify('⚠️','Nama shift wajib diisi!','orange'); return; }
  if (jamKeluar <= jamMasuk)  { notify('⚠️','Jam keluar harus setelah jam masuk!','orange'); return; }
  if (hariAktif.length === 0) { notify('⚠️','Pilih minimal satu hari aktif!','orange'); return; }

  const btn = document.getElementById('saveShiftBtn');
  btn.disabled = true; btn.textContent = '⏳ Menyimpan...';

  const payload = {
    nama, jam_masuk: jamMasuk+':00', jam_keluar: jamKeluar+':00',
    toleransi_menit: toleransi, hari_aktif: hariAktif, deskripsi,
    updated_by: currentUser?.id,
  };

  try {
    let error;
    if (editingShiftId) {
      ({ error } = await sb.from('shifts').update(payload).eq('id', editingShiftId));
    } else {
      ({ error } = await sb.from('shifts').insert({ ...payload, created_by: currentUser?.id }));
    }
    if (error) throw error;
    await fetchShifts();
    renderShiftList();
    closeShiftModal();
    notify('✅', editingShiftId ? 'Shift diperbarui!' : 'Shift baru ditambahkan!', 'green');
  } catch(e) {
    notify('❌', e.message || 'Gagal menyimpan shift', 'red');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Simpan Shift';
  }
}

async function deleteShift(id) {
  const s = shifts.find(x => x.id===id);
  if (!confirm(`Hapus shift "${s?.nama}"?`)) return;
  try {
    const { error } = await sb.from('shifts').delete().eq('id', id);
    if (error) throw error;
    await fetchShifts();
    renderShiftList();
    notify('🗑️', 'Shift dihapus', 'red');
  } catch(e) { notify('❌', e.message, 'red'); }
}

function closeShiftModal() {
  document.getElementById('shiftModal').style.display = 'none';
  editingShiftId = null;
}

// ============================================================
// USER MANAGEMENT (Main Admin only)
// Membuat akun Admin baru atau mengubah role user yang sudah ada
// ============================================================

async function renderAdminUserList() {
  const el = document.getElementById('adminUserList');
  if (!el) return;
  el.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:32px;">⏳ Memuat...</p>';

  try {
    const { data, error } = await sb.from('profiles')
      .select('id,email,nama,role,created_at')
      .order('role')
      .order('nama');

    if (error) throw error;
    if (!data || data.length === 0) {
      el.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:24px;">Belum ada user terdaftar.</p>';
      return;
    }

    const roleColors  = { employee: '#22c55e', admin: '#3b82f6', main_admin: '#a855f7' };
    const roleLabels  = { employee: 'Employee', admin: 'Admin', main_admin: 'Main Admin' };

    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Aksi</th></tr></thead>
      <tbody>
      ${data.map(u => `
        <tr>
          <td><strong>${_esc(u.nama || '—')}</strong></td>
          <td style="font-size:12px;color:var(--muted);">${_esc(u.email || '—')}</td>
          <td><span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${roleColors[u.role]}22;color:${roleColors[u.role]};">${roleLabels[u.role] || u.role}</span></td>
          <td>
            ${u.id !== currentUser?.id
              ? `<button class="btn btn-sm btn-outline" style="font-size:11px;padding:4px 10px;" onclick="openEditUserModal('${u.id}','${_esc(u.email)}','${u.role}')">✏️ Ubah Role</button>`
              : '<span style="font-size:11px;color:var(--muted);">(Anda)</span>'}
          </td>
        </tr>`).join('')}
      </tbody></table></div>`;
  } catch(e) {
    el.innerHTML = `<p style="color:var(--red);font-size:13px;text-align:center;padding:24px;">❌ Gagal memuat: ${_esc(e.message)}</p>`;
  }
}

// Helper: escape HTML untuk cegah XSS di innerHTML
function _esc(str) {
  return String(str || '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Buka modal untuk BUAT akun Admin baru
function showAddAdminModal() {
  document.getElementById('addAdminModalTitle').textContent = '👥 Buat Akun Admin Baru';
  document.getElementById('adminUserName').value   = '';
  document.getElementById('adminUserEmail').value  = '';
  document.getElementById('adminUserPass').value   = '';
  document.getElementById('adminUserRole').value   = 'admin';
  document.getElementById('adminUserEmail').removeAttribute('readonly');
  document.getElementById('adminUserPass').closest('.form-group').style.display = '';
  document.getElementById('adminUserName').closest('.form-group').style.display = '';
  document.getElementById('adminUserEmail').removeAttribute('data-uid');
  document.getElementById('addAdminModal').style.display = 'flex';
}

// Buka modal untuk UBAH ROLE user yang sudah ada
function openEditUserModal(id, email, role) {
  document.getElementById('addAdminModalTitle').textContent = '✏️ Ubah Role User';
  document.getElementById('adminUserName').value   = '';
  document.getElementById('adminUserEmail').value  = email;
  document.getElementById('adminUserPass').value   = '';
  document.getElementById('adminUserRole').value   = role;
  document.getElementById('adminUserEmail').setAttribute('readonly', true);
  document.getElementById('adminUserEmail').setAttribute('data-uid', id);
  // Sembunyikan field nama & password saat hanya ubah role
  document.getElementById('adminUserPass').closest('.form-group').style.display = 'none';
  document.getElementById('adminUserName').closest('.form-group').style.display = 'none';
  document.getElementById('addAdminModal').style.display = 'flex';
}

function closeAddAdminModal() {
  document.getElementById('addAdminModal').style.display = 'none';
  document.getElementById('adminUserEmail').removeAttribute('data-uid');
  document.getElementById('adminUserEmail').removeAttribute('readonly');
}

async function saveAdminUser() {
  const emailEl  = document.getElementById('adminUserEmail');
  const nameEl   = document.getElementById('adminUserName');
  const passEl   = document.getElementById('adminUserPass');
  const role     = document.getElementById('adminUserRole').value;
  const uid      = emailEl.getAttribute('data-uid');
  const email    = emailEl.value.trim();
  const nama     = nameEl.value.trim();
  const password = passEl.value.trim();
  const btn      = document.getElementById('saveAdminUserBtn');

  if (!email) { notify('⚠️', 'Email wajib diisi!', 'orange'); return; }

  btn.disabled = true; btn.textContent = '⏳ Menyimpan...';

  try {
    if (uid) {
      // ── Mode UBAH ROLE: user sudah ada ──
      const { error } = await sb.from('profiles').update({ role }).eq('id', uid);
      if (error) throw error;
      notify('✅', `Role berhasil diubah ke ${role}!`, 'green');

    } else {
      // ── Mode BUAT AKUN BARU ──
      if (!nama)     { notify('⚠️', 'Nama wajib diisi!', 'orange'); return; }
      if (!password || password.length < 6) {
        notify('⚠️', 'Password minimal 6 karakter!', 'orange'); return;
      }

      // 1. Buat akun di Supabase Auth
      const { data: signUpData, error: signUpErr } = await sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: nama } },
      });

      if (signUpErr) throw signUpErr;
      if (!signUpData?.user) throw new Error('User tidak berhasil dibuat.');

      const newUid = signUpData.user.id;

      // 2. Upsert profile dengan role yang dipilih
      // (trigger otomatis akan buat profile dengan role 'employee', kita update setelah itu)
      await new Promise(r => setTimeout(r, 800)); // beri waktu trigger jalan

      const { error: profileErr } = await sb.from('profiles').upsert({
        id:    newUid,
        email: email,
        nama:  nama,
        role:  role,
      }, { onConflict: 'id' });

      if (profileErr) throw profileErr;

      notify('✅', `Akun ${email} berhasil dibuat dengan role ${role}!`, 'green');
    }

    closeAddAdminModal();
    await renderAdminUserList();

  } catch(e) {
    // Pesan error Supabase yang umum
    const msg = e.message?.includes('already registered')
      ? 'Email ini sudah terdaftar. Gunakan "Ubah Role" untuk mengubah aksesnya.'
      : (e.message || 'Gagal menyimpan');
    notify('❌', msg, 'red');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Simpan';
  }
}
