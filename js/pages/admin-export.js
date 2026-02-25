// ============================================================
// PAGE: ADMIN — LAPORAN & EXPORT
// Export Excel (ExcelJS) dan PDF
// ============================================================

function renderPreview() {
  const month    = document.getElementById('previewMonth').value;
  const officeId = document.getElementById('previewOffice').value;
  const data = absenRecords.filter(r => r.tanggal.startsWith(month) && (!officeId || r.officeId===officeId));
  const tbody = document.getElementById('previewTable');
  if (!tbody) return;
  tbody.innerHTML = data.slice(0,50).map(r=>`<tr>
    <td>${r.selfie?`<img src="${r.selfie}" class="selfie-preview" loading="lazy" style="cursor:pointer;" onclick="window.open('${r.selfie}','_blank')">`:'<div style="width:80px;height:80px;border-radius:12px;background:var(--surface2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:20px;">📷</div>'}</td>
    <td style="font-weight:600;">${r.empNama}</td>
    <td><span class="badge badge-purple">${r.officeName}</span></td>
    <td style="font-family:'JetBrains Mono',monospace;font-size:12px;">${r.tanggal}</td>
    <td style="color:var(--green);font-weight:600;">${r.masuk||'—'}</td>
    <td style="color:var(--red);font-weight:600;">${r.keluar||'—'}</td>
    <td>${r.masuk&&r.keluar?calcDuration(r.masuk,r.keluar):'—'}</td>
    <td>${statusBadge(r.status)}</td>
  </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:32px;">Tidak ada data</td></tr>';
}

// ---- Export Excel ----

async function exportExcel() {
  const officeId  = document.getElementById('exportOffice').value;
  const divisi    = document.getElementById('exportDivisi').value;
  const month     = document.getElementById('exportMonth').value;
  const withPhoto = document.getElementById('excelWithPhoto').checked;

  let data = absenRecords.filter(r =>
    (!officeId || r.officeId === officeId) &&
    (!divisi   || r.divisi   === divisi)   &&
    (!month    || r.tanggal.startsWith(month))
  );

  const btn = document.getElementById('exportExcelBtn');
  btn.disabled = true; btn.textContent = '⏳ Memproses...';

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TSA Presence';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Absensi Detail');
    const headerFill  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1A4FA0' } };
    const headerFont  = { bold:true, color:{ argb:'FFFFFFFF' }, size:11 };
    const centerAlign = { horizontal:'center', vertical:'middle' };
    const wrapAlign   = { wrapText:true, vertical:'middle' };

    const cols = withPhoto
      ? [
          { header:'No', key:'no', width:5 }, { header:'Nama', key:'nama', width:22 },
          { header:'Divisi', key:'divisi', width:16 }, { header:'Kantor', key:'kantor', width:22 },
          { header:'Tanggal', key:'tgl', width:13 }, { header:'Jam Masuk', key:'masuk', width:12 },
          { header:'Jam Keluar', key:'keluar', width:12 }, { header:'Durasi', key:'durasi', width:10 },
          { header:'Status', key:'status', width:12 }, { header:'Foto Selfie', key:'foto', width:18 },
        ]
      : [
          { header:'No', key:'no', width:5 }, { header:'Nama', key:'nama', width:22 },
          { header:'Divisi', key:'divisi', width:16 }, { header:'Kantor', key:'kantor', width:22 },
          { header:'Tanggal', key:'tgl', width:13 }, { header:'Jam Masuk', key:'masuk', width:12 },
          { header:'Jam Keluar', key:'keluar', width:12 }, { header:'Durasi', key:'durasi', width:10 },
          { header:'Status', key:'status', width:12 },
        ];

    ws.columns = cols;
    const headerRow = ws.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell(cell => {
      cell.fill = headerFill; cell.font = headerFont;
      cell.alignment = centerAlign;
      cell.border = { bottom:{ style:'thin', color:{ argb:'FFE2E8F0' } } };
    });

    const ROW_H = withPhoto ? 75 : 20;
    let photoMap = {};
    if (withPhoto) {
      btn.textContent = '⏳ Mengunduh foto... (0/' + data.length + ')';
      const photoEntries = data.filter(r => r.selfie);
      let done = 0;
      await Promise.all(photoEntries.map(async r => {
        const b64 = await fetchImageAsBase64(r.selfie);
        if (b64) photoMap[r.id] = b64;
        done++;
        btn.textContent = `⏳ Mengunduh foto... (${done}/${photoEntries.length})`;
      }));
    }

    btn.textContent = '⏳ Membuat file Excel...';

    data.forEach((r, idx) => {
      const dur = r.masuk && r.keluar ? calcDuration(r.masuk, r.keluar) : '—';
      const rowData = {
        no: idx+1, nama: r.empNama, divisi: r.divisi, kantor: r.officeName,
        tgl: r.tanggal, masuk: r.masuk||'—', keluar: r.keluar||'—', durasi: dur, status: r.status,
      };
      if (withPhoto) rowData.foto = r.selfie ? '' : '(tidak ada)';

      const row = ws.addRow(rowData);
      row.height = ROW_H;
      row.eachCell(cell => {
        cell.alignment = wrapAlign;
        cell.border = { bottom:{ style:'hair', color:{ argb:'FFE2E8F0' } } };
      });

      const statusCell = row.getCell('status');
      if (r.status==='Hadir')     statusCell.font = { color:{ argb:'FF16A34A' }, bold:true };
      else if (r.status==='Terlambat') statusCell.font = { color:{ argb:'FFD97706' }, bold:true };
      else if (r.status==='Absen')statusCell.font = { color:{ argb:'FFDC2626' }, bold:true };

      if (withPhoto && photoMap[r.id]) {
        const rawB64 = stripDataPrefix(photoMap[r.id]);
        const ext    = photoMap[r.id].startsWith('data:image/png') ? 'png' : 'jpeg';
        try {
          const imgId = workbook.addImage({ base64: rawB64, extension: ext });
          const excelRow  = idx + 2;
          const fotoColIdx = cols.findIndex(c => c.key==='foto');
          ws.addImage(imgId, {
            tl: { col: fotoColIdx + 0.1, row: excelRow - 1 + 0.1 },
            br: { col: fotoColIdx + 0.9, row: excelRow - 0.1 },
            editAs: 'oneCell',
          });
        } catch(e) {
          row.getCell('foto').value = r.selfie || '(error)';
        }
      }

      if (idx % 2 === 1) {
        row.eachCell(cell => {
          cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF7F9FC' } };
        });
      }
    });

    ws.views = [{ state:'frozen', ySplit:1 }];

    // Sheet 2 — Rekap per karyawan
    const ws2 = workbook.addWorksheet('Rekap Karyawan');
    ws2.columns = [
      { header:'Nama', key:'nama', width:22 }, { header:'Divisi', key:'divisi', width:16 },
      { header:'Kantor', key:'kantor', width:22 }, { header:'Total Hadir', key:'hadir', width:13 },
      { header:'Terlambat', key:'late', width:13 }, { header:'Absen', key:'absen', width:13 },
      { header:'% Kehadiran', key:'pct', width:13 },
    ];
    const hRow2 = ws2.getRow(1);
    hRow2.height = 32;
    hRow2.eachCell(cell => { cell.fill=headerFill; cell.font=headerFont; cell.alignment=centerAlign; });

    employees.filter(e => (!officeId||e.office_id===officeId) && (!divisi||e.divisi===divisi))
      .forEach((emp, idx) => {
        const recs  = absenRecords.filter(r => r.empId===emp.id && (!month||r.tanggal.startsWith(month)));
        const hadir = recs.length;
        const late  = recs.filter(r => r.status==='Terlambat').length;
        const workdays = 22;
        const absen = Math.max(0, workdays-hadir);
        const pct   = Math.round((hadir/workdays)*100)+'%';
        const row   = ws2.addRow({ nama:emp.nama, divisi:emp.divisi, kantor:emp.offices?.nama||'—', hadir, late, absen, pct });
        row.height  = 20;
        if (idx%2===1) row.eachCell(cell => { cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF7F9FC' } }; });
      });
    ws2.views = [{ state:'frozen', ySplit:1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Absensi_TSA_${month||new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    notify('✅', 'File Excel berhasil diunduh!', 'green');
  } catch(e) {
    console.error(e);
    notify('❌', 'Gagal membuat Excel: ' + e.message, 'red');
  } finally {
    btn.disabled = false; btn.textContent = '⬇️ Download Excel (.xlsx)';
  }
}

// ---- Export PDF ----

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
        ? `<img src="${photoMap[r.id]}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid #dde3ec;" alt="selfie">`
        : withPhoto ? '<div style="width:70px;height:70px;border-radius:8px;background:#f0f4f8;border:1px solid #dde3ec;display:flex;align-items:center;justify-content:center;font-size:22px;">📷</div>' : '';
      const fotoTd = withPhoto ? `<td style="padding:6px 8px;text-align:center;">${imgSrc}</td>` : '';
      return `<tr>
        ${fotoTd}
        <td><strong>${r.empNama}</strong><br><span style="color:#64748b;font-size:10px;">${r.divisi}</span></td>
        <td>${r.officeName}</td>
        <td style="font-family:monospace;white-space:nowrap;">${r.tanggal}</td>
        <td style="color:#16a34a;font-weight:700;">${r.masuk||'—'}</td>
        <td style="color:#dc2626;font-weight:700;">${r.keluar||'—'}</td>
        <td>${dur}</td>
        <td><span class="badge ${badge}">${r.status}</span></td>
      </tr>`;
    }).join('');

    const fotoTh = withPhoto ? '<th style="width:86px;">Foto</th>' : '';

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Laporan Absensi TSA — ${month}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Arial,sans-serif; padding:24px; color:#1e293b; font-size:12px; }
  .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; padding-bottom:16px; border-bottom:3px solid #1a4fa0; }
  .header-left h1 { font-size:20px; font-weight:800; color:#1a4fa0; letter-spacing:-.3px; }
  .header-left p  { color:#64748b; font-size:12px; margin-top:4px; }
  .meta { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:16px; }
  .meta-item { background:#f0f4f8; border:1px solid #dde3ec; border-radius:8px; padding:8px 14px; }
  .meta-item .label { font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.5px; }
  .meta-item .val   { font-size:14px; font-weight:800; color:#1e293b; margin-top:2px; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  th { background:#1a4fa0; color:#fff; padding:10px; text-align:left; font-size:11px; font-weight:700; letter-spacing:.3px; }
  td { padding:8px 10px; border-bottom:1px solid #e2e8f0; vertical-align:middle; }
  tr:nth-child(even) td { background:#f7f9fc; }
  .badge { padding:3px 9px; border-radius:100px; font-size:10px; font-weight:700; }
  .hadir  { background:#dcfce7; color:#166534; }
  .late   { background:#fef3c7; color:#92400e; }
  .absen  { background:#fee2e2; color:#991b1b; }
  .footer { margin-top:20px; padding-top:12px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; }
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
