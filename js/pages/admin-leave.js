// ============================================================
// PAGE: ADMIN — PERSETUJUAN IZIN / CUTI
// ============================================================

function renderLeaveRequests() {
  const el = document.getElementById('leaveRequestList');
  if (!el) return;
  const st   = document.getElementById('filterLeaveStatus')?.value || '';
  const tp   = document.getElementById('filterLeaveType')?.value   || '';
  const list = leaveRequests.filter(r => (!st || r.status===st) && (!tp || r.jenis===tp));

  if (list.length === 0) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:60px;color:var(--muted);">Tidak ada pengajuan izin/cuti.</div>';
    return;
  }

  const icons  = { Izin:'🌤️', Cuti:'🏖️', Sakit:'🏥' };
  const stCls  = { Menunggu:'leave-pending', Disetujui:'leave-approved', Ditolak:'leave-rejected' };
  const stIcon = { Menunggu:'⏳', Disetujui:'✅', Ditolak:'❌' };

  el.innerHTML = list.map(r => {
    const empName  = r.employees?.nama           || '—';
    const divisi   = r.employees?.divisi         || '—';
    const kantor   = r.employees?.offices?.nama  || '—';
    const durasi   = r.tanggal_mulai === r.tanggal_selesai
      ? r.tanggal_mulai
      : `${r.tanggal_mulai} s/d ${r.tanggal_selesai}`;
    const days     = Math.max(1, Math.round((new Date(r.tanggal_selesai) - new Date(r.tanggal_mulai)) / 86400000) + 1);
    const isPending = r.status === 'Menunggu';

    return `<div class="leave-card">
      <div class="leave-icon ${r.jenis?.toLowerCase()}">${icons[r.jenis]||'📝'}</div>
      <div class="leave-meta">
        <div class="leave-name">${empName}
          <span style="font-size:11px;font-weight:500;color:var(--muted);margin-left:8px;">${divisi} · ${kantor}</span>
        </div>
        <div class="leave-type"><strong>${r.jenis}</strong> · ${days} hari</div>
        <div class="leave-dates">📅 ${durasi}</div>
        <div class="leave-reason">"${r.keterangan || '-'}"</div>
        <div style="margin-top:8px;">
          <span class="status-badge-leave ${stCls[r.status]||'leave-pending'}">${stIcon[r.status]||'⏳'} ${r.status}</span>
          <span style="font-size:11px;color:var(--muted);margin-left:10px;">${new Date(r.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</span>
          ${r.catatan_admin ? `<span style="font-size:11px;color:var(--muted);margin-left:8px;">· ${r.catatan_admin}</span>` : ''}
        </div>
      </div>
      ${isPending ? `<div class="leave-actions">
        <button class="btn btn-sm btn-green" onclick="approveLeave('${r.id}')">✅ Setujui</button>
        <button class="btn btn-sm btn-red"   onclick="rejectLeave('${r.id}')">❌ Tolak</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

async function approveLeave(id) {
  const catatan = prompt('Catatan persetujuan (opsional):') ?? '';
  try {
    const { error } = await sb.from('leave_requests').update({
      status: 'Disetujui',
      catatan_admin: catatan,
      reviewed_by: currentUser?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) throw error;
    await fetchLeaveRequests();
    renderLeaveRequests();
    notify('✅', 'Izin disetujui!', 'green');
  } catch(e) { notify('❌', e.message, 'red'); }
}

async function rejectLeave(id) {
  const catatan = prompt('Alasan penolakan:');
  if (catatan === null) return;
  try {
    const { error } = await sb.from('leave_requests').update({
      status: 'Ditolak',
      catatan_admin: catatan,
      reviewed_by: currentUser?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) throw error;
    await fetchLeaveRequests();
    renderLeaveRequests();
    notify('🗑️', 'Izin ditolak.', 'red');
  } catch(e) { notify('❌', e.message, 'red'); }
}
