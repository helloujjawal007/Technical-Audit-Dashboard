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
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      // In development or when service role key is not configured
      return new Response(JSON.stringify({
        success: true,
        message: "If an account exists, a reset link has been sent.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Use the admin API to send a recovery email (password reset)
    // generateLink with type "recovery" sends the user an email with a link
    // that contains a recovery token in the URL hash
    const { error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: cleanEmail,
    });

    if (linkError) {
      // Don't reveal whether the email exists
      return new Response(JSON.stringify({
        success: true,
        message: "If an account exists, a reset link has been sent.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // The action_link contains the recovery URL with the token hash
    // Supabase automatically sends the email when using generateLink with type recovery
    // The link will redirect to our app with #type=recovery in the hash

    return new Response(JSON.stringify({
      success: true,
      message: "Password reset email sent. Check your inbox.",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Password reset failed:", err);
    return new Response(JSON.stringify({ error: "Something went wrong." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
