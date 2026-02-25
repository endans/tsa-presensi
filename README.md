# 📋 TSA Presence — Sistem Absensi Digital

Sistem absensi digital berbasis web untuk **PT. Tujuh Sinar Abadi**, dilengkapi dengan fitur geolokasi, selfie, dan manajemen role (RBAC).

---

## 🚀 Fitur Utama

- **Login terpadu** — Admin via email, Karyawan via ID Karyawan
- **Absensi dengan selfie & GPS** — Validasi lokasi radius kantor
- **RBAC (Role-Based Access Control)** — 3 level akses: `main_admin`, `admin`, `employee`
- **Dashboard real-time** — Statistik kehadiran harian dengan Supabase Realtime
- **Rekap & Export** — Laporan absensi per periode
- **Manajemen Izin/Cuti/Sakit** — Pengajuan & persetujuan oleh admin
- **Manajemen Karyawan, Kantor, Divisi, Shift** — Khusus Main Admin

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend / Database | [Supabase](https://supabase.com) (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage (selfie photos) |
| Hosting | Static hosting (Netlify / Vercel / dll) |

---

## 👥 Role & Akses

| Role | Akses |
|------|-------|
| `main_admin` | Akses penuh — dashboard, absensi, rekap, laporan, persetujuan, karyawan, kantor, pengaturan |
| `admin` | Dashboard, absensi, rekap, laporan, persetujuan |
| `employee` | Portal karyawan — absensi mandiri, riwayat, izin, profil |

---

## 📁 Struktur Proyek

```
tsa-rbac/
├── index.html
├── config.js                    # Konfigurasi Supabase URL & Anon Key
├── schema.sql                   # Schema database lengkap (jalankan di Supabase)
├── assets/
│   ├── style.css
│   ├── logo.svg
│   └── logo-white.svg
└── js/
    ├── state.js                 # Global state variables
    ├── utils.js                 # Helper functions (notify, calcDuration, getDistance, dll)
    ├── services/
    │   ├── supabase.js          # Inisialisasi Supabase client
    │   ├── auth.js              # Login, logout, routing berdasarkan role
    │   └── data.js              # Fetch data dari Supabase
    ├── components/
    │   ├── navigation.js        # Sidebar, bottom nav, RBAC menu visibility
    │   ├── camera.js            # Kamera selfie (admin & karyawan)
    │   └── clock-geo.js         # Jam realtime & geolokasi
    └── pages/
        ├── admin-dashboard.js   # Dashboard & absensi admin
        ├── admin-employees.js   # Manajemen karyawan
        ├── admin-offices.js     # Manajemen kantor
        ├── admin-leave.js       # Persetujuan izin/cuti
        ├── admin-settings.js    # Pengaturan jam kerja, divisi, shift, user
        ├── admin-export.js      # Export laporan PDF/Excel
        └── employee-portal.js   # Portal karyawan
```

---

## ⚙️ Setup & Instalasi

### 1. Buat Project Supabase

1. Buat project baru di [supabase.com](https://supabase.com)
2. Catat **Project URL** dan **Anon Key** dari `Project Settings > API`

### 2. Setup Database

Jalankan `schema.sql` di **Supabase Dashboard → SQL Editor**:

```sql
-- Paste seluruh isi schema.sql lalu klik Run
```

File ini akan membuat semua tabel, trigger, index, dan RLS secara otomatis.

### 3. Buat Storage Bucket

Di **Supabase Dashboard → Storage → New Bucket**:
- Nama: `selfies`
- Public: ✅ Aktifkan

### 4. Konfigurasi Aplikasi

Edit file `config.js`:

```javascript
window.SUPABASE_URL  = 'https://xxxx.supabase.co';      // ganti dengan Project URL kamu
window.SUPABASE_ANON_KEY = 'eyJhbGci...';               // ganti dengan Anon Key kamu
```

### 5. Buat Akun Main Admin

Di **Supabase Dashboard → Authentication → Users → Add user**:
- Email: `it-support@tsa.org` (atau email lain yang dikonfigurasi di trigger)
- Password: sesuai keinginan
- Centang **Auto Confirm User**

Trigger database akan otomatis memberikan role `main_admin`.

> Jika gagal, jalankan query ini di SQL Editor:
> ```sql
> INSERT INTO public.profiles (id, email, nama, role)
> SELECT id, email, 'IT Support', 'main_admin'
> FROM auth.users WHERE email = 'it-support@tsa.org'
> ON CONFLICT (id) DO UPDATE SET role = 'main_admin';
> ```

### 6. Supabase Auth Settings

Di **Supabase Dashboard → Authentication → Settings**:
- ✅ Enable email signups: **ON**
- Confirm email: **OFF** (opsional, agar akun langsung aktif)

### 7. Deploy

Upload seluruh folder ke hosting statis:
- [Netlify](https://netlify.com) — drag & drop folder
- [Vercel](https://vercel.com) — connect ke GitHub repo
- Atau hosting statis lainnya

---

## 🔐 Cara Login

### Admin / Main Admin
- Gunakan **email** dan password Supabase Auth
- Contoh: `it-support@tsa.org`

### Karyawan
- Gunakan **ID Karyawan** (contoh: `EMP001`) dan password karyawan
- Password default: `123456` (bisa diubah oleh admin)

---

## 🗄️ Skema Database

| Tabel | Keterangan |
|-------|-----------|
| `profiles` | Role user (terhubung ke Supabase Auth) |
| `employees` | Data karyawan |
| `offices` | Data kantor & koordinat GPS |
| `divisions` | Daftar divisi |
| `shifts` | Jadwal shift kerja |
| `settings` | Jam masuk/keluar & toleransi global |
| `absensi` | Rekap kehadiran harian |
| `leave_requests` | Pengajuan izin/cuti/sakit |

Semua tabel dilindungi **Row Level Security (RLS)**.

---

## ⚠️ Catatan Penting

- **Password karyawan** saat ini disimpan sebagai plain text. Rencanakan migrasi ke hashing (pgcrypto) atau Supabase Auth untuk keamanan lebih baik di versi berikutnya.
- **Anon Key** aman untuk diexpose di frontend selama RLS sudah aktif di semua tabel.
- Absensi karyawan yang login via ID (tanpa Supabase Auth session) dilindungi di app layer — pastikan RLS `auth.uid() IS NULL` hanya digunakan jika diperlukan.

---

## 📞 Kontak

Untuk bantuan teknis, hubungi IT Support melalui WhatsApp atau email internal.
