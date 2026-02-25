// ============================================================
// APPLICATION STATE
// Semua variabel state global dikumpulkan di satu tempat
// ============================================================

// ---- Auth & Role State ----
let currentUser    = null;
let currentProfile = null;
// Possible values: 'employee' | 'admin' | 'main_admin' | null
let currentRole    = null;
let employees      = [];
let offices        = [];
let absenRecords   = [];
let settings       = { jamMasuk:'08:00', jamKeluar:'17:00', toleransi:15 };
let currentAbsenType = 'masuk';
let capturedPhoto  = null;
let currentLocation = null;
let videoStream    = null;
let editingEmpId   = null;
let editingOfficeId = null;
let rekapMode      = 'harian';

// ---- Employee Portal State ----
let currentEmployee    = null;
let empAbsenRecords    = [];
let empCurrentLocation = null;
let empVideoStream     = null;
let empCapturedPhoto   = null;
let empCurrentAbsenType = 'masuk';
let isEmployeeMode     = false;

// ---- Keterangan Absen State ----
let pendingKeteranganType  = null;
let pendingAbsenIsEmployee = false;
let pendingAbsenCallback   = null;

// ---- Shift State ----
let shifts        = [];
let editingShiftId = null;

// ---- Division State ----
let divisions      = [];
let editingDivisiId = null;

// ---- Leave State ----
let leaveRequests      = [];
let empLeaveRequests   = [];
let selectedLeaveType  = 'Izin';
