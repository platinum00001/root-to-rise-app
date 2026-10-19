/*
 * Root to Rise — public site configuration.
 * The Supabase URL and publishable key are PUBLIC by design (security is enforced by
 * Row Level Security in supabase/schema.sql). NEVER put a service_role / secret key here.
 * Clear SUPABASE_URL to run the site in "accounts coming soon" mode.
 */
window.RTR_CONFIG = {
  SUPABASE_URL: "https://oiousqgzqcjanikglkxl.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_IJHa5taHcttV2DSZq45fWQ_bVbRDbA2", // publishable key (safe to publish)
  SUPABASE_SCHEMA: "rtr_app",   // this app's own schema inside the shared "james-sites" project
  SITE_URL: "https://platinum00001.github.io/root-to-rise-app/"
};
