# Smart Gizi — Deploy ke Netlify

## Build settings
- Build command: `npm run build`
- Publish directory: `dist`
- Node.js: 22 (disarankan)

Pengaturan build di atas sudah dicantumkan pada `netlify.toml`.

## Deploy manual
1. Ekstrak ZIP proyek ini ke komputer.
2. Buka folder proyek dan jalankan `npm install` (atau `pnpm install` jika menggunakan pnpm).
3. Jalankan `npm run build` untuk memeriksa hasil build. Hasil produksi dibuat di folder `dist`.
4. Di Netlify, pilih **Add new site → Deploy manually** dan unggah folder `dist` yang dihasilkan.

Alternatif: unggah ZIP proyek ke repositori GitHub, hubungkan repositori tersebut di Netlify, lalu gunakan build command `npm run build` dan publish directory `dist`. Netlify akan membaca `netlify.toml` secara otomatis.

## Konfigurasi Supabase
Jika aplikasi menggunakan Supabase, tambahkan environment variables di **Netlify → Site configuration → Environment variables**:
- `VITE_SUPABASE_URL` = URL proyek Supabase
- `VITE_SUPABASE_ANON_KEY` = publishable/anon key proyek Supabase

Setelah mengubah environment variables, jalankan deploy ulang. Jangan memasukkan `service_role` key ke aplikasi frontend atau ke ZIP yang dibagikan.

## Catatan
ZIP ini berisi source code proyek yang diekspor dari file Figma Make, bukan folder hasil build `dist`. Dependencies perlu dipasang dan proyek perlu dibuild terlebih dahulu sebelum deploy manual dengan mengunggah `dist`.
