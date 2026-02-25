// ============================================================
// COMPONENT: CLOCK & GEOLOCATION
// Jam real-time dan GPS/geofence logic
// ============================================================

// ---- Admin Clock ----

function startClock() {
  function update() {
    const now = new Date();
    const t   = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(n => String(n).padStart(2,'0')).join(':');
    const el = document.getElementById('clockDisplay');
    if (el) el.textContent = t;
    const de = document.getElementById('dateDisplay');
    if (de) de.textContent = now.toLocaleDateString('id-ID',
      { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }
  update(); setInterval(update, 1000);
}

// ---- Employee Clock ----

function startEmpClock() {
  function update() {
    const now = new Date();
    const t   = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(n => String(n).padStart(2,'0')).join(':');
    const el = document.getElementById('empClock');
    if (el) el.textContent = t;
    const de = document.getElementById('empDateDisplay');
    if (de) de.textContent = now.toLocaleDateString('id-ID',
      { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }
  update(); setInterval(update, 1000);
}

// ---- Admin Geolocation ----

function getLocation() {
  if (!navigator.geolocation) { setLocationFallback(); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    currentLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    document.getElementById('locationCoords').textContent =
      `lat: ${currentLocation.lat.toFixed(5)}, lon: ${currentLocation.lon.toFixed(5)}`;
    updateGeofenceUI();
  }, () => setLocationFallback());
}

function setLocationFallback() {
  const ref = getSelectedOffice();
  currentLocation = ref
    ? { lat: parseFloat(ref.lat), lon: parseFloat(ref.lon) }
    : { lat: -6.2088, lon: 106.8456 };
  document.getElementById('locationAddr').textContent  = (ref?.alamat || 'Simulasi') + ' (simulasi)';
  document.getElementById('locationCoords').textContent =
    `lat: ${currentLocation.lat.toFixed(5)}, lon: ${currentLocation.lon.toFixed(5)}`;
  updateGeofenceUI();
}

function getSelectedOffice() {
  const id = document.getElementById('absenOffice')?.value;
  return offices.find(o => o.id === id) || null;
}

function onOfficeChange() {
  const off = getSelectedOffice();
  if (off) document.getElementById('locationAddr').textContent = `${off.nama} — ${off.alamat}`;
  updateGeofenceUI();
}

function onEmployeeChange() {
  const empId = document.getElementById('absenEmployee')?.value;
  const emp   = employees.find(e => e.id === empId);
  if (emp?.office_id) {
    document.getElementById('absenOffice').value = emp.office_id;
    onOfficeChange();
  }
}

function updateGeofenceUI() {
  const off = getSelectedOffice();
  if (!off || !currentLocation) {
    document.getElementById('geofenceStatus').textContent = '—'; return;
  }
  const dist = getDistance(currentLocation.lat, currentLocation.lon, parseFloat(off.lat), parseFloat(off.lon));
  const ok   = dist <= off.radius;
  document.getElementById('geofenceStatus').innerHTML = ok
    ? '<span style="color:#86efac;">✅ Dalam Area</span>'
    : `<span style="color:#fca5a5;">⚠️ Di Luar Area (${Math.round(dist)}m)</span>`;
}

// ---- Employee Geolocation ----

function getEmpLocation() {
  if (!navigator.geolocation) { setEmpLocationFallback(); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    empCurrentLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    document.getElementById('empLocationCoords').textContent =
      `lat: ${empCurrentLocation.lat.toFixed(5)}, lon: ${empCurrentLocation.lon.toFixed(5)}`;
    updateEmpGeofenceUI();
  }, () => setEmpLocationFallback());
}

function setEmpLocationFallback() {
  const off = currentEmployee?.offices;
  empCurrentLocation = off
    ? { lat: parseFloat(off.lat), lon: parseFloat(off.lon) }
    : { lat: -7.42, lon: 109.22 };
  document.getElementById('empLocationAddr').textContent = (off?.alamat || 'Lokasi kantor') + ' (simulasi)';
  document.getElementById('empLocationCoords').textContent =
    `lat: ${empCurrentLocation.lat.toFixed(5)}, lon: ${empCurrentLocation.lon.toFixed(5)}`;
  updateEmpGeofenceUI();
}

function updateEmpGeofenceUI() {
  const off = currentEmployee?.offices;
  if (!off || !empCurrentLocation) {
    document.getElementById('empGeofenceStatus').textContent = '—'; return;
  }
  const dist = getDistance(empCurrentLocation.lat, empCurrentLocation.lon, parseFloat(off.lat), parseFloat(off.lon));
  const ok   = dist <= off.radius;
  document.getElementById('empLocationAddr').textContent = `${off.nama} — ${off.alamat}`;
  document.getElementById('empGeofenceStatus').innerHTML = ok
    ? '<span class="geofence-ok">✅ Dalam Area</span>'
    : `<span class="geofence-fail">⚠️ Di Luar Area (${Math.round(dist)}m)</span>`;
}

// ---- Admin: ambil koordinat GPS untuk form kantor ----
function getMyLocation() {
  if (!navigator.geolocation) { notify('⚠️','GPS tidak tersedia','orange'); return; }
  notify('📡','Mengambil koordinat GPS...','blue');
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('officeLat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('officeLon').value = pos.coords.longitude.toFixed(6);
    notify('✅',`Koordinat ditemukan!`,'green');
  }, () => notify('❌','Gagal mendapatkan lokasi','red'));
}
