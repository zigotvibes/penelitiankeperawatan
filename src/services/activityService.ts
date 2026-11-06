import type { TablesInsert } from '../types/database'
import { requireSupabase, throwSupabaseError, withoutUndefined } from './supabaseService'

export async function getActivityLogs(userId: string) {
  const { data, error } = await requireSupabase()
    .from('learning_activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
  throwSupabaseError('membaca aktivitas belajar', error)
  return data ?? []
}

export async function createActivityLog(activity: TablesInsert<'learning_activity_logs'>) {
  const { data, error } = await requireSupabase()
    .from('learning_activity_logs')
    .insert(withoutUndefined(activity))
    .select()
    .single()
  throwSupabaseError('membuat aktivitas belajar', error)
  if (!data) throw new Error('Aktivitas Supabase gagal disimpan.')
  return data
}
