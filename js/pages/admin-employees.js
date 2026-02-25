// ============================================================
// PAGE: ADMIN — MANAJEMEN KARYAWAN
// ============================================================

function renderEmployees() {
  const search    = document.getElementById('searchEmp')?.value?.toLowerCase() || '';
  const offFilter = document.getElementById('filterEmpOffice')?.value || '';
  const filtered  = employees.filter(e =>
    (e.nama.toLowerCase().includes(search) || e.divisi.toLowerCase().includes(search)) &&
    (!offFilter || e.office_id===offFilter)
  );
  const grid = document.getElementById('empGrid');
  if (!grid) return;

  grid.innerHTML = filtered.map(emp => {
    const recs       = absenRecords.filter(r => r.empId===emp.id);
    const officeName = emp.offices?.nama || '—';
    return `<div class="emp-card">
      <div class="emp-avatar">${emp.nama[0]}</div>
      <div style="flex:1;">
        <div class="emp-name">${emp.nama}</div>
        <div class="emp-role">${emp.jabatan||'—'} • ${emp.divisi}</div>
        <div class="emp-office">🏢 ${officeName}</div>
        ${emp.employee_id ? `<div class="emp-id-badge">${emp.employee_id}</div>` : ''}
        <div class="emp-stats">
          <div class="emp-stat-item"><span>${recs.length}</span>Kehadiran</div>
          <div class="emp-stat-item"><span>${recs.filter(r=>r.status==='Terlambat').length}</span>Terlambat</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <button class="btn btn-sm btn-outline" onclick="editEmployee('${emp.id}')" style="padding:6px 12px;font-size:11px;">✏️</button>
        <button class="btn btn-sm btn-red" onclick="deleteEmployee('${emp.id}')" style="padding:6px 12px;font-size:11px;">🗑️</button>
      </div>
    </div>`;
  }).join('') || '<p style="color:var(--muted);text-align:center;padding:40px;">Tidak ada karyawan ditemukan.</p>';
}

function showAddEmpModal() {
  editingEmpId = null;
  document.getElementById('empModalTitle').textContent = 'Tambah Karyawan';
  ['empNama','empEmail','empJabatan','empTelepon','empKaryawanId'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('empDivisi').value  = '';
  document.getElementById('empOffice').value  = '';
  document.getElementById('empJoin').value    = new Date().toISOString().split('T')[0];
  // Reset password ke default
  if (document.getElementById('empPassword')) {
    document.getElementById('empPassword').value = '123456';
    document.getElementById('empPassword').placeholder = 'Default: 123456';
  }
  document.getElementById('empModal').style.display = 'flex';
}

function editEmployee(id) {
  const emp = employees.find(e => e.id===id);
  if (!emp) return;
  editingEmpId = id;
  document.getElementById('empModalTitle').textContent  = 'Edit Karyawan';
  document.getElementById('empNama').value              = emp.nama;
  document.getElementById('empEmail').value             = emp.email    || '';
  document.getElementById('empJabatan').value           = emp.jabatan  || '';
  document.getElementById('empDivisi').value            = emp.divisi;
  document.getElementById('empTelepon').value           = emp.telepon  || '';
  document.getElementById('empJoin').value              = emp.join_date|| '';
  document.getElementById('empOffice').value            = emp.office_id|| '';
  document.getElementById('empKaryawanId').value        = emp.employee_id || '';
  // Kosongkan password saat edit — kosong = tidak diubah
  if (document.getElementById('empPassword')) {
    document.getElementById('empPassword').value = '';
    document.getElementById('empPassword').placeholder = 'Kosongkan jika tidak diubah';
  }
  document.getElementById('empModal').style.display = 'flex';
}

async function saveEmployee() {
  const karyawanId = document.getElementById('empKaryawanId').value.trim().toUpperCase();
  const empPassword = document.getElementById('empPassword')?.value.trim() || '123456';

  const data = {
    nama:              document.getElementById('empNama').value.trim(),
    email:             document.getElementById('empEmail').value.trim() || null,
    jabatan:           document.getElementById('empJabatan').value.trim(),
    divisi:            document.getElementById('empDivisi').value,
    telepon:           document.getElementById('empTelepon').value.trim(),
    join_date:         document.getElementById('empJoin').value,
    office_id:         document.getElementById('empOffice').value || null,
    employee_id:       karyawanId || null,
    employee_password: empPassword || '123456',
    is_active:         true,
    created_by:        currentUser?.id,
  };

  if (!data.nama)       { notify('⚠️','Nama wajib diisi!','orange'); return; }
  if (!karyawanId)      { notify('⚠️','ID Karyawan wajib diisi!','orange'); return; }
  if (!empPassword || empPassword.length < 4) {
    notify('⚠️','Password minimal 4 karakter!','orange'); return;
  }

  const btn = document.getElementById('saveEmpBtn');
  btn.disabled = true; btn.textContent = '⏳ Menyimpan...';

  try {
    let error;
    if (editingEmpId) {
      // Saat edit: hanya update password jika field diisi
      const updateData = { ...data };
      if (!document.getElementById('empPassword')?.value.trim()) {
        delete updateData.employee_password; // jangan overwrite password lama jika kosong
      }
      ({ error } = await sb.from('employees').update(updateData).eq('id', editingEmpId));
    } else {
      ({ error } = await sb.from('employees').insert(data));
    }
    if (error) throw error;
    await fetchEmployees();
    populateAllDropdowns();
    renderEmployees();
    renderDashboard();
    closeEmpModal();
    notify('✅', editingEmpId ? 'Data karyawan diperbarui!' : 'Karyawan baru ditambahkan!', 'green');
  } catch(e) {
    notify('❌', e.message||'Gagal menyimpan','red');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Simpan';
  }
}

async function deleteEmployee(id) {
  if (!confirm('Hapus karyawan ini?')) return;
  try {
    const { error } = await sb.from('employees').update({ is_active:false }).eq('id',id);
    if (error) throw error;
    await fetchEmployees();
    populateAllDropdowns();
    renderEmployees();
    renderDashboard();
    notify('🗑️','Karyawan dihapus','red');
  } catch(e) { notify('❌', e.message||'Gagal menghapus','red'); }
}

function toggleEmpPasswordVisibility() {
  const inp = document.getElementById('empPassword');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function closeEmpModal() {
  document.getElementById('empModal').style.display = 'none';
  editingEmpId = null;
}
