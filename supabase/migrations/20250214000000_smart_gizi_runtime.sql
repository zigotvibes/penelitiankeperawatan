create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('SISWA', 'DEVELOPER');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.test_kind as enum ('pre', 'post');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.session_status as enum ('active', 'completed', 'auto-ended');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.activity_type as enum (
    'LOGIN', 'LOGOUT',
    'MATERIAL_OPEN', 'MATERIAL_COMPLETED',
    'QUIZ_START', 'QUIZ_COMPLETED',
    'GAME_START', 'GAME_COMPLETED',
    'PRETEST_START', 'PRETEST_COMPLETED',
    'POSTTEST_START', 'POSTTEST_COMPLETED'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.audit_action as enum ('RESET_PROGRESS', 'DELETE_STUDENT');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  username text not null unique,
  role public.user_role not null default 'SISWA',
  kelas text not null default 'Kelas VI',
  sekolah text not null default 'SDN Kiaracondong 038',
  profile_photo text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.student_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  materi_dibuka integer[] not null default '{}',
  materi_selesai integer[] not null default '{}',
  kuis_selesai integer not null default 0,
  kuis_scores integer[] not null default '{}',
  kuis_timestamps timestamptz[] not null default '{}',
  game_dimainkan text[] not null default '{}',
  total_poin integer not null default 0,
  badge integer not null default 0,
  activities jsonb not null default '[]'::jsonb,
  quiz_answers jsonb not null default '[]'::jsonb,
  game_scores jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  jenis_test public.test_kind not null,
  skor integer not null,
  jumlah_benar integer not null,
  jumlah_salah integer not null,
  total_soal integer not null,
  jawaban integer[] not null,
  topik_detail jsonb not null,
  tanggal_pengerjaan date not null,
  waktu_pengerjaan timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz not null,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  constraint test_results_user_kind_key unique (user_id, jenis_test)
);

create table if not exists public.login_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  login_at timestamptz not null,
  logout_at timestamptz,
  last_activity_at timestamptz not null,
  duration_seconds integer not null default 0,
  timezone text not null,
  status public.session_status not null default 'active',
  created_at timestamptz not null default now(),
constraint login_sessions_id_user_id_key
  unique (id, user_id)
);

create table if not exists public.learning_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null,
  activity_type public.activity_type not null,
  activity_name text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_seconds integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
constraint activity_logs_session_owner_fkey
  foreign key (session_id, user_id)
  references public.login_sessions (id, user_id)
  on delete cascade
);

create table if not exists public.developer_audits (
  id uuid primary key default gen_random_uuid(),
  action public.audit_action not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  developer_user_id uuid not null references public.profiles(id) on delete restrict,
  timestamp timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists test_results_user_id_idx on public.test_results(user_id);
create index if not exists login_sessions_user_id_idx on public.login_sessions(user_id);
create index if not exists activity_logs_user_id_idx on public.learning_activity_logs(user_id);
create index if not exists activity_logs_session_id_idx on public.learning_activity_logs(session_id);
create index if not exists developer_audits_developer_id_idx on public.developer_audits(developer_user_id);

create or replace function public.ensure_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, name, username, role, kelas, sekolah, profile_photo
  ) values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), 'Pengguna'),
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), new.id::text),
    'SISWA'::public.user_role,
    coalesce(nullif(new.raw_user_meta_data ->> 'kelas', ''), 'Kelas VI'),
    coalesce(nullif(new.raw_user_meta_data ->> 'sekolah', ''), 'SDN Kiaracondong 038'),
    nullif(new.raw_user_meta_data ->> 'profile_photo', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.ensure_auth_profile();

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
