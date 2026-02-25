// ============================================================
// UTILITY HELPERS
// Fungsi-fungsi kecil yang digunakan di berbagai tempat
// ============================================================

/** Tampilkan notifikasi toast */
function notify(icon, msg, type) {
  const el = document.createElement('div');
  el.className = 'notification';
  const colors = { green:'var(--green)', red:'var(--red)', orange:'var(--orange)', blue:'var(--accent)' };
  el.innerHTML = `<span style="font-size:20px;">${icon}</span><span style="color:${colors[type]||'var(--text)'};font-weight:600;">${msg}</span>`;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

/** Hitung durasi kerja dari jam masuk & keluar (format "Xj Ym") */
function calcDuration(masuk, keluar) {
  const [mh, mm] = masuk.split(':').map(Number);
  const [kh, km] = keluar.split(':').map(Number);
  const total = (kh*60+km) - (mh*60+mm);
  if (total <= 0) return '—';
  return `${Math.floor(total/60)}j ${total%60}m`;
}

/** Render badge status absensi */
function statusBadge(status) {
  const map = { Hadir:'badge-green', Terlambat:'badge-orange', Absen:'badge-red', Izin:'badge-blue' };
  return `<span class="badge ${map[status]||'badge-blue'}">${status||'—'}</span>`;
}

/** Hitung jarak dua koordinat GPS (meter) menggunakan Haversine */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2
    + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/** Set innerHTML ke elemen berdasarkan id */
function setOpts(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

/** Kompres foto selfie agar tidak lebih dari maxBytes */
async function compressPhoto(canvas, maxBytes = 64 * 1024) {
  // Coba kompresi kualitas jpeg dulu
  for (let q = 0.7; q >= 0.1; q -= 0.1) {
    const dataUrl = canvas.toDataURL('image/jpeg', q);
    const bytes = Math.ceil((dataUrl.length - 'data:image/jpeg;base64,'.length) * 3 / 4);
    if (bytes <= maxBytes) return dataUrl;
  }
  // Jika masih besar, scale down canvas
  let scale = 0.8;
  while (scale >= 0.2) {
    const tmp = document.createElement('canvas');
    tmp.width  = Math.round(canvas.width  * scale);
    tmp.height = Math.round(canvas.height * scale);
    tmp.getContext('2d').drawImage(canvas, 0, 0, tmp.width, tmp.height);
    for (let q = 0.7; q >= 0.1; q -= 0.1) {
      const dataUrl = tmp.toDataURL('image/jpeg', q);
      const bytes = Math.ceil((dataUrl.length - 'data:image/jpeg;base64,'.length) * 3 / 4);
      if (bytes <= maxBytes) return dataUrl;
    }
    scale -= 0.2;
  }
  // Fallback minimum quality
  const tmp = document.createElement('canvas');
  tmp.width = 320; tmp.height = 240;
  tmp.getContext('2d').drawImage(canvas, 0, 0, 320, 240);
  return tmp.toDataURL('image/jpeg', 0.1);
}
