/* Loads supabase-js from a CDN ONLY when config.js has a URL + public key.
 * If not configured, RTR.getSupabase() resolves to null and pages show
 * a friendly "accounts coming soon" state. All queries go to the app's own
 * schema (config SUPABASE_SCHEMA, default "rtr_app"). */
(function () {
  const RTR = (window.RTR = window.RTR || {});
  const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js";
  let promise = null, settingsPromise = null;
  const cfg = () => window.RTR_CONFIG || {};
  RTR.supabaseConfigured = function () {
    const c = cfg();
    return !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY && /^https:\/\//.test(c.SUPABASE_URL));
  };
  // Absolute URL of a page in this site (works on a sub-path like /root-to-rise-app/).
  RTR.pageURL = function (page) { return new URL(page, location.href).href.split("#")[0].split("?")[0]; };
  RTR.getSupabase = function () {
    if (promise) return promise;
    if (!RTR.supabaseConfigured()) return (promise = Promise.resolve(null));
    promise = new Promise(function (resolve) {
      const s = document.createElement("script");
      s.src = CDN;
      s.crossOrigin = "anonymous";
      s.onload = function () {
        try {
          const c = cfg();
          resolve(window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, {
            db: { schema: c.SUPABASE_SCHEMA || "rtr_app" },
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
          }));
        } catch (e) { console.warn(e); resolve(null); }
      };
      s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
    });
    return promise;
  };
  RTR.getUser = async function () {
    const sb = await RTR.getSupabase();
    if (!sb) return { sb: null, user: null };
    const { data } = await sb.auth.getSession();
    return { sb, user: data && data.session ? data.session.user : null };
  };
  // Which sign-in methods are switched on in Supabase (public endpoint).
  RTR.authSettings = function () {
    if (settingsPromise) return settingsPromise;
    const c = cfg();
    settingsPromise = fetch(c.SUPABASE_URL + "/auth/v1/settings", { headers: { apikey: c.SUPABASE_ANON_KEY } })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    return settingsPromise;
  };
  // Turn database errors into plain language (never show raw codes to members).
  RTR.friendlyError = function (error) {
    if (!error) return "";
    const m = String(error.message || error);
    if (/Invalid schema|PGRST106/i.test(m) || error.code === "PGRST106") return "Member features are being switched on. Please try again later today.";
    if (/JWT|not authenticated|sign in first/i.test(m)) return "Please sign in again.";
    return m;
  };
  RTR.comingSoonHTML = function (what) {
    return '<div class="accounts-soon" role="status"><p><strong>Accounts are coming soon.</strong></p><p>' +
      RTR.esc(what || "Member accounts are not turned on yet.") +
      ' You can still use the <a href="eligibility.html">benefits checker</a> and <a href="resources.html">resource finder</a> right now—no account needed.</p></div>';
  };
  // Render a QR code (vendored MIT qrcode-generator) as an <img> data URL.
  RTR.qrImg = function (text, label) {
    if (typeof window.qrcode !== "function") return "";
    const q = window.qrcode(0, "M"); q.addData(String(text)); q.make();
    return '<img class="qr" width="164" height="164" alt="' + RTR.esc(label || "QR code") + '" src="' + q.createDataURL(5, 2) + '">';
  };
})();
