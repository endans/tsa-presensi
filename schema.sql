-- ============================================================
-- TSA PRESENCE — RBAC SCHEMA (v3)
-- Supabase SQL Editor: jalankan seluruh file ini
-- Aman dijalankan ulang (idempotent) — tidak menghapus data
-- ============================================================


-- ============================================================
-- BAGIAN 1: ENUM & TABEL
-- ============================================================

-- ▸ 1. ENUM type untuk role
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('employee', 'admin', 'main_admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ▸ 2. Tabel profiles (terhubung ke auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE,
  nama        TEXT,
  role        user_role NOT NULL DEFAULT 'employee',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ▸ 3. Tambah kolom employee_password ke tabel employees (jika belum ada)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employee_password TEXT NOT NULL DEFAULT '123456';


-- ============================================================
-- BAGIAN 2: FUNCTIONS & TRIGGERS
-- ============================================================

-- ▸ 4. Trigger: otomatis buat profile saat user baru signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role user_role;
BEGIN
  -- it-support@tsa.org → main_admin, selain itu → employee
  -- (Main Admin akan upgrade role via UI Manajemen User)
  IF NEW.email = 'it-support@tsa.org' THEN
    assigned_role := 'main_admin';
  ELSE
    assigned_role := 'employee';
  END IF;

  INSERT INTO public.profiles (id, email, nama, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    assigned_role
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        nama  = COALESCE(EXCLUDED.nama, public.profiles.nama);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pasang trigger pada auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ▸ 5. Helper function: ambil role user saat ini (dipakai RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- BAGIAN 3: ROW LEVEL SECURITY (RLS)
-- ============================================================

-- ▸ 6. RLS — profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users: view own profile"       ON public.profiles;
DROP POLICY IF EXISTS "Admin: view all profiles"      ON public.profiles;
DROP POLICY IF EXISTS "Users: update own profile"     ON public.profiles;
DROP POLICY IF EXISTS "MainAdmin: update any profile" ON public.profiles;
DROP POLICY IF EXISTS "System: insert via trigger"    ON public.profiles;

-- Semua user bisa baca profil sendiri
CREATE POLICY "Users: view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Admin & Main Admin bisa lihat semua profil
CREATE POLICY "Admin: view all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() IN ('admin', 'main_admin'));

-- User bisa update profil sendiri (nama, avatar)
CREATE POLICY "Users: update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Hanya Main Admin yang bisa update role orang lain
CREATE POLICY "MainAdmin: update any profile"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'main_admin');

-- Trigger (SECURITY DEFINER) bisa insert profile baru
CREATE POLICY "System: insert via trigger"
  ON public.profiles FOR INSERT
  WITH CHECK (true);


-- ▸ 7. RLS — employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employee: view own data"     ON public.employees;
DROP POLICY IF EXISTS "Admin: manage employees"     ON public.employees;
DROP POLICY IF EXISTS "MainAdmin: manage employees" ON public.employees;
DROP POLICY IF EXISTS "Admin: update employees"     ON public.employees;

-- Employee hanya lihat data dirinya sendiri (via user_id jika login email)
-- anon = employee login via ID karyawan, dilindungi di app layer
CREATE POLICY "Employee: view own data"
  ON public.employees FOR SELECT
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR public.get_my_role() IN ('admin', 'main_admin')
    OR auth.uid() IS NULL  -- anon: employee login via ID karyawan
  );

-- Hanya Main Admin yang bisa INSERT / DELETE karyawan
CREATE POLICY "MainAdmin: manage employees"
  ON public.employees FOR ALL
  USING (public.get_my_role() = 'main_admin')
  WITH CHECK (public.get_my_role() = 'main_admin');

-- Admin (bukan main_admin) boleh UPDATE karyawan (misal nonaktifkan)
-- tapi tidak bisa INSERT atau DELETE
CREATE POLICY "Admin: update employees"
  ON public.employees FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'main_admin'))
  WITH CHECK (public.get_my_role() IN ('admin', 'main_admin'));


-- ▸ 8. RLS — offices
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone: view active offices" ON public.offices;
DROP POLICY IF EXISTS "MainAdmin: manage offices"   ON public.offices;

-- Semua user (termasuk anon) boleh baca offices — dibutuhkan saat employee absen
CREATE POLICY "Anyone: view active offices"
  ON public.offices FOR SELECT
  USING (true);

-- Hanya Main Admin yang bisa kelola kantor
CREATE POLICY "MainAdmin: manage offices"
  ON public.offices FOR ALL
  USING (public.get_my_role() = 'main_admin')
  WITH CHECK (public.get_my_role() = 'main_admin');


-- ▸ 9. RLS — absensi
ALTER TABLE public.absensi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employee: view own absen"   ON public.absensi;
DROP POLICY IF EXISTS "Employee: insert own absen" ON public.absensi;
DROP POLICY IF EXISTS "Employee: update own absen" ON public.absensi;
DROP POLICY IF EXISTS "Admin: manage absen"        ON public.absensi;

-- Employee bisa SELECT absensi dirinya
CREATE POLICY "Employee: view own absen"
  ON public.absensi FOR SELECT
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR public.get_my_role() IN ('admin', 'main_admin')
    OR auth.uid() IS NULL
  );

-- Employee bisa INSERT absensi dirinya (absen masuk)
CREATE POLICY "Employee: insert own absen"
  ON public.absensi FOR INSERT
  WITH CHECK (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR public.get_my_role() IN ('admin', 'main_admin')
    OR auth.uid() IS NULL
  );

-- Employee bisa UPDATE absensi dirinya (absen keluar)
CREATE POLICY "Employee: update own absen"
  ON public.absensi FOR UPDATE
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR public.get_my_role() IN ('admin', 'main_admin')
    OR auth.uid() IS NULL
  );

-- Admin bisa kelola semua absensi (INSERT, UPDATE, DELETE)
CREATE POLICY "Admin: manage absen"
  ON public.absensi FOR ALL
  USING (public.get_my_role() IN ('admin', 'main_admin'));


-- ▸ 10. RLS — leave_requests
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employee: view own leaves"   ON public.leave_requests;
DROP POLICY IF EXISTS "Employee: insert own leaves" ON public.leave_requests;
DROP POLICY IF EXISTS "Admin: manage leaves"        ON public.leave_requests;

-- Employee bisa lihat permohonan izin dirinya
CREATE POLICY "Employee: view own leaves"
  ON public.leave_requests FOR SELECT
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR public.get_my_role() IN ('admin', 'main_admin')
    OR auth.uid() IS NULL
  );

-- Employee bisa submit permohonan izin baru
CREATE POLICY "Employee: insert own leaves"
  ON public.leave_requests FOR INSERT
  WITH CHECK (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR public.get_my_role() IN ('admin', 'main_admin')
    OR auth.uid() IS NULL
  );

-- Admin bisa approve / reject / kelola semua leave request
CREATE POLICY "Admin: manage leaves"
  ON public.leave_requests FOR ALL
  USING (public.get_my_role() IN ('admin', 'main_admin'));


-- ▸ 11. RLS — settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone: view settings"      ON public.settings;
DROP POLICY IF EXISTS "MainAdmin: manage settings" ON public.settings;

-- Semua user boleh baca settings (jam masuk, jam keluar, toleransi)
CREATE POLICY "Anyone: view settings"
  ON public.settings FOR SELECT
  USING (true);

-- Hanya Main Admin yang bisa ubah settings
CREATE POLICY "MainAdmin: manage settings"
  ON public.settings FOR ALL
  USING (public.get_my_role() = 'main_admin')
  WITH CHECK (public.get_my_role() = 'main_admin');


-- ▸ 12. RLS — divisions
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone: view divisions"      ON public.divisions;
DROP POLICY IF EXISTS "MainAdmin: manage divisions" ON public.divisions;

CREATE POLICY "Anyone: view divisions"
  ON public.divisions FOR SELECT
  USING (true);

CREATE POLICY "MainAdmin: manage divisions"
  ON public.divisions FOR ALL
  USING (public.get_my_role() = 'main_admin')
  WITH CHECK (public.get_my_role() = 'main_admin');


-- ▸ 13. RLS — shifts
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone: view shifts"      ON public.shifts;
DROP POLICY IF EXISTS "MainAdmin: manage shifts" ON public.shifts;

CREATE POLICY "Anyone: view shifts"
  ON public.shifts FOR SELECT
  USING (true);

CREATE POLICY "MainAdmin: manage shifts"
  ON public.shifts FOR ALL
  USING (public.get_my_role() = 'main_admin')
  WITH CHECK (public.get_my_role() = 'main_admin');


-- ============================================================
-- BAGIAN 4: STORAGE POLICIES (bucket: selfies)
-- ============================================================
-- Jalankan ini HANYA jika bucket 'selfies' sudah dibuat di
-- Supabase Dashboard > Storage > Buckets

DROP POLICY IF EXISTS "Anyone: upload selfie" ON storage.objects;
CREATE POLICY "Anyone: upload selfie"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'selfies');

DROP POLICY IF EXISTS "Anyone: view selfie" ON storage.objects;
CREATE POLICY "Anyone: view selfie"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'selfies');

DROP POLICY IF EXISTS "Admin: delete selfie" ON storage.objects;
CREATE POLICY "Admin: delete selfie"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'selfies' AND public.get_my_role() IN ('admin', 'main_admin'));


-- ============================================================
-- BAGIAN 5: DATA AWAL
-- ============================================================

-- ▸ 14. Pastikan it-support@tsa.org jadi main_admin (jika sudah signup)
UPDATE public.profiles
SET role = 'main_admin'
WHERE email = 'it-support@tsa.org';


-- ============================================================
-- VERIFIKASI — cek status RLS semua tabel
-- Hasil query ini harus menunjukkan rls_enabled = true semua
-- ============================================================
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles','employees','offices','absensi','leave_requests','settings','divisions','shifts')
ORDER BY tablename;


-- ============================================================
-- CATATAN PENTING: Supabase Auth Settings
-- ============================================================
-- Agar Main Admin bisa membuat akun Admin baru via aplikasi,
-- pastikan di Supabase Dashboard > Authentication > Settings:
-- 1. "Enable email signups" = ON
-- 2. "Confirm email" = OFF (atau gunakan email konfirmasi sesuai kebutuhan)
--    Jika OFF, akun langsung aktif tanpa verifikasi email.
-- ============================================================
