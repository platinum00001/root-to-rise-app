/* Member accounts (Supabase Auth email/password) + profile, saved answers, consent. */
(function () {
  const RTR = window.RTR;
  const esc = (s) => RTR.esc(s);

  function authForm(area, sb) {
    area.innerHTML =
      '<div class="grid grid-2"><form id="signin" class="card"><h2 style="margin-top:0">Sign in</h2>' +
      '<div class="field"><label for="si-email">Email</label><input id="si-email" type="email" autocomplete="email" required></div>' +
      '<div class="field"><label for="si-pass">Password</label><input id="si-pass" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn" type="submit">Sign in</button> <p id="si-msg" role="status"></p></form>' +
      '<form id="signup" class="card"><h2 style="margin-top:0">Create a free account</h2>' +
      '<div class="field"><label for="su-email">Email</label><input id="su-email" type="email" autocomplete="email" required></div>' +
      '<div class="field"><label for="su-pass">Password (8+ characters)</label><input id="su-pass" type="password" minlength="8" autocomplete="new-password" required></div>' +
      '<p class="hint">Creating an account does <strong>not</strong> sign you up for any emails.</p>' +
      '<button class="btn" type="submit">Create account</button> <p id="su-msg" role="status"></p></form></div>';
    document.getElementById("signin").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { error } = await sb.auth.signInWithPassword({ email: document.getElementById("si-email").value, password: document.getElementById("si-pass").value });
      document.getElementById("si-msg").textContent = error ? error.message : "Signed in.";
      if (!error) render();
    });
    document.getElementById("signup").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { data, error } = await sb.auth.signUp({ email: document.getElementById("su-email").value, password: document.getElementById("su-pass").value, options: { emailRedirectTo: location.origin + "/account.html" } });
      document.getElementById("su-msg").textContent = error ? error.message : (data.session ? "Account created — you're signed in." : "Check your email to confirm your account, then sign in.");
      if (!error && data.session) render();
    });
  }

  async function dashboard(area, sb, user) {
    const [{ data: prof }, { data: answers }, { data: consent }] = await Promise.all([
      sb.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      sb.from("eligibility_answers").select("id, created_at, answers, results, rules_version, includes_health_data").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      sb.from("notification_consent").select("*").eq("user_id", user.id).maybeSingle()
    ]);
    const p = prof || {};
    area.innerHTML =
      '<p>Signed in as <strong>' + esc(user.email) + '</strong>. <button class="btn secondary" id="signout">Sign out</button></p>' +
      '<form id="profile" class="card"><h2 style="margin-top:0">My profile</h2><div class="inline-fields">' +
      '<div class="field"><label for="p-name">First name or nickname (optional)</label><input id="p-name" type="text" value="' + esc(p.display_name || "") + '"></div>' +
      '<div class="field"><label for="p-state">State</label><select id="p-state"><option value="">—</option><option value="MA"' + (p.state === "MA" ? " selected" : "") + '>Massachusetts</option><option value="NH"' + (p.state === "NH" ? " selected" : "") + '>New Hampshire</option></select></div>' +
      '<div class="field"><label for="p-zip">Zip code (optional)</label><input id="p-zip" type="text" inputmode="numeric" maxlength="5" value="' + esc(p.zip || "") + '"></div></div>' +
      '<button class="btn" type="submit">Save profile</button> <span id="p-msg" role="status"></span></form>' +
      '<section class="card" style="margin-top:1rem"><h2 style="margin-top:0">Saved checker answers</h2>' +
      '<p class="hint">Answers are only here if you ticked “Save my answers.” Health-related answers are only included if you ticked that separate box.</p>' +
      ((answers && answers.length) ? "<ul>" + answers.map((a) => "<li>" + esc(new Date(a.created_at).toLocaleString()) + " — " + esc((a.answers && a.answers.state) || "") + ", household of " + esc((a.answers && (a.answers.household_size || a.answers.household)) || "?") + (a.includes_health_data ? " (includes health answers)" : "") + ' <button class="btn secondary del-ans" data-id="' + esc(a.id) + '">Delete</button></li>').join("") + "</ul>" + '<button class="btn secondary" id="del-all">Delete all my saved answers</button> <span id="del-msg" role="status"></span>' : '<p>None saved. The <a href="eligibility.html">benefits checker</a> never saves anything unless you choose to.</p>') +
      "</section>" +
      '<section class="card" style="margin-top:1rem"><h2 style="margin-top:0">Offer notifications</h2>' +
      (consent && consent.opted_in ? '<p>You are <strong>opted in</strong> (since ' + esc(new Date(consent.consented_at).toLocaleDateString()) + '). <a href="unsubscribe.html?token=' + esc(consent.unsubscribe_token) + '">Unsubscribe in one click</a>.</p>' : '<p>You are <strong>not</strong> receiving offer notifications. You can opt in on the <a href="offers.html">partner offers page</a>.</p>') +
      "</section>";
    document.getElementById("signout").addEventListener("click", async () => { await sb.auth.signOut(); render(); });
    document.getElementById("profile").addEventListener("submit", async (e) => {
      e.preventDefault();
      const zip = document.getElementById("p-zip").value.trim();
      const { error } = await sb.from("profiles").upsert({ id: user.id, display_name: document.getElementById("p-name").value.trim() || null, state: document.getElementById("p-state").value || null, zip: /^\d{5}$/.test(zip) ? zip : null });
      document.getElementById("p-msg").textContent = error ? "Couldn't save: " + error.message : "Saved.";
    });
    area.querySelectorAll(".del-ans").forEach((b) => b.addEventListener("click", async () => {
      await sb.from("eligibility_answers").delete().eq("id", b.getAttribute("data-id")); render();
    }));
    const delAll = document.getElementById("del-all");
    if (delAll) delAll.addEventListener("click", async () => {
      if (!confirm("Delete all of your saved checker answers? This cannot be undone.")) return;
      const { error } = await sb.from("eligibility_answers").delete().eq("user_id", user.id);
      if (error) document.getElementById("del-msg").textContent = "Couldn't delete: " + error.message; else render();
    });
  }

  async function render() {
    const area = document.getElementById("account-area");
    const { sb, user } = await RTR.getUser();
    if (!sb) { area.innerHTML = RTR.comingSoonHTML("Member accounts are not turned on yet."); return; }
    if (!user) authForm(area, sb); else dashboard(area, sb, user);
  }
  document.addEventListener("DOMContentLoaded", render);
})();
