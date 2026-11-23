// Public browser configuration only.
// Set these two values to the intended Supabase project before enabling student access.
// Never place secret keys, service-role keys, database passwords, or Cloudflare API tokens here.
window.MEMBERSHIP_CONFIG = window.MEMBERSHIP_CONFIG || {
  supabaseUrl: "",
  supabasePublishableKey: "",
  supabaseAnonKey: ""
};

window.isMembershipPublicKey = function (value) {
  const key = String(value || "").trim();
  if (key.startsWith("sb_publishable_")) return key.length > 20;
  if (key.startsWith("sb_secret_") || key.startsWith("sb_service_role_")) return false;
  if (!key.startsWith("eyJ")) return false;

  const parts = key.split(".");
  if (parts.length !== 3) return false;
  let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  while (payload.length % 4) payload += "=";
  try {
    const decoded = JSON.parse(atob(payload));
    return decoded.role === "anon";
  } catch (_) {
    return false;
  }
};
