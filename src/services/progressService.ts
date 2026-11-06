import type { TablesInsert } from '../types/database'
import { requireSupabase, throwSupabaseError, withoutUndefined } from './supabaseService'

export async function getProgress(userId: string) {
  const { data, error } = await requireSupabase()
    .from('student_progress')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  throwSupabaseError('membaca progres siswa', error)
  return data
}

export async function saveProgress(progress: TablesInsert<'student_progress'>) {
  const { data, error } = await requireSupabase()
    .from('student_progress')
    .upsert(withoutUndefined({ ...progress, updated_at: new Date().toISOString() }), { onConflict: 'user_id' })
    .select()
    .single()
  throwSupabaseError('menyimpan progres siswa', error)
  if (!data) throw new Error('Progres Supabase gagal disimpan.')
  return data
}

export async function deleteProgress(userId: string) {
  const { error } = await requireSupabase().from('student_progress').delete().eq('user_id', userId)
  throwSupabaseError('menghapus progres siswa', error)
}
