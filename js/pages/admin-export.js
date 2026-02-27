// ============================================================
// PAGE: ADMIN — LAPORAN & EXPORT
// Export Excel (ExcelJS tanpa foto), PDF, dan ZIP Foto per Karyawan
// ============================================================

function renderPreview() {
  const month    = document.getElementById('previewMonth').value;
  const officeId = document.getElementById('previewOffice').value;
  const data = absenRecords.filter(r => r.tanggal.startsWith(month) && (!officeId || r.officeId===officeId));
  const tbody = document.getElementById('previewTable');
  if (!tbody) return;
  tbody.innerHTML = data.slice(0,50).map(r=>`<tr>
    <td>${r.selfie?`<img src="${r.selfie}" class="selfie-preview" loading="lazy" style="cursor:pointer;width:56px;height:56px;object-fit:cover;border-radius:8px;" onclick="window.open('${r.selfie}','_blank')">`:'<div style="width:56px;height:56px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:18px;">📷</div>'}</td>
    <td style="font-weight:600;">${r.empNama}</td>
    <td><span class="badge badge-purple">${r.officeName}</span></td>
    <td style="font-family:'JetBrains Mono',monospace;font-size:12px;">${r.tanggal}</td>
    <td style="color:var(--green);font-weight:600;">${r.masuk||'—'}</td>
    <td style="color:var(--red);font-weight:600;">${r.keluar||'—'}</td>
    <td>${r.masuk&&r.keluar?calcDuration(r.masuk,r.keluar):'—'}</td>
    <td>${statusBadge(r.status)}</td>
  </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:32px;">Tidak ada data</td></tr>';
}

// ============================================================
// EXPORT EXCEL — tanpa foto (foto diunduh terpisah via ZIP)
// ============================================================

async function exportExcel() {
  const officeId = document.getElementById('exportOffice').value;
  const divisi   = document.getElementById('exportDivisi').value;
  const month    = document.getElementById('exportMonth').value;

  let data = absenRecords.filter(r =>
    (!officeId || r.officeId === officeId) &&
    (!divisi   || r.divisi   === divisi)   &&
    (!month    || r.tanggal.startsWith(month))
  );

  const btn = document.getElementById('exportExcelBtn');
  btn.disabled = true; btn.textContent = '⏳ Membuat Excel...';

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TSA Presence';
    workbook.created = new Date();

    // ---- Sheet 1: Detail Absensi ----
    const ws = workbook.addWorksheet('Absensi Detail');
    const headerFill  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1A4FA0' } };
    const headerFont  = { bold:true, color:{ argb:'FFFFFFFF' }, size:11 };
    const centerAlign = { horizontal:'center', vertical:'middle' };
    const wrapAlign   = { wrapText:true, vertical:'middle' };

    ws.columns = [
      { header:'No',         key:'no',      width:5  },
      { header:'Nama',       key:'nama',    width:24 },
      { header:'ID Karyawan',key:'empid',   width:14 },
      { header:'Divisi',     key:'divisi',  width:16 },
      { header:'Kantor',     key:'kantor',  width:22 },
      { header:'Tanggal',    key:'tgl',     width:13 },
      { header:'Hari',       key:'hari',    width:10 },
      { header:'Jam Masuk',  key:'masuk',   width:12 },
      { header:'Jam Keluar', key:'keluar',  width:12 },
      { header:'Durasi',     key:'durasi',  width:10 },
      { header:'Status',     key:'status',  width:12 },
      { header:'Keterangan', key:'ket',     width:22 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell(cell => {
      cell.fill = headerFill; cell.font = headerFont;
      cell.alignment = centerAlign;
      cell.border = { bottom:{ style:'thin', color:{ argb:'FFE2E8F0' } } };
    });

    const hariNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

    data.forEach((r, idx) => {
      const dur   = r.masuk && r.keluar ? calcDuration(r.masuk, r.keluar) : '—';
      const tglDate = new Date(r.tanggal + 'T00:00:00');
      const hari  = hariNames[tglDate.getDay()];
      const emp   = employees.find(e => e.id === r.empId);

      const row = ws.addRow({
        no: idx+1, nama: r.empNama, empid: emp?.employee_id || '—',
        divisi: r.divisi, kantor: r.officeName,
        tgl: r.tanggal, hari, masuk: r.masuk||'—', keluar: r.keluar||'—',
        durasi: dur, status: r.status, ket: r.keterangan || '',
      });
      row.height = 22;
      row.eachCell(cell => {
        cell.alignment = wrapAlign;
        cell.border = { bottom:{ style:'hair', color:{ argb:'FFE2E8F0' } } };
      });

      const statusCell = row.getCell('status');
      if (r.status==='Hadir')      statusCell.font = { color:{ argb:'FF16A34A' }, bold:true };
      else if (r.status==='Terlambat') statusCell.font = { color:{ argb:'FFD97706' }, bold:true };
      else if (r.status==='Absen') statusCell.font = { color:{ argb:'FFDC2626' }, bold:true };

      if (idx % 2 === 1) {
        row.eachCell(cell => {
          cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF7F9FC' } };
        });
      }
    });
    ws.views = [{ state:'frozen', ySplit:1 }];

    // ---- Sheet 2: Rekap per Karyawan ----
    const ws2 = workbook.addWorksheet('Rekap Karyawan');
    ws2.columns = [
      { header:'Nama',         key:'nama',   width:24 },
      { header:'ID Karyawan',  key:'empid',  width:14 },
      { header:'Divisi',       key:'divisi', width:16 },
      { header:'Kantor',       key:'kantor', width:22 },
      { header:'Total Hadir',  key:'hadir',  width:13 },
      { header:'Terlambat',    key:'late',   width:13 },
      { header:'Izin/Cuti',    key:'izin',   width:13 },
      { header:'Absen',        key:'absen',  width:13 },
      { header:'Hari Kerja',   key:'wdays',  width:13 },
      { header:'% Kehadiran',  key:'pct',    width:13 },
    ];
    const hRow2 = ws2.getRow(1);
    hRow2.height = 32;
    hRow2.eachCell(cell => { cell.fill=headerFill; cell.font=headerFont; cell.alignment=centerAlign; });

    const wdays = month ? countWorkDaysForMonth(month) : 22;

    employees
      .filter(e => (!officeId||e.office_id===officeId) && (!divisi||e.divisi===divisi))
      .forEach((emp, idx) => {
        const recs  = absenRecords.filter(r => r.empId===emp.id && (!month||r.tanggal.startsWith(month)));
        const hadir = recs.filter(r => r.status==='Hadir').length;
        const late  = recs.filter(r => r.status==='Terlambat').length;
        const izin  = leaveRequests.filter(lr => lr.employee_id===emp.id && lr.status==='Disetujui' && (!month||(lr.start_date||'').startsWith(month))).length;
        const total = hadir + late;
        const absen = Math.max(0, wdays - total - izin);
        const pct   = wdays > 0 ? Math.round((total/wdays)*100)+'%' : '—';
        const row   = ws2.addRow({
          nama:emp.nama, empid:emp.employee_id||'—', divisi:emp.divisi,
          kantor:emp.offices?.nama||'—', hadir, late, izin, absen, wdays, pct
        });
        row.height = 22;
        if (idx%2===1) row.eachCell(cell => { cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF7F9FC' } }; });
      });
    ws2.views = [{ state:'frozen', ySplit:1 }];

    // ---- Sheet 3: Info File ----
    const ws3 = workbook.addWorksheet('Info Laporan');
    ws3.getCell('A1').value = 'Laporan Absensi PT. Tujuh Sinar Abadi';
    ws3.getCell('A1').font  = { bold:true, size:14, color:{ argb:'FF1A4FA0' } };
    ws3.getCell('A3').value = 'Periode:';    ws3.getCell('B3').value = month || 'Semua';
    ws3.getCell('A4').value = 'Kantor:';     ws3.getCell('B4').value = officeId ? (offices.find(o=>o.id===officeId)?.nama||officeId) : 'Semua Kantor';
    ws3.getCell('A5').value = 'Divisi:';     ws3.getCell('B5').value = divisi || 'Semua Divisi';
    ws3.getCell('A6').value = 'Total Data:'; ws3.getCell('B6').value = data.length;
    ws3.getCell('A7').value = 'Dibuat:';     ws3.getCell('B7').value = new Date().toLocaleString('id-ID');
    ws3.getCell('A9').value = 'Catatan:';
    ws3.getCell('A10').value = 'File Excel ini tidak menyertakan foto selfie. Untuk mengunduh foto, gunakan fitur "Unduh ZIP Foto" di halaman Laporan.';
    ws3.getCell('A10').font = { italic:true, color:{ argb:'FF64748B' } };
    ws3.columns = [{ width:18 }, { width:36 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Absensi_TSA_${month||'all'}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    notify('✅', 'File Excel berhasil diunduh!', 'green');
  } catch(e) {
    console.error(e);
    notify('❌', 'Gagal membuat Excel: ' + e.message, 'red');
  } finally {
    btn.disabled = false; btn.textContent = '⬇️ Unduh Excel (.xlsx)';
  }
}

// Helper: hitung hari kerja (Senin-Jumat) dalam bulan tertentu
function countWorkDaysForMonth(yearMonth) {
  const [y, mo] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  let count = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    const day = new Date(y, mo-1, i).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

// ============================================================
// EXPORT ZIP FOTO — foto per karyawan dalam folder terpisah
// ============================================================

async function exportPhotoZip() {
  const month    = document.getElementById('zipMonth').value;
  const officeId = document.getElementById('zipOffice').value;
  const divisi   = document.getElementById('zipDivisi').value;

  if (!month) { notify('⚠️', 'Pilih bulan terlebih dahulu.', 'orange'); return; }

  let data = absenRecords.filter(r =>
    r.selfie &&
    r.tanggal.startsWith(month) &&
    (!officeId || r.officeId === officeId) &&
    (!divisi   || r.divisi   === divisi)
  );

  if (data.length === 0) {
    notify('⚠️', 'Tidak ada foto untuk periode dan filter yang dipilih.', 'orange');
    return;
  }

  const btn = document.getElementById('exportZipBtn');
  btn.disabled = true;
  const progressWrap = document.getElementById('zipProgressWrap');
  const progressBar  = document.getElementById('zipProgressBar');
  const progressLabel= document.getElementById('zipProgressLabel');
  const progressPct  = document.getElementById('zipProgressPct');
  const progressSub  = document.getElementById('zipProgressSub');
  progressWrap.style.display = 'block';

  try {
    const zip = new JSZip();

    // Kelompokkan records per karyawan
    const byEmp = {};
    data.forEach(r => {
      const key = r.empId;
      if (!byEmp[key]) byEmp[key] = { nama: r.empNama, records: [] };
      byEmp[key].records.push(r);
    });

    const empList    = Object.values(byEmp);
    const totalPhotos= data.length;
    let   downloaded = 0;
    let   failed     = 0;

    progressLabel.textContent = `Mengunduh ${totalPhotos} foto dari ${empList.length} karyawan...`;

    // Proses per karyawan — buat folder per nama
    for (const empData of empList) {
      // Sanitasi nama folder: hilangkan karakter ilegal
      const folderName = empData.nama
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, '_')
        .trim() || 'Karyawan';

      const folder = zip.folder(folderName);

      // Unduh foto satu per satu (untuk menghindari rate limit)
      for (const r of empData.records) {
        try {
          const resp = await fetch(r.selfie);
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          const blob = await resp.blob();
          const ext  = blob.type.includes('png') ? 'png' : 'jpg';

          // Nama file: NAMA_TANGGAL_TIPE.ext
          const safeName = empData.nama.replace(/[^a-zA-Z0-9]/g, '_').substring(0,20);
          const tipe     = r.masuk && !r.keluar ? 'masuk' : r.keluar && !r.masuk ? 'keluar' : 'absen';
          const fileName = `${safeName}_${r.tanggal}_${tipe}.${ext}`;

          folder.file(fileName, blob);
          downloaded++;
        } catch(e) {
          console.warn('[ZIP] Gagal unduh foto:', r.selfie, e.message);
          failed++;
          downloaded++;
        }

        // Update progress
        const pct = Math.round((downloaded / totalPhotos) * 100);
        progressBar.style.width  = pct + '%';
        progressPct.textContent  = pct + '%';
        progressSub.textContent  = `${downloaded}/${totalPhotos} foto — ${empData.nama}`;

        // Beri jeda agar UI tidak freeze
        if (downloaded % 5 === 0) await new Promise(r => setTimeout(r, 10));
      }
    }

    progressLabel.textContent = 'Mengompres file ZIP...';
    progressPct.textContent   = '...';

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }, (meta) => {
      progressBar.style.width = meta.percent.toFixed(0) + '%';
      progressPct.textContent = meta.percent.toFixed(0) + '%';
    });

    const url = URL.createObjectURL(zipBlob);
    const a   = document.createElement('a');
    a.href    = url;
    a.download= `Foto_Absensi_${month}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    const msg = failed > 0
      ? `ZIP berhasil dibuat! ${downloaded - failed} foto, ${failed} gagal diunduh.`
      : `ZIP berhasil! ${downloaded} foto dari ${empList.length} karyawan.`;
    notify('✅', msg, 'green');

  } catch(e) {
    console.error('[ZIP]', e);
    notify('❌', 'Gagal membuat ZIP: ' + e.message, 'red');
  } finally {
    btn.disabled = false;
    btn.textContent = '📦 Unduh ZIP Foto';
    setTimeout(() => {
      progressWrap.style.display = 'none';
      progressBar.style.width = '0%';
      progressPct.textContent = '0%';
    }, 2500);
  }
}

// ============================================================
// EXPORT PDF — dengan opsi foto
// ============================================================

async function exportPDF() {
  const month     = document.getElementById('pdfMonth').value;
  const officeId  = document.getElementById('pdfOffice').value;
  const withPhoto = document.getElementById('pdfWithPhoto').checked;
  const data      = absenRecords.filter(r =>
    r.tanggal.startsWith(month) && (!officeId || r.officeId===officeId)
  );
  const officeName = officeId ? (offices.find(o=>o.id===officeId)?.nama||'') : 'Semua Kantor';

  const btn = document.getElementById('exportPdfBtn');
  btn.disabled = true; btn.textContent = '⏳ Memproses...';

  try {
    let photoMap = {};
    if (withPhoto) {
      const withSelfie = data.filter(r => r.selfie);
      let done = 0;
      btn.textContent = `⏳ Mengunduh foto... (0/${withSelfie.length})`;
      await Promise.all(withSelfie.map(async r => {
        const b64 = await fetchImageAsBase64(r.selfie);
        if (b64) photoMap[r.id] = b64;
        done++;
        btn.textContent = `⏳ Mengunduh foto... (${done}/${withSelfie.length})`;
      }));
    }

    btn.textContent = '⏳ Membuat PDF...';

    const tableRows = data.map(r => {
      const dur    = r.masuk && r.keluar ? calcDuration(r.masuk, r.keluar) : '—';
      const badge  = r.status==='Hadir' ? 'hadir' : r.status==='Terlambat' ? 'late' : 'absen';
      const imgSrc = withPhoto && photoMap[r.id]
        ? `<img src="${photoMap[r.id]}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #dde3ec;" alt="selfie">`
        : withPhoto ? '<div style="width:64px;height:64px;border-radius:8px;background:#f0f4f8;border:1px solid #dde3ec;display:flex;align-items:center;justify-content:center;font-size:20px;">📷</div>' : '';
      const fotoTd = withPhoto ? `<td style="padding:6px 8px;text-align:center;">${imgSrc}</td>` : '';
      return `<tr>
        ${fotoTd}
        <td><strong>${r.empNama}</strong><br><span style="color:#64748b;font-size:10px;">${r.divisi||''}</span></td>
        <td>${r.officeName}</td>
        <td style="font-family:monospace;white-space:nowrap;">${r.tanggal}</td>
        <td style="color:#16a34a;font-weight:700;">${r.masuk||'—'}</td>
        <td style="color:#dc2626;font-weight:700;">${r.keluar||'—'}</td>
        <td>${dur}</td>
        <td><span class="badge ${badge}">${r.status}</span></td>
      </tr>`;
    }).join('');

    const fotoTh = withPhoto ? '<th style="width:80px;">Foto</th>' : '';

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Laporan Absensi TSA — ${month}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Arial,sans-serif; padding:24px; color:#1e293b; font-size:12px; }
  .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; padding-bottom:14px; border-bottom:3px solid #1a4fa0; }
  .header-left h1 { font-size:18px; font-weight:800; color:#1a4fa0; }
  .header-left p  { color:#64748b; font-size:11px; margin-top:3px; }
  .meta { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
  .meta-item { background:#f0f4f8; border:1px solid #dde3ec; border-radius:8px; padding:7px 13px; }
  .meta-item .label { font-size:9px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.5px; }
  .meta-item .val   { font-size:13px; font-weight:800; color:#1e293b; margin-top:2px; }
  table { width:100%; border-collapse:collapse; margin-top:6px; }
  th { background:#1a4fa0; color:#fff; padding:9px 10px; text-align:left; font-size:10px; font-weight:700; letter-spacing:.3px; }
  td { padding:7px 10px; border-bottom:1px solid #e2e8f0; vertical-align:middle; }
  tr:nth-child(even) td { background:#f7f9fc; }
  .badge { padding:2px 8px; border-radius:100px; font-size:10px; font-weight:700; }
  .hadir  { background:#dcfce7; color:#166534; }
  .late   { background:#fef3c7; color:#92400e; }
  .absen  { background:#fee2e2; color:#991b1b; }
  .footer { margin-top:16px; padding-top:10px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; }
  @media print { body { padding:10px; } tr { page-break-inside:avoid; } }
</style>
</head>
<body>
<div class="header">
  <div class="header-left">
    <h1>📋 Laporan Absensi PT. Tujuh Sinar Abadi</h1>
    <p>${officeName} &nbsp;|&nbsp; Periode: ${month} &nbsp;|&nbsp; Dibuat: ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</p>
  </div>
</div>
<div class="meta">
  <div class="meta-item"><div class="label">Total Data</div><div class="val">${data.length}</div></div>
  <div class="meta-item"><div class="label">Hadir</div><div class="val" style="color:#16a34a">${data.filter(r=>r.status==='Hadir').length}</div></div>
  <div class="meta-item"><div class="label">Terlambat</div><div class="val" style="color:#d97706">${data.filter(r=>r.status==='Terlambat').length}</div></div>
  <div class="meta-item"><div class="label">Absen</div><div class="val" style="color:#dc2626">${data.filter(r=>r.status==='Absen').length}</div></div>
</div>
<table>
  <thead><tr>${fotoTh}<th>Nama & Divisi</th><th>Kantor</th><th>Tanggal</th><th>Masuk</th><th>Keluar</th><th>Durasi</th><th>Status</th></tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<div class="footer">
  <span>TSA Presence — PT. Tujuh Sinar Abadi</span>
  <span>Dicetak: ${new Date().toLocaleString('id-ID')}</span>
</div>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    notify('✅', 'PDF siap dicetak!', 'green');
  } catch(e) {
    console.error(e);
    notify('❌', 'Gagal membuat PDF: ' + e.message, 'red');
  } finally {
    btn.disabled = false; btn.textContent = '⬇️ Generate PDF';
  }
}
