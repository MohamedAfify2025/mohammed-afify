// Public browser configuration. Publishable keys are intended for browser clients.
// Row Level Security and RPC authorization remain the actual access controls.
// Cloudflare Pages preview subdomains use the isolated TEST project; the root
// production hostname and all other production domains continue to use LIVE.
const MEMBERSHIP_LIVE_CONFIG = {
  supabaseUrl: "https://ybsjnubrswqksvktgmay.supabase.co",
  supabasePublishableKey: "sb_publishable_lLJqfC6krPlgE9sLWQX98A_gPo0TiRj",
  supabaseAnonKey: ""
};

const MEMBERSHIP_PREVIEW_CONFIG = {
  supabaseUrl: "https://jniekfbelqticopcotxg.supabase.co",
  supabasePublishableKey: "sb_publishable_VVwaESCrseTv1Q4RnZmA6Q_rdF4YJ-C",
  supabaseAnonKey: ""
};

const membershipHost = String(window.location?.hostname || "").toLowerCase();
const isCloudflarePreview =
  membershipHost.endsWith(".mohammed-afify.pages.dev") &&
  membershipHost !== "mohammed-afify.pages.dev";

window.MEMBERSHIP_CONFIG = isCloudflarePreview
  ? MEMBERSHIP_PREVIEW_CONFIG
  : MEMBERSHIP_LIVE_CONFIG;
window.MEMBERSHIP_CONFIG.environment = isCloudflarePreview ? "preview" : "production";

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
    return JSON.parse(atob(payload)).role === "anon";
  } catch (_) {
    return false;
  }
};
