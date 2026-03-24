// ============================================================
// KONFIGURASI SUPABASE
// Ganti nilai di bawah dengan kredensial project Supabase kamu
// Dapatkan dari: Supabase Dashboard > Project Settings > API
//
// Langkah:
//   1. Buka https://supabase.com/dashboard
//   2. Pilih project kamu
//   3. Klik Settings → API
//   4. Salin "Project URL" ke SUPABASE_URL
//   5. Salin "anon public" key ke SUPABASE_ANON_KEY
// ============================================================

window.SUPABASE_URL      = 'https://XXXXXXXXXXXXXXXXXXXX.supabase.co'; // ← ganti ini
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // ← ganti ini

// ============================================================
// VALIDASI — mencegah app berjalan dengan kredensial kosong
// ============================================================
(function validateConfig() {
  const urlOk  = window.SUPABASE_URL  && !window.SUPABASE_URL.includes('XXXXXXXXXXXXXXXXXXXX');
  const keyOk  = window.SUPABASE_ANON_KEY && window.SUPABASE_ANON_KEY.length > 100;

  if (!urlOk || !keyOk) {
    document.addEventListener('DOMContentLoaded', () => {
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) overlay.style.display = 'none';

      const body = document.body;
      const banner = document.createElement('div');
      banner.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:99999',
        'background:#1e293b', 'color:#f8fafc',
        'display:flex', 'flex-direction:column',
        'align-items:center', 'justify-content:center',
        'gap:16px', 'font-family:monospace', 'padding:32px',
        'text-align:center',
      ].join(';');
      banner.innerHTML = `
        <div style="font-size:48px">⚙️</div>
        <h2 style="margin:0;font-size:20px;color:#f87171">Konfigurasi Supabase Belum Diisi</h2>
        <p style="margin:0;max-width:480px;line-height:1.6;color:#94a3b8">
          Buka file <code style="background:#334155;padding:2px 6px;border-radius:4px">config.js</code>
          dan isi <strong>SUPABASE_URL</strong> serta <strong>SUPABASE_ANON_KEY</strong>
          dengan kredensial project Supabase kamu.
        </p>
        <a href="https://supabase.com/dashboard" target="_blank"
           style="background:#2563eb;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Buka Supabase Dashboard →
        </a>
      `;
      body.prepend(banner);
    });
  }
})();
