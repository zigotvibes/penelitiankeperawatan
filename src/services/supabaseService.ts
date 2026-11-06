import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export class SupabaseConfigurationError extends Error {
  constructor() {
    super(
      'Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY; mode lokal tetap aktif.',
    )
    this.name = 'SupabaseConfigurationError'
  }
}

export class SupabaseServiceError extends Error {
  readonly code?: string

  constructor(operation: string, cause: PostgrestError) {
    super(`Operasi Supabase "${operation}" gagal: ${cause.message}`)
    this.name = 'SupabaseServiceError'
    this.code = cause.code
  }
}

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) throw new SupabaseConfigurationError()
  return supabase
}

export function throwSupabaseError(operation: string, error: PostgrestError | null): void {
  if (error) throw new SupabaseServiceError(operation, error)
}

export function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => withoutUndefined(item)) as T
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, withoutUndefined(item)]),
    ) as T
  }
  return value
}
