// Public browser configuration only.
// Set these two values to the intended Supabase project before enabling student access.
// Never place SUPABASE_SECRET_KEYS, service_role keys, database passwords, or Cloudflare API tokens here.
window.MEMBERSHIP_CONFIG = window.MEMBERSHIP_CONFIG || {
  supabaseUrl: "",
  supabasePublishableKey: "",
  supabaseAnonKey: ""
};
