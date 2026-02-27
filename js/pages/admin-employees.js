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
      <div class="emp-avatar" style="width:42px;height:42px;font-size:16px;flex-shrink:0;">${emp.nama[0]}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;">
          <div style="min-width:0;">
            <div class="emp-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${emp.nama}</div>
            <div class="emp-role">${emp.jabatan||'—'} · ${emp.divisi}</div>
            <div class="emp-office" style="font-size:10px;margin-top:3px;">🏢 ${officeName}</div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;">
            <button class="btn-icon-edit" onclick="editEmployee('${emp.id}')" title="Edit">✏️</button>
            <button class="btn-icon-del" onclick="deleteEmployee('${emp.id}')" title="Hapus">🗑️</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;">
          ${emp.employee_id ? `<div class="emp-id-badge">${emp.employee_id}</div>` : ''}
          <div style="display:flex;gap:10px;margin-left:auto;">
            <div class="emp-stat-item"><span>${recs.length}</span>Hadir</div>
            <div class="emp-stat-item"><span>${recs.filter(r=>r.status==='Terlambat').length}</span>Lambat</div>
          </div>
        </div>
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
  const ok = await showConfirm({
  icon: '🗑️',
  title: 'Hapus Karyawan',
  message: 'Data karyawan ini akan dihapus secara permanen. Lanjutkan?',
  okText: 'Ya, Hapus',
  okColor: 'var(--red)',
});
if (!ok) return;
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
