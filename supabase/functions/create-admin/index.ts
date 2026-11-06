import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = "admin@fontaxi.jo";
  const password = "FonTaxi@Admin2026";

  // Check if user already exists
  const { data: existing } = await adminClient
    .from("profiles")
    .select("id, user_id")
    .eq("email", email)
    .maybeSingle();

  if (existing?.user_id) {
    // Update password
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(
      existing.user_id,
      { password }
    );
    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ success: true, message: "Password updated" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create new admin user
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authErr) {
    return new Response(
      JSON.stringify({ error: authErr.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Upsert profile
  await adminClient
    .from("profiles")
    .upsert({
      email,
      role: "admin",
      phone: "admin",
      name: "مدير النظام",
      user_id: authData.user.id,
    }, { onConflict: "email" });

  return new Response(
    JSON.stringify({ success: true, message: "Admin created", uid: authData.user.id }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
