import type { User } from "@supabase/supabase-js"
import { requireSupabase } from "./supabaseService"

export async function getAuthenticatedUser() {
  const client = requireSupabase()
  const { data, error } = await client.auth.getUser()
  if (error)
    throw new Error(
      `Operasi Supabase "membaca pengguna autentikasi" gagal: ${error.message}`,
    )
  return data.user
}

async function usernameEmail(username: string) {
  const normalized = username.trim().toLocaleLowerCase("id-ID")
  const bytes = new TextEncoder().encode(normalized)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")
  return `${hash}@smart-gizi.app`
}

export async function getAuthSession() {
  const { data, error } = await requireSupabase().auth.getSession()
  if (error)
    throw new Error(
      `Operasi Supabase "memulihkan sesi" gagal: ${error.message}`,
    )
  return data.session
}

export async function signInWithUsername(username: string, password: string) {
  const input = username.trim()

  // Jika pengguna memasukkan email, gunakan email tersebut langsung.
  // Ini diperlukan untuk akun Developer yang dibuat melalui Supabase Dashboard.
  const email = input.includes("@")
    ? input.toLowerCase()
    : await usernameEmail(input)

  const { data, error } = await requireSupabase().auth.signInWithPassword({
    email,
    password,
  })


if (error) throw new Error(error.message)

  return data.user
}

export interface RegistrationInput {
  name: string
  username: string
  password: string
  role: "SISWA" | "DEVELOPER"
  kelas: string
  sekolah: string
  profilePhoto?: string
}

export async function registerWithUsername(
  input: RegistrationInput,
): Promise<User> {
  const email = await usernameEmail(input.username)
  const { data, error } = await requireSupabase().auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        name: input.name.trim(),
        username: input.username.trim(),
        role: input.role,
        kelas: input.kelas,
        sekolah: input.sekolah,
      },
    },
  })
  if (error) {
    const duplicate = error.message.toLowerCase().includes("already registered")
    throw new Error(
      duplicate
        ? "Username/NISN sudah terdaftar."
        : `Pendaftaran Supabase gagal: ${error.message}`,
    )
  }
  if (!data.user)
    throw new Error("Pendaftaran Supabase tidak menghasilkan akun.")
  if (!data.session) {
    throw new Error(
      "Akun dibuat, tetapi konfirmasi email Supabase masih aktif. Nonaktifkan konfirmasi email untuk login berbasis username.",
    )
  }
  return data.user
}

export async function signOutFromSupabase() {
  const client = requireSupabase()
  const { error } = await client.auth.signOut()
  if (error)
    throw new Error(`Operasi Supabase "logout" gagal: ${error.message}`)
}
