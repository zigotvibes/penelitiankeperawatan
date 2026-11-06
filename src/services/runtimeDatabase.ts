import {
  addLearningActivity as addLocalActivity,
  addLoginSession as addLocalSession,
  createEmptyProgress,
  deleteStudent as deleteLocalStudent,
  getCurrentUser as getLocalCurrentUser,
  getCurrentUserData as getLocalCurrentUserData,
  getStudentData as getLocalStudentData,
  getStudents as getLocalStudents,
  initializeLocalDatabase,
  login as loginLocally,
  logout as logoutLocally,
  registerStudent as registerLocally,
  resetStudentProgress as resetLocalStudent,
  saveProgress as saveLocalProgress,
  saveTest as saveLocalTest,
  updateLoginSession as updateLocalSession,
  updateProfile as updateLocalProfile,
  type ActivityRecord,
  type AppUser,
  type LearningActivityLog,
  type LoginSession,
  type StudentData,
  type TestResult,
  type TopikDetail,
  type UserProgress,
} from '../lib/localDatabase'
import { isSupabaseConfigured } from '../lib/supabase'
import type { Json, Tables } from '../types/database'
import { createActivityLog, getActivityLogs } from './activityService'
import { createAudit } from './auditService'
import {
  getAuthSession,
  registerWithUsername,
  signInWithUsername,
  signOutFromSupabase,
} from './authService'
import {
  deleteProfile,
  ensureProfile,
  getProfile,
  getStudents as getCloudStudents,
  updateProfile as updateCloudProfile,
} from './profileService'
import { deleteProgress, getProgress, saveProgress as saveCloudProgress } from './progressService'
import {
  createLoginSession,
  deleteLoginSessions,
  getLoginSessions,
  updateLoginSession as updateCloudSession,
} from './sessionService'
import {
  deleteTestResults,
  getTestResults,
  saveTestResult,
} from './testService'
import {
  SupabaseServiceError,
  requireSupabase,
  throwSupabaseError,
} from './supabaseService'

export type {
  ActivityRecord,
  ActivityType,
  AppUser,
  LearningActivityLog,
  LoginSession,
  SessionStatus,
  StudentData,
  TestResult,
  TopikDetail,
  UserProgress,
} from '../lib/localDatabase'

const school = 'SDN Kiaracondong 038'

function profileToUser(profile: Tables<'profiles'>): AppUser {
  return {
    userId: profile.id,
    name: profile.name,
    username: profile.username,
    role: profile.role,
    kelas: profile.kelas,
    sekolah: profile.sekolah,
    createdAt: profile.created_at,
    ...(profile.profile_photo ? { profilePhoto: profile.profile_photo } : {}),
    ...(profile.last_login_at ? { lastLoginAt: profile.last_login_at } : {}),
  }
}

function jsonValue(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json
}

function rowToProgress(row: Tables<'student_progress'> | null): UserProgress {
  if (!row) return createEmptyProgress()
  return {
    materiDibuka: row.materi_dibuka,
    materiSelesai: row.materi_selesai,
    kuisSelesai: row.kuis_selesai,
    kuisScores: row.kuis_scores,
    kuisTimestamps: row.kuis_timestamps,
    gameDimainkan: row.game_dimainkan,
    totalPoin: row.total_poin,
    badge: row.badge,
    activities: row.activities as unknown as ActivityRecord[],
    quizAnswers: row.quiz_answers as unknown as number[][],
    gameScores: row.game_scores as unknown as UserProgress['gameScores'],
  }
}

function progressInsert(userId: string, progress: UserProgress) {
  return {
    user_id: userId,
    materi_dibuka: progress.materiDibuka,
    materi_selesai: progress.materiSelesai,
    kuis_selesai: progress.kuisSelesai,
    kuis_scores: progress.kuisScores,
    kuis_timestamps: progress.kuisTimestamps,
    game_dimainkan: progress.gameDimainkan,
    total_poin: progress.totalPoin,
    badge: progress.badge,
    activities: jsonValue(progress.activities),
    quiz_answers: jsonValue(progress.quizAnswers),
    game_scores: jsonValue(progress.gameScores),
  }
}

function rowToTest(row: Tables<'test_results'>, name: string): TestResult {
  return {
    resultId: row.id,
    userId: row.user_id,
    namaSiswa: name,
    jenisTest: row.jenis_test,
    skor: row.skor,
    jumlahBenar: row.jumlah_benar,
    jumlahSalah: row.jumlah_salah,
    totalSoal: row.total_soal,
    jawaban: row.jawaban,
    tanggalPengerjaan: row.tanggal_pengerjaan,
    waktuPengerjaan: row.waktu_pengerjaan,
   ...(row.started_at ? { startedAt: row.started_at } : {}),
durationSeconds: row.duration_seconds,
topikDetail: row.topik_detail as unknown as Record<string, TopikDetail>,
  }
}

function rowToSession(row: Tables<'login_sessions'>, user: AppUser): LoginSession {
  const date = new Date(row.login_at)
  return {
    id: row.id,
    userId: row.user_id,
    username: user.username,
    name: user.name,
    role: 'SISWA',
    loginAt: row.login_at,
    logoutAt: row.logout_at,
    lastActivityAt: row.last_activity_at,
    durationSeconds: row.duration_seconds,
    durationFormatted: formatDuration(row.duration_seconds),
    date: localDateKey(date),
    day: date.toLocaleDateString('id-ID', { weekday: 'long' }),
    month: date.toLocaleDateString('id-ID', { month: 'long' }),
    year: date.getFullYear(),
    timezone: row.timezone,
    status: row.status,
  }
}

function rowToActivity(row: Tables<'learning_activity_logs'>): LearningActivityLog {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    activityType: row.activity_type,
    activityName: row.activity_name,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds,
    metadata: row.metadata as Record<string, string | number | boolean>,
  }
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (hours) parts.push(`${hours} jam`)
  if (minutes || !hours) parts.push(`${minutes} menit`)
  return parts.join(' ')
}

function localFallbackFor(user: AppUser): StudentData | null {
  const match = getLocalStudents().find(item =>
    item.user.username.trim().toLowerCase() === user.username.trim().toLowerCase(),
  )
  if (!match) return null
  return {
    ...match,
    user,
    tests: match.tests.map(test => ({ ...test, userId: user.userId, namaSiswa: user.name })),
    loginSessions: match.loginSessions.map(session => ({ ...session, userId: user.userId })),
    activityLogs: match.activityLogs.map(log => ({ ...log, userId: user.userId })),
  }
}

async function cloudStudentData(user: AppUser): Promise<StudentData> {
  const [progress, tests, sessions, activities] = await Promise.all([
    getProgress(user.userId),
    getTestResults(user.userId),
    getLoginSessions(user.userId),
    getActivityLogs(user.userId),
  ])
  const fallback = localFallbackFor(user)
  return {
    user,
    progress: progress ? rowToProgress(progress) : fallback?.progress ?? createEmptyProgress(),
    tests: tests.length ? tests.map(test => rowToTest(test, user.name)) : fallback?.tests ?? [],
    loginSessions: sessions.length
      ? sessions.map(session => rowToSession(session, user))
      : fallback?.loginSessions ?? [],
    activityLogs: activities.length
      ? activities.map(rowToActivity)
      : fallback?.activityLogs ?? [],
  }
}

async function profileFromAuth() {
  const session = await getAuthSession()
  if (!session) return null
  try {
    return profileToUser(await getProfile(session.user.id))
  } catch (error) {
    if (!(error instanceof SupabaseServiceError) || error.code !== 'PGRST116') throw error
    const metadata = session.user.user_metadata
    const text = (key: string, fallback: string) =>
      typeof metadata[key] === 'string' && metadata[key].trim() ? metadata[key].trim() : fallback
    const profile = await ensureProfile({
      id: session.user.id,
      name: text('name', 'Pengguna'),
      username: text('username', session.user.id),
      role: 'SISWA',
      kelas: text('kelas', 'Kelas VI'),
      sekolah: text('sekolah', school),
      profile_photo: typeof metadata.profile_photo === 'string' ? metadata.profile_photo : null,
    })
    return profileToUser(profile)
  }
}

export function initializeDatabase() {
  initializeLocalDatabase()
}

export async function restoreAuthenticatedUser() {
  if (!isSupabaseConfigured) return getLocalCurrentUser()
  return profileFromAuth()
}

export async function loginUser(username: string, password: string) {
  if (!isSupabaseConfigured) return loginLocally(username, password)
  let migratedProfilePhoto: string | undefined
  try {
    await signInWithUsername(username, password)
  } catch (cloudError) {
    let localUser: AppUser
    try {
      localUser = loginLocally(username, password)
      logoutLocally()
    } catch {
      throw cloudError
    }
    migratedProfilePhoto = localUser.profilePhoto
    await registerWithUsername({
      name: localUser.name,
      username: localUser.username,
      password,
      role: localUser.role,
      kelas: localUser.kelas,
      sekolah: localUser.sekolah,
      profilePhoto: localUser.profilePhoto,
    })
  }
  const user = await profileFromAuth()
  if (!user) throw new Error('Profil pengguna Supabase tidak ditemukan.')
  const updated = await updateCloudProfile(user.userId, {
    last_login_at: new Date().toISOString(),
    ...(migratedProfilePhoto ? { profile_photo: migratedProfilePhoto } : {}),
  })
  return profileToUser(updated)
}

export async function registerStudent(input: {
  name: string
  username: string
  password: string
  profilePhoto?: string
}) {
  if (!isSupabaseConfigured) return registerLocally(input)
  await registerWithUsername({
    ...input,
    role: 'SISWA',
    kelas: 'Kelas VI',
    sekolah: school,
  })
  const user = await profileFromAuth()
  if (!user) throw new Error('Profil siswa Supabase tidak ditemukan.')
  if (input.profilePhoto) {
    await updateCloudProfile(user.userId, { profile_photo: input.profilePhoto })
  }
  await saveCloudProgress(progressInsert(user.userId, createEmptyProgress()))
  return input.profilePhoto ? { ...user, profilePhoto: input.profilePhoto } : user
}

export async function getCurrentUserData(): Promise<StudentData> {
  if (!isSupabaseConfigured) return getLocalCurrentUserData()
  const user = await profileFromAuth()
  if (!user) throw new Error('Sesi Supabase tidak valid.')
  if (user.role === 'DEVELOPER') {
    return { user, progress: createEmptyProgress(), tests: [], loginSessions: [], activityLogs: [] }
  }
  return cloudStudentData(user)
}

export async function getStudents(): Promise<StudentData[]> {
  if (!isSupabaseConfigured) return getLocalStudents()
  const profiles = await getCloudStudents()
  return Promise.all(profiles.map(profile => cloudStudentData(profileToUser(profile))))
}

export async function updateProfile(user: AppUser) {
  if (!isSupabaseConfigured) return updateLocalProfile(user)
  return profileToUser(await updateCloudProfile(user.userId, {
    name: user.name.trim(),
    profile_photo: user.profilePhoto ?? null,
  }))
}

export async function saveProgress(userId: string, progress: UserProgress) {
  if (!isSupabaseConfigured) return saveLocalProgress(userId, progress)
  await saveCloudProgress(progressInsert(userId, progress))
}

export async function saveTest(result: TestResult, progress: UserProgress) {
  if (!isSupabaseConfigured) return saveLocalTest(result.userId, result, progress)
  const completedAt = result.waktuPengerjaan
 const saved = await saveTestResult({
  user_id: result.userId,
  jenis_test: result.jenisTest,
  skor: result.skor,
  jumlah_benar: result.jumlahBenar,
  jumlah_salah: result.jumlahSalah,
  total_soal: result.totalSoal,
  jawaban: result.jawaban,
  topik_detail: jsonValue(result.topikDetail),
  tanggal_pengerjaan: completedAt.slice(0, 10),
  waktu_pengerjaan: completedAt,
  started_at: result.startedAt ?? null,
  completed_at: completedAt,
  duration_seconds: result.durationSeconds ?? null,
})
  await saveCloudProgress(progressInsert(result.userId, progress))
  return [rowToTest(saved, result.namaSiswa)]
}

export async function addLoginSession(userId: string, session: LoginSession) {
  if (!isSupabaseConfigured) {
    addLocalSession(userId, session)
    return session
  }
  const saved = await createLoginSession({
    user_id: userId,
    login_at: session.loginAt,
    logout_at: session.logoutAt,
    last_activity_at: session.lastActivityAt,
    duration_seconds: session.durationSeconds,
    timezone: session.timezone,
    status: session.status,
  })
  return { ...session, id: saved.id }
}

export async function updateLoginSession(
  userId: string,
  sessionId: string,
  changes: Partial<LoginSession>,
) {
  if (!isSupabaseConfigured) return updateLocalSession(userId, sessionId, changes)
  await updateCloudSession(sessionId, {
    last_activity_at: changes.lastActivityAt,
    logout_at: changes.logoutAt,
    status: changes.status,
    duration_seconds: changes.durationSeconds,
  })
}

export async function addLearningActivity(userId: string, activity: LearningActivityLog) {
  if (!isSupabaseConfigured) return addLocalActivity(userId, activity)
  const saved = await createActivityLog({
    user_id: userId,
    session_id: activity.sessionId,
    activity_type: activity.activityType,
    activity_name: activity.activityName,
    started_at: activity.startedAt,
    completed_at: activity.completedAt,
    duration_seconds: activity.durationSeconds,
    metadata: jsonValue(activity.metadata ?? {}),
  })
  return { ...activity, id: saved.id }
}

export async function resetStudentProgress(userId: string, developerUserId: string) {
  if (!isSupabaseConfigured) return resetLocalStudent(userId, developerUserId)
  await createAudit({
    action: 'RESET_PROGRESS',
    target_user_id: userId,
    developer_user_id: developerUserId,
    metadata: {},
  })
  await Promise.all([
    saveCloudProgress(progressInsert(userId, createEmptyProgress())),
    deleteTestResults(userId),
  ])
}
export async function deleteLearningActivityLogs(userId: string) {
  const { error } = await requireSupabase()
    .from('learning_activity_logs')
    .delete()
    .eq('user_id', userId)

  throwSupabaseError('menghapus aktivitas belajar siswa', error)
}
export async function deleteStudent(
  userId: string,
  developerUserId: string,
) {
  if (!isSupabaseConfigured) {
    return deleteLocalStudent(userId, developerUserId)
  }

  // Pastikan akun yang sedang login sesuai dengan identitas developer.
  const session = await getAuthSession()

  if (!session?.user?.id) {
    throw new Error('Sesi login tidak ditemukan. Silakan login kembali.')
  }

  if (session.user.id !== developerUserId) {
    throw new Error('Identitas developer tidak sesuai dengan sesi login.')
  }

  // Penghapusan dilakukan oleh Edge Function di sisi server.
  // Server wajib memvalidasi role developer dan kepemilikan target.
  const { data: deleteResult, error: deleteError } =
    await requireSupabase().functions.invoke(
      'delete-student-account',
      {
        body: { userId },
      },
    )

  if (deleteError) {
    throw new Error(
      `Gagal menghapus akun siswa: ${deleteError.message}`,
    )
  }

  if (!deleteResult?.success) {
    throw new Error(
      deleteResult?.error ??
        'Penghapusan akun siswa gagal.',
    )
  }
}
export async function logout() {
  if (!isSupabaseConfigured) return logoutLocally()
  await signOutFromSupabase()
}

export async function getDeveloperIdentity() {
  if (!isSupabaseConfigured) return getLocalCurrentUser()
  return profileFromAuth()
}

export { createEmptyProgress, getLocalStudentData }
