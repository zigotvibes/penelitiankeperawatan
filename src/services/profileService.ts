import type { TablesInsert, TablesUpdate } from '../types/database'
import { requireSupabase, throwSupabaseError, withoutUndefined } from './supabaseService'

export async function getProfile(userId: string) {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  throwSupabaseError('membaca profil', error)
  if (!data) throw new Error('Profil Supabase tidak ditemukan.')
  return data
}

export async function getStudent(userId: string) {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .eq('role', 'SISWA')
    .single()
  throwSupabaseError('membaca profil siswa', error)
  if (!data) throw new Error('Profil siswa Supabase tidak ditemukan.')
  return data
}

export async function getStudents() {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('*')
    .eq('role', 'SISWA')
    .order('name')
  throwSupabaseError('membaca daftar siswa', error)
  return data ?? []
}

export async function updateProfile(userId: string, changes: TablesUpdate<'profiles'>) {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .update(withoutUndefined({ ...changes, updated_at: new Date().toISOString() }))
    .eq('id', userId)
    .select()
    .single()
  throwSupabaseError('memperbarui profil', error)
  if (!data) throw new Error('Profil Supabase gagal diperbarui.')
  return data
}

export async function ensureProfile(profile: TablesInsert<'profiles'>) {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .upsert(withoutUndefined(profile), { onConflict: 'id', ignoreDuplicates: true })
    .select()
    .single()
  throwSupabaseError('memastikan profil', error)
  if (!data) throw new Error('Profil Supabase gagal dibuat.')
  return data
}

export async function deleteProfile(userId: string) {
  const { error } = await requireSupabase().from('profiles').delete().eq('id', userId)
  throwSupabaseError('menghapus profil siswa', error)
}
