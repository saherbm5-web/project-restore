import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { phone, verify, code } = await req.json();

    if (!phone || typeof phone !== "string") {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify mode
    if (verify && code) {
      const { data: record } = await supabase
        .from("otp_codes")
        .select("*")
        .eq("phone", phone)
        .eq("code", code)
        .eq("used", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!record) {
        return new Response(
          JSON.stringify({ verified: false, error: "رمز غير صحيح" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const now = new Date();
      const expires = new Date(record.expires_at);
      if (now > expires) {
        return new Response(
          JSON.stringify({ verified: false, error: "انتهت صلاحية الرمز" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabase
        .from("otp_codes")
        .update({ used: true })
        .eq("id", record.id);

      return new Response(
        JSON.stringify({ verified: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Send mode — generate new code
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from("otp_codes")
      .insert({
        phone,
        code: otp,
        expires_at: expiresAt,
        used: false,
      });

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to generate code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // SMS provider integration: if SMS_API_KEY is configured, send via HTTP.
    const smsApiKey = Deno.env.get("SMS_API_KEY");
    let smsSent = false;

    if (smsApiKey) {
      try {
        const smsUrl = Deno.env.get("SMS_API_URL") || "https://api.unifonic.com/v1/messages";
        const sender = Deno.env.get("SMS_SENDER") || "FonTaxi";
        const fullPhone = phone.startsWith("962") ? phone : `962${phone.replace(/^0/, "")}`;

        const smsResponse = await fetch(smsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${smsApiKey}`,
          },
          body: JSON.stringify({
            to: fullPhone,
            from: sender,
            body: `رمز التحقق الخاص بك في FON TAXI هو: ${otp}`,
          }),
        });

        smsSent = smsResponse.ok;
      } catch {
        smsSent = false;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        code: otp,
        smsSent,
        message: smsSent
          ? "OTP sent via SMS"
          : "OTP generated — no SMS provider configured, code returned for on-screen display",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
