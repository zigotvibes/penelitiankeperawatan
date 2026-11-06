
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ success: false, error: "Metode tidak diizinkan." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Konfigurasi server Supabase belum lengkap.");
    }

    if (!authorization?.startsWith("Bearer ")) {
      return respond({ success: false, error: "Sesi login tidak ditemukan." }, 401);
    }

    const token = authorization.slice("Bearer ".length);

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return respond({ success: false, error: "Sesi login tidak valid." }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const developerId = authData.user.id;
    const body = await req.json();
    const userId = body?.userId;

    if (
      typeof userId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
    ) {
      return respond({ success: false, error: "ID siswa tidak valid." }, 400);
    }

    if (userId === developerId) {
      return respond({ success: false, error: "Akun sendiri tidak dapat dihapus melalui fitur ini." }, 400);
    }

    const { data: developer, error: developerError } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", developerId)
      .maybeSingle();

    if (developerError) throw developerError;

    if (!developer || developer.role !== "DEVELOPER") {
      return respond({ success: false, error: "Akses khusus developer diperlukan." }, 403);
    }

    const { data: student, error: studentError } = await adminClient
      .from("profiles")
      .select("id, name, username, role")
      .eq("id", userId)
      .maybeSingle();

    if (studentError) throw studentError;

    if (!student || student.role !== "SISWA") {
      return respond({ success: false, error: "Akun siswa tidak ditemukan." }, 404);
    }

    // Catat audit sebelum menghapus akun.
    const { error: auditError } = await adminClient
      .from("developer_audits")
      .insert({
        action: "DELETE_STUDENT",
        target_user_id: userId,
        developer_user_id: developerId,
        metadata: {
          username: student.username,
          name: student.name,
        },
      });

    if (auditError) throw auditError;

    // Penghapusan akun Auth akan memicu cascade pada profil dan data terkait.
    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      throw new Error(`Penghapusan akun gagal: ${deleteError.message}`);
    }

    return respond({ success: true });
  } catch (error) {
    console.error("delete-student-account failed:", error);

    return respond(
      {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menghapus akun siswa.",
      },
      500,
    );
  }
});
