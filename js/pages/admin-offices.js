// ============================================================
// PAGE: ADMIN — MANAJEMEN KANTOR
// ============================================================

function renderOffices() {
  const search   = document.getElementById('searchOffice')?.value?.toLowerCase() || '';
  const filtered = offices.filter(o =>
    o.nama.toLowerCase().includes(search) || o.kota.toLowerCase().includes(search)
  );
  const grid = document.getElementById('officeGrid');
  if (!grid) return;

  grid.innerHTML = filtered.map(o => {
    const empCount  = employees.filter(e => e.office_id===o.id).length;
    const today     = new Date().toISOString().split('T')[0];
    const hadirCount = new Set(absenRecords.filter(r=>r.officeId===o.id&&r.tanggal===today).map(r=>r.empId)).size;
    return `<div class="office-card">
      <div class="office-card-header">
        <div>
          <div class="office-name">🏢 ${o.nama}</div>
          <div class="office-city">📍 ${o.kota}</div>
        </div>
        <span class="badge badge-purple">${empCount} karyawan</span>
      </div>
      <div class="office-detail">📬 <span>${o.alamat}</span></div>
      <div class="office-detail">📡 <span style="font-family:'JetBrains Mono',monospace;font-size:11px;">${parseFloat(o.lat).toFixed(5)}, ${parseFloat(o.lon).toFixed(5)}</span></div>
      <div class="office-detail">⭕ Radius: <span>${o.radius} meter</span></div>
      <div class="office-detail">✅ Hadir hari ini: <span style="color:var(--green);font-weight:700;">${hadirCount}</span> / <span>${empCount}</span></div>
      <div class="office-actions">
        <button class="btn btn-sm btn-outline" onclick="editOffice('${o.id}')" style="flex:1;">✏️ Edit</button>
        <button class="btn btn-sm btn-red" onclick="deleteOffice('${o.id}')" style="flex:1;">🗑️ Hapus</button>
      </div>
    </div>`;
  }).join('') || '<p style="color:var(--muted);padding:40px;text-align:center;">Belum ada kantor terdaftar.</p>';

  renderOfficeStats();
}

function renderOfficeStats() {
  const tbody = document.getElementById('officeStatsTable');
  if (!tbody) return;
  const today = new Date().toISOString().split('T')[0];
  tbody.innerHTML = offices.map(o => {
    const total = employees.filter(e=>e.office_id===o.id).length;
    const hadir = new Set(absenRecords.filter(r=>r.officeId===o.id&&r.tanggal===today).map(r=>r.empId)).size;
    const absen = Math.max(0, total-hadir);
    const pct   = total>0 ? Math.round((hadir/total)*100) : 0;
    return `<tr>
      <td style="font-weight:700;">${o.nama}</td>
      <td><span class="badge badge-purple">${o.kota}</span></td>
      <td>${total}</td>
      <td style="color:var(--green);font-weight:700;">${hadir}</td>
      <td style="color:var(--red);">${absen}</td>
      <td><div style="display:flex;align-items:center;gap:8px;">
        <div style="flex:1;height:6px;background:var(--surface2);border-radius:3px;border:1px solid var(--border);">
          <div style="width:${pct}%;height:100%;background:${pct>=80?'var(--green)':pct>=60?'var(--orange)':'var(--red)'};border-radius:3px;"></div>
        </div>
        <span style="font-size:12px;font-weight:700;">${pct}%</span>
      </div></td>
    </tr>`;
  }).join('');
}

function showAddOfficeModal() {
  editingOfficeId = null;
  document.getElementById('officeModalTitle').textContent = 'Tambah Kantor Cabang';
  ['officeName','officeKota','officeAlamat'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('officeRadius').value = '100';
  document.getElementById('officeLat').value    = '';
  document.getElementById('officeLon').value    = '';
  document.getElementById('officeModal').style.display = 'flex';
}

function editOffice(id) {
  const o = offices.find(x => x.id===id);
  if (!o) return;
  editingOfficeId = id;
  document.getElementById('officeModalTitle').textContent = 'Edit Kantor Cabang';
  document.getElementById('officeName').value   = o.nama;
  document.getElementById('officeKota').value   = o.kota;
  document.getElementById('officeAlamat').value = o.alamat;
  document.getElementById('officeRadius').value = o.radius;
  document.getElementById('officeLat').value    = o.lat;
  document.getElementById('officeLon').value    = o.lon;
  document.getElementById('officeModal').style.display = 'flex';
}

async function saveOffice() {
  const data = {
    nama:      document.getElementById('officeName').value.trim(),
    kota:      document.getElementById('officeKota').value.trim(),
    alamat:    document.getElementById('officeAlamat').value.trim(),
    radius:    parseInt(document.getElementById('officeRadius').value) || 100,
    lat:       parseFloat(document.getElementById('officeLat').value),
    lon:       parseFloat(document.getElementById('officeLon').value),
    is_active: true,
    created_by: currentUser?.id,
  };

  if (!data.nama)   { notify('⚠️','Nama kantor wajib diisi!','orange'); return; }
  if (!data.kota)   { notify('⚠️','Kota wajib diisi!','orange'); return; }
  if (!data.alamat) { notify('⚠️','Alamat wajib diisi!','orange'); return; }
  if (isNaN(data.lat)||isNaN(data.lon)) { notify('⚠️','Koordinat latitude/longitude wajib diisi!','orange'); return; }

  const btn = document.getElementById('saveOfficeBtn');
  btn.disabled = true; btn.textContent = '⏳ Menyimpan...';

  try {
    let error;
    if (editingOfficeId) {
      ({ error } = await sb.from('offices').update(data).eq('id', editingOfficeId));
    } else {
      ({ error } = await sb.from('offices').insert(data));
    }
    if (error) throw error;
    await fetchOffices();
    populateAllDropdowns();
    renderOffices();
    renderDashboard();
    closeOfficeModal();
    notify('✅', editingOfficeId ? 'Kantor diperbarui!' : 'Kantor baru ditambahkan!', 'green');
  } catch(e) {
    notify('❌', e.message||'Gagal menyimpan', 'red');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Simpan Kantor';
  }
}

async function deleteOffice(id) {
  const emp = employees.filter(e => e.office_id===id);
  if (emp.length > 0) { notify('⚠️',`${emp.length} karyawan masih ditugaskan di kantor ini.`,'orange'); return; }
  if (!confirm('Hapus kantor ini?')) return;
  try {
    const { error } = await sb.from('offices').update({ is_active:false }).eq('id',id);
    if (error) throw error;
    await fetchOffices();
    populateAllDropdowns();
    renderOffices();
    renderDashboard();
    notify('🗑️','Kantor dihapus','red');
  } catch(e) { notify('❌', e.message||'Gagal menghapus','red'); }
}

function closeOfficeModal() {
  document.getElementById('officeModal').style.display = 'none';
}
