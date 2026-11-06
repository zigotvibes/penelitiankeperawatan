export type UserRole = 'SISWA' | 'DEVELOPER'

export interface AppUser {
  userId: string
  name: string
  username: string
  password?: string
  role: UserRole
  kelas: string
  sekolah: string
  createdAt: string
  profilePhoto?: string
  lastLoginAt?: string
}

export interface ActivityRecord {
  type: 'materi' | 'kuis' | 'game' | 'pretest' | 'posttest' | 'login'
  label: string
  timestamp: string
  score?: number
}

export type SessionStatus = 'active' | 'completed' | 'auto-ended'
export type ActivityType =
  | 'LOGIN' | 'LOGOUT'
  | 'MATERIAL_OPEN' | 'MATERIAL_COMPLETED'
  | 'QUIZ_START' | 'QUIZ_COMPLETED'
  | 'GAME_START' | 'GAME_COMPLETED'
  | 'PRETEST_START' | 'PRETEST_COMPLETED'
  | 'POSTTEST_START' | 'POSTTEST_COMPLETED'

export interface LoginSession {
  id: string
  userId: string
  username: string
  name: string
  role: 'SISWA'
  loginAt: string
  logoutAt: string | null
  lastActivityAt: string
  durationSeconds: number
  durationFormatted: string
  date: string
  day: string
  month: string
  year: number
  timezone: string
  status: SessionStatus
}

export interface LearningActivityLog {
  id: string
  userId: string
  sessionId: string
  activityType: ActivityType
  activityName: string
  startedAt: string
  completedAt: string | null
  durationSeconds: number | null
  metadata?: Record<string, string | number | boolean>
}

export interface UserProgress {
  materiDibuka: number[]
  materiSelesai: number[]
  kuisSelesai: number
  kuisScores: number[]
  kuisTimestamps: string[]
  gameDimainkan: string[]
  totalPoin: number
  badge: number
  activities: ActivityRecord[]
  quizAnswers: number[][]
  gameScores: { gameId: string; score: number; status: 'selesai'; timestamp: string }[]
}

export interface TopikDetail {
  benar: number
  total: number
  pct: number
}

export interface TestResult {
  resultId: string
  userId: string
  namaSiswa: string
  jenisTest: 'pre' | 'post'
  skor: number
  jumlahBenar: number
  jumlahSalah: number
  totalSoal: number
  jawaban: number[]
  tanggalPengerjaan: string
  waktuPengerjaan: string
  startedAt?: string
durationSeconds?: number | null
topikDetail: Record<string, TopikDetail>
}

export interface StudentData {
  user: AppUser
  progress: UserProgress
  tests: TestResult[]
  loginSessions: LoginSession[]
  activityLogs: LearningActivityLog[]
}

interface LocalAccount extends AppUser {
  password: string
}

interface LocalDatabase {
  version: 1
  users: LocalAccount[]
  students: Record<string, Omit<StudentData, 'user'>>
  audits: {
    id: string
    action: 'RESET_PROGRESS' | 'DELETE_STUDENT'
    targetUserId: string
    developerUserId: string
    timestamp: string
  }[]
}

interface LocalSession {
  userId: string
  createdAt: string
}

const DATABASE_KEY = 'smart_gizi_local_database'
const SESSION_KEY = 'prototype_session'
const SEED_DATE = '2025-01-01T00:00:00.000Z'
let memoryDatabase: LocalDatabase | null = null
let memorySession: LocalSession | null = null

export function createEmptyProgress(): UserProgress {
  return {
    materiDibuka: [],
    materiSelesai: [],
    kuisSelesai: 0,
    kuisScores: [],
    kuisTimestamps: [],
    gameDimainkan: [],
    totalPoin: 0,
    badge: 0,
    activities: [],
    quizAnswers: [],
    gameScores: [],
  }
}

function seedDatabase(): LocalDatabase {
  const student: LocalAccount = {
    userId: 'student-gwansik',
    name: 'gwansik',
    username: 'gwansik',
    password: 'greenflag',
    role: 'SISWA',
    kelas: 'Kelas VI',
    sekolah: 'SDN Kiaracondong 038',
    createdAt: SEED_DATE,
  }
  const developer: LocalAccount = {
    userId: 'developer-muhammad-syamil',
    name: 'Muhammad Syamil',
    username: 'Muhammad Syamil',
    password: 'shitpeople3000',
    role: 'DEVELOPER',
    kelas: '-',
    sekolah: 'SDN Kiaracondong 038',
    createdAt: SEED_DATE,
  }
  return {
    version: 1,
    users: [student, developer],
    students: {
      [student.userId]: {
        progress: createEmptyProgress(),
        tests: [],
        loginSessions: [],
        activityLogs: [],
      },
    },
    audits: [],
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function storageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function persistDatabase(database: LocalDatabase) {
  const safeDatabase = clone(database)
  memoryDatabase = safeDatabase
  if (!storageAvailable()) return
  try {
    window.localStorage.setItem(DATABASE_KEY, JSON.stringify(safeDatabase))
  } catch {
    // Memory persistence keeps the prototype usable when browser storage is unavailable or full.
  }
}

function isDatabase(value: unknown): value is LocalDatabase {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<LocalDatabase>
  return candidate.version === 1
    && Array.isArray(candidate.users)
    && Boolean(candidate.students)
    && typeof candidate.students === 'object'
    && Array.isArray(candidate.audits)
}

function readDatabase(): LocalDatabase {
  if (storageAvailable()) {
    try {
      const raw = window.localStorage.getItem(DATABASE_KEY)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isDatabase(parsed)) {
          memoryDatabase = parsed
          return clone(parsed)
        }
      }
    } catch {
      // Corrupt storage is replaced by the permanent local seed below.
    }
  }
  if (memoryDatabase && isDatabase(memoryDatabase)) return clone(memoryDatabase)
  const seeded = seedDatabase()
  persistDatabase(seeded)
  return clone(seeded)
}

function publicUser(account: LocalAccount): AppUser {
  const { password: _password, ...user } = account
  return clone(user)
}

function requireStudent(database: LocalDatabase, userId: string) {
  const student = database.students[userId]
  if (!student) throw new Error('Data siswa tidak ditemukan.')
  return student
}

function writeSession(session: LocalSession | null) {
  memorySession = session ? clone(session) : null
  if (!storageAvailable()) return
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // Authentication remains available in memory when localStorage cannot be written.
  }
}

function readSession(): LocalSession | null {
  if (storageAvailable()) {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<LocalSession>
        if (typeof parsed.userId === 'string' && typeof parsed.createdAt === 'string') {
          memorySession = parsed as LocalSession
          return clone(memorySession)
        }
      }
    } catch {
      try {
        window.localStorage.removeItem(SESSION_KEY)
      } catch {
        // Ignore storage cleanup failures.
      }
    }
  }
  return memorySession ? clone(memorySession) : null
}

export function initializeLocalDatabase() {
  return readDatabase()
}

export const localDB = {
  get<K extends keyof LocalDatabase>(key: K): LocalDatabase[K] {
    return clone(readDatabase()[key])
  },
  set<K extends keyof LocalDatabase>(key: K, value: LocalDatabase[K]) {
    if (value === undefined || value === null) return false
    const database = readDatabase()
    database[key] = clone(value)
    persistDatabase(database)
    return true
  },
  update(updater: (database: LocalDatabase) => LocalDatabase | void) {
    const database = readDatabase()
    const updated = updater(database) || database
    if (!isDatabase(updated)) return false
    persistDatabase(updated)
    return true
  },
  remove<K extends keyof LocalDatabase>(key: K) {
    const database = readDatabase()
    database[key] = clone(seedDatabase()[key])
    persistDatabase(database)
  },
  reset: resetLocalDatabase,
  seed: initializeLocalDatabase,
}

export function resetLocalDatabase() {
  if (storageAvailable()) {
    try {
      window.localStorage.removeItem(DATABASE_KEY)
      window.localStorage.removeItem(SESSION_KEY)
    } catch {
      // The in-memory reset below still succeeds.
    }
  }
  memorySession = null
  const seeded = seedDatabase()
  persistDatabase(seeded)
  return clone(seeded)
}

export function getCurrentUser(): AppUser | null {
  const session = readSession()
  if (!session) return null
  const account = readDatabase().users.find(user => user.userId === session.userId)
  if (!account) {
    writeSession(null)
    return null
  }
  return publicUser(account)
}

export function isAuthenticated() {
  return getCurrentUser() !== null
}

export function login(username: string, password: string): AppUser {
  const normalized = username.trim().toLowerCase()
  const database = readDatabase()
  const account = database.users.find(user =>
    user.username.trim().toLowerCase() === normalized && user.password === password,
  )
  if (!account) throw new Error('Nama pengguna atau kata sandi salah.')
  account.lastLoginAt = new Date().toISOString()
  persistDatabase(database)
  writeSession({ userId: account.userId, createdAt: account.lastLoginAt })
  return publicUser(account)
}

export function logout() {
  writeSession(null)
}

export function registerStudent(input: { name: string; username: string; password: string; profilePhoto?: string }) {
  const database = readDatabase()
  const normalized = input.username.trim().toLowerCase()
  if (database.users.some(user => user.username.trim().toLowerCase() === normalized)) {
    throw new Error('Username/NISN sudah terdaftar.')
  }
  const now = new Date().toISOString()
  const account: LocalAccount = {
    userId: `student_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: input.name.trim(),
    username: input.username.trim(),
    password: input.password,
    role: 'SISWA',
    kelas: 'Kelas VI',
    sekolah: 'SDN Kiaracondong 038',
    createdAt: now,
    ...(input.profilePhoto ? { profilePhoto: input.profilePhoto } : {}),
  }
  database.users.push(account)
  database.students[account.userId] = {
    progress: createEmptyProgress(),
    tests: [],
    loginSessions: [],
    activityLogs: [],
  }
  persistDatabase(database)
  writeSession({ userId: account.userId, createdAt: now })
  return publicUser(account)
}

export function getStudentData(userId: string): StudentData {
  const database = readDatabase()
  const account = database.users.find(user => user.userId === userId && user.role === 'SISWA')
  if (!account) throw new Error('Siswa tidak ditemukan.')
  const student = requireStudent(database, userId)
  return { user: publicUser(account), ...clone(student) }
}

export function getCurrentUserData(): StudentData {
  const user = getCurrentUser()
  if (!user) throw new Error('Sesi tidak valid.')
  if (user.role === 'DEVELOPER') {
    return {
      user,
      progress: createEmptyProgress(),
      tests: [],
      loginSessions: [],
      activityLogs: [],
    }
  }
  return getStudentData(user.userId)
}

export function getStudents() {
  const database = readDatabase()
  return database.users
    .filter(account => account.role === 'SISWA')
    .map(account => ({
      user: publicUser(account),
      ...clone(database.students[account.userId] || {
        progress: createEmptyProgress(),
        tests: [],
        loginSessions: [],
        activityLogs: [],
      }),
    }))
}

export function updateProfile(user: AppUser) {
  const database = readDatabase()
  const account = database.users.find(item => item.userId === user.userId)
  if (!account) throw new Error('Akun tidak ditemukan.')
  account.name = user.name.trim() || account.name
  if (typeof user.profilePhoto === 'string') account.profilePhoto = user.profilePhoto
  persistDatabase(database)
  return publicUser(account)
}

export function saveProgress(userId: string, progress: UserProgress) {
  const database = readDatabase()
  requireStudent(database, userId).progress = clone(progress)
  persistDatabase(database)
}

export function saveTest(userId: string, result: TestResult, progress: UserProgress) {
  const database = readDatabase()
  const student = requireStudent(database, userId)
  student.tests = [...student.tests.filter(item => item.jenisTest !== result.jenisTest), clone(result)]
  student.progress = clone(progress)
  persistDatabase(database)
  return clone(student.tests)
}

export function addLoginSession(userId: string, session: LoginSession) {
  const database = readDatabase()
  requireStudent(database, userId).loginSessions.push(clone(session))
  persistDatabase(database)
}

export function updateLoginSession(userId: string, sessionId: string, changes: Partial<LoginSession>) {
  const database = readDatabase()
  const student = requireStudent(database, userId)
  const index = student.loginSessions.findIndex(session => session.id === sessionId)
  if (index < 0) throw new Error('Sesi tidak ditemukan.')
  student.loginSessions[index] = {
    ...student.loginSessions[index],
    ...clone(changes),
    id: sessionId,
    userId,
  }
  persistDatabase(database)
}

export function addLearningActivity(userId: string, activity: LearningActivityLog) {
  const database = readDatabase()
  requireStudent(database, userId).activityLogs.push(clone(activity))
  persistDatabase(database)
}

export function resetStudentProgress(userId: string, developerUserId: string) {
  const database = readDatabase()
  const student = requireStudent(database, userId)
  student.progress = createEmptyProgress()
  student.tests = []
  database.audits.push({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    action: 'RESET_PROGRESS',
    targetUserId: userId,
    developerUserId,
    timestamp: new Date().toISOString(),
  })
  persistDatabase(database)
}

export function deleteStudent(userId: string, developerUserId: string) {
  const database = readDatabase()
  const account = database.users.find(user => user.userId === userId)
  if (!account || account.role !== 'SISWA') throw new Error('Siswa tidak ditemukan.')
  database.users = database.users.filter(user => user.userId !== userId)
  delete database.students[userId]
  database.audits.push({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    action: 'DELETE_STUDENT',
    targetUserId: userId,
    developerUserId,
    timestamp: new Date().toISOString(),
  })
  persistDatabase(database)
}
