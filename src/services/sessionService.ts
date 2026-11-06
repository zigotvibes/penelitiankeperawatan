import type { TablesInsert, TablesUpdate } from '../types/database'
import { requireSupabase, throwSupabaseError, withoutUndefined } from './supabaseService'

export async function getLoginSessions(userId: string) {
  const { data, error } = await requireSupabase()
    .from('login_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('login_at', { ascending: false })
  throwSupabaseError('membaca sesi login', error)
  return data ?? []
}

export async function createLoginSession(session: TablesInsert<'login_sessions'>) {
  const { data, error } = await requireSupabase()
    .from('login_sessions')
    .insert(withoutUndefined(session))
    .select()
    .single()
  throwSupabaseError('membuat sesi login', error)
  if (!data) throw new Error('Sesi login Supabase gagal dibuat.')
  return data
}

export async function updateLoginSession(
  sessionId: string,
  changes: TablesUpdate<'login_sessions'>,
) {
  const { data, error } = await requireSupabase()
    .from('login_sessions')
    .update(withoutUndefined(changes))
    .eq('id', sessionId)
    .select()
    .single()
  throwSupabaseError('memperbarui sesi login', error)
  if (!data) throw new Error('Sesi login Supabase gagal diperbarui.')
  return data
}
export async function deleteLoginSessions(userId: string) {
  const { error } = await requireSupabase()
    .from('login_sessions')
    .delete()
    .eq('user_id', userId)

  throwSupabaseError('menghapus sesi login', error)
}