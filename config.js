/*
 * Root to Rise — public site configuration.
 * The Supabase URL and ANON key are PUBLIC by design (security is enforced by
 * Row Level Security in supabase/schema.sql). NEVER put a service-role key here.
 * Leave these empty to run the site in "accounts coming soon" mode.
 */
window.RTR_CONFIG = {
  SUPABASE_URL: "",       // e.g. "https://abcdefghijk.supabase.co"
  SUPABASE_ANON_KEY: "",  // e.g. "eyJhbGciOi..." (anon / publishable key only)
  SITE_URL: "https://root-to-rise.vercel.app"
};
