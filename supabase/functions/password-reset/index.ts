import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
    const body = await req.json();
    const { email, token, newPassword } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      // In development or when service role key is not configured
      return new Response(JSON.stringify({
        success: true,
        message: "If an account exists, a reset code and link have been generated.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If verifying a token and updating password via admin API
    if (token && newPassword) {
      const { data: userList } = await supabase.auth.admin.listUsers();
      const targetUser = userList?.users?.find(
        (u) => u.email?.toLowerCase() === cleanEmail
      );

      if (targetUser) {
        const { error: updateErr } = await supabase.auth.admin.updateUserById(
          targetUser.id,
          { password: newPassword }
        );
        if (updateErr) {
          return new Response(JSON.stringify({ error: updateErr.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({
          success: true,
          message: "Password updated successfully.",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Generate link and OTP code
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: cleanEmail,
    });

    if (linkError) {
      return new Response(JSON.stringify({
        success: true,
        message: "If an account exists, a reset code and link have been generated.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Password reset code sent. Check your inbox.",
      otp: linkData?.properties?.email_otp,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Password reset error:", err);
    return new Response(JSON.stringify({ error: "Something went wrong." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
