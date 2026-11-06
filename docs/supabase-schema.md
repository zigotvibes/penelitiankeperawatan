# Schema dan Migrasi Runtime Supabase

Schema idempotent tersedia di
`supabase/migrations/20250214000000_smart_gizi_runtime.sql`. Migration tersebut
harus diterapkan pada project Supabase sebelum runtime cloud digunakan.
Komponen UI mengakses data melalui `src/services/runtimeDatabase.ts`, kemudian
service per domain, lalu Supabase.

`src/lib/localDatabase.ts` tetap dipertahankan sebagai fallback kompatibilitas.
Fallback hanya menjadi runtime utama jika Supabase tidak dikonfigurasi. Saat
Supabase aktif, data lokal hanya dipakai untuk melengkapi hasil baca cloud yang
belum mempunyai snapshot; write cloud yang gagal tidak dianggap berhasil.

## Konfigurasi frontend

- `VITE_SUPABASE_URL`: URL project Supabase.
- `VITE_SUPABASE_ANON_KEY`: public/anon key untuk browser.
- Jangan pernah menaruh `service_role` di frontend.
- Jika kedua variable belum tersedia, `src/lib/supabase.ts` mengekspor client
  `null`, service memberi error konfigurasi yang aman, dan aplikasi tetap lokal.

## Mapping model lokal

| Model lokal | Target Supabase |
| --- | --- |
| `AppUser` | `profiles` |
| `UserProgress` | `student_progress` |
| `TestResult` | `test_results` |
| `LoginSession` | `login_sessions` |
| `LearningActivityLog` | `learning_activity_logs` |
| `audit` | `developer_audits` |
| `StudentData` | Aggregate query, bukan tabel |

Konversi field mengikuti camelCase ke snake_case. Field tampilan turunan pada
`LoginSession` (`username`, `name`, `role`, `durationFormatted`, `date`, `day`,
`month`, dan `year`) dihitung dari profil/timestamp dan tidak diduplikasi.
`TestResult.namaSiswa` berasal dari `profiles.name`. Array object lokal seperti
`activities`, `quizAnswers`, `gameScores`, dan `topikDetail` disimpan sebagai
`jsonb`.

## Tabel

### `profiles`

Tujuan: profil aplikasi yang berpasangan satu-ke-satu dengan identitas Supabase
Auth.

| Kolom | Tipe PostgreSQL | Aturan |
| --- | --- | --- |
| `id` | `uuid` | PK, FK ke `auth.users.id` |
| `name` | `text` | wajib |
| `username` | `text` | wajib, unique |
| `role` | enum `user_role` | `SISWA` atau `DEVELOPER` |
| `kelas` | `text` | wajib |
| `sekolah` | `text` | wajib |
| `profile_photo` | `text` | nullable |
| `created_at` | `timestamptz` | default `now()` |
| `last_login_at` | `timestamptz` | nullable |
| `updated_at` | `timestamptz` | default `now()` |

### `student_progress`

Tujuan: satu snapshot progres untuk setiap siswa.

| Kolom | Tipe PostgreSQL | Aturan |
| --- | --- | --- |
| `user_id` | `uuid` | PK, FK ke `profiles.id` |
| `materi_dibuka` | `integer[]` | default `{}` |
| `materi_selesai` | `integer[]` | default `{}` |
| `kuis_selesai` | `integer` | default `0` |
| `kuis_scores` | `integer[]` | default `{}` |
| `kuis_timestamps` | `timestamptz[]` | default `{}` |
| `game_dimainkan` | `text[]` | default `{}` |
| `total_poin` | `integer` | default `0` |
| `badge` | `integer` | default `0` |
| `activities` | `jsonb` | default `[]` |
| `quiz_answers` | `jsonb` | default `[]` |
| `game_scores` | `jsonb` | default `[]` |
| `updated_at` | `timestamptz` | default `now()` |

`activities` dipertahankan agar migrasi `UserProgress` bersifat lossless,
meskipun log monitoring terstruktur tetap berada di
`learning_activity_logs`.

### `test_results`

Tujuan: hasil pre-test dan post-test beserta jawaban per soal.

| Kolom | Tipe PostgreSQL | Aturan |
| --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | FK ke `profiles.id` |
| `jenis_test` | enum `test_kind` | `pre` atau `post` |
| `skor` | `integer` | wajib |
| `jumlah_benar` | `integer` | wajib |
| `jumlah_salah` | `integer` | wajib |
| `total_soal` | `integer` | wajib |
| `jawaban` | `integer[]` | wajib |
| `topik_detail` | `jsonb` | wajib |
| `tanggal_pengerjaan` | `date` | wajib |
| `waktu_pengerjaan` | `timestamptz` | wajib |
| `started_at` | `timestamptz` | nullable |
| `completed_at` | `timestamptz` | wajib |
| `created_at` | `timestamptz` | default `now()` |

Untuk menyamai perilaku lokal yang menyimpan hasil terbaru per jenis, siapkan
unique constraint `(user_id, jenis_test)` pada tahap migrasi.

### `login_sessions`

Tujuan: durasi dan status sesi penggunaan siswa.

| Kolom | Tipe PostgreSQL | Aturan |
| --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | FK ke `profiles.id` |
| `login_at` | `timestamptz` | wajib |
| `logout_at` | `timestamptz` | nullable |
| `last_activity_at` | `timestamptz` | wajib |
| `duration_seconds` | `integer` | default `0` |
| `timezone` | `text` | wajib |
| `status` | enum `session_status` | `active`, `completed`, `auto-ended` |
| `created_at` | `timestamptz` | default `now()` |

### `learning_activity_logs`

Tujuan: event monitoring aktivitas belajar yang terkait dengan sesi.

| Kolom | Tipe PostgreSQL | Aturan |
| --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | FK ke `profiles.id` |
| `session_id` | `uuid` | FK ke `login_sessions.id` |
| `activity_type` | enum `activity_type` | lihat daftar di bawah |
| `activity_name` | `text` | wajib |
| `started_at` | `timestamptz` | wajib |
| `completed_at` | `timestamptz` | nullable |
| `duration_seconds` | `integer` | nullable |
| `metadata` | `jsonb` | default `{}` |
| `created_at` | `timestamptz` | default `now()` |

Nilai `activity_type`: `LOGIN`, `LOGOUT`, `MATERIAL_OPEN`,
`MATERIAL_COMPLETED`, `QUIZ_START`, `QUIZ_COMPLETED`, `GAME_START`,
`GAME_COMPLETED`, `PRETEST_START`, `PRETEST_COMPLETED`, `POSTTEST_START`,
dan `POSTTEST_COMPLETED`.

### `developer_audits`

Tujuan: jejak tindakan administratif yang dilakukan developer.

| Kolom | Tipe PostgreSQL | Aturan |
| --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `action` | enum `audit_action` | `RESET_PROGRESS` atau `DELETE_STUDENT` |
| `target_user_id` | `uuid` | nullable, FK ke `profiles.id`, `ON DELETE SET NULL` |
| `developer_user_id` | `uuid` | FK ke `profiles.id` |
| `timestamp` | `timestamptz` | default `now()` |
| `metadata` | `jsonb` | default `{}` |

Sebelum menghapus profil, identitas target yang perlu dipertahankan dapat
disalin ke `metadata`; FK target kemudian menjadi `null`.

## Relationship

```text
auth.users (1) ── (1) profiles
profiles (1) ── (0..1) student_progress
profiles (1) ── (0..n) test_results
profiles (1) ── (0..n) login_sessions
profiles (1) ── (0..n) learning_activity_logs
login_sessions (1) ── (0..n) learning_activity_logs
profiles (1) ── (0..n) developer_audits
```

`StudentData` adalah aggregate dari `profiles`, `student_progress`,
`test_results`, `login_sessions`, dan `learning_activity_logs`. Tidak ada dan
tidak boleh ada tabel `student_data`.

## Authentication

Login username dipetakan secara deterministik ke identitas email internal
Supabase Auth; password hanya dikirim ke Supabase Auth dan tidak disimpan pada
tabel aplikasi. Trigger `on_auth_user_created` memastikan setiap Auth user
memiliki satu profile, sedangkan service memakai upsert berbasis UUID untuk
menangani profile yang belum tersedia.

Akun prototype lokal yang berhasil diverifikasi dapat dibuat ke Supabase Auth
pada login pertamanya. Supabase **Confirm email** harus dinonaktifkan untuk
alur username-only ini karena alamat internal tidak menerima email. Akun baru
yang memerlukan konfirmasi akan mendapat pesan yang jelas dan tidak dianggap
sudah login.

## Batas keamanan tahap ini

RLS final, RPC administratif, Realtime, dan Edge Function belum diterapkan.
Penghapusan melalui frontend menghapus profile dan seluruh data relasional,
tetapi tidak dapat menghapus row `auth.users` tanpa operasi server berprivilege.
Penghapusan identitas Auth penuh harus diselesaikan melalui RPC/Edge Function
aman pada tahap security berikutnya; `service_role` tidak pernah digunakan di
frontend.
