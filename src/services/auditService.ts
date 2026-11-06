import type { TablesInsert } from '../types/database'
import { requireSupabase, throwSupabaseError, withoutUndefined } from './supabaseService'

export async function getAudits() {
  const { data, error } = await requireSupabase()
    .from('developer_audits')
    .select('*')
    .order('timestamp', { ascending: false })
  throwSupabaseError('membaca audit developer', error)
  return data ?? []
}


export async function createAudit(audit: TablesInsert<'developer_audits'>) {
  console.log('[DEBUG CREATE AUDIT]', audit)

  const { data, error } = await requireSupabase()
    .from('developer_audits')
    .insert(withoutUndefined(audit))
    .select()
    .single()

  throwSupabaseError('membuat audit developer', error)
  if (!data) throw new Error('Audit Supabase gagal disimpan.')
  return data
}
