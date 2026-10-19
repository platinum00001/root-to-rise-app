/* Member accounts (Supabase Auth): Google / Facebook / email link / password,
 * plus profile, saved answers, offer codes, notification choices and data deletion. */
(function () {
  const RTR = window.RTR;
  const esc = (s) => RTR.esc(s);
  const ACCOUNT_URL = () => RTR.pageURL("account.html");
  let recoveryMode = false;

  function urlAuthError() {
    const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.replace(/^#/, ""));
    const d = h.get("error_description") || q.get("error_description");
    if (!d) return "";
    history.replaceState(null, "", location.pathname);
    if (/provider is not enabled|Unsupported provider/i.test(d)) return "That sign-in option isn't switched on yet. Please use email for now.";
    if (/expired|invalid/i.test(d)) return "That sign-in link has expired or was already used. Please request a new one.";
    return d.replace(/\+/g, " ");
  }

  const PROVIDERS = { google: "Google", facebook: "Facebook" };
  function oauthButtons() {
    return '<div class="oauth-row">' + Object.keys(PROVIDERS).map((p) =>
      '<button type="button" class="btn oauth ' + p + '" data-provider="' + p + '">' + (p === "google" ? googleIcon() : fbIcon()) + '<span>Continue with ' + PROVIDERS[p] + '</span></button>').join("") +
      '</div><p id="oauth-msg" class="hint" role="status"></p>';
  }
  function googleIcon() { return '<svg aria-hidden="true" viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>'; }
  function fbIcon() { return '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>'; }

  function authForm(area, sb, notice) {
    area.innerHTML =
      (notice ? '<p class="notice info" role="alert">' + esc(notice) + "</p>" : "") +
      '<section class="card auth-card"><h2 style="margin-top:0">Sign in or create a free account</h2>' +
      oauthButtons() +
      '<div class="divider"><span>or use your email</span></div>' +
      '<form id="magic"><div class="field"><label for="ml-email">Email</label><input id="ml-email" type="email" autocomplete="email" required></div>' +
      '<button class="btn" type="submit">Email me a sign-in link</button> <span id="ml-msg" role="status"></span>' +
      '<p class="hint">No password needed. We\'ll email you a one-time link. New here? The link creates your account.</p></form></section>' +
      '<div class="grid grid-2" style="margin-top:1rem"><form id="signin" class="card"><h2 style="margin-top:0">Sign in with a password</h2>' +
      '<div class="field"><label for="si-email">Email</label><input id="si-email" type="email" autocomplete="email" required></div>' +
      '<div class="field"><label for="si-pass">Password</label><input id="si-pass" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn" type="submit">Sign in</button> <button class="linklike" type="button" id="forgot">Forgot password?</button> <p id="si-msg" role="status"></p></form>' +
      '<form id="signup" class="card"><h2 style="margin-top:0">Create an account with a password</h2>' +
      '<div class="field"><label for="su-email">Email</label><input id="su-email" type="email" autocomplete="email" required></div>' +
      '<div class="field"><label for="su-pass">Password (8+ characters)</label><input id="su-pass" type="password" minlength="8" autocomplete="new-password" required></div>' +
      '<button class="btn" type="submit">Create account</button> <p id="su-msg" role="status"></p></form></div>' +
      '<p class="hint" style="margin-top:1rem">Creating an account does <strong>not</strong> sign you up for any emails. If you use Google or Facebook with the same email address, they all open the same account. See our <a href="privacy.html">privacy policy</a>.</p>';

    area.querySelectorAll("[data-provider]").forEach((b) => b.addEventListener("click", async () => {
      const p = b.getAttribute("data-provider"), msg = document.getElementById("oauth-msg");
      const st = await RTR.authSettings();
      if (st && st.external && !st.external[p]) {
        msg.textContent = PROVIDERS[p] + " sign-in is coming soon. For now, please use the email link or a password below.";
        return;
      }
      msg.textContent = "Opening " + PROVIDERS[p] + "…";
      const { error } = await sb.auth.signInWithOAuth({ provider: p, options: { redirectTo: ACCOUNT_URL() } });
      if (error) msg.textContent = /not enabled|Unsupported provider/i.test(error.message) ? PROVIDERS[p] + " sign-in is coming soon. Please use email for now." : error.message;
    }));
    document.getElementById("magic").addEventListener("submit", async (e) => {
      e.preventDefault();
      const m = document.getElementById("ml-msg"); m.textContent = "Sending…";
      const { error } = await sb.auth.signInWithOtp({ email: document.getElementById("ml-email").value.trim(), options: { emailRedirectTo: ACCOUNT_URL(), shouldCreateUser: true } });
      m.textContent = error ? friendlyAuth(error) : "Check your email for a sign-in link (it may take a minute; check spam too).";
    });
    document.getElementById("signin").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { error } = await sb.auth.signInWithPassword({ email: document.getElementById("si-email").value.trim(), password: document.getElementById("si-pass").value });
      document.getElementById("si-msg").textContent = error ? friendlyAuth(error) : "Signed in.";
      if (!error) render();
    });
    document.getElementById("forgot").addEventListener("click", async () => {
      const email = document.getElementById("si-email").value.trim(), m = document.getElementById("si-msg");
      if (!email) { m.textContent = "Type your email above first, then tap “Forgot password?”."; return; }
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: ACCOUNT_URL() });
      m.textContent = error ? friendlyAuth(error) : "If that email has an account, we sent a link to set a new password.";
    });
    document.getElementById("signup").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { data, error } = await sb.auth.signUp({ email: document.getElementById("su-email").value.trim(), password: document.getElementById("su-pass").value, options: { emailRedirectTo: ACCOUNT_URL() } });
      document.getElementById("su-msg").textContent = error ? friendlyAuth(error) : (data.session ? "Account created — you're signed in." : "Check your email to confirm your account, then sign in.");
      if (!error && data.session) render();
    });
  }
  function friendlyAuth(error) {
    const m = String(error.message || "");
    if (/rate limit|too many/i.test(m)) return "Too many tries — please wait a few minutes and try again.";
    if (/Invalid login credentials/i.test(m)) return "That email and password don't match. Try the email link instead?";
    if (/Email not confirmed/i.test(m)) return "Please confirm your email first (check your inbox), or use the email link.";
    if (/sending.*email|confirmation email/i.test(m)) return "We couldn't send the email right now. Please try again later, or contact us.";
    return m;
  }

  function recoveryForm(area, sb) {
    area.innerHTML = '<form id="newpass" class="card"><h2 style="margin-top:0">Set a new password</h2>' +
      '<div class="field"><label for="np">New password (8+ characters)</label><input id="np" type="password" minlength="8" autocomplete="new-password" required></div>' +
      '<button class="btn" type="submit">Save new password</button> <span id="np-msg" role="status"></span></form>';
    document.getElementById("newpass").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { error } = await sb.auth.updateUser({ password: document.getElementById("np").value });
      document.getElementById("np-msg").textContent = error ? friendlyAuth(error) : "Password updated.";
      if (!error) { recoveryMode = false; setTimeout(render, 800); }
    });
  }

  async function offerTitles() {
    try { const d = await RTR.fetchJSON("data/offers.json"); const m = {}; d.offers.forEach((o) => (m[o.id] = o)); return m; } catch (e) { return {}; }
  }

  async function dashboard(area, sb, user) {
    // Make sure this app has a profile row for the member (created on first sign-in only).
    const up = await sb.from("profiles").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
    if (up.error && /PGRST106|Invalid schema/i.test(up.error.message + up.error.code)) {
      area.innerHTML = '<p>Signed in as <strong>' + esc(user.email) + '</strong>. <button class="btn secondary" id="signout">Sign out</button></p><p class="notice info">' + esc(RTR.friendlyError(up.error)) + "</p>";
      document.getElementById("signout").addEventListener("click", async () => { await sb.auth.signOut(); render(); });
      return;
    }
    const [{ data: prof }, { data: answers }, { data: consent }, { data: codes }, { data: roles }, offers] = await Promise.all([
      sb.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      sb.from("eligibility_answers").select("id, created_at, answers, results, rules_version, includes_health_data").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      sb.from("notification_consent").select("*").eq("user_id", user.id).maybeSingle(),
      sb.from("offer_code_requests").select("id, offer_id, code, status, created_at, redeemed_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      sb.rpc("my_roles"),
      offerTitles()
    ]);
    const p = prof || {};
    const staff = roles && (roles.admin || (roles.partner_offers || []).length);
    area.innerHTML =
      '<p>Signed in as <strong>' + esc(user.email) + '</strong>. <button class="btn secondary" id="signout">Sign out</button>' +
      (staff ? ' <a class="btn secondary" href="staff.html">Staff dashboard</a>' : "") + "</p>" +
      '<form id="profile" class="card"><h2 style="margin-top:0">My profile</h2><div class="inline-fields">' +
      '<div class="field"><label for="p-name">First name or nickname (optional)</label><input id="p-name" type="text" maxlength="80" value="' + esc(p.display_name || "") + '"></div>' +
      '<div class="field"><label for="p-state">State</label><select id="p-state"><option value="">—</option><option value="MA"' + (p.state === "MA" ? " selected" : "") + '>Massachusetts</option><option value="NH"' + (p.state === "NH" ? " selected" : "") + '>New Hampshire</option></select></div>' +
      '<div class="field"><label for="p-zip">Zip code (optional)</label><input id="p-zip" type="text" inputmode="numeric" maxlength="5" value="' + esc(p.zip || "") + '"></div></div>' +
      '<button class="btn" type="submit">Save profile</button> <span id="p-msg" role="status"></span></form>' +

      '<section class="card" style="margin-top:1rem" id="my-codes"><h2 style="margin-top:0">My offer codes</h2>' +
      ((codes && codes.length) ? '<div class="code-list">' + codes.map((c) => {
        const o = offers[c.offer_id] || {};
        return '<div class="code-item"><div>' + (c.status === "issued" ? RTR.qrImg(c.code, "QR code for offer code " + c.code) : "") + '</div><div><p style="margin:0"><strong>' + esc(o.title || c.offer_id) + "</strong></p>" +
          '<p class="offer-code" aria-label="Offer code">' + esc(c.code) + "</p>" +
          '<p class="hint" style="margin:0">' + (c.status === "redeemed" ? "Redeemed " + esc(new Date(c.redeemed_at).toLocaleDateString()) : c.status === "issued" ? "Show this code or QR to the partner. Issued " + esc(new Date(c.created_at).toLocaleDateString()) + "." : esc(c.status)) + "</p>" +
          '<button class="linklike del-code" data-id="' + esc(c.id) + '">Delete this code</button></div></div>';
      }).join("") + "</div>" : '<p>No codes yet. Request one on the <a href="offers.html">partner offers page</a>.</p>') + "</section>" +

      '<section class="card" style="margin-top:1rem"><h2 style="margin-top:0">Saved checker answers</h2>' +
      '<p class="hint">Answers are only here if you ticked “Save my answers.” Health-related answers are only included if you ticked that separate box.</p>' +
      ((answers && answers.length) ? "<ul>" + answers.map((a) => "<li>" + esc(new Date(a.created_at).toLocaleString()) + " — " + esc((a.answers && a.answers.state) || "") + ", household of " + esc((a.answers && (a.answers.household_size || a.answers.household)) || "?") + (a.includes_health_data ? " (includes health answers)" : "") + ' <button class="btn secondary del-ans" data-id="' + esc(a.id) + '">Delete</button></li>').join("") + "</ul>" + '<button class="btn secondary" id="del-all">Delete all my saved answers</button> <span id="del-msg" role="status"></span>' : '<p>None saved. The <a href="eligibility.html">benefits checker</a> never saves anything unless you choose to.</p>') +
      "</section>" +
      '<section class="card" style="margin-top:1rem"><h2 style="margin-top:0">Offer notifications</h2>' +
      (consent && consent.opted_in ? '<p>You are <strong>opted in</strong> (since ' + esc(new Date(consent.consented_at).toLocaleDateString()) + '). <a href="unsubscribe.html?token=' + esc(consent.unsubscribe_token) + '">Unsubscribe in one click</a>.</p>' : '<p>You are <strong>not</strong> receiving offer notifications. You can opt in on the <a href="offers.html">partner offers page</a>.</p>') +
      "</section>" +
      '<section class="card" style="margin-top:1rem"><h2 style="margin-top:0">Delete my data</h2><p>This permanently deletes your profile, saved answers, offer codes and notification choices from Root to Rise.</p>' +
      '<button class="btn secondary" id="wipe">Delete all my Root to Rise data</button> <span id="wipe-msg" role="status"></span>' +
      '<p class="hint">To also close your login itself, email <a href="mailto:roottorisema@gmail.com">roottorisema@gmail.com</a> and we\'ll remove it.</p></section>';

    document.getElementById("signout").addEventListener("click", async () => { await sb.auth.signOut(); render(); });
    document.getElementById("profile").addEventListener("submit", async (e) => {
      e.preventDefault();
      const zip = document.getElementById("p-zip").value.trim();
      const { error } = await sb.from("profiles").upsert({ id: user.id, display_name: document.getElementById("p-name").value.trim() || null, state: document.getElementById("p-state").value || null, zip: /^\d{5}$/.test(zip) ? zip : null });
      document.getElementById("p-msg").textContent = error ? "Couldn't save: " + RTR.friendlyError(error) : "Saved.";
    });
    area.querySelectorAll(".del-ans").forEach((b) => b.addEventListener("click", async () => {
      await sb.from("eligibility_answers").delete().eq("id", b.getAttribute("data-id")); render();
    }));
    area.querySelectorAll(".del-code").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Delete this code? You can request a new one later.")) return;
      await sb.from("offer_code_requests").delete().eq("id", b.getAttribute("data-id")); render();
    }));
    const delAll = document.getElementById("del-all");
    if (delAll) delAll.addEventListener("click", async () => {
      if (!confirm("Delete all of your saved checker answers? This cannot be undone.")) return;
      const { error } = await sb.from("eligibility_answers").delete().eq("user_id", user.id);
      if (error) document.getElementById("del-msg").textContent = "Couldn't delete: " + RTR.friendlyError(error); else render();
    });
    document.getElementById("wipe").addEventListener("click", async () => {
      if (!confirm("Delete ALL your Root to Rise data (profile, saved answers, codes, notification choices)? This cannot be undone.")) return;
      const { error } = await sb.rpc("delete_my_data");
      if (error) { document.getElementById("wipe-msg").textContent = "Couldn't delete: " + RTR.friendlyError(error); return; }
      await sb.auth.signOut(); render("Your Root to Rise data was deleted and you are signed out.");
    });
  }

  async function render(notice) {
    const area = document.getElementById("account-area");
    const { sb, user } = await RTR.getUser();
    if (!sb) { area.innerHTML = RTR.comingSoonHTML("Member accounts are not turned on yet."); return; }
    if (!RTR._authHooked) {
      RTR._authHooked = true;
      sb.auth.onAuthStateChange((evt) => { if (evt === "PASSWORD_RECOVERY") { recoveryMode = true; recoveryForm(area, sb); } });
    }
    if (recoveryMode) return recoveryForm(area, sb);
    if (!user) authForm(area, sb, typeof notice === "string" ? notice : urlAuthError()); else dashboard(area, sb, user);
  }
  document.addEventListener("DOMContentLoaded", () => render());
})();
