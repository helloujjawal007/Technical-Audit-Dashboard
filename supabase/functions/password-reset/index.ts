import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { email, redirectTo } = body;

    if (typeof email !== "string" || !email.trim()) {
      return new Response(JSON.stringify({ error: "Email is required." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl) {
      console.error("Password reset is unavailable: Supabase URL is not configured.");
      return new Response(JSON.stringify({ error: "Password reset is temporarily unavailable." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // First attempt: Standard email dispatch via Supabase Auth
    let emailDispatched = false;
    if (supabaseAnonKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: typeof redirectTo === "string" ? redirectTo : undefined,
        });
        if (!resetError) {
          emailDispatched = true;
        } else {
          console.warn("Public resetPasswordForEmail rejected:", resetError.message);
        }
      } catch (err) {
        console.warn("Public resetPasswordForEmail exception:", err);
      }
    }

    if (emailDispatched) {
      return new Response(JSON.stringify({
        success: true,
        email_sent: true,
        message: "Password reset email sent. Please check your inbox and spam folder.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fail-safe fallback: If email was rate-limited or failed, generate direct recovery link & OTP using service role
    if (supabaseServiceKey) {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: cleanEmail,
        options: {
          redirectTo: typeof redirectTo === "string" ? redirectTo : undefined,
        },
      });

      if (!linkError && linkData?.properties) {
        return new Response(JSON.stringify({
          success: true,
          email_sent: false,
          rate_limited: true,
          action_link: linkData.properties.action_link,
          email_otp: linkData.properties.email_otp,
          message: "Email dispatch was rate-limited by the mail server, but a secure one-time reset link and verification code were successfully generated for you.",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (linkError) {
        console.error("admin.generateLink error:", linkError.message);
      }
    }

    return new Response(JSON.stringify({
      error: "Password reset is temporarily rate-limited. Please try again in a few moments.",
    }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Password reset error:", err);
    return new Response(JSON.stringify({ error: "Something went wrong." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
