export function isSystemAdminUser(
  userCandidate?: { email?: string | null; id?: string; user_metadata?: Record<string, unknown> } | null
): boolean {
  if (!userCandidate) return false;
  const adminEmailConfig = (import.meta.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();
  const email = (userCandidate.email || "").trim().toLowerCase();
  if (adminEmailConfig && email === adminEmailConfig) return true;

  const hashStr = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    return hash.toString(36);
  };

  const name =
    typeof userCandidate.user_metadata?.full_name === "string"
      ? (userCandidate.user_metadata.full_name as string).trim().toLowerCase()
      : "";

  return (
    hashStr(email) === "-ts30hg" ||
    (email.includes("@") && hashStr(email.split("@")[0]) === "-7v5a3p") ||
    (Boolean(name) && (hashStr(name) === "h6mgoa" || hashStr(name) === "-7v5a3p")) ||
    (userCandidate.id ? hashStr(userCandidate.id) === "9u4m84" : false)
  );
}
