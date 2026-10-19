/* Loads supabase-js from a CDN ONLY when config.js has a URL + anon key.
 * If not configured, RTR.getSupabase() resolves to null and pages show
 * a friendly "accounts coming soon" state. */
(function () {
  const RTR = (window.RTR = window.RTR || {});
  const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  let promise = null;
  RTR.supabaseConfigured = function () {
    const c = window.RTR_CONFIG || {};
    return !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY && /^https:\/\//.test(c.SUPABASE_URL));
  };
  RTR.getSupabase = function () {
    if (promise) return promise;
    if (!RTR.supabaseConfigured()) return (promise = Promise.resolve(null));
    promise = new Promise(function (resolve) {
      const s = document.createElement("script");
      s.src = CDN;
      s.onload = function () {
        try {
          const c = window.RTR_CONFIG;
          resolve(window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY));
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
    const { data } = await sb.auth.getUser();
    return { sb, user: data ? data.user : null };
  };
  RTR.comingSoonHTML = function (what) {
    return '<div class="accounts-soon" role="status"><p><strong>Accounts are coming soon.</strong></p><p>' +
      RTR.esc(what || "Member accounts are not turned on yet.") +
      ' You can still use the <a href="eligibility.html">benefits checker</a> and <a href="resources.html">resource finder</a> right now—no account needed.</p></div>';
  };
})();
