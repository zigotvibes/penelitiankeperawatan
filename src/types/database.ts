export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'SISWA' | 'DEVELOPER'
export type TestKind = 'pre' | 'post'
export type SessionStatus = 'active' | 'completed' | 'auto-ended'
export type ActivityType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'MATERIAL_OPEN'
  | 'MATERIAL_COMPLETED'
  | 'QUIZ_START'
  | 'QUIZ_COMPLETED'
  | 'GAME_START'
  | 'GAME_COMPLETED'
  | 'PRETEST_START'
  | 'PRETEST_COMPLETED'
  | 'POSTTEST_START'
  | 'POSTTEST_COMPLETED'
export type AuditAction = 'RESET_PROGRESS' | 'DELETE_STUDENT'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          username: string
          role: UserRole
          kelas: string
          sekolah: string
          profile_photo: string | null
          created_at: string
          last_login_at: string | null
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          username: string
          role: UserRole
          kelas: string
          sekolah: string
          profile_photo?: string | null
          created_at?: string
          last_login_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          username?: string
          role?: UserRole
          kelas?: string
          sekolah?: string
          profile_photo?: string | null
          created_at?: string
          last_login_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      student_progress: {
        Row: {
          user_id: string
          materi_dibuka: number[]
          materi_selesai: number[]
          kuis_selesai: number
          kuis_scores: number[]
          kuis_timestamps: string[]
          game_dimainkan: string[]
          total_poin: number
          badge: number
          activities: Json
          quiz_answers: Json
          game_scores: Json
          updated_at: string
        }
        Insert: {
          user_id: string
          materi_dibuka?: number[]
          materi_selesai?: number[]
          kuis_selesai?: number
          kuis_scores?: number[]
          kuis_timestamps?: string[]
          game_dimainkan?: string[]
          total_poin?: number
          badge?: number
          activities?: Json
          quiz_answers?: Json
          game_scores?: Json
          updated_at?: string
        }
        Update: {
          user_id?: string
          materi_dibuka?: number[]
          materi_selesai?: number[]
          kuis_selesai?: number
          kuis_scores?: number[]
          kuis_timestamps?: string[]
          game_dimainkan?: string[]
          total_poin?: number
          badge?: number
          activities?: Json
          quiz_answers?: Json
          game_scores?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'student_progress_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
test_results: {
  Row: {
    id: string
    user_id: string
    jenis_test: TestKind
    skor: number
    jumlah_benar: number
    jumlah_salah: number
    total_soal: number
    jawaban: number[]
    topik_detail: Json
    tanggal_pengerjaan: string
    waktu_pengerjaan: string
    started_at: string | null
    completed_at: string
    created_at: string
    duration_seconds: number | null
  }

  Insert: {
    id?: string
    user_id: string
    jenis_test: TestKind
    skor: number
    jumlah_benar: number
    jumlah_salah: number
    total_soal: number
    jawaban: number[]
    topik_detail: Json
    tanggal_pengerjaan: string
    waktu_pengerjaan: string
    started_at?: string | null
    completed_at: string
    created_at?: string
    duration_seconds?: number | null
  }

   Update: {
    id?: string
    user_id?: string
    jenis_test?: TestKind
    skor?: number
    jumlah_benar?: number
    jumlah_salah?: number
    total_soal?: number
    jawaban?: number[]
    topik_detail?: Json
    tanggal_pengerjaan?: string
    waktu_pengerjaan?: string
    started_at?: string | null
    completed_at?: string
    created_at?: string
    duration_seconds?: number | null
  },

  Relationships: [
    {
      foreignKeyName: 'test_results_user_id_fkey'
      columns: ['user_id']
      isOneToOne: false
      referencedRelation: 'profiles'
      referencedColumns: ['id']
    },
  ]
}
      login_sessions: {
        Row: {
          id: string
          user_id: string
          login_at: string
          logout_at: string | null
          last_activity_at: string
          duration_seconds: number
          timezone: string
          status: SessionStatus
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          login_at: string
          logout_at?: string | null
          last_activity_at: string
          duration_seconds?: number
          timezone: string
          status?: SessionStatus
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          login_at?: string
          logout_at?: string | null
          last_activity_at?: string
          duration_seconds?: number
          timezone?: string
          status?: SessionStatus
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'login_sessions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      learning_activity_logs: {
        Row: {
          id: string
          user_id: string
          session_id: string
          activity_type: ActivityType
          activity_name: string
          started_at: string
          completed_at: string | null
          duration_seconds: number | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_id: string
          activity_type: ActivityType
          activity_name: string
          started_at: string
          completed_at?: string | null
          duration_seconds?: number | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_id?: string
          activity_type?: ActivityType
          activity_name?: string
          started_at?: string
          completed_at?: string | null
          duration_seconds?: number | null
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'learning_activity_logs_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'learning_activity_logs_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'login_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      developer_audits: {
        Row: {
          id: string
          action: AuditAction
          target_user_id: string | null
          developer_user_id: string
          timestamp: string
          metadata: Json
        }
        Insert: {
          id?: string
          action: AuditAction
          target_user_id?: string | null
          developer_user_id: string
          timestamp?: string
          metadata?: Json
        }
        Update: {
          id?: string
          action?: AuditAction
          target_user_id?: string | null
          developer_user_id?: string
          timestamp?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'developer_audits_target_user_id_fkey'
            columns: ['target_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'developer_audits_developer_user_id_fkey'
            columns: ['developer_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      test_kind: TestKind
      session_status: SessionStatus
      activity_type: ActivityType
      audit_action: AuditAction
    }
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export interface StudentAggregate {
  profile: Tables<'profiles'>
  progress: Tables<'student_progress'> | null
  tests: Tables<'test_results'>[]
  loginSessions: Tables<'login_sessions'>[]
  activityLogs: Tables<'learning_activity_logs'>[]
}
