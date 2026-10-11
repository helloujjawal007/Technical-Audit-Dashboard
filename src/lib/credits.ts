export interface CreditLimit {
  label: string;
  limit: number;
  windowDays: number;
  windowLabel: string;
}

export const FREE_TIER_LIMITS: Record<string, CreditLimit> = {
  single: { label: "Single Page", limit: 20, windowDays: 1, windowLabel: "per day" },
  multiple: { label: "Multiple Pages", limit: 50, windowDays: 28, windowLabel: "per 28 days" },
  crawl: { label: "Full Domain Crawl", limit: 100, windowDays: 28, windowLabel: "per 28 days" },
  staging: { label: "Staging", limit: 50, windowDays: 28, windowLabel: "per 28 days" },
};

export const GUEST_DAILY_LIMIT = 5;
export const ADMIN_DAILY_LIMIT = 200;

export interface CreditUsage {
  used: number;
  limit: number;
  remaining: number;
  windowDays: number;
  windowLabel: string;
  label: string;
}

export async function getCreditUsage(
  userId: string,
  auditType: string
): Promise<CreditUsage> {
  const supabase = (await import("@/lib/supabase")).supabase;
  const { data: subscription } = await supabase
    .from("user_subscriptions")
    .select("tier")
    .eq("user_id", userId)
    .maybeSingle();
  const isAdmin = subscription?.tier === "admin";
  const limit = isAdmin
    ? { label: "Admin", limit: ADMIN_DAILY_LIMIT, windowDays: 1, windowLabel: "per day" }
    : FREE_TIER_LIMITS[auditType] || FREE_TIER_LIMITS.single;
  const since = new Date();
  since.setDate(since.getDate() - limit.windowDays);
  const sinceIso = since.toISOString();

  let usageQuery = supabase
    .from("credit_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sinceIso);

  if (!isAdmin) {
    usageQuery = usageQuery.eq("audit_type", auditType);
  }

  const { count } = await usageQuery;

  const used = count || 0;
  return {
    used,
    limit: limit.limit,
    remaining: Math.max(0, limit.limit - used),
    windowDays: limit.windowDays,
    windowLabel: limit.windowLabel,
    label: limit.label,
  };
}

export async function getAllCreditUsage(
  userId: string
): Promise<Record<string, CreditUsage>> {
  const firstUsage = await getCreditUsage(userId, "single");
  if (firstUsage.label === "Admin") {
    return { admin: firstUsage };
  }

  const types = ["single", "multiple", "crawl", "staging"];
  const results = await Promise.all(types.map((t) => getCreditUsage(userId, t)));
  const map: Record<string, CreditUsage> = {};
  types.forEach((t, i) => { map[t] = results[i]; });
  return map;
}

export async function recordCreditUsage(
  userId: string,
  auditType: string,
  urlCount: number = 1
): Promise<void> {
  await (await import("@/lib/supabase")).supabase
    .from("credit_usage")
    .insert({ user_id: userId, audit_type: auditType, url_count: urlCount });
}

export function canStartAudit(
  usage: CreditUsage
): { allowed: boolean; message?: string } {
  if (usage.remaining <= 0) {
    return {
      allowed: false,
      message: usage.label === "Admin"
        ? `You've used all ${usage.limit} admin audits for today.`
        : `You've reached your ${usage.label} limit (${usage.limit} ${usage.windowLabel}). Upgrade your plan for more audits.`,
    };
  }
  return { allowed: true };
}

// ===== Guest credit tracking (IP-based, 5/day) =====

export async function getGuestCreditUsage(ipKey: string): Promise<CreditUsage> {
  const { supabase } = await import("@/lib/supabase");
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("guest_credits")
    .select("count")
    .eq("ip_address", ipKey)
    .eq("used_date", today)
    .maybeSingle();

  const used = data?.count || 0;
  return {
    used,
    limit: GUEST_DAILY_LIMIT,
    remaining: Math.max(0, GUEST_DAILY_LIMIT - used),
    windowDays: 1,
    windowLabel: "per day",
    label: "Guest",
  };
}

export async function recordGuestCreditUsage(ipKey: string): Promise<void> {
  const { supabase } = await import("@/lib/supabase");
  const today = new Date().toISOString().split("T")[0];

  // Try to increment existing record
  const { data } = await supabase
    .from("guest_credits")
    .select("id, count")
    .eq("ip_address", ipKey)
    .eq("used_date", today)
    .maybeSingle();

  if (data) {
    await supabase
      .from("guest_credits")
      .update({ count: (data.count || 0) + 1 })
      .eq("id", data.id);
  } else {
    await supabase
      .from("guest_credits")
      .insert({ ip_address: ipKey, used_date: today, count: 1 });
  }
}

export async function canStartGuestAudit(ipKey: string): Promise<{ allowed: boolean; message?: string }> {
  const usage = await getGuestCreditUsage(ipKey);
  if (usage.remaining <= 0) {
    return {
      allowed: false,
      message: `You've used all ${GUEST_DAILY_LIMIT} guest audits for today. Sign up for a free account to get more credits.`,
    };
  }
  return { allowed: true };
}
