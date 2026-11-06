import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { projectId, publicAnonKey } from '../../utils/supabase/info'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || (projectId ? `https://${projectId}.supabase.co` : '')
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || publicAnonKey

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const dataMode = isSupabaseConfigured ? 'supabase' : 'local'

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY belum tersedia. Aplikasi tetap menggunakan database lokal.',
  )
}

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
