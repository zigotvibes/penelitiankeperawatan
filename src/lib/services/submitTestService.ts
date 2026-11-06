import { requireSupabase } from "../../services/supabaseService";

export interface SubmitTestResponse {
  result: {
    id: string;
    user_id: string;
    jenis_test: "pre" | "post";
    skor: number;
    jumlah_benar: number;
    jumlah_salah: number;
    total_soal: number;
    jawaban: number[];
    topik_detail: Record<
      string,
      { benar: number; total: number; pct: number }
    >;
    tanggal_pengerjaan: string;
    waktu_pengerjaan: string;
    started_at: string | null;
    completed_at: string;
    duration_seconds: number | null;
    namaSiswa?: string;
  };
  bonus_diberikan: boolean;
  bonus_poin: number;
}

export async function submitTestToServer(
  jenisTest: "pre" | "post",
  answers: number[],
  startedAt: string | null,
): Promise<SubmitTestResponse> {
  const supabase = requireSupabase();

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError || !sessionData.session) {
    throw new Error("Sesi login berakhir. Silakan login kembali.");
  }

  const { data, error } =
    await supabase.functions.invoke<SubmitTestResponse>(
      "submit-test",
      {
        body: { jenisTest, answers, startedAt },
      },
    );

  if (error) {
    throw new Error(
      `Pengiriman hasil tes gagal: ${error.message}`,
    );
  }

  if (!data?.result) {
    throw new Error("Server tidak mengembalikan hasil tes.");
  }

  if (
    typeof data.bonus_diberikan !== "boolean" ||
    typeof data.bonus_poin !== "number"
  ) {
    throw new Error(
      "Respons bonus dari server tidak valid. Silakan periksa Edge Function.",
    );
  }

  return data;
}
