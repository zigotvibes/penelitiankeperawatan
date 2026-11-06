import { useState, useEffect, useRef, useCallback } from 'react'
import { allQuestions } from './data/questions'
import { submitTestToServer } from "./lib/services/submitTestService";
import { materials, type Material } from './data/materials'
import {
  addLearningActivity,
  addLoginSession,
  createEmptyProgress,
  deleteStudent,
  getDeveloperIdentity,
  getCurrentUserData,
  getStudents,
  initializeDatabase,
  loginUser,
  logout,
  registerStudent,
  restoreAuthenticatedUser,
  resetStudentProgress,
  saveProgress,
  saveTest,
  updateLoginSession,
  updateProfile,
  type ActivityRecord,
  type ActivityType,
  type AppUser,
  type LearningActivityLog,
  type LoginSession,
  type SessionStatus,
  type StudentData,
  type TestResult,
  type TopikDetail,
  type UserProgress,
} from './services/runtimeDatabase'

// ─── Types ────────────────────────────────────────────────────────────────────
type AppPhase = 'loading' | 'splash' | 'login' | 'app'

type Screen =
  | 'home'
  | 'materi'
  | 'materiDetail'
  | 'kuis'
  | 'game'
  | 'hasil'
  | 'profil'
  | 'pretest'
  | 'posttest'
  | 'testResult'

type TestMode = 'pre' | 'post'

function emptyProgress(): UserProgress {
  return createEmptyProgress()
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDuration(totalSeconds: number, withSeconds = false) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  const parts: string[] = []
  if (hours) parts.push(`${hours} jam`)
  if (minutes || (!hours && !withSeconds)) parts.push(`${minutes} menit`)
  if (withSeconds && (remainder || parts.length === 0)) parts.push(`${remainder} detik`)
  return parts.join(' ')
}

type StudentDashboardData = StudentData & {
  pre: TestResult | null
  post: TestResult | null
}

function normalizeStudentData(data: Partial<StudentData> & { user: AppUser }): StudentData {
  return {
    user: data.user,
    progress: { ...emptyProgress(), ...(data.progress || {}) },
    tests: data.tests || [],
    loginSessions: data.loginSessions || [],
    activityLogs: data.activityLogs || [],
  }
}

function toStudentDashboard(data: StudentData): StudentDashboardData {
  return {
    ...data,
    pre: data.tests.find(result => result.jenisTest === 'pre') || null,
    post: data.tests.find(result => result.jenisTest === 'post') || null,
  }
}

async function localLogin(username: string, password: string) {
  return loginUser(username, password)
}

async function localRegister(input: { name: string; username: string; password: string; profilePhoto?: string }) {
  return registerStudent(input)
}

async function localGetMe() {
  return normalizeStudentData(await getCurrentUserData())
}

async function localGetStudents() {
  return (await getStudents()).map(normalizeStudentData)
}

async function localUpdateProfile(user: AppUser) {
  return updateProfile(user)
}

async function localSaveProgress(userId: string, progress: UserProgress) {
  saveProgress(userId, progress)
}

async function localSaveTest(result: TestResult, progress: UserProgress) {
  return saveTest(result, progress)
}

async function localResetStudent(userId: string) {
  const developer = await getDeveloperIdentity()
  if (!developer || developer.role !== 'DEVELOPER') throw new Error('Akses ditolak.')
  await resetStudentProgress(userId, developer.userId)
}

async function localDeleteStudent(userId: string) {
  const developer = await getDeveloperIdentity()
  if (!developer || developer.role !== 'DEVELOPER') throw new Error('Akses ditolak.')
  await deleteStudent(userId, developer.userId)
}

async function dbStartLoginSession(user: AppUser): Promise<LoginSession | null> {
  if (user.role !== 'SISWA') return null
  const now = new Date()
  const iso = now.toISOString()
  const session: LoginSession = {
    id: makeId('session'),
    userId: user.userId,
    username: user.username,
    name: user.name,
    role: 'SISWA',
    loginAt: iso,
    logoutAt: null,
    lastActivityAt: iso,
    durationSeconds: 0,
    durationFormatted: '0 menit',
    date: localDateKey(now),
    day: now.toLocaleDateString('id-ID', { weekday: 'long' }),
    month: now.toLocaleDateString('id-ID', { month: 'long' }),
    year: now.getFullYear(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local',
    status: 'active',
  }
  const savedSession = await addLoginSession(user.userId, session)
  await dbAddActivity(user.userId, savedSession.id, 'LOGIN', 'Login ke aplikasi', iso)
  return savedSession
}

async function dbUpdateLoginSession(userId: string, sessionId: string, loginAt: string, status: SessionStatus, endedAt = new Date(), keepalive = false) {
  const end = endedAt.toISOString()
  const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - new Date(loginAt).getTime()) / 1000))
  await updateLoginSession(userId, sessionId, {
    lastActivityAt: end,
    logoutAt: status === 'active' ? null : end,
    status,
    durationSeconds,
    durationFormatted: formatDuration(durationSeconds),
  })
}

async function dbEndLoginSession(userId: string, sessionId: string, loginAt: string, automatic = false, keepalive = false) {
  const now = new Date()
  await dbUpdateLoginSession(userId, sessionId, loginAt, automatic ? 'auto-ended' : 'completed', now, keepalive)
  await dbAddActivity(userId, sessionId, 'LOGOUT', automatic ? 'Sesi berakhir otomatis' : 'Logout dari aplikasi', now.toISOString(), undefined, keepalive)
}

async function dbAddActivity(
  userId: string,
  sessionId: string,
  activityType: ActivityType,
  activityName: string,
  at = new Date().toISOString(),
  metadata?: Record<string, string | number | boolean>,
  keepalive = false,
) {
  const log: LearningActivityLog = {
    id: makeId('activity'),
    userId,
    sessionId,
    activityType,
    activityName,
    startedAt: at,
    completedAt: activityType.endsWith('COMPLETED') || activityType === 'LOGIN' || activityType === 'LOGOUT' ? at : null,
    durationSeconds: null,
    metadata,
  }
  await addLearningActivity(userId, log)
}

// ─── Utilities ─────────────────────────────────────────────────────────────────
function fmtDate(d: Date) {
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}
function fmtLongDate(d: Date) {
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
function fmtTimeSeconds(d: Date) {
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function fmtDateTime(iso: string) {
  const d = new Date(iso); return `${fmtDate(d)}, ${fmtTime(d)}`
}
function fmtLongDateTime(iso: string) {
  const d = new Date(iso); return `${fmtLongDate(d)} • ${fmtTime(d)}`
}

function sessionDuration(session: LoginSession, now = Date.now()) {
  const end = session.status === 'active' ? now : new Date(session.logoutAt || session.lastActivityAt).getTime()
  return Math.max(0, Math.floor((end - new Date(session.loginAt).getTime()) / 1000))
}

function isSessionActive(session: LoginSession, now = Date.now()) {
  return session.status === 'active' && now - new Date(session.lastActivityAt).getTime() < 90_000
}

function computeOverallProgress(progress: UserProgress, tests: TestResult[]): number {
  const mPct = Math.round((progress.materiSelesai.length / materials.length) * 20)
  const kPct = progress.kuisSelesai > 0 ? 20 : 0
  const distinctGames = new Set(progress.gameDimainkan.map(item => item.split('_')[0])).size
  const gPct = Math.round(Math.min(distinctGames / 3, 1) * 20)
  const prePct = tests.find(t => t.jenisTest === 'pre') ? 10 : 0
  const postPct = tests.find(t => t.jenisTest === 'post') ? 30 : 0
  return Math.min(100, mPct + kPct + gPct + prePct + postPct)
}

function addActivity(progress: UserProgress, activity: ActivityRecord): ActivityRecord[] {
  return [activity, ...(progress.activities || [])].slice(0, 50)
}

function computeTopikDetail(answers: number[]): Record<string, TopikDetail> {
  const topics = [...new Set(allQuestions.map(q => q.topic))]
  const detail: Record<string, TopikDetail> = {}
  topics.forEach(topic => {
    const qs = allQuestions.map((q, i) => ({ q, i })).filter(({ q }) => q.topic === topic)
    const benar = qs.filter(({ q, i }) => answers[i] === q.correct).length
    detail[topic] = { benar, total: qs.length, pct: Math.round((benar / qs.length) * 100) }
  })
  return detail
}

function computeBadge(progress: UserProgress, tests: TestResult[]): number {
  let b = 0
  if (progress.materiSelesai.length >= 1) b++
  if (progress.materiSelesai.length >= 3) b++
  if (progress.materiSelesai.length >= 6) b++
  if (progress.kuisSelesai >= 1) b++
  if (progress.gameDimainkan.length >= 1) b++
  if (tests.find(t => t.jenisTest === 'pre')) b++
  if (tests.find(t => t.jenisTest === 'post')) b++
  return b
}

function getKnowledgeLevel(pct: number) {
  if (pct >= 80) return { label: 'Sangat Baik', desc: 'Pengetahuan gizi kamu sangat tinggi! Pertahankan terus!', color: '#2E7D32', bg: '#E8F5E9', border: '#66BB6A', emoji: '🌟' }
  if (pct >= 60) return { label: 'Baik', desc: 'Pengetahuan gizimu sudah baik. Masih ada ruang untuk berkembang!', color: '#1565C0', bg: '#E3F2FD', border: '#42A5F5', emoji: '👍' }
  if (pct >= 40) return { label: 'Cukup', desc: 'Pengetahuan gizimu cukup. Yuk pelajari lebih lanjut!', color: '#E65100', bg: '#FFF3E0', border: '#FF9800', emoji: '📚' }
  return { label: 'Perlu Ditingkatkan', desc: 'Semangat belajar! Pelajari semua materi untuk meningkatkan pengetahuan gizimu.', color: '#B71C1C', bg: '#FFEBEE', border: '#EF5350', emoji: '💪' }
}

// ─── SVG Illustrations ────────────────────────────────────────────────────────
function MascotGizi({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <ellipse cx="50" cy="68" rx="22" ry="18" fill="#66BB6A" />
      <ellipse cx="50" cy="30" rx="20" ry="8" fill="white" />
      <rect x="38" y="16" width="24" height="16" rx="6" fill="white" />
      <ellipse cx="50" cy="16" rx="12" ry="6" fill="white" />
      <circle cx="50" cy="48" r="18" fill="#FFD54F" />
      <circle cx="43" cy="44" r="3.5" fill="#1A237E" />
      <circle cx="57" cy="44" r="3.5" fill="#1A237E" />
      <circle cx="44" cy="43" r="1.2" fill="white" />
      <circle cx="58" cy="43" r="1.2" fill="white" />
      <path d="M43 52 Q50 58 57 52" stroke="#1A237E" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="39" cy="50" r="4" fill="#FF8A65" opacity="0.5" />
      <circle cx="61" cy="50" r="4" fill="#FF8A65" opacity="0.5" />
      <path d="M72 40 Q80 32 78 24 Q70 28 68 36 Q64 38 66 44 Z" fill="#66BB6A" opacity="0.8" />
    </svg>
  )
}

function FruitIllustration() {
  return (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
      <ellipse cx="25" cy="45" rx="16" ry="18" fill="#EF5350" />
      <path d="M25 30 Q28 22 32 20" stroke="#66BB6A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <ellipse cx="30" cy="22" rx="5" ry="3" fill="#66BB6A" transform="rotate(-20 30 22)" />
      <path d="M18 38 Q22 44 18 50" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
      <path d="M50 55 Q65 30 78 45 Q72 52 60 58 Z" fill="#FDD835" />
      <path d="M50 55 Q65 30 78 45" stroke="#F9A825" strokeWidth="2" fill="none" />
      <circle cx="98" cy="48" r="16" fill="#FF7043" />
      <path d="M90 34 Q98 28 106 34" stroke="#388E3C" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <ellipse cx="102" cy="32" rx="4" ry="2.5" fill="#66BB6A" transform="rotate(20 102 32)" />
    </svg>
  )
}

function PlateIllustration({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="52" fill="#FFF8E1" stroke="#FFECB3" strokeWidth="2" />
      <circle cx="60" cy="60" r="46" fill="none" stroke="#FFE082" strokeWidth="1.5" />
      <path d="M60 14 A46 46 0 0 0 60 106 Z" fill="#FFCA28" opacity="0.8" />
      <path d="M60 14 A46 46 0 0 1 106 60 L60 60 Z" fill="#EF5350" opacity="0.8" />
      <path d="M106 60 A46 46 0 0 1 60 106 L60 60 Z" fill="#66BB6A" opacity="0.8" />
      <line x1="60" y1="14" x2="60" y2="106" stroke="white" strokeWidth="2.5" />
      <line x1="60" y1="60" x2="106" y2="60" stroke="white" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="10" fill="white" />
      <text x="60" y="64" textAnchor="middle" fontSize="10" fill="#1A237E" fontFamily="Nunito" fontWeight="700">1/2</text>
    </svg>
  )
}

function KidWithLunchbox() {
  return (
    <svg width="180" height="200" viewBox="0 0 180 200" fill="none">
      <circle cx="90" cy="110" r="80" fill="#BBDEFB" opacity="0.4" />
      <rect x="60" y="110" width="60" height="60" rx="16" fill="#42A5F5" />
      <path d="M75 110 L90 125 L105 110" fill="white" opacity="0.9" />
      <rect x="35" y="115" width="28" height="15" rx="7" fill="#42A5F5" />
      <rect x="117" y="115" width="28" height="15" rx="7" fill="#42A5F5" />
      <circle cx="35" cy="122" r="9" fill="#FFD54F" />
      <circle cx="145" cy="122" r="9" fill="#FFD54F" />
      <rect x="40" y="118" width="34" height="22" rx="6" fill="#FF7043" />
      <rect x="40" y="118" width="34" height="8" rx="4" fill="#E64A19" />
      <rect x="53" y="115" width="8" height="5" rx="2" fill="#E64A19" />
      <rect x="44" y="130" width="26" height="3" rx="1.5" fill="white" opacity="0.5" />
      <circle cx="90" cy="82" r="32" fill="#FFD54F" />
      <path d="M60 72 Q62 52 90 50 Q118 52 120 72" fill="#5D4037" />
      <path d="M60 72 Q55 65 58 58 Q62 52 70 54" fill="#5D4037" />
      <circle cx="80" cy="80" r="5" fill="#1A237E" />
      <circle cx="100" cy="80" r="5" fill="#1A237E" />
      <circle cx="81" cy="78.5" r="2" fill="white" />
      <circle cx="101" cy="78.5" r="2" fill="white" />
      <path d="M78 90 Q90 100 102 90" stroke="#1A237E" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="72" cy="88" r="6" fill="#FF8A65" opacity="0.45" />
      <circle cx="108" cy="88" r="6" fill="#FF8A65" opacity="0.45" />
      <rect x="68" y="165" width="18" height="28" rx="9" fill="#1565C0" />
      <rect x="94" y="165" width="18" height="28" rx="9" fill="#1565C0" />
      <ellipse cx="77" cy="194" rx="14" ry="7" fill="#212121" />
      <ellipse cx="103" cy="194" rx="14" ry="7" fill="#212121" />
    </svg>
  )
}

// ─── Login Illustrations ───────────────────────────────────────────────────────
function SchoolKidsSVG() {
  const figures = [
    { x: 20, skin: '#FFCC80', hijab: '#4CAF50', isGirl: true, hasHijab: true, book: '#FF7043' },
    { x: 68, skin: '#FFCCBC', hijab: '#5D4037', isGirl: false, hasHijab: false },
    { x: 116, skin: '#FFD5AD', hijab: '#AB47BC', isGirl: true, hasHijab: true, book: '#66BB6A' },
    { x: 164, skin: '#FFCC80', hijab: '#5D4037', isGirl: false, hasHijab: false, glasses: true },
    { x: 212, skin: '#FFCCBC', hijab: '#FF7043', isGirl: true, hasHijab: false },
    { x: 255, skin: '#FFD5AD', hijab: '#5D4037', isGirl: false, hasHijab: false, waving: true },
  ]
  return (
    <svg width="300" height="140" viewBox="0 0 300 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="300" height="140" rx="14" fill="#64B5F6"/>
      <ellipse cx="52" cy="32" rx="30" ry="17" fill="white" opacity="0.85"/>
      <ellipse cx="32" cy="37" rx="20" ry="13" fill="white" opacity="0.85"/>
      <ellipse cx="76" cy="37" rx="22" ry="13" fill="white" opacity="0.85"/>
      <ellipse cx="235" cy="26" rx="28" ry="16" fill="white" opacity="0.85"/>
      <ellipse cx="213" cy="31" rx="20" ry="12" fill="white" opacity="0.85"/>
      <ellipse cx="258" cy="31" rx="20" ry="12" fill="white" opacity="0.85"/>
      <circle cx="275" cy="22" r="20" fill="#FFE082" opacity="0.7"/>
      <rect x="0" y="114" width="300" height="26" fill="#81C784"/>
      <ellipse cx="150" cy="114" rx="150" ry="10" fill="#A5D6A7"/>
      {figures.map((f, i) => (
        <g key={i} transform={`translate(${f.x}, 0)`}>
          {f.hasHijab ? (
            <ellipse cx="17" cy="57" rx="17" ry="20" fill={f.hijab}/>
          ) : (
            <ellipse cx="17" cy="49" rx="15" ry="10" fill={f.hijab}/>
          )}
          <circle cx="17" cy="58" r="13" fill={f.skin}/>
          {f.glasses && (
            <>
              <rect x="9" y="55" width="7" height="5" rx="2.5" stroke="#37474F" strokeWidth="1.2" fill="rgba(200,230,255,0.5)"/>
              <rect x="18" y="55" width="7" height="5" rx="2.5" stroke="#37474F" strokeWidth="1.2" fill="rgba(200,230,255,0.5)"/>
              <line x1="16" y1="57" x2="18" y2="57" stroke="#37474F" strokeWidth="1"/>
            </>
          )}
          <circle cx="12" cy="57" r="2" fill="#1A237E"/>
          <circle cx="22" cy="57" r="2" fill="#1A237E"/>
          <circle cx="12.7" cy="56.3" r="0.8" fill="white"/>
          <circle cx="22.7" cy="56.3" r="0.8" fill="white"/>
          <path d="M11 63 Q17 68 23 63" stroke="#1A237E" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          <circle cx="8" cy="62" r="3" fill="#FF8A65" opacity="0.45"/>
          <circle cx="26" cy="62" r="3" fill="#FF8A65" opacity="0.45"/>
          <rect x="5" y="69" width="24" height="14" rx="5" fill="#1565C0"/>
          <rect x="6" y="83" width="22" height="12" rx="3" fill="white"/>
          <polygon points="17,70 20,70 18.5,82" fill="#F44336"/>
          {f.isGirl ? (
            <path d="M6 95 L0 128 L34 128 L28 95 Z" fill="#F44336"/>
          ) : (
            <>
              <rect x="6" y="95" width="10" height="33" rx="5" fill="#37474F"/>
              <rect x="18" y="95" width="10" height="33" rx="5" fill="#37474F"/>
            </>
          )}
          <ellipse cx="10" cy="128" rx="8" ry="5" fill="#212121"/>
          <ellipse cx="24" cy="128" rx="8" ry="5" fill="#212121"/>
          {f.book && (
            <rect x="-8" y="80" width="10" height="14" rx="2" fill={f.book}/>
          )}
          {f.waving && (
            <>
              <path d="M29 74 Q40 60 35 52" stroke="#1565C0" strokeWidth="7" strokeLinecap="round" fill="none"/>
              <circle cx="35" cy="50" r="7" fill={f.skin}/>
            </>
          )}
        </g>
      ))}
    </svg>
  )
}

function KemenkesLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
        <rect x="15" y="3" width="8" height="32" rx="3" fill="#4CAF50"/>
        <rect x="3" y="15" width="32" height="8" rx="3" fill="#4CAF50"/>
        <circle cx="8" cy="8" r="5" fill="#FFC107"/>
        <circle cx="30" cy="8" r="5" fill="#FFC107"/>
        <circle cx="8" cy="30" r="5" fill="#FFC107"/>
        <circle cx="30" cy="30" r="5" fill="#FFC107"/>
        <circle cx="19" cy="19" r="6" fill="white"/>
        <circle cx="19" cy="19" r="3.5" fill="#4CAF50"/>
      </svg>
      <div>
        <div style={{ fontFamily: 'Baloo 2', fontSize: 12, fontWeight: 800, color: '#2E7D32', lineHeight: 1.1 }}>Kemenkes</div>
        <div style={{ fontFamily: 'Nunito', fontSize: 10, fontWeight: 700, color: '#388E3C', lineHeight: 1.1 }}>Poltekkes Bandung</div>
      </div>
    </div>
  )
}

// ─── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, onRegister }: {
  onLogin: (username: string, password: string) => Promise<void>
  onRegister: (input: { name: string; username: string; password: string; profilePhoto?: string }) => Promise<void>
}) {
  const [isRegistering, setIsRegistering] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profilePhoto, setProfilePhoto] = useState<string>()
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)


async function handleLogin() {
  setError('')

  if (!username.trim()) {
    setError('Nama pengguna atau NISN wajib diisi!')
    return
  }

  if (!password) {
    setError('Kata sandi wajib diisi!')
    return
  }

  setLoading(true)

  try {
    // Kirim username/NISN dan kata sandi yang benar-benar diisi siswa.
    await onLogin(username.trim(), password)
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : 'Login gagal. Silakan coba lagi.',
    )
    setLoading(false)
  }
}

  function handlePhoto(file?: File) {
    if (!file) return
    if (file.size > 1_500_000) {
      setError('Ukuran foto maksimal 1,5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setProfilePhoto(String(reader.result))
    reader.readAsDataURL(file)
  }

  async function handleRegister() {
    setError('')
    if (!fullName.trim() || !username.trim() || !password) {
      setError('Nama lengkap, username/NISN, dan kata sandi wajib diisi.')
      return
    }
    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.')
      return
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi belum sama.')
      return
    }
    setLoading(true)
    try {
      await onRegister({ name: fullName, username, password, profilePhoto })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Registrasi gagal. Silakan coba lagi.')
      setLoading(false)
    }
  }

  if (isRegistering) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(160deg, #42A5F5 0%, #1976D2 55%, #0D47A1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 18px' }}>
        <div style={{ background: 'white', borderRadius: 28, padding: '24px 22px', width: '100%', maxWidth: 360, boxShadow: '0 20px 64px rgba(0,0,0,0.28)', animation: 'slide-up 0.35s both' }}>
          <button onClick={() => { setIsRegistering(false); setError('') }} style={{ background: '#E3F2FD', border: 'none', borderRadius: 10, padding: '7px 10px', color: '#1976D2', fontFamily: 'Nunito', fontWeight: 800, cursor: 'pointer' }}>← Kembali</button>
          <div style={{ fontFamily: 'Baloo 2', fontSize: 22, fontWeight: 800, color: '#1A237E', marginTop: 16 }}>Daftar Akun Siswa</div>
          <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#546E7A', marginBottom: 16 }}>Buat akun untuk menyimpan progres belajarmu sendiri.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input aria-label="Nama lengkap" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nama lengkap" style={{ border: '2px solid #E3F2FD', borderRadius: 14, padding: '12px 14px', fontFamily: 'Nunito', outlineColor: '#42A5F5' }} />
            <input aria-label="Username atau NISN" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username atau NISN" style={{ border: '2px solid #E3F2FD', borderRadius: 14, padding: '12px 14px', fontFamily: 'Nunito', outlineColor: '#42A5F5' }} />
            <input aria-label="Kata sandi" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Kata sandi (minimal 6 karakter)" style={{ border: '2px solid #E3F2FD', borderRadius: 14, padding: '12px 14px', fontFamily: 'Nunito', outlineColor: '#42A5F5' }} />
            <input aria-label="Konfirmasi kata sandi" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Konfirmasi kata sandi" style={{ border: '2px solid #E3F2FD', borderRadius: 14, padding: '12px 14px', fontFamily: 'Nunito', outlineColor: '#42A5F5' }} />
            <label style={{ border: '2px dashed #90CAF9', borderRadius: 14, padding: 12, fontFamily: 'Nunito', fontSize: 12, fontWeight: 700, color: '#1976D2', cursor: 'pointer', textAlign: 'center' }}>
              {profilePhoto ? 'Foto profil dipilih ✓' : 'Pilih foto profil (opsional)'}
              <input type="file" accept="image/*" onChange={e => handlePhoto(e.target.files?.[0])} style={{ display: 'none' }} />
            </label>
          </div>
          {error && <div role="alert" style={{ background: '#FFEBEE', color: '#C62828', borderRadius: 10, padding: '9px 12px', marginTop: 12, fontFamily: 'Nunito', fontSize: 12, fontWeight: 700 }}>{error}</div>}
          <button disabled={loading} onClick={handleRegister} style={{ width: '100%', padding: '14px 0', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg, #66BB6A, #388E3C)', color: 'white', fontFamily: 'Baloo 2', fontSize: 16, fontWeight: 800, marginTop: 14, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>{loading ? 'Menyimpan akun...' : 'Buat Akun & Masuk'}</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #42A5F5 0%, #1976D2 55%, #0D47A1 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '28px 18px 36px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }}/>
      <div style={{ position: 'absolute', bottom: -80, left: -80, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }}/>
      <div style={{ position: 'absolute', top: '45%', right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,193,7,0.10)' }}/>

      {['🥦', '🍎', '🥕', '🍌'].map((e, i) => (
        <div key={i} style={{
          position: 'absolute', fontSize: 22, opacity: 0.35,
          animation: `float ${2.5 + i * 0.4}s ease-in-out infinite`,
          animationDelay: `${i * 0.5}s`,
          top: `${52 + i * 9}%`,
          [i % 2 === 0 ? 'left' : 'right']: '10px',
        }}>{e}</div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, animation: 'slide-up 0.5s both', zIndex: 2 }}>
        <div style={{ fontSize: 34 }}>📚</div>
        <div>
          <div style={{ fontFamily: 'Baloo 2', fontWeight: 800, fontSize: 19, color: 'white', letterSpacing: 0.2 }}>SDN Kiaracondong 038</div>
          <div style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Smart Gizi · Belajar Gizi Seru! ✨</div>
        </div>
      </div>

      <div style={{
        background: 'white',
        borderRadius: 28,
        padding: '24px 22px 22px',
        width: '100%',
        maxWidth: 360,
        boxShadow: '0 20px 64px rgba(0,0,0,0.28)',
        animation: 'bounce-in 0.6s 0.15s both',
        zIndex: 2,
      }}>
        <div style={{ fontFamily: 'Baloo 2', fontSize: 19, fontWeight: 800, color: '#1A237E', textAlign: 'center', marginBottom: 14 }}>
          Selamat Datang Siswa/Siswi Kebanggaan!
        </div>

        <div style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 18 }}>
          <SchoolKidsSVG />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            border: '2px solid #E3F2FD', borderRadius: 14,
            padding: '12px 14px', background: '#F8FAFF',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>✏️</span>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Nama Pengguna atau NISN"
              style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'Nunito', fontSize: 14, fontWeight: 600, color: '#1A237E', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            border: '2px solid #E3F2FD', borderRadius: 14,
            padding: '12px 14px', background: '#F8FAFF',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🔒</span>
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Kata Sandi"
              style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'Nunito', fontSize: 14, fontWeight: 600, color: '#1A237E', outline: 'none' }}
            />
            <button onClick={() => setShowPw(!showPw)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.55, padding: 0 }}>
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: '#FFEBEE', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontFamily: 'Nunito', fontSize: 12, color: '#C62828', fontWeight: 700, animation: 'slide-up 0.2s both' }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 16, border: 'none',
            background: loading ? '#90CAF9' : 'linear-gradient(135deg, #1976D2, #0D47A1)',
            fontFamily: 'Baloo 2', fontSize: 17, fontWeight: 800, color: 'white',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 6px 24px rgba(25,118,210,0.4)',
            marginBottom: 18, transition: 'all 0.2s',
          }}
        >
          {loading ? '⏳ Memuat...' : '🚀 Masuk'}
        </button>

        <button onClick={() => { setIsRegistering(true); setError('') }} style={{ width: '100%', padding: '11px 0', borderRadius: 14, border: '2px solid #BBDEFB', background: '#F8FBFF', color: '#1976D2', fontFamily: 'Nunito', fontSize: 13, fontWeight: 800, cursor: 'pointer', marginBottom: 16 }}>
          Belum punya akun? Daftar Akun
        </button>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <KemenkesLogo />
        </div>
      </div>
    </div>
  )
}

// ─── Splash Screen ─────────────────────────────────────────────────────────────
function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2000); return () => clearTimeout(t) }, [onDone])
  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(160deg, #42A5F5 0%, #1976D2 50%, #0D47A1 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'absolute', bottom: -80, left: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
      {['🥦', '🍎', '🥕', '🍌', '🥛', '🐟'].map((emoji, i) => (
        <div key={i} style={{ position: 'absolute', fontSize: 28, opacity: 0.5, animation: `float ${2.5 + i * 0.3}s ease-in-out infinite`, animationDelay: `${i * 0.4}s`, top: `${10 + i * 12}%`, left: i % 2 === 0 ? `${5 + i * 3}%` : undefined, right: i % 2 !== 0 ? `${5 + i * 3}%` : undefined }}>{emoji}</div>
      ))}
      <div style={{ animation: 'bounce-in 0.7s 0.3s both', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 110, height: 110, borderRadius: 30, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', marginBottom: 20 }}>
          <MascotGizi size={88} />
        </div>
        <div style={{ fontFamily: 'Baloo 2', fontWeight: 800, fontSize: 44, color: 'white', letterSpacing: 1, lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
          Smart<span style={{ color: '#FFC107' }}> Gizi</span>
        </div>
        <div style={{ fontFamily: 'Nunito', fontWeight: 600, fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 6 }}>Belajar Gizi Seru & Menyenangkan! 🌟</div>
      </div>
      <div style={{ animation: 'slide-up 0.6s 0.6s both', marginTop: 32 }}><KidWithLunchbox /></div>
      <div style={{ display: 'flex', gap: 8, marginTop: 24, animation: 'slide-up 0.4s 1.2s both' }}>
        {[0, 1, 2].map(i => (<div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', animation: `bounce-in 0.6s ${0.3 + i * 0.15}s infinite alternate` }} />))}
      </div>
      <div style={{ position: 'absolute', bottom: 32, fontFamily: 'Nunito', fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>SDN Kiaracondong 038 · Kelas VI</div>
    </div>
  )
}

// ─── Bottom Nav ────────────────────────────────────────────────────────────────
const studentNavItems = [
  { id: 'home', icon: '🏠', label: 'Beranda' },
  { id: 'materi', icon: '📚', label: 'Materi' },
  { id: 'kuis', icon: '✏️', label: 'Kuis' },
  { id: 'game', icon: '🎮', label: 'Game' },
  { id: 'hasil', icon: '📊', label: 'Hasil' },
  { id: 'profil', icon: '👤', label: 'Profil' },
] as const

const devNavItems = [
  { id: 'home', icon: '🏠', label: 'Beranda' },
  { id: 'hasil', icon: '📊', label: 'Data Siswa' },
  { id: 'profil', icon: '👤', label: 'Profil' },
] as const

function BottomNav({ active, onNav, role }: { active: Screen; onNav: (s: Screen) => void; role: 'SISWA' | 'DEVELOPER' }) {
  const items = role === 'DEVELOPER' ? devNavItems : studentNavItems
  return (
    <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: role === 'DEVELOPER' ? 1040 : 520, background: 'white', borderTop: '1px solid #E3F2FD', display: 'flex', paddingBottom: 8, paddingTop: 4, boxShadow: '0 -4px 20px rgba(66,165,245,0.12)', zIndex: 100 }}>
      {items.map(item => {
        const isActive = active === item.id
        return (
          <button key={item.id} onClick={() => onNav(item.id as Screen)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer', transition: 'transform 0.15s' }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <div style={{ width: 44, height: 28, borderRadius: 14, background: isActive ? '#BBDEFB' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'background 0.2s' }}>
              {item.icon}
            </div>
            <span style={{ fontSize: 10, fontFamily: 'Nunito', fontWeight: isActive ? 800 : 600, color: isActive ? '#1976D2' : '#78909C' }}>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── App Bar ───────────────────────────────────────────────────────────────────
function AppBar({ title, showBack, onBack, rightEl, bg = '#42A5F5' }: { title: string; showBack?: boolean; onBack?: () => void; rightEl?: React.ReactNode; bg?: string }) {
  return (
    <div style={{ background: bg, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderRadius: '0 0 20px 20px', boxShadow: '0 4px 16px rgba(66,165,245,0.25)', position: 'relative', zIndex: 10 }}>
      {showBack && (
        <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.25)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'white' }}>←</button>
      )}
      <span style={{ flex: 1, fontFamily: 'Baloo 2', fontWeight: 700, fontSize: 18, color: 'white', letterSpacing: 0.3 }}>{title}</span>
      {rightEl}
    </div>
  )
}

// ─── Developer Home Screen ─────────────────────────────────────────────────────
function DeveloperHomeScreen({ currentUser, students, onNav, onLogout }: { currentUser: AppUser; students: StudentDashboardData[]; onNav: (s: Screen) => void; onLogout: () => void }) {
  const totalStudents = students.length
  const studentsWithPre = students.filter(s => s.pre !== null).length
  const studentsWithPost = students.filter(s => s.post !== null).length
  const activeStudents = students.filter(s => s.progress.activities.length > 0 || s.pre || s.post).length
  const completedStudents = students.filter(s => computeOverallProgress(s.progress, [s.pre, s.post].filter(Boolean) as TestResult[]) === 100).length
  const avgPre = studentsWithPre > 0 ? Math.round(students.filter(s => s.pre).reduce((sum, s) => sum + (s.pre?.skor || 0), 0) / studentsWithPre) : null
  const avgPost = studentsWithPost > 0 ? Math.round(students.filter(s => s.post).reduce((sum, s) => sum + (s.post?.skor || 0), 0) / studentsWithPost) : null
  const now = new Date()

  return (
    <div style={{ paddingBottom: 80, background: '#F0F8FF', minHeight: '100vh' }}>
      <div style={{ background: 'linear-gradient(135deg, #1A237E 0%, #283593 100%)', padding: '20px 20px 32px', borderRadius: '0 0 32px 32px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'Nunito', fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{fmtDate(now)} · {fmtTime(now)}</div>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 21, color: 'white', fontWeight: 800, marginTop: 2 }}>Hai, {currentUser.name}! 👋</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>🔬 Developer · SDN Kiaracondong 038</div>
          </div>
          <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 12, padding: '6px 12px', fontFamily: 'Nunito', fontSize: 11, fontWeight: 700, color: 'white', cursor: 'pointer' }}>🚪 Keluar</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10, marginTop: 18 }}>
          {[
            { label: 'Total Siswa', value: totalStudents, icon: '👥' },
            { label: 'Siswa Aktif', value: activeStudents, icon: '📈' },
            { label: 'Sudah Pre-Test', value: studentsWithPre, icon: '📝' },
            { label: 'Sudah Post-Test', value: studentsWithPost, icon: '🎯' },
            { label: 'Selesai Semua', value: completedStudents, icon: '✓' },
          ].map((stat, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '10px 6px', textAlign: 'center', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: 20 }}>{stat.icon}</div>
              <div style={{ fontFamily: 'Baloo 2', fontSize: 22, fontWeight: 800, color: 'white' }}>{stat.value}</div>
              <div style={{ fontFamily: 'Nunito', fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        {(avgPre !== null || avgPost !== null) && (
          <div style={{ background: 'white', borderRadius: 20, padding: 16, marginBottom: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: '#1A237E', marginBottom: 12 }}>📊 Rata-Rata Nilai Kelas</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, background: '#E3F2FD', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#546E7A' }}>Pre-Test</div>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 26, fontWeight: 800, color: '#1976D2' }}>{avgPre ?? '—'}</div>
                <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#78909C' }}>{studentsWithPre} siswa</div>
              </div>
              <div style={{ flex: 1, background: '#EDE7F6', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#546E7A' }}>Post-Test</div>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 26, fontWeight: 800, color: '#7B1FA2' }}>{avgPost ?? '—'}</div>
                <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#78909C' }}>{studentsWithPost} siswa</div>
              </div>
              {avgPre !== null && avgPost !== null && (
                <div style={{ flex: 1, background: avgPost >= avgPre ? '#E8F5E9' : '#FFEBEE', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#546E7A' }}>Δ Selisih</div>
                  <div style={{ fontFamily: 'Baloo 2', fontSize: 26, fontWeight: 800, color: avgPost >= avgPre ? '#2E7D32' : '#C62828' }}>
                    {avgPost >= avgPre ? '+' : ''}{avgPost - avgPre}
                  </div>
                  <div style={{ fontFamily: 'Nunito', fontSize: 10, color: avgPost >= avgPre ? '#2E7D32' : '#C62828' }}>{avgPost >= avgPre ? '📈' : '📉'}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <button onClick={() => onNav('hasil')} style={{ background: 'white', borderRadius: 20, padding: '16px 12px', border: '2px solid #E1BEE7', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', transition: 'transform 0.15s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: '#EDE7F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>📊</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 12, fontWeight: 800, color: '#1A237E', textAlign: 'center' }}>Lihat Semua Hasil</div>
          </button>
          <button onClick={() => onNav('profil')} style={{ background: 'white', borderRadius: 20, padding: '16px 12px', border: '2px solid #BBDEFB', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', transition: 'transform 0.15s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>👤</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 12, fontWeight: 800, color: '#1A237E', textAlign: 'center' }}>Profil Developer</div>
          </button>
        </div>

        {totalStudents === 0 ? (
          <div style={{ background: 'white', borderRadius: 20, padding: 24, textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 16, fontWeight: 700, color: '#1A237E', marginBottom: 8 }}>Belum Ada Siswa</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#546E7A', lineHeight: 1.6 }}>Data siswa akan muncul di sini setelah mereka login dan mulai menggunakan aplikasi.</div>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 20, padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: '#1A237E', marginBottom: 12 }}>👥 Daftar Siswa ({totalStudents})</div>
            {students.slice(0, 4).map(({ user, pre, post }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < Math.min(students.length, 4) - 1 ? '1px solid #F0F4F8' : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, overflow: 'hidden' }}>{user.profilePhoto ? <img src={user.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🧑‍🎒'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Nunito', fontSize: 13, fontWeight: 700, color: '#1A237E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                  <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#78909C' }}>Pre: {pre ? pre.skor : '—'} | Post: {post ? post.skor : '—'}</div>
                </div>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, fontWeight: 700, color: post ? '#2E7D32' : pre ? '#1565C0' : '#90A4AE', flexShrink: 0 }}>
                  {post ? '✅ Selesai' : pre ? '📝 Pre-Test' : '○ Belum'}
                </div>
              </div>
            ))}
            {totalStudents > 4 && (
              <button onClick={() => onNav('hasil')} style={{ width: '100%', marginTop: 10, padding: '8px 0', border: 'none', background: '#F0F8FF', borderRadius: 10, fontFamily: 'Nunito', fontSize: 12, fontWeight: 700, color: '#1976D2', cursor: 'pointer' }}>
                Lihat Semua {totalStudents} Siswa →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Student Home Screen ───────────────────────────────────────────────────────
function HomeScreen({ currentUser, userProgress, userTests, onNav, onLogout }: {
  currentUser: AppUser
  userProgress: UserProgress
  userTests: TestResult[]
  onNav: (s: Screen) => void
  onLogout: () => void
}) {
  const preResult = userTests.find(t => t.jenisTest === 'pre') || null
  const postResult = userTests.find(t => t.jenisTest === 'post') || null
  const preScore = preResult?.skor ?? null
  const postScore = postResult?.skor ?? null
  const progress = computeOverallProgress(userProgress, userTests)
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 11 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 18 ? 'Selamat Sore' : 'Selamat Malam'
  const greetEmoji = hour < 11 ? '🌤️' : hour < 15 ? '☀️' : hour < 18 ? '🌅' : '🌙'
  const latestActivity = [...(userProgress.activities || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

  return (
    <div style={{ paddingBottom: 80, background: '#F0F8FF', minHeight: '100vh' }}>
      <div style={{ background: 'linear-gradient(135deg, #42A5F5 0%, #1E88E5 100%)', padding: '20px 20px 32px', borderRadius: '0 0 32px 32px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,193,7,0.15)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'Nunito', fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{greeting}! {greetEmoji}</div>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 22, color: 'white', fontWeight: 800, marginTop: 2 }}>Hai, {currentUser.name}! 👋</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{currentUser.kelas} · {currentUser.sekolah}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ width: 52, height: 52, borderRadius: 18, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: 26, overflow: 'hidden' }}>{currentUser.profilePhoto ? <img src={currentUser.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🧑‍🎒'}</div>
            <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '3px 8px', fontFamily: 'Nunito', fontSize: 10, fontWeight: 700, color: 'white', cursor: 'pointer' }}>🚪 Keluar</button>
          </div>
        </div>
        <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: '12px 16px', backdropFilter: 'blur(8px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: 'Nunito', fontSize: 13, color: 'white', fontWeight: 700 }}>⚡ Progress Belajar</span>
            <span style={{ fontFamily: 'Baloo 2', fontSize: 16, color: '#FFC107', fontWeight: 800 }}>{progress}%</span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.3)', borderRadius: 99 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #FFC107, #FF8F00)', borderRadius: 99, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{userProgress.materiSelesai.length} dari {materials.length} materi selesai</span>
            <span style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>⚡ {userProgress.totalPoin} Poin</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <div style={{ fontFamily: 'Baloo 2', fontSize: 15, fontWeight: 700, color: '#1A237E', marginBottom: 12 }}>📋 Tes Pengetahuan Gizi</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          <button onClick={() => onNav('pretest')} style={{ background: preScore !== null ? 'linear-gradient(135deg, #E8F5E9, #C8E6C9)' : 'linear-gradient(135deg, #E3F2FD, #BBDEFB)', borderRadius: 18, padding: '14px 12px', border: preScore !== null ? '2px solid #66BB6A' : '2px solid #90CAF9', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 4px 14px rgba(0,0,0,0.07)', textAlign: 'left' }}>
            <div style={{ fontSize: 28 }}>{preScore !== null ? '✅' : '📝'}</div>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 800, color: '#1A237E' }}>Pre-Test</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#546E7A' }}>Sebelum belajar</div>
            {preScore !== null ? (
              <div style={{ fontFamily: 'Baloo 2', fontSize: 16, fontWeight: 800, color: '#2E7D32' }}>{preScore}</div>
            ) : (
              <div style={{ fontFamily: 'Nunito', fontSize: 11, fontWeight: 700, color: '#1565C0' }}>Mulai →</div>
            )}
          </button>
          <button onClick={() => onNav('posttest')} disabled={preScore === null} style={{ background: postScore !== null ? 'linear-gradient(135deg, #FFF8E1, #FFE082)' : 'linear-gradient(135deg, #FFF3E0, #FFE0B2)', borderRadius: 18, padding: '14px 12px', border: postScore !== null ? '2px solid #FFC107' : '2px solid #FFCC80', cursor: preScore === null ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 4px 14px rgba(0,0,0,0.07)', textAlign: 'left', opacity: preScore === null ? 0.6 : 1 }}>
            <div style={{ fontSize: 28 }}>{postScore !== null ? '🏆' : '🎯'}</div>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 800, color: '#1A237E' }}>Post-Test</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#546E7A' }}>Setelah belajar</div>
            {postScore !== null ? (
              <div style={{ fontFamily: 'Baloo 2', fontSize: 16, fontWeight: 800, color: '#E65100' }}>{postScore}</div>
            ) : (
              <div style={{ fontFamily: 'Nunito', fontSize: 11, fontWeight: 700, color: '#E65100' }}>{preScore === null ? 'Kerjakan Pre-Test dulu' : 'Mulai →'}</div>
            )}
          </button>
        </div>

        {preScore !== null && postScore !== null && (
          <div style={{ background: 'linear-gradient(135deg, #7B1FA2, #4A148C)', borderRadius: 20, padding: 16, marginBottom: 20, boxShadow: '0 6px 24px rgba(123,31,162,0.3)' }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 800, color: 'white', marginBottom: 12 }}>📈 Perbandingan Hasil Tes</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Pre-Test</div>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 28, fontWeight: 800, color: '#90CAF9' }}>{preScore}</div>
              </div>
              <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.5)' }}>→</div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Post-Test</div>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 28, fontWeight: 800, color: '#FFC107' }}>{postScore}</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Peningkatan</div>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 28, fontWeight: 800, color: postScore > preScore ? '#69F0AE' : '#EF5350' }}>
                  {postScore > preScore ? '+' : ''}{postScore - preScore}
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ fontFamily: 'Baloo 2', fontSize: 16, fontWeight: 700, color: '#1A237E', marginBottom: 14 }}>Menu Utama 🎯</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {[
            { icon: '📚', label: 'Materi Gizi', color: '#42A5F5', bg: '#BBDEFB', screen: 'materi' as Screen },
            { icon: '✏️', label: 'Kuis', color: '#66BB6A', bg: '#C8E6C9', screen: 'kuis' as Screen },
            { icon: '🎮', label: 'Game', color: '#FF7043', bg: '#FFE0B2', screen: 'game' as Screen },
            { icon: '📊', label: 'Hasil Belajar', color: '#AB47BC', bg: '#E1BEE7', screen: 'hasil' as Screen },
          ].map(item => (
            <button key={item.screen} onClick={() => onNav(item.screen)} style={{ background: 'white', borderRadius: 20, padding: '18px 12px', border: `2px solid ${item.bg}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', transition: 'transform 0.15s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{item.icon}</div>
              <span style={{ fontFamily: 'Nunito', fontSize: 13, fontWeight: 800, color: '#1A237E' }}>{item.label}</span>
            </button>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: 18, padding: 14, marginBottom: 18, border: '2px solid #E3F2FD', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: latestActivity ? '#E8F5E9' : '#ECEFF1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{latestActivity ? '✓' : '○'}</div>
          <div>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 800, color: '#1A237E' }}>Aktivitas Terakhir</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#546E7A' }}>{latestActivity ? latestActivity.label : 'Belum ada aktivitas belajar.'}</div>
            {latestActivity && <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#90A4AE', marginTop: 2 }}>{fmtDateTime(latestActivity.timestamp)}</div>}
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #FF7043, #E64A19)', borderRadius: 20, padding: 16, display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 6px 20px rgba(255,112,67,0.3)', cursor: 'pointer' }} onClick={() => onNav('kuis')}>
          <div style={{ width: 54, height: 54, borderRadius: 18, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🏆</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 800, color: 'white' }}>Tantangan Hari Ini</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>Kuis Gizi Seimbang · +50 Poin · ⏱️ 10 menit</div>
            <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.25)', borderRadius: 8, padding: '4px 10px', display: 'inline-block', fontFamily: 'Nunito', fontSize: 11, color: 'white', fontWeight: 700 }}>Mulai Sekarang →</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Test Intro Screen ─────────────────────────────────────────────────────────
function TestIntroScreen({ mode, onStart, onBack }: { mode: TestMode; onStart: () => void; onBack: () => void }) {
  const isPre = mode === 'pre'
  return (
    <div style={{ paddingBottom: 40, background: '#F0F8FF', minHeight: '100vh' }}>
      <AppBar title={isPre ? '📝 Pre-Test' : '🎯 Post-Test'} showBack onBack={onBack} bg={isPre ? '#1976D2' : '#7B1FA2'} />
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ animation: 'bounce-in 0.5s both' }}><MascotGizi size={90} /></div>
        <div style={{ background: 'white', borderRadius: 24, padding: '24px 20px', width: '100%', boxShadow: '0 6px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ fontFamily: 'Baloo 2', fontSize: 20, fontWeight: 800, color: '#1A237E', textAlign: 'center', marginBottom: 12 }}>
            {isPre ? 'Pre-Test Pengetahuan Gizi' : 'Post-Test Pengetahuan Gizi'}
          </div>
          <div style={{ fontFamily: 'Nunito', fontSize: 13, color: '#546E7A', textAlign: 'center', lineHeight: 1.7, marginBottom: 16 }}>
            {isPre ? 'Tes ini dikerjakan SEBELUM kamu mempelajari materi gizi. Jawaban kamu jujur sangat membantu penelitian ini.' : 'Tes ini dikerjakan SETELAH kamu mempelajari semua materi gizi. Tunjukkan semua yang sudah kamu pelajari!'}
          </div>
          {[
            { icon: '📝', label: 'Jumlah Soal', value: `${allQuestions.length} soal pilihan ganda` },
            { icon: '⏱️', label: 'Waktu', value: 'Sekitar 20–30 menit' },
            { icon: '📚', label: 'Topik', value: '6 topik gizi utama' },
            { icon: '🎯', label: 'Tujuan', value: isPre ? 'Mengukur pengetahuan awal' : 'Mengukur peningkatan pengetahuan' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 3 ? '1px solid #F0F4F8' : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: '#F0F8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
              <div>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#90A4AE', fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontFamily: 'Nunito', fontSize: 13, color: '#1A237E', fontWeight: 700 }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: isPre ? '#E3F2FD' : '#EDE7F6', borderRadius: 16, padding: 14, width: '100%', border: `2px solid ${isPre ? '#90CAF9' : '#CE93D8'}` }}>
          <div style={{ fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 700, color: isPre ? '#1565C0' : '#6A1B9A', marginBottom: 4 }}>💡 Petunjuk Mengerjakan</div>
          <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#37474F', lineHeight: 1.6 }}>
            {'• Baca setiap soal dengan teliti sebelum menjawab\n• Pilih SATU jawaban yang paling tepat\n• Setelah memilih, soal akan otomatis berpindah\n• Kerjakan sendiri dengan jujur\n• Tidak ada sanksi untuk jawaban yang salah'}
          </div>
        </div>
        <button onClick={onStart} style={{ width: '100%', padding: '16px 0', borderRadius: 18, border: 'none', background: isPre ? 'linear-gradient(135deg, #1976D2, #0D47A1)' : 'linear-gradient(135deg, #7B1FA2, #4A148C)', fontFamily: 'Baloo 2', fontSize: 18, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: isPre ? '0 8px 28px rgba(25,118,210,0.4)' : '0 8px 28px rgba(123,31,162,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          🚀 Mulai {isPre ? 'Pre-Test' : 'Post-Test'}
        </button>
      </div>
    </div>
  )
}

// ─── Test Questions Screen ─────────────────────────────────────────────────────
function TestQuestionsScreen({ mode, onFinish, onBack }: { mode: TestMode; onFinish: (score: number, answers: number[]) => void; onBack: () => void }) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<number[]>(Array(allQuestions.length).fill(-1))
  const [selected, setSelected] = useState<number | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const isPre = mode === 'pre'
  const q = allQuestions[currentIdx]
  const progress = ((currentIdx + 1) / allQuestions.length) * 100

  function handleSelect(idx: number) {
    if (selected !== null) return
    setSelected(idx)
    const newAnswers = [...answers]; newAnswers[currentIdx] = idx; setAnswers(newAnswers)
    setShowFeedback(true)
  }

  function handleNext() {
    setShowFeedback(false); setSelected(null)
    if (currentIdx + 1 >= allQuestions.length) {
      const finalAnswers = [...answers]; finalAnswers[currentIdx] = selected!
      const correct = allQuestions.filter((q, i) => (i === currentIdx ? selected! : answers[i]) === q.correct).length
      onFinish(Math.round((correct / allQuestions.length) * 100), finalAnswers)
    } else { setCurrentIdx(i => i + 1) }
  }

  const topicColors: Record<string, string> = { 'Pengertian Gizi': '#42A5F5', 'Isi Piringku': '#66BB6A', 'Makanan Bergizi Seimbang': '#FF7043', 'Pentingnya Sarapan': '#FFC107', 'Minum Air Putih': '#26C6DA', 'Aktivitas Fisik': '#AB47BC', 'Gizi & Kesehatan': '#EF5350' }
  const topicColor = topicColors[q.topic] ?? '#42A5F5'
  const levelColor = q.level === 'mudah' ? '#66BB6A' : q.level === 'sedang' ? '#FFC107' : '#EF5350'

  return (
    <div style={{ paddingBottom: 20, background: '#F0F8FF', minHeight: '100vh' }}>
      <AppBar title={`${isPre ? 'Pre-Test' : 'Post-Test'} · ${currentIdx + 1}/${allQuestions.length}`} showBack onBack={onBack} bg={isPre ? '#1976D2' : '#7B1FA2'} rightEl={<div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '4px 10px', fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 700, color: 'white' }}>{answers.filter(a => a !== -1).length}/{allQuestions.length}</div>} />
      <div style={{ height: 6, background: isPre ? '#BBDEFB' : '#CE93D8' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: isPre ? 'linear-gradient(90deg, #42A5F5, #1976D2)' : 'linear-gradient(90deg, #AB47BC, #7B1FA2)', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ background: topicColor + '22', borderRadius: 10, padding: '4px 10px', fontFamily: 'Nunito', fontSize: 11, fontWeight: 700, color: topicColor, border: `1.5px solid ${topicColor}44` }}>{q.topic}</div>
          <div style={{ background: levelColor + '22', borderRadius: 10, padding: '4px 10px', fontFamily: 'Nunito', fontSize: 11, fontWeight: 700, color: levelColor, border: `1.5px solid ${levelColor}44` }}>{q.level === 'mudah' ? '🟢' : q.level === 'sedang' ? '🟡' : '🔴'} {q.level}</div>
        </div>
        <div style={{ background: 'white', borderRadius: 22, padding: 20, marginBottom: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', animation: 'slide-up 0.3s both' }} key={currentIdx}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <div style={{ width: 72, height: 72, borderRadius: 22, background: topicColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 }}>{q.img}</div>
          </div>
          <div style={{ fontFamily: 'Nunito', fontSize: 15, fontWeight: 700, color: '#1A237E', textAlign: 'center', lineHeight: 1.55 }}>Soal {currentIdx + 1}: {q.q}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>

{q.options.map((opt, idx) => {
  let bg = 'white'
  let borderColor = '#E3F2FD'
  let textColor = '#1A237E'

  if (showFeedback && !isPre) {
    if (idx === q.correct) {
      bg = '#E8F5E9'
      borderColor = '#66BB6A'
      textColor = '#1B5E20'
    } else if (idx === selected) {
      bg = '#FFEBEE'
      borderColor = '#EF5350'
      textColor = '#B71C1C'
    }
  } else if (isPre && idx === selected) {
    bg = '#E3F2FD'
    borderColor = '#42A5F5'
    textColor = '#1A237E'
  }

  return (
    <button
      key={idx}
      onClick={() => handleSelect(idx)}
      style={{
        background: bg,
        border: `2px solid ${borderColor}`,
        borderRadius: 16,
        padding: '13px 14px',
        cursor: selected !== null ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'all 0.2s',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        width: '100%',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background:
            showFeedback && !isPre && idx === q.correct
              ? '#66BB6A'
              : showFeedback && !isPre && idx === selected
                ? '#EF5350'
                : isPre && idx === selected
                  ? '#42A5F5'
                  : '#E3F2FD',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {String.fromCharCode(65 + idx)}
      </div>

      <span
        style={{
          fontFamily: 'Nunito',
          fontSize: 13,
          fontWeight: 600,
          color: textColor,
          flex: 1,
        }}
      >
        {opt}
      </span>

      {showFeedback && !isPre && idx === q.correct && (
        <span>✅</span>
      )}

      {showFeedback && !isPre && idx === selected && idx !== q.correct && (
        <span>❌</span>
      )}
       </button>
  )
})}

        </div>

        {showFeedback && !isPre && (
          <div
            style={{
              background: selected === q.correct ? '#E8F5E9' : '#FFF3E0',
              borderRadius: 16,
              padding: 14,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontFamily: 'Baloo 2',
                fontSize: 14,
                fontWeight: 800,
                color: selected === q.correct ? '#2E7D32' : '#E65100',
                marginBottom: 6,
              }}
            >
              {selected === q.correct ? '🎉 Jawaban Benar!' : '💡 Penjelasan:'}
            </div>
            <div
              style={{
                fontFamily: 'Nunito',
                fontSize: 13,
                color: '#455A64',
                lineHeight: 1.6,
              }}
            >
              {q.explanation}
            </div>
          </div>
        )}

        {showFeedback && (
          <button
            onClick={handleNext}
            style={{
              width: '100%',
              padding: '14px',
              border: 'none',
              borderRadius: 16,
              background: isPre ? '#1976D2' : '#7B1FA2',
              color: 'white',
              fontFamily: 'Baloo 2',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {currentIdx + 1 >= allQuestions.length
              ? '🏁 Selesai & Lihat Hasil'
              : 'Soal Berikutnya →'}
          </button>
        )}
      </div>
    </div>
  )
}


// ─── Test Result Screen ────────────────────────────────────────────────────────
function TestResultScreen({ mode, score, answers, preScore, onBack, onRetry }: { mode: TestMode; score: number; answers: number[]; preScore: number | null; onBack: () => void; onRetry: () => void }) {
  const [showDetail, setShowDetail] = useState(false)
  const isPre = mode === 'pre'
  const level = getKnowledgeLevel(score)
  const correct = allQuestions.filter((q, i) => answers[i] === q.correct).length
  const topics = [...new Set(allQuestions.map(q => q.topic))]
  const topicStats = topics.map(topic => {
    const qs = allQuestions.map((q, i) => ({ q, i })).filter(({ q }) => q.topic === topic)
    const correctCount = qs.filter(({ q, i }) => answers[i] === q.correct).length
    return { topic, total: qs.length, correct: correctCount, pct: Math.round((correctCount / qs.length) * 100) }
  })
  const topicColors: Record<string, string> = { 'Pengertian Gizi': '#42A5F5', 'Isi Piringku': '#66BB6A', 'Makanan Bergizi Seimbang': '#FF7043', 'Pentingnya Sarapan': '#FFC107', 'Minum Air Putih': '#26C6DA', 'Aktivitas Fisik': '#AB47BC', 'Gizi & Kesehatan': '#EF5350' }

  return (
    <div style={{ paddingBottom: 40, background: '#F0F8FF', minHeight: '100vh' }}>
      <AppBar title={isPre ? '📊 Hasil Pre-Test' : '📊 Hasil Post-Test'} showBack onBack={onBack} bg={isPre ? '#1976D2' : '#7B1FA2'} />
      <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'white', borderRadius: 24, padding: 24, boxShadow: '0 6px 28px rgba(0,0,0,0.09)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, animation: 'bounce-in 0.5s both' }}>
          <div style={{ fontSize: 52 }}>{level.emoji}</div>
          <div style={{ fontFamily: 'Baloo 2', fontSize: 18, fontWeight: 800, color: '#1A237E' }}>{isPre ? 'Pre-Test' : 'Post-Test'} Selesai!</div>
          <div style={{ width: 110, height: 110, borderRadius: '50%', background: isPre ? 'linear-gradient(135deg, #1976D2, #0D47A1)' : 'linear-gradient(135deg, #7B1FA2, #4A148C)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: isPre ? '0 8px 28px rgba(25,118,210,0.4)' : '0 8px 28px rgba(123,31,162,0.4)' }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 36, fontWeight: 800, color: 'white', lineHeight: 1 }}>{score}</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>dari 100</div>
          </div>
          <div style={{ background: level.bg, borderRadius: 14, padding: '8px 20px', border: `2px solid ${level.border}` }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 15, fontWeight: 800, color: level.color, textAlign: 'center' }}>Tingkat: {level.label}</div>
          </div>
          <div style={{ fontFamily: 'Nunito', fontSize: 13, color: '#546E7A', textAlign: 'center', lineHeight: 1.6 }}>{level.desc}</div>
          <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'Baloo 2', fontSize: 22, fontWeight: 800, color: '#2E7D32' }}>{correct}</div><div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#90A4AE' }}>Benar</div></div>
            <div style={{ width: 1, background: '#E0E0E0' }} />
            <div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'Baloo 2', fontSize: 22, fontWeight: 800, color: '#C62828' }}>{allQuestions.length - correct}</div><div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#90A4AE' }}>Salah</div></div>
            <div style={{ width: 1, background: '#E0E0E0' }} />
            <div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'Baloo 2', fontSize: 22, fontWeight: 800, color: '#1565C0' }}>{allQuestions.length}</div><div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#90A4AE' }}>Soal</div></div>
          </div>
        </div>

        {!isPre && preScore !== null && (
          <div style={{ background: 'linear-gradient(135deg, #4A148C, #7B1FA2)', borderRadius: 20, padding: 18, boxShadow: '0 6px 24px rgba(74,20,140,0.3)' }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 800, color: 'white', marginBottom: 14 }}>📈 Perbandingan Pre vs Post Test</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Pre-Test</div>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 28, fontWeight: 800, color: '#90CAF9' }}>{preScore}</div>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{getKnowledgeLevel(preScore).label}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 20, color: 'rgba(255,255,255,0.6)' }}>→</div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Post-Test</div>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 28, fontWeight: 800, color: '#FFC107' }}>{score}</div>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{level.label}</div>
              </div>
            </div>
            <div style={{ background: score > preScore ? 'rgba(105,240,174,0.2)' : 'rgba(239,83,80,0.2)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, border: `1.5px solid ${score > preScore ? 'rgba(105,240,174,0.4)' : 'rgba(239,83,80,0.4)'}` }}>
              <div style={{ fontSize: 24 }}>{score > preScore ? '🎉' : score === preScore ? '🤝' : '💪'}</div>
              <div>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 800, color: score > preScore ? '#69F0AE' : '#EF9A9A' }}>{score > preScore ? `Meningkat +${score - preScore} poin!` : score === preScore ? 'Tidak ada perubahan' : `Turun ${preScore - score} poin`}</div>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{score > preScore ? 'Edukasi gizi berhasil meningkatkan pengetahuanmu!' : 'Yuk pelajari kembali materinya!'}</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: 20, padding: 18, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
          <button onClick={() => setShowDetail(d => !d)} style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0 }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 15, fontWeight: 700, color: '#1A237E' }}>📋 Rincian per Topik</div>
            <div style={{ fontSize: 18, color: '#90CAF9', transition: 'transform 0.2s', transform: showDetail ? 'rotate(180deg)' : 'none' }}>▼</div>
          </button>
          {showDetail && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10, animation: 'slide-up 0.3s both' }}>
              {topicStats.map((ts, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ fontFamily: 'Nunito', fontSize: 12, fontWeight: 700, color: '#37474F' }}>{ts.topic}</div>
                    <div style={{ fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 800, color: topicColors[ts.topic] ?? '#42A5F5' }}>{ts.correct}/{ts.total} ({ts.pct}%)</div>
                  </div>
                  <div style={{ height: 8, background: '#F5F5F5', borderRadius: 99 }}>
                    <div style={{ width: `${ts.pct}%`, height: '100%', background: topicColors[ts.topic] ?? '#42A5F5', borderRadius: 99, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onRetry} style={{ flex: 1, padding: '14px 0', borderRadius: 14, border: `2px solid ${isPre ? '#1976D2' : '#7B1FA2'}`, background: 'white', fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: isPre ? '#1976D2' : '#7B1FA2', cursor: 'pointer' }}>🔄 Ulangi</button>
          <button onClick={onBack} style={{ flex: 1, padding: '14px 0', borderRadius: 14, border: 'none', background: isPre ? 'linear-gradient(135deg, #1976D2, #0D47A1)' : 'linear-gradient(135deg, #7B1FA2, #4A148C)', fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>🏠 Ke Beranda</button>
        </div>
      </div>
    </div>
  )
}

// ─── Materi Screen ─────────────────────────────────────────────────────────────
function MateriScreen({ userProgress, onNav }: { userProgress: UserProgress; onNav: (s: Screen, mat?: Material) => void }) {
  const done = userProgress.materiSelesai.length
  return (
    <div style={{ paddingBottom: 80, background: '#F0F8FF', minHeight: '100vh' }}>
      <AppBar title="📚 Materi Gizi" bg="#42A5F5" />
      <div style={{ padding: '16px 16px' }}>
        <div style={{ background: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)', borderRadius: 20, padding: 16, marginBottom: 20, border: '1.5px solid #90CAF9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 15, fontWeight: 700, color: '#1565C0' }}>Progres Materi</div>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 20, fontWeight: 800, color: '#1565C0' }}>{done}/{materials.length}</div>
          </div>
          <div style={{ height: 10, background: 'rgba(21,101,192,0.15)', borderRadius: 99 }}>
            <div style={{ width: `${(done / materials.length) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #42A5F5, #1976D2)', borderRadius: 99, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#1565C0', marginTop: 4 }}>
            {done} materi selesai · {materials.length - done} tersisa
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #1A237E, #283593)', borderRadius: 20, padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 6px 20px rgba(26,35,126,0.25)' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🎯</div>
          <div>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: 'white' }}>Bekal Menuju Post-Test</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>8 materi · contoh sehari-hari · mini quiz</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#FFC107', marginTop: 4, fontWeight: 700 }}>Pelajari dari atas ke bawah</div>
          </div>
        </div>

        <div style={{ fontFamily: 'Baloo 2', fontSize: 16, fontWeight: 700, color: '#1A237E', marginBottom: 14 }}>Semua Materi 📖</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {materials.map(m => {
            const isDone = userProgress.materiSelesai.includes(m.id)
            const isStarted = userProgress.materiDibuka.includes(m.id)
            const status = isDone ? 'Selesai' : isStarted ? 'Sedang Dipelajari' : 'Belum Dipelajari'
            return (
              <button key={m.id} onClick={() => onNav('materiDetail', m)} style={{ background: 'white', borderRadius: 20, padding: '14px 16px', border: `2px solid ${isDone ? m.color : '#E3F2FD'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 3px 12px rgba(0,0,0,0.05)', transition: 'transform 0.15s', width: '100%', textAlign: 'left' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>{m.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <div style={{ fontFamily: 'Nunito', fontSize: 14, fontWeight: 800, color: '#1A237E' }}>{m.title}</div>
                    {isDone && <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#66BB6A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'white', fontWeight: 700, flexShrink: 0 }}>✓</div>}
                  </div>
                  <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#78909C' }}>{m.desc}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontFamily: 'Nunito', fontSize: 11, color: m.color, fontWeight: 700 }}>⏱️ {m.duration}</div>
                    <div style={{ borderRadius: 8, padding: '2px 7px', background: isDone ? '#E8F5E9' : isStarted ? '#FFF8E1' : '#ECEFF1', color: isDone ? '#2E7D32' : isStarted ? '#E65100' : '#78909C', fontFamily: 'Nunito', fontSize: 9, fontWeight: 800 }}>{status}</div>
                  </div>
                </div>
                <div style={{ fontSize: 18, color: '#90CAF9' }}>›</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Materi Detail Screen ──────────────────────────────────────────────────────
function MateriDetailScreen({ material, userProgress, onBack, onComplete }: { material: Material; userProgress: UserProgress; onBack: () => void; onComplete: (id: number) => void }) {
  const isDone = userProgress.materiSelesai.includes(material.id)
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({})
  const [activityAnswer, setActivityAnswer] = useState<number | null>(null)
  const [plateChoices, setPlateChoices] = useState<Record<string, string>>({})
  const plateGroups = [
    { label: 'Makanan Pokok', options: ['Nasi', 'Jagung', 'Ubi'] },
    { label: 'Lauk', options: ['Ikan', 'Telur', 'Tempe'] },
    { label: 'Sayur', options: ['Bayam', 'Wortel', 'Kangkung'] },
    { label: 'Buah', options: ['Pepaya', 'Pisang', 'Jeruk'] },
  ]
  const plateComplete = plateGroups.every(group => plateChoices[group.label])

  return (
    <div style={{ paddingBottom: 80, background: '#F0F8FF', minHeight: '100vh' }}>
      <AppBar title={material.title} showBack onBack={onBack} bg={material.color} rightEl={<div style={{ fontFamily: 'Nunito', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>⏱️ {material.duration}</div>} />
      <div style={{ background: material.bg, padding: '24px 16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 150, height: 96, borderRadius: 28, background: 'rgba(255,255,255,0.72)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
          {material.heroIcons.map((icon, index) => <span key={index} style={{ fontSize: index === 0 ? 34 : 27, transform: `translateY(${index % 2 === 0 ? -4 : 5}px)` }}>{icon}</span>)}
        </div>
        <div style={{ fontFamily: 'Nunito', fontSize: 12, fontWeight: 700, color: '#37474F', textAlign: 'center', maxWidth: 330 }}>{material.desc}</div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 16, boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ fontFamily: 'Baloo 2', fontSize: 15, fontWeight: 800, color: '#1A237E', marginBottom: 12 }}>🎯 Apa yang Akan Kamu Pelajari?</div>
          {material.keyPoints.map((point, index) => (
            <div key={point} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: index === material.keyPoints.length - 1 ? 0 : 9 }}>
              <div style={{ width: 24, height: 24, borderRadius: 8, background: material.bg, color: material.color, display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'Baloo 2', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{index + 1}</div>
              <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#37474F', lineHeight: 1.5, fontWeight: 700 }}>{point}</div>
            </div>
          ))}
        </div>

        {material.sections.map((sec, index) => (
          <div key={sec.title} style={{ background: 'white', borderRadius: 20, padding: 16, boxShadow: '0 3px 12px rgba(0,0,0,0.05)', animation: `slide-up 0.3s ${index * 0.06}s both` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: material.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{sec.icon}</div>
              <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: '#1A237E' }}>{sec.title}</div>
            </div>
            {sec.highlight && <div style={{ background: material.bg, borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontFamily: 'Nunito', fontSize: 12, fontWeight: 800, color: material.color, border: `1.5px solid ${material.color}44` }}>✨ {sec.highlight}</div>}
            <div style={{ fontFamily: 'Nunito', fontSize: 13, color: '#37474F', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{sec.content}</div>
          </div>
        ))}

        {material.tableData && (
          <div style={{ background: 'white', borderRadius: 20, padding: 16, boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: '#1A237E', marginBottom: 10 }}>📊 Ringkasan Mudah</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {material.tableData.map(row => (
                <div key={row.label} style={{ borderRadius: 12, border: '1.5px solid #E3F2FD', overflow: 'hidden' }}>
                  <div style={{ background: material.bg, padding: '7px 10px', fontFamily: 'Baloo 2', fontSize: 12, fontWeight: 800, color: material.color }}>{row.label}</div>
                  <div style={{ padding: '8px 10px', fontFamily: 'Nunito', fontSize: 11, color: '#37474F', lineHeight: 1.5 }}><strong>{row.function}</strong><br />{row.examples}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: '#E8F5E9', borderRadius: 20, padding: 16, border: '2px solid #A5D6A7' }}>
          <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: '#2E7D32', marginBottom: 5 }}>🏫 Contoh Sehari-hari</div>
          <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#33691E', lineHeight: 1.6 }}>{material.everydayExample}</div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #FFF8E1, #FFE57F)', borderRadius: 20, padding: 16, border: '2px solid #FFC107', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 28 }}>💡</div>
          <div>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: '#E65100' }}>Tahukah Kamu?</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#BF360C', marginTop: 4, lineHeight: 1.55 }}>{material.funFact}</div>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 20, padding: 16, boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ fontFamily: 'Baloo 2', fontSize: 15, fontWeight: 800, color: '#1A237E', marginBottom: 12 }}>🧠 Mini Quiz</div>
          {material.miniQuiz.map((quiz, quizIndex) => {
            const answered = quizAnswers[quizIndex]
            return (
              <div key={quiz.question} style={{ marginBottom: quizIndex === material.miniQuiz.length - 1 ? 0 : 16 }}>
                <div style={{ fontFamily: 'Nunito', fontSize: 12, fontWeight: 800, color: '#1A237E', marginBottom: 8 }}>{quizIndex + 1}. {quiz.question}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {quiz.options.map((option, optionIndex) => {
                    const selected = answered === optionIndex
                    const correct = answered !== undefined && optionIndex === quiz.correct
                    return <button key={option} onClick={() => setQuizAnswers(current => ({ ...current, [quizIndex]: optionIndex }))} style={{ width: '100%', borderRadius: 11, border: `1.5px solid ${correct ? '#66BB6A' : selected ? '#EF5350' : '#E3F2FD'}`, background: correct ? '#E8F5E9' : selected ? '#FFEBEE' : '#F8FAFF', padding: '8px 10px', textAlign: 'left', cursor: 'pointer', fontFamily: 'Nunito', fontSize: 11, fontWeight: 700, color: correct ? '#2E7D32' : selected ? '#C62828' : '#37474F' }}>{option}</button>
                  })}
                </div>
                {answered !== undefined && <div style={{ marginTop: 7, borderRadius: 10, background: answered === quiz.correct ? '#E8F5E9' : '#FFF3E0', padding: '7px 9px', fontFamily: 'Nunito', fontSize: 10, lineHeight: 1.45, color: answered === quiz.correct ? '#2E7D32' : '#E65100', fontWeight: 700 }}>{answered === quiz.correct ? 'Benar! ' : 'Belum tepat. '}{quiz.explanation}</div>}
              </div>
            )
          })}
        </div>

        <div style={{ background: material.bg, borderRadius: 20, padding: 16, border: `2px solid ${material.color}44` }}>
          <div style={{ fontFamily: 'Baloo 2', fontSize: 15, fontWeight: 800, color: material.color, marginBottom: 5 }}>{material.activity.title}</div>
          <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#546E7A', lineHeight: 1.5, marginBottom: 12 }}>{material.activity.instruction}</div>
          {material.activity.type === 'plate' ? (
            <>
              <div style={{ width: 230, height: 230, borderRadius: '50%', background: 'white', border: '10px solid #FFF3E0', margin: '0 auto 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden', boxShadow: '0 6px 18px rgba(0,0,0,0.08)' }}>
                {plateGroups.map((group, index) => <div key={group.label} style={{ borderRight: index % 2 === 0 ? '2px solid #FFF3E0' : 'none', borderBottom: index < 2 ? '2px solid #FFF3E0' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8, textAlign: 'center', background: plateChoices[group.label] ? ['#FFF9C4', '#FFEBEE', '#E8F5E9', '#FFF3E0'][index] : 'white' }}>
                  <div style={{ fontFamily: 'Nunito', fontSize: 9, color: '#78909C', fontWeight: 800 }}>{group.label}</div>
                  <div style={{ fontFamily: 'Baloo 2', fontSize: 13, color: '#1A237E', fontWeight: 800, marginTop: 3 }}>{plateChoices[group.label] || 'Pilih'}</div>
                </div>)}
              </div>
              {plateGroups.map(group => <div key={group.label} style={{ marginBottom: 9 }}>
                <div style={{ fontFamily: 'Nunito', fontSize: 10, fontWeight: 800, color: '#37474F', marginBottom: 4 }}>{group.label}</div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {group.options.map(option => <button key={option} onClick={() => setPlateChoices(current => ({ ...current, [group.label]: option }))} style={{ flex: 1, borderRadius: 9, border: `1.5px solid ${plateChoices[group.label] === option ? material.color : '#E0E0E0'}`, background: plateChoices[group.label] === option ? 'white' : 'rgba(255,255,255,0.55)', padding: '6px 3px', fontFamily: 'Nunito', fontSize: 10, fontWeight: 700, color: plateChoices[group.label] === option ? '#1A237E' : '#78909C', cursor: 'pointer' }}>{option}</button>)}
                </div>
              </div>)}
              {plateComplete && <div style={{ background: '#E8F5E9', borderRadius: 11, padding: '9px 10px', fontFamily: 'Nunito', fontSize: 11, color: '#2E7D32', fontWeight: 800 }}>✓ {material.activity.success}</div>}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {material.activity.options?.map((option, index) => <button key={option.label} onClick={() => setActivityAnswer(index)} style={{ borderRadius: 12, border: `2px solid ${activityAnswer === index ? material.color : 'rgba(255,255,255,0.8)'}`, background: activityAnswer === index ? 'white' : 'rgba(255,255,255,0.55)', padding: '9px 11px', textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#1A237E', fontWeight: 800 }}>{option.label}</div>
                  {option.detail && <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#546E7A', marginTop: 3 }}>{option.detail}</div>}
                </button>)}
              </div>
              {activityAnswer !== null && <div style={{ marginTop: 9, borderRadius: 11, padding: '9px 10px', background: activityAnswer === material.activity.correct ? '#E8F5E9' : '#FFEBEE', color: activityAnswer === material.activity.correct ? '#2E7D32' : '#C62828', fontFamily: 'Nunito', fontSize: 11, fontWeight: 800 }}>{activityAnswer === material.activity.correct ? `✓ ${material.activity.success}` : 'Coba lagi. Baca petunjuk dan bandingkan pilihannya.'}</div>}
            </>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: 20, padding: 16, border: `2px solid ${material.bg}` }}>
          <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 800, color: '#1A237E', marginBottom: 5 }}>✅ Kesimpulan</div>
          <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#37474F', lineHeight: 1.6 }}>{material.conclusion}</div>
        </div>

        <button onClick={() => { if (!isDone) onComplete(material.id) }} style={{ width: '100%', padding: '14px 0', borderRadius: 16, border: isDone ? '2px solid #66BB6A' : 'none', background: isDone ? '#E8F5E9' : `linear-gradient(135deg, ${material.color}, ${material.color}cc)`, fontFamily: 'Baloo 2', fontSize: 15, fontWeight: 800, color: isDone ? '#2E7D32' : 'white', cursor: isDone ? 'default' : 'pointer', boxShadow: isDone ? 'none' : '0 6px 20px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {isDone ? '✓ Materi Sudah Selesai' : 'Aku Sudah Paham! (+50 poin)'}
        </button>
      </div>
    </div>
  )
}

// ─── Kuis Screen ───────────────────────────────────────────────────────────────
const quizQuestions = allQuestions.slice(0, 10)

function KuisScreen({ onQuizComplete }: { onQuizComplete: (score: number, answers: number[]) => void }) {
  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [showExpl, setShowExpl] = useState(false)
  const [answers, setAnswers] = useState<number[]>([])
  const q = quizQuestions[currentQ]
  const progress = ((currentQ + (answered ? 1 : 0)) / quizQuestions.length) * 100

  function handleSelect(idx: number) {
    if (answered) return
    setSelected(idx); setAnswered(true)
    const finalAnswers = [...answers, idx]
    setAnswers(finalAnswers)
    const newScore = idx === q.correct ? score + 10 : score
    if (idx === q.correct) setScore(s => s + 10)
    setTimeout(() => setShowExpl(true), 400)
    if (currentQ + 1 >= quizQuestions.length) {
      setTimeout(() => {
        setFinished(true)
        onQuizComplete(newScore, finalAnswers)
      }, 1200)
    }
  }

  function handleNext() {
    setShowExpl(false)
    if (currentQ + 1 >= quizQuestions.length) { setFinished(true) }
    else { setCurrentQ(c => c + 1); setSelected(null); setAnswered(false) }
  }

  if (finished) {
    const passed = score >= 60
    return (
      <div style={{ paddingBottom: 80, background: '#F0F8FF', minHeight: '100vh' }}>
        <AppBar title="✏️ Kuis Gizi" bg="#66BB6A" />
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 64, animation: 'bounce-in 0.5s both' }}>{passed ? '🎉' : '😅'}</div>
          <div style={{ background: 'white', borderRadius: 24, padding: '24px 20px', width: '100%', boxShadow: '0 6px 24px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 20, fontWeight: 800, color: '#1A237E' }}>{passed ? 'Kamu Hebat! 🌟' : 'Terus Semangat! 💪'}</div>
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: passed ? 'linear-gradient(135deg, #FFC107, #FF8F00)' : 'linear-gradient(135deg, #EF5350, #C62828)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', boxShadow: '0 8px 28px rgba(0,0,0,0.2)' }}>
              <div style={{ fontFamily: 'Baloo 2', fontSize: 30, fontWeight: 800, color: 'white' }}>{score}</div>
              <div style={{ fontFamily: 'Nunito', fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>Poin</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>{[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: 26, animation: `star-pop 0.3s ${s*0.1}s both`, filter: s <= Math.round(score/20) ? 'none' : 'grayscale(1)' }}>⭐</span>)}</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 14, color: '#546E7A', textAlign: 'center' }}>Kamu menjawab benar <strong>{score / 10}</strong> dari <strong>{quizQuestions.length}</strong> soal</div>
          </div>
          <button onClick={() => { setCurrentQ(0); setSelected(null); setAnswered(false); setScore(0); setFinished(false); setShowExpl(false); setAnswers([]) }} style={{ flex: 1, width: '100%', padding: '14px 0', borderRadius: 14, border: '2px solid #42A5F5', background: 'white', fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: '#42A5F5', cursor: 'pointer' }}>🔄 Ulangi Kuis</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 80, background: '#F0F8FF', minHeight: '100vh' }}>
      <AppBar title={`✏️ Soal ${currentQ + 1}/${quizQuestions.length}`} bg="#66BB6A" rightEl={<div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 10, padding: '4px 10px', fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: 'white' }}>🏆 {score}</div>} />
      <div style={{ height: 6, background: '#C8E6C9' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #FFC107, #FF8F00)', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ padding: '16px 16px' }}>
        <div style={{ background: 'white', borderRadius: 24, padding: 20, marginBottom: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', animation: 'slide-up 0.3s both' }} key={currentQ}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <div style={{ width: 72, height: 72, borderRadius: 22, background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 }}>{q.img}</div>
          </div>
          <div style={{ fontFamily: 'Nunito', fontSize: 14, fontWeight: 700, color: '#1A237E', textAlign: 'center', lineHeight: 1.55 }}>{q.q}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {q.options.map((opt, idx) => {
            let bg = 'white', border = '2px solid #E3F2FD', color = '#1A237E'
            if (answered && idx === q.correct) { bg = '#E8F5E9'; border = '2px solid #66BB6A' }
            else if (answered && idx === selected) { bg = '#FFEBEE'; border = '2px solid #EF5350' }
            return (
              <button key={idx} onClick={() => handleSelect(idx)} style={{ background: bg, border, borderRadius: 16, padding: '13px 14px', cursor: answered ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s', width: '100%', textAlign: 'left' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 700, color: '#1565C0', flexShrink: 0 }}>{String.fromCharCode(65+idx)}</div>
                <span style={{ fontFamily: 'Nunito', fontSize: 13, fontWeight: 600, color, flex: 1 }}>{opt}</span>
                {answered && idx === q.correct && <span>✅</span>}
                {answered && idx === selected && idx !== q.correct && <span>❌</span>}
              </button>
            )
          })}
        </div>
        {showExpl && (
          <div style={{ background: selected === q.correct ? '#E8F5E9' : '#FFF3E0', borderRadius: 16, padding: 14, border: `2px solid ${selected === q.correct ? '#66BB6A' : '#FF9800'}`, marginBottom: 14, animation: 'slide-up 0.25s both' }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 700, color: selected === q.correct ? '#2E7D32' : '#E65100', marginBottom: 4 }}>{selected === q.correct ? '🎉 Benar!' : '💡 Penjelasan:'}</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#37474F', lineHeight: 1.5 }}>{q.explanation}</div>
          </div>
        )}
        {answered && (
          <button onClick={handleNext} style={{ width: '100%', padding: '14px 0', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg, #66BB6A, #388E3C)', fontFamily: 'Baloo 2', fontSize: 16, fontWeight: 700, color: 'white', cursor: 'pointer', boxShadow: '0 6px 20px rgba(102,187,106,0.35)', animation: 'slide-up 0.25s both' }}>
            {currentQ + 1 >= quizQuestions.length ? '🎯 Lihat Hasil' : 'Soal Berikutnya →'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Game Screen ───────────────────────────────────────────────────────────────
const healthyFoods = ['🥦', '🥕', '🍎', '🥛', '🐟', '🥚', '🍌', '🌽']
const unhealthyFoods = ['🍟', '🍬', '🥤', '🍕']

function GameScreen({ onGamePlayed, onGameStart }: { onGamePlayed: (gameId: string, score: number) => void; onGameStart: (gameId: string) => void }) {
  const [activeGame, setActiveGame] = useState<null | 'tebak' | 'susun' | 'cocok'>(null)
  const [tebakScore, setTebakScore] = useState(0)
  const [tebakIdx, setTebakIdx] = useState(0)
  const [tebakFeedback, setTebakFeedback] = useState<null | boolean>(null)
  const allFoods = [...healthyFoods, ...unhealthyFoods]
  const currentFood = allFoods[tebakIdx % allFoods.length]
  const isHealthy = healthyFoods.includes(currentFood)
  const [matched, setMatched] = useState<number[]>([])
  const [selectedFood, setSelectedFood] = useState<number | null>(null)
  const [plateAnswer, setPlateAnswer] = useState<number | null>(null)
  const foodPairs = [
    { food: '🥛', nutrisi: 'Kalsium', color: '#E3F2FD' },
    { food: '🐟', nutrisi: 'Protein', color: '#E8F5E9' },
    { food: '🥕', nutrisi: 'Vitamin A', color: '#FFF3E0' },
    { food: '🍌', nutrisi: 'Kalium', color: '#FFF9C4' },
  ]

  function startGame(id: string) {
    onGameStart(id)
    if (id === 'tebak') {
      setTebakIdx(0)
      setTebakScore(0)
      setTebakFeedback(null)
    }
    if (id === 'susun') setPlateAnswer(null)
    if (id === 'cocok') {
      setMatched([])
      setSelectedFood(null)
    }
    setActiveGame(id as any)
  }

  function handleTebak(answer: boolean) {
    const correct = answer === isHealthy
    const finalScore = correct ? tebakScore + 10 : tebakScore
    setTebakFeedback(correct)
    if (correct) setTebakScore(s => s + 10)
    if (tebakIdx + 1 >= allFoods.length) {
      setTimeout(() => {
        onGamePlayed('tebak', Math.round((finalScore / (allFoods.length * 10)) * 100))
        setActiveGame(null)
        setTebakIdx(0)
        setTebakScore(0)
        setTebakFeedback(null)
      }, 900)
    } else {
      setTimeout(() => { setTebakFeedback(null); setTebakIdx(i => i + 1) }, 800)
    }
  }

  function handleFoodSelect(idx: number) {
    if (matched.includes(idx % 10)) return
    if (selectedFood === null) { setSelectedFood(idx) }
    else {
      if (selectedFood !== idx && Math.abs(selectedFood - idx) >= 10) {
        const firstPair = selectedFood % 10
        const secondPair = idx % 10
        if (firstPair === secondPair) {
          const nextMatched = [...new Set([...matched, firstPair])]
          setMatched(nextMatched)
          if (nextMatched.length === foodPairs.length) onGamePlayed('cocok', 100)
        }
      }
      setSelectedFood(null)
    }
  }

  const games = [
    { id: 'tebak', icon: '🤔', title: 'Tebak Makanan Sehat', desc: 'Pilih mana makanan yang sehat!', color: '#42A5F5', bg: '#E3F2FD' },
    { id: 'susun', icon: '🍽️', title: 'Susun Isi Piringku', desc: 'Pelajari komposisi piring yang benar', color: '#66BB6A', bg: '#E8F5E9' },
    { id: 'cocok', icon: '🎯', title: 'Cocokkan Gizi', desc: 'Pasangkan makanan dengan kandungan gizinya', color: '#FF7043', bg: '#FFF3E0' },
  ]

  if (activeGame === 'tebak') {
    return (
      <div style={{ paddingBottom: 80, background: '#F0F8FF', minHeight: '100vh' }}>
        <AppBar title="🤔 Tebak Makanan Sehat" showBack onBack={() => setActiveGame(null)} bg="#42A5F5" />
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{ background: '#FFC107', borderRadius: 16, padding: '8px 20px', fontFamily: 'Baloo 2', fontSize: 18, fontWeight: 800, color: '#1A237E' }}>🏆 Skor: {tebakScore}</div>
          <div style={{ width: 150, height: 150, borderRadius: 30, background: tebakFeedback === null ? 'white' : tebakFeedback ? '#E8F5E9' : '#FFEBEE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 70, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', transition: 'background 0.3s', border: `3px solid ${tebakFeedback === null ? '#E3F2FD' : tebakFeedback ? '#66BB6A' : '#EF5350'}` }}>
            {tebakFeedback !== null ? (tebakFeedback ? '✅' : '❌') : currentFood}
          </div>
          <div style={{ fontFamily: 'Baloo 2', fontSize: 18, fontWeight: 700, color: '#1A237E', textAlign: 'center' }}>Apakah ini makanan SEHAT?</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <button onClick={() => handleTebak(true)} style={{ width: 130, height: 56, borderRadius: 18, background: 'linear-gradient(135deg, #66BB6A, #388E3C)', border: 'none', cursor: 'pointer', fontFamily: 'Baloo 2', fontSize: 18, fontWeight: 800, color: 'white', boxShadow: '0 4px 16px rgba(102,187,106,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>✅ Sehat</button>
            <button onClick={() => handleTebak(false)} style={{ width: 130, height: 56, borderRadius: 18, background: 'linear-gradient(135deg, #EF5350, #C62828)', border: 'none', cursor: 'pointer', fontFamily: 'Baloo 2', fontSize: 18, fontWeight: 800, color: 'white', boxShadow: '0 4px 16px rgba(239,83,80,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>❌ Tidak</button>
          </div>
        </div>
      </div>
    )
  }

  if (activeGame === 'susun') {
    return (
      <div style={{ paddingBottom: 80, background: '#F0F8FF', minHeight: '100vh' }}>
        <AppBar title="🍽️ Susun Isi Piringku" showBack onBack={() => setActiveGame(null)} bg="#66BB6A" />
        <div style={{ padding: '16px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}><PlateIllustration size={160} /></div>
          {[
            { label: 'Sayuran & Buah', value: 50, color: '#66BB6A', emoji: '🥗' },
            { label: 'Makanan Pokok (Karbohidrat)', value: 25, color: '#FFC107', emoji: '🍚' },
            { label: 'Lauk-Pauk (Protein)', value: 25, color: '#EF5350', emoji: '🍗' },
          ].map((item, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontFamily: 'Nunito', fontSize: 13, fontWeight: 700, color: '#37474F' }}>{item.emoji} {item.label}</div>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 800, color: item.color }}>{item.value}%</div>
              </div>
              <div style={{ height: 14, background: '#E8EAF6', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${item.value}%`, height: '100%', background: item.color, borderRadius: 99 }} />
              </div>
            </div>
          ))}
          <div style={{ background: '#E8F5E9', borderRadius: 16, padding: 14, border: '2px solid #A5D6A7', marginTop: 8 }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 700, color: '#2E7D32' }}>💡 Ingat!</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#388E3C', marginTop: 4, lineHeight: 1.5 }}>Separuh piring = sayuran & buah. Seperempat = nasi/kentang. Seperempat = lauk protein. Lengkapi dengan segelas air putih!</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: '#1A237E', marginBottom: 10 }}>Pilih komposisi yang benar:</div>
            {['25% sayur/buah, 50% nasi, 25% lauk', '50% sayur/buah, 25% makanan pokok, 25% lauk', '50% lauk, 25% sayur, 25% buah'].map((option, index) => (
              <button key={option} disabled={plateAnswer !== null} onClick={() => { setPlateAnswer(index); if (index === 1) onGamePlayed('susun', 100) }} style={{ width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: 8, borderRadius: 14, border: `2px solid ${plateAnswer === index ? index === 1 ? '#66BB6A' : '#EF5350' : '#E3F2FD'}`, background: plateAnswer === index ? index === 1 ? '#E8F5E9' : '#FFEBEE' : 'white', fontFamily: 'Nunito', fontWeight: 700, color: '#1A237E', cursor: plateAnswer === null ? 'pointer' : 'default' }}>{option}</button>
            ))}
            {plateAnswer !== null && <div style={{ fontFamily: 'Nunito', fontSize: 12, fontWeight: 800, color: plateAnswer === 1 ? '#2E7D32' : '#C62828', textAlign: 'center' }}>{plateAnswer === 1 ? 'Benar! Game selesai dan skor tersimpan.' : 'Belum tepat. Kembali lalu coba lagi.'}</div>}
          </div>
        </div>
      </div>
    )
  }

  if (activeGame === 'cocok') {
    return (
      <div style={{ paddingBottom: 80, background: '#F0F8FF', minHeight: '100vh' }}>
        <AppBar title="🎯 Cocokkan Gizi" showBack onBack={() => setActiveGame(null)} bg="#FF7043" />
        <div style={{ padding: '16px 16px' }}>
          <div style={{ fontFamily: 'Nunito', fontSize: 13, color: '#546E7A', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>Ketuk makanan lalu ketuk kandungan gizinya untuk memasangkan!</div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 700, color: '#FF7043', marginBottom: 4, textAlign: 'center' }}>Makanan</div>
              {foodPairs.map((fp, i) => (
                <button key={i} onClick={() => handleFoodSelect(i)} style={{ background: matched.includes(i) ? '#E8F5E9' : selectedFood === i ? '#FFE0B2' : 'white', borderRadius: 14, padding: '14px 8px', border: `2px solid ${matched.includes(i) ? '#66BB6A' : selectedFood === i ? '#FF7043' : '#E3F2FD'}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.2s' }}>
                  <span style={{ fontSize: 32 }}>{fp.food}</span>
                  {matched.includes(i) && <span style={{ fontSize: 14 }}>✓</span>}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: 36, color: '#90CAF9', fontSize: 24 }}>↔</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 700, color: '#42A5F5', marginBottom: 4, textAlign: 'center' }}>Kandungan Gizi</div>
              {foodPairs.map((fp, i) => (
                <button key={i} onClick={() => handleFoodSelect(i + 10)} style={{ background: matched.includes(i) ? '#E8F5E9' : fp.color, borderRadius: 14, padding: '14px 8px', border: `2px solid ${matched.includes(i) ? '#66BB6A' : '#E0E0E0'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                  <span style={{ fontFamily: 'Nunito', fontSize: 12, fontWeight: 700, color: '#1A237E' }}>{fp.nutrisi}</span>
                </button>
              ))}
            </div>
          </div>
          {matched.length >= 2 && (
            <div style={{ marginTop: 20, background: 'linear-gradient(135deg, #FFC107, #FF8F00)', borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', gap: 12, animation: 'bounce-in 0.5s both' }}>
              <span style={{ fontSize: 32 }}>🎊</span>
              <div>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 800, color: '#1A237E' }}>Keren Banget!</div>
                <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#1A237E' }}>Kamu sudah memahami kandungan gizi makanan!</div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 80, background: '#F0F8FF', minHeight: '100vh' }}>
      <AppBar title="🎮 Game Edukasi" bg="#FF7043" />
      <div style={{ padding: '16px 16px' }}>
        <div style={{ background: 'linear-gradient(135deg, #FF7043, #BF360C)', borderRadius: 20, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 6px 20px rgba(255,112,67,0.3)' }}>
          <div style={{ fontSize: 44 }}>🎮</div>
          <div>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 16, fontWeight: 800, color: 'white' }}>Belajar Sambil Bermain!</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>3 game seru untuk menguji pengetahuan gizimu</div>
          </div>
        </div>
        <div style={{ fontFamily: 'Baloo 2', fontSize: 16, fontWeight: 700, color: '#1A237E', marginBottom: 14 }}>Pilih Game 🕹️</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {games.map(game => (
            <button key={game.id} onClick={() => startGame(game.id)} style={{ background: 'white', borderRadius: 20, padding: 16, border: `2px solid ${game.bg}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', width: '100%', textAlign: 'left', transition: 'transform 0.15s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: game.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>{game.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 15, fontWeight: 700, color: '#1A237E' }}>{game.title}</div>
                <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#78909C', marginTop: 3 }}>{game.desc}</div>
                <div style={{ marginTop: 8, background: game.bg, borderRadius: 8, padding: '3px 10px', display: 'inline-block', fontFamily: 'Nunito', fontSize: 11, fontWeight: 700, color: game.color }}>Mulai Main →</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Student Hasil Screen ──────────────────────────────────────────────────────
function StudentHasil({ userProgress, userTests }: { userProgress: UserProgress; userTests: TestResult[] }) {
  const preResult = userTests.find(t => t.jenisTest === 'pre') || null
  const postResult = userTests.find(t => t.jenisTest === 'post') || null
  const topicColors: Record<string, string> = { 'Pengertian Gizi': '#42A5F5', 'Isi Piringku': '#66BB6A', 'Makanan Bergizi Seimbang': '#FF7043', 'Pentingnya Sarapan': '#FFC107', 'Minum Air Putih': '#26C6DA', 'Aktivitas Fisik': '#AB47BC', 'Gizi & Kesehatan': '#EF5350' }

  if (!preResult && !postResult) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <div style={{ background: 'white', borderRadius: 24, padding: 28, textAlign: 'center', boxShadow: '0 6px 24px rgba(0,0,0,0.08)', marginBottom: 16 }}>
          <div style={{ fontSize: 56, marginBottom: 14 }}>📋</div>
          <div style={{ fontFamily: 'Baloo 2', fontSize: 18, fontWeight: 800, color: '#1A237E', marginBottom: 8 }}>Belum Ada Hasil Tes</div>
          <div style={{ fontFamily: 'Nunito', fontSize: 13, color: '#546E7A', lineHeight: 1.7 }}>Kerjakan Pre-Test terlebih dahulu untuk melihat hasil belajarmu di sini. Hasil akan muncul setelah kamu menyelesaikan tes.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { icon: '📚', label: 'Materi Selesai', value: `${userProgress.materiSelesai.length}/${materials.length}`, color: '#42A5F5', bg: '#E3F2FD' },
            { icon: '✏️', label: 'Kuis Dikerjakan', value: `${userProgress.kuisSelesai}`, color: '#66BB6A', bg: '#E8F5E9' },
            { icon: '🎮', label: 'Game Dimainkan', value: `${userProgress.gameDimainkan.length}`, color: '#FF7043', bg: '#FFF3E0' },
            { icon: '⚡', label: 'Total Poin', value: `${userProgress.totalPoin}`, color: '#FFC107', bg: '#FFF9C4' },
          ].map((item, i) => (
            <div key={i} style={{ background: item.bg, borderRadius: 20, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 28 }}>{item.icon}</div>
              <div style={{ fontFamily: 'Baloo 2', fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}</div>
              <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#546E7A', fontWeight: 600 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Pre/Post comparison */}
      <div style={{ background: 'linear-gradient(135deg, #7B1FA2, #4A148C)', borderRadius: 20, padding: 16, boxShadow: '0 6px 24px rgba(123,31,162,0.3)' }}>
        <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 800, color: 'white', marginBottom: 12 }}>📋 Rekap Pre-Test & Post-Test</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Pre-Test</div>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 26, fontWeight: 800, color: preResult ? '#90CAF9' : 'rgba(255,255,255,0.3)' }}>{preResult ? preResult.skor : '—'}</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{preResult ? getKnowledgeLevel(preResult.skor).label : 'Belum dikerjakan'}</div>
            {preResult && <div style={{ fontFamily: 'Nunito', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{fmtDate(new Date(preResult.waktuPengerjaan))}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 20 }}>→</div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Post-Test</div>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 26, fontWeight: 800, color: postResult ? '#FFC107' : 'rgba(255,255,255,0.3)' }}>{postResult ? postResult.skor : '—'}</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{postResult ? getKnowledgeLevel(postResult.skor).label : 'Belum dikerjakan'}</div>
            {postResult && <div style={{ fontFamily: 'Nunito', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{fmtDate(new Date(postResult.waktuPengerjaan))}</div>}
          </div>
          {preResult && postResult && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 20 }}>→</div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Δ Perubahan</div>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 26, fontWeight: 800, color: postResult.skor >= preResult.skor ? '#69F0AE' : '#EF9A9A' }}>
                  {postResult.skor >= preResult.skor ? '+' : ''}{postResult.skor - preResult.skor}
                </div>
                <div style={{ fontFamily: 'Nunito', fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{postResult.skor >= preResult.skor ? '📈 Meningkat' : '📉 Menurun'}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { icon: '📚', label: 'Materi Selesai', value: `${userProgress.materiSelesai.length}`, unit: `/${materials.length}`, color: '#42A5F5', bg: '#E3F2FD', border: '#90CAF9' },
          { icon: '✏️', label: 'Kuis Dikerjakan', value: `${userProgress.kuisSelesai}`, unit: ' kuis', color: '#66BB6A', bg: '#E8F5E9', border: '#A5D6A7' },
          { icon: '🎮', label: 'Game Dimainkan', value: `${userProgress.gameDimainkan.length}`, unit: ' sesi', color: '#FF7043', bg: '#FFF3E0', border: '#FFCC80' },
          { icon: '⚡', label: 'Total Poin', value: `${userProgress.totalPoin}`, unit: ' poin', color: '#FFC107', bg: '#FFF9C4', border: '#FFD54F' },
        ].map((item, i) => (
          <div key={i} style={{ background: item.bg, borderRadius: 20, padding: '14px 12px', border: `2px solid ${item.border}`, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 28 }}>{item.icon}</div>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 22, fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}<span style={{ fontSize: 13, fontWeight: 600 }}>{item.unit}</span></div>
            <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#546E7A', fontWeight: 600 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Per-topic breakdown from actual test */}
      {(preResult || postResult) && (() => {
        const result = postResult || preResult!
        const topicDetail = result.topikDetail
        return (
          <div style={{ background: 'white', borderRadius: 20, padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 15, fontWeight: 700, color: '#1A237E', marginBottom: 14 }}>📋 Nilai per Topik ({postResult ? 'Post-Test' : 'Pre-Test'})</div>
            {Object.entries(topicDetail).map(([topic, detail], i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontFamily: 'Nunito', fontSize: 12, fontWeight: 700, color: '#37474F' }}>{topic}</div>
                  <div style={{ fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 800, color: topicColors[topic] ?? '#42A5F5' }}>{detail.benar}/{detail.total} ({detail.pct}%)</div>
                </div>
                <div style={{ height: 8, background: '#F5F5F5', borderRadius: 99 }}>
                  <div style={{ width: `${detail.pct}%`, height: '100%', background: topicColors[topic] ?? '#42A5F5', borderRadius: 99, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      <div style={{ background: 'linear-gradient(135deg, #E8F5E9, #C8E6C9)', borderRadius: 20, padding: 16, border: '2px solid #A5D6A7', display: 'flex', gap: 12, alignItems: 'center' }}>
        <MascotGizi size={52} />
        <div>
          <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: '#2E7D32' }}>Semangat Belajar! 💪</div>
          <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#388E3C', marginTop: 4, lineHeight: 1.5 }}>"Setiap hari kamu semakin pintar tentang gizi. Terus belajar dan jadilah juara kesehatan!"</div>
        </div>
      </div>
    </div>
  )
}

// ─── Developer Hasil Screen ────────────────────────────────────────────────────
function DeveloperHasil({ students, onRefresh }: { students: StudentDashboardData[]; onRefresh: () => Promise<void> }) {
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<{ type: 'reset' | 'delete'; student: StudentDashboardData } | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [answerDetail, setAnswerDetail] = useState<'pre' | 'post' | null>(null)
  const [statusFilter, setStatusFilter] = useState<'Semua Siswa' | 'Belum Mulai' | 'Sedang Berlangsung' | 'Belum Lengkap' | 'Selesai Semua'>('Semua Siswa')
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'month' | 'all' | 'specific' | 'range'>('all')
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'all' | SessionStatus>('all')
  const [specificDate, setSpecificDate] = useState(localDateKey(new Date()))
  const [rangeStart, setRangeStart] = useState(localDateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [rangeEnd, setRangeEnd] = useState(localDateKey(new Date()))
  const [refreshKey, setRefreshKey] = useState(0)
  const now = Date.now()

  function refresh() { setRefreshKey(k => k + 1) }
  useEffect(() => {
    refresh()
    const timer = window.setInterval(() => {
      refresh()
      void onRefresh()
    }, 10_000)
    return () => {
      window.clearInterval(timer)
    }
  }, [onRefresh])
  void refreshKey
  
async function confirmStudentAction() {
  if (!pendingAction) return

  setActionLoading(true)
  setActionMessage(null)

  try {
    if (pendingAction.type === 'reset') {
      await localResetStudent(pendingAction.student.user.userId)

      setActionMessage({
        type: 'success',
        text: `Progress ${pendingAction.student.user.name} berhasil direset.`,
      })
    } else {
      await localDeleteStudent(pendingAction.student.user.userId)

      setActionMessage({
        type: 'success',
        text: `Akun ${pendingAction.student.user.name} berhasil dihapus.`,
      })

      if (selectedStudent === pendingAction.student.user.userId) {
        setSelectedStudent(null)
      }
    }

    setPendingAction(null)
    setDeleteConfirmation('')
    await onRefresh()
  } catch (error) {
    console.error('Gagal menjalankan tindakan siswa:', error)

    const detail =
      error instanceof Error ? error.message : String(error)

    setActionMessage({
      type: 'error',
      text: `${
        pendingAction.type === 'reset'
          ? 'Reset progress gagal'
          : 'Penghapusan akun gagal'
      }: ${detail}`,
    })
  } finally {
    setActionLoading(false)
  }
}

  function matchesDateFilter(session: LoginSession) {
    const sessionDate = new Date(`${session.date}T00:00:00`)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((today.getTime() - sessionDate.getTime()) / 86_400_000)
    if (dateFilter === 'today') return diffDays === 0
    if (dateFilter === 'yesterday') return diffDays === 1
    if (dateFilter === '7days') return diffDays >= 0 && diffDays < 7
    if (dateFilter === '30days') return diffDays >= 0 && diffDays < 30
    if (dateFilter === 'month') return sessionDate.getMonth() === today.getMonth() && sessionDate.getFullYear() === today.getFullYear()
    if (dateFilter === 'specific') return session.date === specificDate
    if (dateFilter === 'range') return session.date >= rangeStart && session.date <= rangeEnd
    return true
  }

  const allSessions = students.flatMap(student => student.loginSessions)
  const todayKey = localDateKey(new Date())
  const todaySessions = allSessions.filter(session => session.date === todayKey)
  const activeToday = new Set(todaySessions.filter(session => isSessionActive(session, now)).map(session => session.userId)).size
  const todaySeconds = todaySessions.reduce((sum, session) => sum + sessionDuration(session, now), 0)
  const todayUsers = new Set(todaySessions.map(session => session.userId)).size

  const sorted = [...students].sort((a, b) => {
    const aPost = a.post?.skor ?? -1
    const bPost = b.post?.skor ?? -1
    if (bPost !== aPost) return bPost - aPost
    const aPre = a.pre?.skor ?? -1
    const bPre = b.pre?.skor ?? -1
    return bPre - aPre
  })

  const top3 = sorted.filter(s => s.post !== null).slice(0, 3)
  const topicColors: Record<string, string> = { 'Pengertian Gizi': '#42A5F5', 'Isi Piringku': '#66BB6A', 'Makanan Bergizi Seimbang': '#FF7043', 'Pentingnya Sarapan': '#FFC107', 'Minum Air Putih': '#26C6DA', 'Aktivitas Fisik': '#AB47BC', 'Gizi & Kesehatan': '#EF5350' }
  const rankMedals = ['🥇', '🥈', '🥉']

  function studentStatus(student: StudentDashboardData) {
    const materialDone = student.progress.materiSelesai.length === materials.length
    const quizDone = student.progress.kuisSelesai > 0
    const gameDone = new Set(student.progress.gameDimainkan.map(item => item.split('_')[0])).size === 3
    const checks = [materialDone, quizDone, gameDone, Boolean(student.pre), Boolean(student.post)]
    const count = checks.filter(Boolean).length
    if (count === 0) return 'Belum Mulai' as const
    if (count === checks.length) return 'Selesai Semua' as const
    if (count <= 2) return 'Sedang Berlangsung' as const
    return 'Belum Lengkap' as const
  }

  const filteredStudents = sorted.filter(student => statusFilter === 'Semua Siswa' || studentStatus(student) === statusFilter)
  const actionDialog = pendingAction && (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.58)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 430, background: 'white', borderRadius: 24, padding: 20, boxShadow: '0 24px 70px rgba(0,0,0,0.28)' }}>
        <div style={{ width: 46, height: 46, borderRadius: 15, background: pendingAction.type === 'reset' ? '#FFF3E0' : '#FFEBEE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 12 }}>
          {pendingAction.type === 'reset' ? '↻' : '!'}
        </div>
        <div style={{ fontFamily: 'Baloo 2', fontSize: 19, fontWeight: 800, color: '#1A237E' }}>{pendingAction.type === 'reset' ? 'Reset Progress Siswa?' : 'Hapus Akun Siswa?'}</div>
        <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#546E7A', lineHeight: 1.6, marginTop: 7 }}>
          {pendingAction.type === 'reset'
            ? `Apakah Anda yakin ingin mereset seluruh progress ${pendingAction.student.user.name}? Semua hasil pembelajaran siswa akan dikembalikan ke kondisi awal.`
            : `Apakah Anda yakin ingin menghapus akun ${pendingAction.student.user.name}? Akun dan seluruh data siswa yang terkait akan dihapus dan tidak dapat dipulihkan.`}
        </div>
        <div style={{ borderRadius: 13, background: pendingAction.type === 'reset' ? '#FFF8E1' : '#FFF1F2', padding: 11, marginTop: 12, fontFamily: 'Nunito', fontSize: 10, color: pendingAction.type === 'reset' ? '#E65100' : '#C62828', lineHeight: 1.55, fontWeight: 700 }}>
          {pendingAction.type === 'reset'
            ? 'Akun, profil, UserId, dan riwayat login tetap ada. Progress, hasil tes, kuis, game, badge, dan ranking akan direset.'
            : 'Akun, profil, progress, hasil tes, aktivitas, screen time, dan data monitoring akan dihapus permanen.'}
        </div>
        {pendingAction.type === 'delete' && (
          <label style={{ display: 'block', fontFamily: 'Nunito', fontSize: 10, fontWeight: 900, color: '#37474F', marginTop: 12 }}>
            Ketik HAPUS untuk melanjutkan
            <input autoFocus value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} placeholder="HAPUS" style={{ width: '100%', border: '2px solid #FFCDD2', borderRadius: 12, padding: '10px 12px', marginTop: 5, fontFamily: 'Nunito', outlineColor: '#EF5350' }} />
          </label>
        )}
        <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
          <button disabled={actionLoading} onClick={() => { setPendingAction(null); setDeleteConfirmation('') }} style={{ flex: 1, border: '2px solid #E3E8EF', borderRadius: 13, padding: '11px 8px', background: 'white', color: '#546E7A', fontFamily: 'Nunito', fontWeight: 900, cursor: 'pointer' }}>Batal</button>
          <button disabled={actionLoading || (pendingAction.type === 'delete' && deleteConfirmation !== 'HAPUS')} onClick={confirmStudentAction} style={{ flex: 1, border: 'none', borderRadius: 13, padding: '11px 8px', background: pendingAction.type === 'reset' ? '#F57C00' : '#D32F2F', color: 'white', fontFamily: 'Nunito', fontWeight: 900, cursor: actionLoading ? 'wait' : 'pointer', opacity: actionLoading || (pendingAction.type === 'delete' && deleteConfirmation !== 'HAPUS') ? 0.55 : 1 }}>
            {actionLoading ? (pendingAction.type === 'reset' ? 'Mereset progress...' : 'Menghapus akun...') : pendingAction.type === 'reset' ? 'Reset Progress' : 'Hapus Akun'}
          </button>
        </div>
      </div>
    </div>
  )

  if (selectedStudent) {
    const sd = students.find(s => s.user.userId === selectedStudent)!
    const progress = computeOverallProgress(sd.progress, [sd.pre, sd.post].filter(Boolean) as TestResult[])
    const latestActivity = [...(sd.progress.activities || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    const sessions = [...sd.loginSessions].sort((a, b) => new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime())
    const filteredSessions = sessions.filter(session => matchesDateFilter(session) && (sessionStatusFilter === 'all' || session.status === sessionStatusFilter))
    const totalSeconds = sessions.reduce((sum, session) => sum + sessionDuration(session, now), 0)
    const lastLogin = sessions[0]
    const lastActivitySession = [...sessions].sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())[0]
    const dailySessions = filteredSessions.reduce<Record<string, LoginSession[]>>((groups, session) => {
      groups[session.date] = [...(groups[session.date] || []), session]
      return groups
    }, {})
    const selectedSessionData = sessions.find(session => session.id === selectedSession) || null
    const selectedSessionLogs = selectedSessionData
      ? sd.activityLogs.filter(log => log.sessionId === selectedSessionData.id).sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
      : []
    const detailResult = answerDetail === 'pre' ? sd.pre : answerDetail === 'post' ? sd.post : null
    if (answerDetail && detailResult) {
      return (
        <div style={{ padding: '16px 16px 40px' }}>
          <button onClick={() => setAnswerDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginBottom: 14, fontFamily: 'Nunito', fontSize: 13, fontWeight: 800, color: '#1976D2', padding: 0 }}>← Kembali ke Detail Siswa</button>
          <div style={{ background: 'white', borderRadius: 20, padding: 18, marginBottom: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 18, fontWeight: 800, color: '#1A237E' }}>Detail Jawaban {answerDetail === 'pre' ? 'Pre-Test' : 'Post-Test'}</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#546E7A' }}>{sd.user.name} · Nilai {detailResult.skor} · {detailResult.jumlahBenar} benar · {detailResult.jumlahSalah} salah · {detailResult.totalSoal} soal</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#78909C', marginTop: 3 }}>{fmtLongDate(new Date(detailResult.waktuPengerjaan))} • {fmtTimeSeconds(new Date(detailResult.waktuPengerjaan))}</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#546E7A', marginTop: 3 }}>
  ⏱️ Durasi pengerjaan: {detailResult.durationSeconds != null
    ? formatDuration(detailResult.durationSeconds, true)
    : 'Belum tersedia'}
</div>
          </div>
          {allQuestions.map((question, index) => {
            const selected = detailResult.jawaban[index]
            const isCorrect = selected === question.correct
            return (
              <div key={question.id} style={{ background: 'white', borderRadius: 16, padding: 14, marginBottom: 10, border: `2px solid ${isCorrect ? '#A5D6A7' : '#FFCDD2'}` }}>
                <div style={{ fontFamily: 'Nunito', fontSize: 12, fontWeight: 800, color: '#1A237E', lineHeight: 1.5 }}>{question.id}. {question.q}</div>
                <div style={{ marginTop: 8, fontFamily: 'Nunito', fontSize: 11, color: isCorrect ? '#2E7D32' : '#C62828', fontWeight: 800 }}>{isCorrect ? 'BENAR' : 'SALAH'}</div>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#546E7A', marginTop: 3 }}>Jawaban siswa: {selected >= 0 ? `${String.fromCharCode(65 + selected)}. ${question.options[selected]}` : 'Tidak dijawab'}</div>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#2E7D32', marginTop: 2 }}>Jawaban benar: {String.fromCharCode(65 + question.correct)}. {question.options[question.correct]}</div>
              </div>
            )
          })}
        </div>
      )
    }
    return (
      <div style={{ padding: '16px 16px', paddingBottom: 40 }}>
        {actionDialog}
        {actionMessage && <div role="status" style={{ borderRadius: 12, padding: '10px 12px', marginBottom: 12, background: actionMessage.type === 'success' ? '#E8F5E9' : '#FFEBEE', color: actionMessage.type === 'success' ? '#2E7D32' : '#C62828', fontFamily: 'Nunito', fontSize: 11, fontWeight: 800 }}>{actionMessage.text}</div>}
        <button onClick={() => setSelectedStudent(null)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, fontFamily: 'Nunito', fontSize: 13, fontWeight: 700, color: '#1976D2', padding: 0 }}>← Kembali ke Daftar Siswa</button>
        <div style={{ background: 'white', borderRadius: 20, padding: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, overflow: 'hidden' }}>{sd.user.profilePhoto ? <img src={sd.user.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🧑‍🎒'}</div>
            <div>
              <div style={{ fontFamily: 'Baloo 2', fontSize: 18, fontWeight: 800, color: '#1A237E' }}>{sd.user.name}</div>
              <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#78909C' }}>{sd.user.kelas} · {sd.user.sekolah}</div>
              <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#78909C' }}>Username: {sd.user.username}</div>
              <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#90A4AE', marginTop: 2 }}>Aktivitas terakhir: {latestActivity ? fmtDateTime(latestActivity.timestamp) : 'Belum ada aktivitas'}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
           <div style={{ background: '#E3F2FD', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
  <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#546E7A' }}>Pre-Test</div>
  <div style={{ fontFamily: 'Baloo 2', fontSize: 22, fontWeight: 800, color: '#1976D2' }}>{sd.pre ? sd.pre.skor : '—'}</div>

  {sd.pre && (
    <div style={{ fontFamily: 'Nunito', fontSize: 9, color: '#546E7A', marginTop: 3 }}>
      ⏱️ {sd.pre.durationSeconds != null
        ? formatDuration(sd.pre.durationSeconds, true)
        : 'Belum tersedia'}
    </div>
  )}
</div>
            <div style={{ background: '#EDE7F6', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
  <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#546E7A' }}>Post-Test</div>
  <div style={{ fontFamily: 'Baloo 2', fontSize: 22, fontWeight: 800, color: '#7B1FA2' }}>{sd.post ? sd.post.skor : '—'}</div>

  {sd.post && (
    <div style={{ fontFamily: 'Nunito', fontSize: 9, color: '#546E7A', marginTop: 3 }}>
      ⏱️ {sd.post.durationSeconds != null
        ? formatDuration(sd.post.durationSeconds, true)
        : 'Belum tersedia'}
    </div>
  )}
</div>
            <div style={{ background: '#F3E5F5', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#546E7A' }}>Progress</div>
              <div style={{ fontFamily: 'Baloo 2', fontSize: 22, fontWeight: 800, color: '#AB47BC' }}>{progress}%</div>
            </div>
          </div>
          <div style={{ marginTop: 14, background: '#F8FAFF', borderRadius: 14, padding: 12 }}>
            <div style={{ fontFamily: 'Nunito', fontSize: 11, fontWeight: 800, color: '#1A237E', marginBottom: 8 }}>Checklist penyelesaian</div>
            {[
              ['Materi', sd.progress.materiSelesai.length === materials.length],
              ['Kuis', sd.progress.kuisSelesai > 0],
              ['Game', new Set(sd.progress.gameDimainkan.map(item => item.split('_')[0])).size === 3],
              ['Pre-Test', Boolean(sd.pre)],
              ['Post-Test', Boolean(sd.post)],
            ].map(([label, complete]) => <span key={String(label)} style={{ display: 'inline-block', margin: '0 6px 6px 0', padding: '5px 8px', borderRadius: 8, background: complete ? '#E8F5E9' : '#ECEFF1', color: complete ? '#2E7D32' : '#78909C', fontFamily: 'Nunito', fontSize: 10, fontWeight: 800 }}>{complete ? '✓' : '○'} {label}</span>)}
            <div style={{ fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 800, color: studentStatus(sd) === 'Selesai Semua' ? '#2E7D32' : '#E65100', marginTop: 4 }}>{studentStatus(sd).toUpperCase()}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button disabled={!sd.pre} onClick={() => setAnswerDetail('pre')} style={{ flex: 1, border: 'none', borderRadius: 12, padding: '9px 6px', background: sd.pre ? '#E3F2FD' : '#ECEFF1', color: sd.pre ? '#1976D2' : '#90A4AE', fontFamily: 'Nunito', fontWeight: 800, cursor: sd.pre ? 'pointer' : 'not-allowed' }}>Jawaban Pre-Test</button>
            <button disabled={!sd.post} onClick={() => setAnswerDetail('post')} style={{ flex: 1, border: 'none', borderRadius: 12, padding: '9px 6px', background: sd.post ? '#EDE7F6' : '#ECEFF1', color: sd.post ? '#7B1FA2' : '#90A4AE', fontFamily: 'Nunito', fontWeight: 800, cursor: sd.post ? 'pointer' : 'not-allowed' }}>Jawaban Post-Test</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => setPendingAction({ type: 'reset', student: sd })} style={{ flex: 1, border: '1px solid #FFCC80', borderRadius: 11, padding: '8px 6px', background: '#FFF8E1', color: '#E65100', fontFamily: 'Nunito', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>Reset Progress</button>
            <button onClick={() => setPendingAction({ type: 'delete', student: sd })} style={{ flex: 1, border: '1px solid #FFCDD2', borderRadius: 11, padding: '8px 6px', background: '#FFF5F5', color: '#C62828', fontFamily: 'Nunito', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>Hapus Akun</button>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 20, padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: 'Baloo 2', fontSize: 15, fontWeight: 800, color: '#1A237E' }}>Aktivitas Login & Screen Time</div>
              <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#78909C' }}>Data aktual penggunaan aplikasi</div>
            </div>
            {lastLogin && isSessionActive(lastLogin, now) && <div style={{ borderRadius: 99, background: '#E8F5E9', color: '#2E7D32', padding: '5px 9px', fontFamily: 'Nunito', fontSize: 9, fontWeight: 900 }}>● Sedang Aktif</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Total Screen Time', value: formatDuration(totalSeconds) },
              { label: 'Total Sesi Login', value: `${sessions.length} sesi` },
              { label: 'Rata-rata per Sesi', value: sessions.length ? formatDuration(totalSeconds / sessions.length) : 'Belum ada data' },
              { label: 'Login Terakhir', value: lastLogin ? fmtLongDateTime(lastLogin.loginAt) : 'Belum ada data login' },
              { label: 'Aktivitas Terakhir', value: lastActivitySession ? fmtLongDateTime(lastActivitySession.lastActivityAt) : 'Belum ada aktivitas' },
              { label: 'Sesi Berjalan', value: lastLogin && isSessionActive(lastLogin, now) ? formatDuration(sessionDuration(lastLogin, now), true) : 'Offline' },
            ].map(item => (
              <div key={item.label} style={{ background: '#F5F8FF', borderRadius: 12, padding: 10, border: '1px solid #E8EAF6' }}>
                <div style={{ fontFamily: 'Nunito', fontSize: 9, color: '#78909C', fontWeight: 800, textTransform: 'uppercase' }}>{item.label}</div>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 13, lineHeight: 1.35, color: '#1A237E', fontWeight: 800, marginTop: 3 }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div style={{ fontFamily: 'Nunito', fontSize: 10, fontWeight: 900, color: '#546E7A', marginBottom: 6 }}>FILTER AKTIVITAS</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8 }} className="scrollbar-hide">
            {([
              ['today', 'Hari ini'], ['yesterday', 'Kemarin'], ['7days', '7 hari'], ['30days', '30 hari'],
              ['month', 'Bulan ini'], ['all', 'Semua'], ['specific', 'Tanggal tertentu'], ['range', 'Rentang tanggal'],
            ] as const).map(([value, label]) => (
              <button key={value} onClick={() => setDateFilter(value)} style={{ whiteSpace: 'nowrap', border: 'none', borderRadius: 10, padding: '7px 10px', background: dateFilter === value ? '#1A237E' : '#E8EAF6', color: dateFilter === value ? 'white' : '#3949AB', fontFamily: 'Nunito', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
          {dateFilter === 'specific' && (
            <input aria-label="Pilih tanggal aktivitas" type="date" value={specificDate} onChange={event => setSpecificDate(event.target.value)} style={{ width: '100%', border: '2px solid #E3F2FD', borderRadius: 12, padding: '9px 11px', fontFamily: 'Nunito', color: '#1A237E', marginBottom: 10 }} />
          )}
          {dateFilter === 'range' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <label style={{ fontFamily: 'Nunito', fontSize: 9, fontWeight: 800, color: '#546E7A' }}>DARI
                <input aria-label="Tanggal awal" type="date" value={rangeStart} max={rangeEnd} onChange={event => setRangeStart(event.target.value)} style={{ width: '100%', border: '2px solid #E3F2FD', borderRadius: 10, padding: '8px', fontFamily: 'Nunito', color: '#1A237E', marginTop: 4 }} />
              </label>
              <label style={{ fontFamily: 'Nunito', fontSize: 9, fontWeight: 800, color: '#546E7A' }}>SAMPAI
                <input aria-label="Tanggal akhir" type="date" value={rangeEnd} min={rangeStart} onChange={event => setRangeEnd(event.target.value)} style={{ width: '100%', border: '2px solid #E3F2FD', borderRadius: 10, padding: '8px', fontFamily: 'Nunito', color: '#1A237E', marginTop: 4 }} />
              </label>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {([
              ['all', 'Semua status'], ['active', 'Active'], ['completed', 'Session ended'], ['auto-ended', 'Auto-ended'],
            ] as const).map(([value, label]) => (
              <button key={value} onClick={() => setSessionStatusFilter(value)} style={{ border: '1px solid #C5CAE9', borderRadius: 9, padding: '5px 8px', background: sessionStatusFilter === value ? '#E8EAF6' : 'white', color: '#3949AB', fontFamily: 'Nunito', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>

          {selectedSessionData && (
            <div style={{ background: '#EEF4FF', border: '2px solid #90CAF9', borderRadius: 16, padding: 14, margin: '6px 0 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 800, color: '#1565C0' }}>Detail Sesi</div>
                <button onClick={() => setSelectedSession(null)} style={{ border: 'none', borderRadius: 8, background: '#DCEBFF', color: '#1565C0', cursor: 'pointer', fontWeight: 900 }}>×</button>
              </div>
              <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#37474F', lineHeight: 1.8, marginTop: 6 }}>
                <strong>Nama:</strong> {sd.user.name}<br />
                <strong>Tanggal:</strong> {fmtLongDate(new Date(selectedSessionData.loginAt))}<br />
                <strong>Login:</strong> {fmtTimeSeconds(new Date(selectedSessionData.loginAt))}<br />
                <strong>Logout:</strong> {selectedSessionData.logoutAt ? fmtTimeSeconds(new Date(selectedSessionData.logoutAt)) : 'Sesi masih berjalan'}<br />
                <strong>Durasi:</strong> {formatDuration(sessionDuration(selectedSessionData, now), true)}<br />
                <strong>Status:</strong> {selectedSessionData.status === 'active' ? 'Active' : selectedSessionData.status === 'auto-ended' ? 'Session ended automatically' : 'Session ended'}
              </div>
              <div style={{ fontFamily: 'Nunito', fontSize: 10, fontWeight: 900, color: '#1565C0', marginTop: 10, marginBottom: 5 }}>AKTIVITAS SELAMA SESI</div>
              {selectedSessionLogs.length === 0 ? (
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#78909C' }}>Belum ada aktivitas tercatat.</div>
              ) : selectedSessionLogs.map(log => (
                <div key={log.id} style={{ display: 'flex', gap: 9, padding: '6px 0', borderTop: '1px solid #D8E6F8' }}>
                  <div style={{ width: 48, fontFamily: 'Baloo 2', fontSize: 11, fontWeight: 800, color: '#1976D2' }}>{fmtTime(new Date(log.startedAt))}</div>
                  <div style={{ flex: 1, fontFamily: 'Nunito', fontSize: 11, color: '#37474F', fontWeight: 700 }}>{log.activityName}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 800, color: '#1A237E', margin: '8px 0' }}>Screen Time Harian</div>
          {Object.keys(dailySessions).length === 0 ? (
            <div style={{ background: '#F8FAFF', borderRadius: 12, padding: 18, textAlign: 'center', fontFamily: 'Nunito', fontSize: 12, color: '#78909C' }}>
              {sessions.length === 0 ? 'Belum ada riwayat aktivitas.' : 'Tidak ada aktivitas pada rentang tanggal ini.'}
            </div>
          ) : Object.entries(dailySessions).map(([date, daySessions]) => {
            const dailySeconds = daySessions.reduce((sum, session) => sum + sessionDuration(session, now), 0)
            return (
              <div key={date} style={{ borderTop: '1px solid #EEF1F5', padding: '11px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontFamily: 'Nunito', fontSize: 12, fontWeight: 900, color: '#1A237E' }}>{fmtLongDate(new Date(`${date}T00:00:00`))}</div>
                    <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#78909C' }}>{daySessions.length} sesi login</div>
                  </div>
                  <div style={{ fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 800, color: '#1976D2' }}>{formatDuration(dailySeconds)}</div>
                </div>
                {daySessions.map(session => (
                  <button key={session.id} onClick={() => setSelectedSession(session.id)} style={{ width: '100%', border: 'none', borderRadius: 11, background: '#F8FAFF', marginTop: 5, padding: '9px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr auto', gap: 6, alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#546E7A' }}><strong>Login</strong><br />{fmtTime(new Date(session.loginAt))}</div>
                    <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#546E7A' }}><strong>Logout</strong><br />{session.logoutAt ? fmtTime(new Date(session.logoutAt)) : 'Aktif'}</div>
                    <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#546E7A' }}><strong>Screen Time</strong><br />{formatDuration(sessionDuration(session, now))}</div>
                    <div style={{ color: '#90CAF9', fontWeight: 900 }}>›</div>
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        <div style={{ background: 'white', borderRadius: 20, padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: 14 }}>
          <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: '#1A237E', marginBottom: 12 }}>📚 Status Materi Siswa</div>
          {materials.map((material, index) => {
            const complete = sd.progress.materiSelesai.includes(material.id)
            return (
              <div key={material.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 0', borderBottom: index < materials.length - 1 ? '1px solid #F0F4F8' : 'none' }}>
                <div style={{ width: 30, height: 30, borderRadius: 10, background: material.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{material.icon}</div>
                <div style={{ flex: 1, fontFamily: 'Nunito', fontSize: 11, fontWeight: 700, color: '#37474F' }}>{material.title}</div>
                <div style={{ borderRadius: 8, padding: '4px 7px', background: complete ? '#E8F5E9' : '#ECEFF1', color: complete ? '#2E7D32' : '#78909C', fontFamily: 'Nunito', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{complete ? 'Selesai' : 'Belum'}</div>
              </div>
            )
          })}
        </div>

        {(sd.pre || sd.post) && (() => {
          const result = sd.post || sd.pre!
          return (
            <div style={{ background: 'white', borderRadius: 20, padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: 14 }}>
              <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: '#1A237E', marginBottom: 12 }}>📋 Nilai per Topik ({sd.post ? 'Post-Test' : 'Pre-Test'})</div>
              {Object.entries(result.topikDetail).map(([topic, detail], i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <div style={{ fontFamily: 'Nunito', fontSize: 11, fontWeight: 700, color: '#37474F' }}>{topic}</div>
                    <div style={{ fontFamily: 'Baloo 2', fontSize: 12, fontWeight: 800, color: topicColors[topic] ?? '#42A5F5' }}>{detail.benar}/{detail.total} ({detail.pct}%)</div>
                  </div>
                  <div style={{ height: 7, background: '#F5F5F5', borderRadius: 99 }}>
                    <div style={{ width: `${detail.pct}%`, height: '100%', background: topicColors[topic] ?? '#42A5F5', borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        <div style={{ background: 'white', borderRadius: 20, padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: '#1A237E', marginBottom: 12 }}>📊 Detail Aktivitas</div>
          {[
            { label: 'Materi Selesai', val: sd.progress.materiSelesai.length, max: materials.length, color: '#42A5F5' },
            { label: 'Kuis Diselesaikan', val: sd.progress.kuisSelesai, max: 10, color: '#66BB6A' },
            { label: 'Game Dimainkan', val: sd.progress.gameDimainkan.length, max: 9, color: '#FF7043' },
          ].map((item, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontFamily: 'Nunito', fontSize: 12, fontWeight: 600, color: '#546E7A' }}>{item.label}</div>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 700, color: item.color }}>{item.val}/{item.max}</div>
              </div>
              <div style={{ height: 8, background: '#F5F5F5', borderRadius: 99 }}>
                <div style={{ width: `${Math.min(100, (item.val / item.max) * 100)}%`, height: '100%', background: item.color, borderRadius: 99 }} />
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#546E7A' }}>⚡ Total Poin: <strong style={{ color: '#FF7043' }}>{sd.progress.totalPoin}</strong></div>
            <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#546E7A' }}>🏅 Badge: <strong style={{ color: '#AB47BC' }}>{sd.progress.badge}</strong></div>
          </div>
          {sd.pre && (
  <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#90A4AE', marginTop: 8 }}>
    📝 Pre-Test: {fmtDateTime(sd.pre.waktuPengerjaan)}
    {sd.pre.durationSeconds != null && ` · ⏱️ ${formatDuration(sd.pre.durationSeconds, true)}`}
  </div>
)}

{sd.post && (
  <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#90A4AE', marginTop: 4 }}>
    🎯 Post-Test: {fmtDateTime(sd.post.waktuPengerjaan)}
    {sd.post.durationSeconds != null && ` · ⏱️ ${formatDuration(sd.post.durationSeconds, true)}`}
  </div>
)}
        {(sd.progress.kuisScores.length > 0 || sd.progress.gameScores.length > 0) && (
          <div style={{ background: 'white', borderRadius: 20, padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginTop: 14 }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: '#1A237E', marginBottom: 12 }}>Riwayat Kuis & Game</div>
            {sd.progress.kuisScores.map((score, index) => (
              <div key={`quiz-${index}`} style={{ padding: '8px 0', borderBottom: '1px solid #F0F4F8', fontFamily: 'Nunito', fontSize: 11, color: '#546E7A' }}>
                Kuis #{index + 1} · <strong style={{ color: '#2E7D32' }}>Skor {score}</strong> · {sd.progress.kuisTimestamps[index] ? fmtDateTime(sd.progress.kuisTimestamps[index]) : 'Waktu tidak tersedia'}
              </div>
            ))}
            {(sd.progress.gameScores || []).map((game, index) => (
              <div key={`${game.gameId}-${index}`} style={{ padding: '8px 0', borderBottom: '1px solid #F0F4F8', fontFamily: 'Nunito', fontSize: 11, color: '#546E7A' }}>
                Game {game.gameId} · <strong style={{ color: '#E65100' }}>Skor {game.score}</strong> · {fmtDateTime(game.timestamp)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
  }
  
  return (
    <div style={{ padding: '16px 16px', paddingBottom: 40 }}>
      {actionDialog}
      {actionMessage && <div role="status" style={{ borderRadius: 12, padding: '10px 12px', marginBottom: 12, background: actionMessage.type === 'success' ? '#E8F5E9' : '#FFEBEE', color: actionMessage.type === 'success' ? '#2E7D32' : '#C62828', fontFamily: 'Nunito', fontSize: 11, fontWeight: 800 }}>{actionMessage.text}</div>}
      {/* Top 3 */}
      <div style={{ background: 'linear-gradient(135deg, #FF8F00, #E65100)', borderRadius: 20, padding: 16, marginBottom: 16, boxShadow: '0 6px 24px rgba(230,81,0,0.3)' }}>
        <div style={{ fontFamily: 'Baloo 2', fontSize: 15, fontWeight: 800, color: 'white', marginBottom: 12 }}>🏆 3 Nilai Post-Test Tertinggi</div>
        {top3.length === 0 ? (
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Nunito', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Belum ada siswa yang mengerjakan Post-Test</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {top3.map((sd, i) => (
              <div key={sd.user.userId} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setSelectedStudent(sd.user.userId)}>
                <div style={{ fontSize: 26, flexShrink: 0 }}>{rankMedals[i]}</div>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{sd.user.profilePhoto ? <img src={sd.user.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🧑‍🎒'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Nunito', fontSize: 13, fontWeight: 800, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sd.user.name}</div>
                  <div style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>@{sd.user.username}</div>
                </div>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 22, fontWeight: 800, color: i === 0 ? '#FFE082' : i === 1 ? '#E0E0E0' : '#FFCC80' }}>{sd.post!.skor}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total Siswa', value: students.length, color: '#1976D2', bg: '#E3F2FD' },
          { label: 'Siswa Aktif Hari Ini', value: activeToday, color: '#388E3C', bg: '#E8F5E9' },
          { label: 'Total Sesi Hari Ini', value: todaySessions.length, color: '#E65100', bg: '#FFF3E0' },
          { label: 'Screen Time Hari Ini', value: formatDuration(todaySeconds), color: '#7B1FA2', bg: '#EDE7F6' },
          { label: 'Rata-rata / Siswa', value: todayUsers ? formatDuration(todaySeconds / todayUsers) : '0 menit', color: '#00695C', bg: '#E0F2F1' },
        ].map((stat, i) => (
          <div key={i} style={{ background: stat.bg, borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 22, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#546E7A', fontWeight: 600 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* All students list */}
      <div style={{ background: 'white', borderRadius: 20, padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
        <div style={{ fontFamily: 'Baloo 2', fontSize: 15, fontWeight: 700, color: '#1A237E', marginBottom: 14 }}>
          👥 Semua Siswa ({students.length})
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 4 }} className="scrollbar-hide">
          {(['Semua Siswa', 'Belum Mulai', 'Sedang Berlangsung', 'Belum Lengkap', 'Selesai Semua'] as const).map(filter => (
            <button key={filter} onClick={() => setStatusFilter(filter)} style={{ whiteSpace: 'nowrap', border: 'none', borderRadius: 10, padding: '7px 10px', background: statusFilter === filter ? '#1A237E' : '#E8EAF6', color: statusFilter === filter ? 'white' : '#3949AB', fontFamily: 'Nunito', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>{filter}</button>
          ))}
        </div>
        {students.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div style={{ fontFamily: 'Nunito', fontSize: 13, color: '#546E7A' }}>Belum ada siswa yang terdaftar</div>
          </div>
        ) : (
          filteredStudents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', fontFamily: 'Nunito', fontSize: 12, color: '#78909C' }}>Tidak ada siswa dengan status ini.</div>
          ) : filteredStudents.map((sd, i) => {
            const prog = computeOverallProgress(sd.progress, [sd.pre, sd.post].filter(Boolean) as TestResult[])
            const lastActivity = [...(sd.progress.activities || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
            const studentSessions = [...sd.loginSessions].sort((a, b) => new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime())
            const lastLoginSession = studentSessions[0]
            const studentActive = Boolean(lastLoginSession && isSessionActive(lastLoginSession, now))
            const todayScreenTime = studentSessions.filter(session => session.date === todayKey).reduce((sum, session) => sum + sessionDuration(session, now), 0)
            const totalScreenTime = studentSessions.reduce((sum, session) => sum + sessionDuration(session, now), 0)
            return (
              <div key={sd.user.userId} onClick={() => setSelectedStudent(sd.user.userId)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < students.length - 1 ? '1px solid #F0F4F8' : 'none', cursor: 'pointer', position: 'relative' }}>
                <div style={{ width: 40, height: 40, borderRadius: 14, background: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, overflow: 'hidden' }}>{sd.user.profilePhoto ? <img src={sd.user.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🧑‍🎒'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Nunito', fontSize: 13, fontWeight: 800, color: '#1A237E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sd.user.name}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'Nunito', fontSize: 11, color: '#78909C' }}>Pre: <strong style={{ color: '#1976D2' }}>{sd.pre ? sd.pre.skor : '—'}</strong></span>
                    <span style={{ fontFamily: 'Nunito', fontSize: 11, color: '#78909C' }}>Post: <strong style={{ color: '#7B1FA2' }}>{sd.post ? sd.post.skor : '—'}</strong></span>
                    <span style={{ fontFamily: 'Nunito', fontSize: 11, color: '#78909C' }}>Progress: <strong style={{ color: '#FF7043' }}>{prog}%</strong></span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4, fontFamily: 'Nunito', fontSize: 9, color: '#546E7A' }}>
                    <span>Login terakhir: <strong>{lastLoginSession ? fmtLongDateTime(lastLoginSession.loginAt) : 'Belum ada'}</strong></span>
                    <span>Hari ini: <strong>{formatDuration(todayScreenTime)}</strong></span>
                    <span>Total: <strong>{formatDuration(totalScreenTime)}</strong></span>
                  </div>
                  <div style={{ fontFamily: 'Nunito', fontSize: 9, color: '#90A4AE', marginTop: 3 }}>{lastActivity ? fmtDateTime(lastActivity.timestamp) : 'Belum ada aktivitas belajar'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                  <div style={{ borderRadius: 99, padding: '3px 7px', background: studentActive ? '#E8F5E9' : '#ECEFF1', color: studentActive ? '#2E7D32' : '#78909C', fontFamily: 'Nunito', fontSize: 8, fontWeight: 900 }}>
                    {studentActive ? '● Aktif' : 'Offline'}
                  </div>
                  <div style={{ fontFamily: 'Nunito', fontSize: 9, fontWeight: 800, color: studentStatus(sd) === 'Selesai Semua' ? '#2E7D32' : '#E65100', maxWidth: 76, textAlign: 'right' }}>
                    {studentStatus(sd)}
                  </div>
                  <button aria-label={`Aksi untuk ${sd.user.name}`} onClick={event => { event.stopPropagation(); setOpenActionMenu(openActionMenu === sd.user.userId ? null : sd.user.userId) }} style={{ border: 'none', borderRadius: 9, padding: '4px 7px', background: '#F1F5F9', color: '#546E7A', fontFamily: 'Nunito', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>⋮ Aksi</button>
                </div>
                {openActionMenu === sd.user.userId && (
                  <div onClick={event => event.stopPropagation()} style={{ position: 'absolute', right: 0, top: 66, zIndex: 20, width: 150, borderRadius: 13, background: 'white', padding: 6, boxShadow: '0 10px 30px rgba(15,23,42,0.18)', border: '1px solid #E3E8EF' }}>
                    <button onClick={() => { setSelectedStudent(sd.user.userId); setOpenActionMenu(null) }} style={{ width: '100%', border: 'none', borderRadius: 8, padding: '8px 9px', background: 'white', textAlign: 'left', color: '#1976D2', fontFamily: 'Nunito', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>Lihat Detail</button>
                    <button onClick={() => { setPendingAction({ type: 'reset', student: sd }); setOpenActionMenu(null) }} style={{ width: '100%', border: 'none', borderRadius: 8, padding: '8px 9px', background: 'white', textAlign: 'left', color: '#E65100', fontFamily: 'Nunito', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>Reset Progress</button>
                    <button onClick={() => { setPendingAction({ type: 'delete', student: sd }); setOpenActionMenu(null) }} style={{ width: '100%', border: 'none', borderRadius: 8, padding: '8px 9px', background: '#FFF5F5', textAlign: 'left', color: '#C62828', fontFamily: 'Nunito', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>Hapus Akun</button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Hasil Screen Wrapper ──────────────────────────────────────────────────────
function HasilScreen({ currentUser, userProgress, userTests, students, onRefreshStudents }: {
  currentUser: AppUser
  userProgress: UserProgress
  userTests: TestResult[]
  students: StudentDashboardData[]
  onRefreshStudents: () => Promise<void>
}) {
  return (
    <div style={{ paddingBottom: 80, background: '#F0F8FF', minHeight: '100vh' }}>
      <AppBar title={currentUser.role === 'DEVELOPER' ? '📊 Data Hasil Penelitian' : '📊 Hasil Belajar'} bg={currentUser.role === 'DEVELOPER' ? '#1A237E' : '#AB47BC'} />
      {currentUser.role === 'DEVELOPER' ? (
        <DeveloperHasil students={students} onRefresh={onRefreshStudents} />
      ) : (
        <StudentHasil userProgress={userProgress} userTests={userTests} />
      )}
    </div>
  )
}

// ─── Profil Screen ─────────────────────────────────────────────────────────────
function ProfilScreen({ currentUser, userProgress, userTests, onLogout, onUserUpdate }: { currentUser: AppUser; userProgress: UserProgress; userTests: TestResult[]; onLogout: () => void; onUserUpdate: (user: AppUser) => void }) {
  const preResult = userTests.find(t => t.jenisTest === 'pre') || null
  const postResult = userTests.find(t => t.jenisTest === 'post') || null
  const progress = currentUser.role === 'SISWA' ? computeOverallProgress(userProgress, userTests) : 100
  const badge = currentUser.role === 'SISWA' ? computeBadge(userProgress, userTests) : 0

  const isDev = currentUser.role === 'DEVELOPER'
  const headerBg = isDev ? 'linear-gradient(135deg, #1A237E, #283593)' : 'linear-gradient(135deg, #1976D2, #0D47A1)'

  function changeProfilePhoto(file?: File) {
    if (!file || file.size > 1_500_000) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const updated = await localUpdateProfile({ ...currentUser, profilePhoto: String(reader.result) })
        onUserUpdate(updated)
      } catch {
        window.alert('Foto profil gagal disimpan secara lokal. Silakan coba lagi.')
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div style={{ paddingBottom: 80, background: '#F0F8FF', minHeight: '100vh' }}>
      <AppBar title="👤 Profil" bg={isDev ? '#1A237E' : '#1976D2'} />
      <div style={{ background: headerBg, padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 90, height: 90, borderRadius: 28, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', border: `4px solid ${isDev ? '#FFC107' : '#42A5F5'}`, overflow: 'hidden' }}>
          {currentUser.profilePhoto ? <img src={currentUser.profilePhoto} alt={`Foto ${currentUser.name}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : isDev ? '👨‍💻' : '🧑‍🎒'}
        </div>
        {!isDev && (
          <label style={{ background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: 10, padding: '6px 12px', fontFamily: 'Nunito', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
            Edit Foto Profil
            <input type="file" accept="image/*" onChange={e => changeProfilePhoto(e.target.files?.[0])} style={{ display: 'none' }} />
          </label>
        )}
        <div style={{ fontFamily: 'Baloo 2', fontSize: 20, fontWeight: 800, color: 'white' }}>{currentUser.name}</div>
        <div style={{ background: isDev ? 'rgba(255,193,7,0.25)' : 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '4px 14px', fontFamily: 'Nunito', fontSize: 12, color: isDev ? '#FFC107' : 'rgba(255,255,255,0.9)', fontWeight: 700, border: isDev ? '1px solid rgba(255,193,7,0.5)' : 'none' }}>
          {isDev ? '🔬 DEVELOPER' : `🏫 ${currentUser.kelas} · ${currentUser.sekolah}`}
        </div>
        {!isDev && (
          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
            {[
              { label: 'Total Poin', value: `${userProgress.totalPoin}`, icon: '⚡' },
              { label: 'Badge', value: `${badge}`, icon: '🏅' },
              { label: 'Progress', value: `${progress}%`, icon: '📊' },
            ].map((stat, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 18, fontWeight: 800, color: '#FFC107' }}>{stat.icon} {stat.value}</div>
                <div style={{ fontFamily: 'Nunito', fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}
        {isDev && (
          <div style={{ fontFamily: 'Nunito', fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
            SDN Kiaracondong 038 · Akun Penelitian
          </div>
        )}
      </div>

      <div style={{ background: '#F0F8FF', borderRadius: '24px 24px 0 0', marginTop: -20, padding: '20px 16px' }}>
        {/* Info card */}
        <div style={{ background: 'white', borderRadius: 20, padding: 16, marginBottom: 16, boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: '#1A237E', marginBottom: 12 }}>👤 Informasi Akun</div>
          {[
            { label: 'Nama', value: currentUser.name },
            { label: 'Username / NISN', value: currentUser.username },
            { label: 'Role', value: currentUser.role },
            { label: 'Kelas', value: currentUser.kelas },
            { label: 'Sekolah', value: currentUser.sekolah },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 4 ? '1px solid #F5F5F5' : 'none' }}>
              <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#78909C', fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontFamily: 'Nunito', fontSize: 12, color: '#1A237E', fontWeight: 700 }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Test scores (student only) */}
        {!isDev && (preResult || postResult) && (
          <div style={{ background: 'white', borderRadius: 20, padding: 16, marginBottom: 16, boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: '#1A237E', marginBottom: 12 }}>📋 Hasil Tes Pengetahuan</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, background: '#E3F2FD', borderRadius: 14, padding: '10px 8px', textAlign: 'center', border: '1.5px solid #90CAF9' }}>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#546E7A' }}>Pre-Test</div>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 22, fontWeight: 800, color: '#1976D2' }}>{preResult ? preResult.skor : '—'}</div>
                {preResult && <div style={{ fontFamily: 'Nunito', fontSize: 10, color: getKnowledgeLevel(preResult.skor).color, fontWeight: 700 }}>{getKnowledgeLevel(preResult.skor).label}</div>}
                {!preResult && <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#78909C' }}>Belum dikerjakan</div>}
              </div>
              <div style={{ flex: 1, background: '#EDE7F6', borderRadius: 14, padding: '10px 8px', textAlign: 'center', border: '1.5px solid #CE93D8' }}>
                <div style={{ fontFamily: 'Nunito', fontSize: 11, color: '#546E7A' }}>Post-Test</div>
                <div style={{ fontFamily: 'Baloo 2', fontSize: 22, fontWeight: 800, color: '#7B1FA2' }}>{postResult ? postResult.skor : '—'}</div>
                {postResult && <div style={{ fontFamily: 'Nunito', fontSize: 10, color: getKnowledgeLevel(postResult.skor).color, fontWeight: 700 }}>{getKnowledgeLevel(postResult.skor).label}</div>}
                {!postResult && <div style={{ fontFamily: 'Nunito', fontSize: 10, color: '#78909C' }}>Belum dikerjakan</div>}
              </div>
            </div>
          </div>
        )}

        {/* Progress (student only) */}
        {!isDev && (
          <div style={{ background: 'white', borderRadius: 20, padding: 16, marginBottom: 16, boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ fontFamily: 'Baloo 2', fontSize: 14, fontWeight: 700, color: '#1A237E', marginBottom: 14 }}>📊 Progress Belajar</div>
            {[
              { label: 'Materi Selesai', val: userProgress.materiSelesai.length, max: materials.length, color: '#42A5F5' },
              { label: 'Kuis Dikerjakan', val: userProgress.kuisSelesai, max: 10, color: '#66BB6A' },
              { label: 'Game Dimainkan', val: userProgress.gameDimainkan.length, max: 9, color: '#FF7043' },
            ].map((item, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontFamily: 'Nunito', fontSize: 12, fontWeight: 600, color: '#546E7A' }}>{item.label}</div>
                  <div style={{ fontFamily: 'Baloo 2', fontSize: 13, fontWeight: 700, color: item.color }}>{item.val}/{item.max}</div>
                </div>
                <div style={{ height: 10, background: '#F5F5F5', borderRadius: 99 }}>
                  <div style={{ width: `${Math.min(100, (item.val / item.max) * 100)}%`, height: '100%', background: item.color, borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <button onClick={onLogout} style={{ width: '100%', padding: '14px 0', borderRadius: 16, border: '2px solid #FFCDD2', background: '#FFF5F5', fontFamily: 'Baloo 2', fontSize: 15, fontWeight: 700, color: '#E53935', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          🚪 Keluar Akun
        </button>
      </div>
    </div>
  )
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState<AppPhase>('loading')
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [userProgress, setUserProgress] = useState<UserProgress>(emptyProgress())
  const [userTests, setUserTests] = useState<TestResult[]>([])
  const [screen, setScreen] = useState<Screen>('home')
  const [testMode, setTestMode] = useState<TestMode>('pre')
  const [testPhase, setTestPhase] = useState<'intro' | 'questions' | 'result'>('intro')
  const [testStartedAt, setTestStartedAt] = useState<string | null>(null)
  const [lastTestScore, setLastTestScore] = useState(0)
  const [lastTestAnswers, setLastTestAnswers] = useState<number[]>([])
  const [selectedMaterial, setSelectedMaterial] = useState<Material>(materials[0])
  const [activitySessionId, setActivitySessionId] = useState<string | null>(null)
  const [activitySessionLoginAt, setActivitySessionLoginAt] = useState<string | null>(null)
  const [developerStudents, setDeveloperStudents] = useState<StudentDashboardData[]>([])
  const [storageError, setStorageError] = useState('')
  const lastHeartbeat = useRef(0)
  const restoreStarted = useRef(false)

  const refreshDeveloperStudents = useCallback(async () => {
    try {
      const students = await localGetStudents()
      setDeveloperStudents(students.map(toStudentDashboard))
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Data siswa lokal gagal diperbarui.')
    }
  }, [])

  useEffect(() => {
    if (restoreStarted.current) return
    restoreStarted.current = true
    async function restoreSession() {
      initializeDatabase()
      if (!await restoreAuthenticatedUser()) {
        setPhase('login')
        return
      }
      try {
        const data = await localGetMe()
        setCurrentUser(data.user)
        setUserProgress(data.progress)
        setUserTests(data.tests)
        if (data.user.role === 'SISWA') {
          const trackingSession = await dbStartLoginSession(data.user)
          setActivitySessionId(trackingSession?.id || null)
          setActivitySessionLoginAt(trackingSession?.loginAt || null)
        } else {
          await refreshDeveloperStudents()
        }
        setPhase('app')
      } catch {
        await logout()
        setPhase('login')
      }
    }
    void restoreSession()
  }, [])

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'SISWA' || !activitySessionId || !activitySessionLoginAt) return
    const touch = () => {
      const now = Date.now()
      if (now - lastHeartbeat.current < 10_000) return
      lastHeartbeat.current = now
      void dbUpdateLoginSession(currentUser.userId, activitySessionId, activitySessionLoginAt, 'active', new Date(now)).catch(() => setStorageError('Screen time belum berhasil disimpan secara lokal.'))
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') touch()
      else void dbUpdateLoginSession(currentUser.userId, activitySessionId, activitySessionLoginAt, 'active')
    }
    const handlePageHide = () => void dbEndLoginSession(currentUser.userId, activitySessionId, activitySessionLoginAt, true, true)
    window.addEventListener('pointerdown', touch)
    window.addEventListener('keydown', touch)
    window.addEventListener('scroll', touch, { passive: true })
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibility)
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') touch()
    }, 15_000)
    touch()
    return () => {
      window.removeEventListener('pointerdown', touch)
      window.removeEventListener('keydown', touch)
      window.removeEventListener('scroll', touch)
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(heartbeat)
    }
  }, [currentUser, activitySessionId, activitySessionLoginAt])

  async function enterAuthenticatedApp(user: AppUser) {
    const data = await localGetMe()
    setCurrentUser(data.user)
    setUserProgress(data.progress)
    setUserTests(data.tests)
    if (user.role === 'SISWA') {
      const trackingSession = await dbStartLoginSession(data.user)
      setActivitySessionId(trackingSession?.id || null)
      setActivitySessionLoginAt(trackingSession?.loginAt || null)
    } else {
      await refreshDeveloperStudents()
    }
    setScreen('home')
    setPhase('app')
  }

  async function handleLogin(username: string, password: string) {
    const user = await localLogin(username, password)
    await enterAuthenticatedApp(user)
  }

  async function handleRegister(input: { name: string; username: string; password: string; profilePhoto?: string }) {
    const user = await localRegister(input)
    await enterAuthenticatedApp(user)
  }

  async function handleLogout() {
    if (currentUser?.role === 'SISWA' && activitySessionId && activitySessionLoginAt) {
      try {
        await dbEndLoginSession(currentUser.userId, activitySessionId, activitySessionLoginAt)
      } catch {
        setStorageError('Sesi logout belum berhasil disimpan secara lokal.')
        return
      }
    }
    await logout()
    setActivitySessionId(null)
    setActivitySessionLoginAt(null)
    setCurrentUser(null)
    setUserProgress(emptyProgress())
    setUserTests([])
    setDeveloperStudents([])
    setScreen('home')
    setPhase('login')
  }

  async function navigate(s: Screen, mat?: Material) {
    if (mat) setSelectedMaterial(mat)
    try {
      if (currentUser?.role === 'SISWA' && activitySessionId) {
        if (s === 'materiDetail' && mat) await dbAddActivity(currentUser.userId, activitySessionId, 'MATERIAL_OPEN', `Membuka materi "${mat.title}"`)
        if (s === 'kuis' && screen !== 'kuis') await dbAddActivity(currentUser.userId, activitySessionId, 'QUIZ_START', 'Membuka Kuis Gizi')
      }
      if (s === 'materiDetail' && mat && currentUser && !userProgress.materiDibuka.includes(mat.id) && !userProgress.materiSelesai.includes(mat.id)) {
        const openedProgress: UserProgress = {
          ...userProgress,
          materiDibuka: [...userProgress.materiDibuka, mat.id],
          activities: addActivity(userProgress, { type: 'materi', label: `Mulai mempelajari materi ${mat.title}`, timestamp: new Date().toISOString() }),
        }
        await localSaveProgress(currentUser.userId, openedProgress)
        setUserProgress(openedProgress)
      }
      if (s === 'pretest') { setTestMode('pre'); setTestPhase('intro') }
      if (s === 'posttest') { setTestMode('post'); setTestPhase('intro') }
      setScreen(s)
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Aktivitas gagal disimpan secara lokal.')
    }
  }

  async function handleMaterialComplete(materialId: number) {
    if (!currentUser) return
    if (userProgress.materiSelesai.includes(materialId)) return
    const newSelesai = [...userProgress.materiSelesai, materialId]
    const newPoin = userProgress.totalPoin + 50
    const material = materials.find(item => item.id === materialId)
    const newProgress: UserProgress = { ...userProgress, materiSelesai: newSelesai, totalPoin: newPoin, activities: addActivity(userProgress, { type: 'materi', label: `Menyelesaikan materi ${material?.title || materialId}`, timestamp: new Date().toISOString() }) }
    newProgress.badge = computeBadge(newProgress, userTests)
    try {
      await localSaveProgress(currentUser.userId, newProgress)
      if (activitySessionId) await dbAddActivity(currentUser.userId, activitySessionId, 'MATERIAL_COMPLETED', `Menyelesaikan materi "${material?.title || materialId}"`)
      setUserProgress(newProgress)
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Progress materi gagal disimpan secara lokal.')
    }
  }

  async function handleQuizComplete(score: number, answers: number[]) {
    if (!currentUser) return
    const newProgress: UserProgress = {
      ...userProgress,
      kuisSelesai: userProgress.kuisSelesai + 1,
      kuisScores: [...userProgress.kuisScores, score],
      kuisTimestamps: [...userProgress.kuisTimestamps, new Date().toISOString()],
      quizAnswers: [...(userProgress.quizAnswers || []), answers],
      totalPoin: userProgress.totalPoin + Math.max(10, Math.round(score / 4)),
      activities: addActivity(userProgress, { type: 'kuis', label: 'Menyelesaikan Kuis Gizi', timestamp: new Date().toISOString(), score }),
    }
    newProgress.badge = computeBadge(newProgress, userTests)
    try {
      await localSaveProgress(currentUser.userId, newProgress)
      if (activitySessionId) await dbAddActivity(currentUser.userId, activitySessionId, 'QUIZ_COMPLETED', 'Menyelesaikan Kuis Gizi', undefined, { score })
      setUserProgress(newProgress)
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Hasil kuis gagal disimpan secara lokal.')
    }
  }

  async function handleGamePlayed(gameId: string, score: number) {
    if (!currentUser) return
    const newProgress: UserProgress = {
      ...userProgress,
      gameDimainkan: [...userProgress.gameDimainkan, `${gameId}_${new Date().toISOString()}`],
      gameScores: [...(userProgress.gameScores || []), { gameId, score, status: 'selesai', timestamp: new Date().toISOString() }],
      totalPoin: userProgress.totalPoin + 10,
      activities: addActivity(userProgress, { type: 'game', label: `Menyelesaikan game ${gameId}`, timestamp: new Date().toISOString(), score }),
    }
    newProgress.badge = computeBadge(newProgress, userTests)
    try {
      await localSaveProgress(currentUser.userId, newProgress)
      if (activitySessionId) await dbAddActivity(currentUser.userId, activitySessionId, 'GAME_COMPLETED', `Menyelesaikan game ${gameId}`, undefined, { score })
      setUserProgress(newProgress)
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Hasil game gagal disimpan secara lokal.')
    }
  }



async function handleTestFinish(_score: number, answers: number[]) {
  if (!currentUser) return;

  const now = new Date();
  const startedAt = testStartedAt || now.toISOString();

  try {
    const serverResponse = await submitTestToServer(
      testMode,
      answers,
      startedAt,
    );

    // Mendukung respons server berbentuk { result, bonus_diberikan, bonus_poin }.
    const serverResult = serverResponse.result;
    const bonusDiberikan = serverResponse.bonus_diberikan === true;
    const bonusPoin = bonusDiberikan
      ? Number(serverResponse.bonus_poin) || 0
      : 0;

    const result: TestResult = {
      resultId: serverResult.id,
      userId: serverResult.user_id,
      namaSiswa: currentUser.name,
      jenisTest: serverResult.jenis_test,
      skor: serverResult.skor,
      jumlahBenar: serverResult.jumlah_benar,
      jumlahSalah: serverResult.jumlah_salah,
      totalSoal: serverResult.total_soal,
      jawaban: serverResult.jawaban,
      tanggalPengerjaan: serverResult.tanggal_pengerjaan,
      waktuPengerjaan: serverResult.waktu_pengerjaan,
      startedAt: serverResult.started_at ?? startedAt,
      durationSeconds: serverResult.duration_seconds ?? 0,
      topikDetail: serverResult.topik_detail,
    };

    const newTests = [
      ...userTests.filter((t) => t.jenisTest !== testMode),
      result,
    ];

    // Jangan memberikan bonus berdasarkan testMode di frontend.
    // Hanya gunakan keputusan dari server.
    const newProgress: UserProgress = {
      ...userProgress,
      totalPoin: userProgress.totalPoin + bonusPoin,
      activities: addActivity(userProgress, {
        type: testMode === "pre" ? "pretest" : "posttest",
        label: `Menyelesaikan ${
          testMode === "pre" ? "Pre-Test" : "Post-Test"
        }`,
        timestamp: serverResult.completed_at,
        score: serverResult.skor,
      }),
    };

    newProgress.badge = computeBadge(newProgress, newTests);

    if (activitySessionId) {
      await dbAddActivity(
        currentUser.userId,
        activitySessionId,
        testMode === "pre" ? "PRETEST_COMPLETED" : "POSTTEST_COMPLETED",
        `Menyelesaikan ${
          testMode === "pre" ? "Pre-Test" : "Post-Test"
        }`,
        serverResult.completed_at,
        { score: serverResult.skor },
      );
    }

    setUserTests(newTests);
    setUserProgress(newProgress);
    setLastTestScore(serverResult.skor);
    setLastTestAnswers(serverResult.jawaban);
    setTestPhase("result");
    setScreen("testResult");
  } catch (error) {
    setStorageError(
      error instanceof Error
        ? error.message
        : "Hasil tes gagal dikirim ke server. Silakan coba lagi.",
    );
  }
}

  const showNav = !['materiDetail', 'pretest', 'posttest', 'testResult'].includes(screen)

  const statusBg: Record<string, string> = {
    home: '#42A5F5', materi: '#42A5F5', materiDetail: '#42A5F5',
    kuis: '#66BB6A', game: '#FF7043', hasil: '#AB47BC', profil: '#1976D2',
    pretest: '#1976D2', posttest: '#7B1FA2', testResult: '#7B1FA2',
  }

  if (phase === 'loading') {
    return <div style={{ minHeight: '100vh', background: '#1976D2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'Baloo 2', fontSize: 24, color: 'white' }}>...</div>
    </div>
  }

  if (phase === 'splash') {
    return (
      <div className="app-viewport">
        <div className="app-device app-device-student">
          <SplashScreen onDone={() => setPhase('login')} />
        </div>
      </div>
    )
  }

  if (phase === 'login') {
    return (
      <div className="app-viewport">
        <div className="app-device app-device-student">
          <LoginScreen onLogin={handleLogin} onRegister={handleRegister} />
        </div>
      </div>
    )
  }

  if (!currentUser) return null

  const isDev = currentUser.role === 'DEVELOPER'
  const preResult = userTests.find(t => t.jenisTest === 'pre') || null

  return (
    <div className="app-viewport">
      <div className={`app-device ${isDev ? 'app-device-developer' : 'app-device-student'}`}>
        {/* Status bar */}
        <div style={{ background: isDev ? '#1A237E' : (statusBg[screen] ?? '#42A5F5'), padding: '6px 20px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Nunito', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
            {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span style={{ fontFamily: 'Nunito', fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>📶 🔋</span>
        </div>
        {storageError && (
          <div role="alert" style={{ background: '#FFEBEE', color: '#C62828', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Nunito', fontSize: 11, fontWeight: 800 }}>
            <span style={{ flex: 1 }}>{storageError}</span>
            <button onClick={() => setStorageError('')} style={{ border: 'none', background: 'transparent', color: '#C62828', cursor: 'pointer', fontWeight: 900 }}>×</button>
          </div>
        )}

        <div style={{ maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }} className="scrollbar-hide">
          {/* Developer screens */}
          {isDev && screen === 'home' && (
            <DeveloperHomeScreen currentUser={currentUser} students={developerStudents} onNav={navigate} onLogout={handleLogout} />
          )}
          {isDev && screen === 'hasil' && (
            <HasilScreen currentUser={currentUser} userProgress={userProgress} userTests={userTests} students={developerStudents} onRefreshStudents={refreshDeveloperStudents} />
          )}
          {isDev && screen === 'profil' && (
            <ProfilScreen currentUser={currentUser} userProgress={userProgress} userTests={userTests} onLogout={handleLogout} onUserUpdate={setCurrentUser} />
          )}
          {isDev && !['home', 'hasil', 'profil'].includes(screen) && (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🔬</div>
              <div style={{ fontFamily: 'Baloo 2', fontSize: 18, fontWeight: 700, color: '#1A237E', marginBottom: 8 }}>Fitur untuk Siswa</div>
              <div style={{ fontFamily: 'Nunito', fontSize: 13, color: '#546E7A' }}>Fitur ini hanya tersedia untuk akun siswa.</div>
            </div>
          )}

          {/* Student screens */}
          {!isDev && screen === 'home' && (
            <HomeScreen currentUser={currentUser} userProgress={userProgress} userTests={userTests} onNav={navigate} onLogout={handleLogout} />
          )}
          {!isDev && (screen === 'pretest' || screen === 'posttest') && testPhase === 'intro' && (
            <TestIntroScreen mode={testMode} onStart={() => {
              if (activitySessionId) dbAddActivity(currentUser.userId, activitySessionId, testMode === 'pre' ? 'PRETEST_START' : 'POSTTEST_START', `Memulai ${testMode === 'pre' ? 'Pre-Test' : 'Post-Test'}`)
              setTestStartedAt(new Date().toISOString())
              setTestPhase('questions')
            }} onBack={() => setScreen('home')} />
          )}
          {!isDev && (screen === 'pretest' || screen === 'posttest') && testPhase === 'questions' && (
            <TestQuestionsScreen mode={testMode} onFinish={handleTestFinish} onBack={() => setScreen('home')} />
          )}
          {!isDev && screen === 'testResult' && (
            <TestResultScreen
              mode={testMode}
              score={lastTestScore}
              answers={lastTestAnswers}
              preScore={preResult?.skor ?? null}
              onBack={() => setScreen('home')}
              onRetry={() => { setTestPhase('intro'); setScreen(testMode === 'pre' ? 'pretest' : 'posttest') }}
            />
          )}
          {!isDev && screen === 'materi' && (
            <MateriScreen userProgress={userProgress} onNav={(s, mat) => navigate(s, mat)} />
          )}
          {!isDev && screen === 'materiDetail' && (
            <MateriDetailScreen material={selectedMaterial} userProgress={userProgress} onBack={() => navigate('materi')} onComplete={handleMaterialComplete} />
          )}
          {!isDev && screen === 'kuis' && (
            <KuisScreen onQuizComplete={handleQuizComplete} />
          )}
          {!isDev && screen === 'game' && (
            <GameScreen onGamePlayed={handleGamePlayed} onGameStart={gameId => {
              if (activitySessionId) dbAddActivity(currentUser.userId, activitySessionId, 'GAME_START', `Membuka game ${gameId}`)
            }} />
          )}
          {!isDev && screen === 'hasil' && (
            <HasilScreen currentUser={currentUser} userProgress={userProgress} userTests={userTests} students={[]} onRefreshStudents={async () => {}} />
          )}
          {!isDev && screen === 'profil' && (
            <ProfilScreen currentUser={currentUser} userProgress={userProgress} userTests={userTests} onLogout={handleLogout} onUserUpdate={setCurrentUser} />
          )}
        </div>

        {showNav && (
          <BottomNav active={screen} onNav={navigate} role={currentUser.role} />
        )}
      </div>
    </div>
  )
}