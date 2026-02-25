// ============================================================
// COMPONENT: CAMERA
// Logika kamera selfie untuk absensi (admin & karyawan)
// ============================================================

// ---- Admin Camera ----

function openCamera(type) {
  const empId    = document.getElementById('absenEmployee').value;
  const officeId = document.getElementById('absenOffice').value;
  if (!empId)    { notify('⚠️','Pilih karyawan terlebih dahulu!','orange'); return; }
  if (!officeId) { notify('⚠️','Pilih kantor terlebih dahulu!','orange'); return; }

  currentAbsenType = type;
  _initCameraModal(type);
  capturedPhoto = null;

  navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' } })
    .then(stream => {
      videoStream = stream;
      document.getElementById('videoEl').srcObject = stream;
    })
    .catch(() => {
      document.getElementById('cameraInfo').innerHTML = '⚠️ Kamera tidak tersedia, mode simulasi';
      capturedPhoto = 'simulated';
      document.getElementById('snapBtn').style.display = 'none';
      document.getElementById('confirmBtn').style.display = '';
    });
}

// ---- Employee Camera ----

function openCameraEmp(type) {
  if (!currentEmployee.office_id) {
    notify('⚠️','Anda belum ditugaskan ke kantor manapun. Hubungi Admin.','orange'); return;
  }
  empCurrentAbsenType = type;
  _initCameraModal(type);
  // Hanya reset empCapturedPhoto — jangan sentuh capturedPhoto (milik admin)
  empCapturedPhoto = null;

  // Tampilkan keterangan inline jika terlambat atau di luar radius
  const needsKet = _empNeedsKeterangan(type);
  _toggleCameraKeterangan(needsKet, type);

  navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' } })
    .then(stream => {
      empVideoStream = stream;
      videoStream = stream;
      document.getElementById('videoEl').srcObject = stream;
    })
    .catch(() => {
      document.getElementById('cameraInfo').innerHTML =
        '⚠️ Kamera tidak tersedia, mode simulasi<br><a href="https://wa.me/6288989363401" target="_blank" style="color:#25D366;font-weight:700;font-size:12px;">Hubungi Service Desk →</a>';
      empCapturedPhoto = 'simulated';
      // Tidak mengubah capturedPhoto (milik admin)
      document.getElementById('snapBtn').style.display = 'none';
      document.getElementById('confirmBtn').style.display = '';
    });
}

/** Inisialisasi tampilan modal kamera */
function _initCameraModal(type) {
  document.getElementById('absenType').textContent = type==='masuk' ? 'Masuk' : 'Keluar';
  document.getElementById('cameraModal').style.display = 'flex';
  document.getElementById('snapBtn').style.display = '';
  document.getElementById('confirmBtn').style.display = 'none';
  document.getElementById('photoPreview').style.display = 'none';
  document.getElementById('videoEl').style.display = '';
  document.getElementById('cameraInfo').textContent = '';
}

/** Cek apakah karyawan memerlukan keterangan (terlambat atau di luar radius) */
function _empNeedsKeterangan(type) {
  if (type !== 'masuk') return false;
  const off = currentEmployee?.offices;
  let outsideRadius = false;
  if (off && empCurrentLocation) {
    const dist = getDistance(empCurrentLocation.lat, empCurrentLocation.lon, parseFloat(off.lat), parseFloat(off.lon));
    outsideRadius = dist > off.radius;
  }
  const now = new Date();
  const [h, m] = settings.jamMasuk.split(':').map(Number);
  const isLate = now.getHours() > h || (now.getHours() === h && now.getMinutes() > m + settings.toleransi);
  return isLate || outsideRadius;
}

/** Tampil/sembunyikan section keterangan di dalam modal kamera */
function _toggleCameraKeterangan(show, type) {
  const ketSection = document.getElementById('cameraKeteranganSection');
  if (!ketSection) return;
  ketSection.style.display = show ? '' : 'none';
  if (!show) return;

  const off = currentEmployee?.offices;
  const reasons = [];
  if (off && empCurrentLocation) {
    const dist = getDistance(empCurrentLocation.lat, empCurrentLocation.lon, parseFloat(off.lat), parseFloat(off.lon));
    if (dist > off.radius) reasons.push('📍 Anda saat ini <strong>di luar radius area kantor</strong>');
  }
  const now = new Date();
  const [h, m] = settings.jamMasuk.split(':').map(Number);
  if (now.getHours() > h || (now.getHours() === h && now.getMinutes() > m + settings.toleransi)) {
    reasons.push('⏰ Anda <strong>terlambat</strong> dari jam masuk yang ditentukan');
  }
  document.getElementById('cameraKeteranganAlert').innerHTML =
    reasons.join(' dan ') + '. Mohon isi keterangan/alasan <strong>sebelum mengambil foto</strong>:';
  document.getElementById('cameraKeteranganInput').value = '';
}

// ---- Capture & Close ----

async function capturePhoto() {
  // Validasi keterangan inline jika tampil
  const ketSection = document.getElementById('cameraKeteranganSection');
  if (ketSection && ketSection.style.display !== 'none') {
    const ket = document.getElementById('cameraKeteranganInput').value.trim();
    if (!ket) {
      notify('⚠️', 'Isi keterangan/alasan terlebih dahulu sebelum mengambil foto!', 'orange');
      return;
    }
  }

  const video  = document.getElementById('videoEl');
  const canvas = document.getElementById('canvasEl');
  canvas.width  = video.videoWidth  || 320;
  canvas.height = video.videoHeight || 240;
  canvas.getContext('2d').drawImage(video, 0, 0);

  const snapBtn = document.getElementById('snapBtn');
  snapBtn.disabled = true; snapBtn.textContent = '⏳ Memproses...';
  const photoData = await compressPhoto(canvas);
  snapBtn.disabled = false; snapBtn.textContent = '📸 Ambil Foto';

  // Simpan ke variable yang benar sesuai mode
  if (isEmployeeMode) {
    empCapturedPhoto = photoData;
  } else {
    capturedPhoto = photoData;
  }

  document.getElementById('photoPreview').src = photoData;
  document.getElementById('photoPreview').style.display = 'block';
  document.getElementById('videoEl').style.display = 'none';
  document.getElementById('snapBtn').style.display = 'none';
  document.getElementById('confirmBtn').style.display = '';
}

function closeCamera() {
  if (videoStream) { videoStream.getTracks().forEach(t => t.stop()); videoStream = null; empVideoStream = null; }
  document.getElementById('cameraModal').style.display = 'none';
  const ketSection = document.getElementById('cameraKeteranganSection');
  if (ketSection) ketSection.style.display = 'none';
  const ketInput = document.getElementById('cameraKeteranganInput');
  if (ketInput) ketInput.value = '';
  // Reset variable foto sesuai mode
  if (isEmployeeMode) {
    empCapturedPhoto = null;
  } else {
    capturedPhoto = null;
  }
}
