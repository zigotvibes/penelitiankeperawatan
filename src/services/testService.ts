import type { TablesInsert } from '../types/database'
import { requireSupabase, throwSupabaseError, withoutUndefined } from './supabaseService'

export async function getTestResults(userId: string) {
  const { data, error } = await requireSupabase()
    .from('test_results')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
  throwSupabaseError('membaca hasil tes', error)
  return data ?? []
}

export async function saveTestResult(result: TablesInsert<'test_results'>) {
  const { data, error } = await requireSupabase()
    .from('test_results')
    .upsert(withoutUndefined(result), { onConflict: 'user_id,jenis_test' })
    .select()
    .single()
  throwSupabaseError('menyimpan hasil tes', error)
  if (!data) throw new Error('Hasil tes Supabase gagal disimpan.')
  return data
}

export async function deleteTestResults(userId: string) {
  const { error } = await requireSupabase().from('test_results').delete().eq('user_id', userId)
  throwSupabaseError('menghapus hasil tes', error)
}
