/* Staff dashboard: aggregate counts + CSV (admins) and code redemption (admins + partner staff). */
(function () {
  const RTR = window.RTR;
  const esc = (s) => RTR.esc(s);
  const LABELS = {
    member_signups: "Member sign-ups", eligibility_checks_saved: "Eligibility checks saved (with consent)",
    members_with_saved_checks: "Members with saved checks", offer_optins_active: "Offer notification opt-ins (active)",
    offer_unsubscribes: "Offer unsubscribes", codes_issued: "Offer codes issued", codes_redeemed: "Offer codes redeemed"
  };

  function csv(stats) {
    const rows = [["section", "metric", "month_or_offer", "value"]];
    Object.keys(stats.totals).forEach((k) => rows.push(["totals", k, "", stats.totals[k]]));
    (stats.by_month || []).forEach((m) => ["member_signups", "eligibility_checks_saved", "codes_issued", "codes_redeemed"].forEach((k) => rows.push(["by_month", k, m.month, m[k]])));
    (stats.codes_by_offer || []).forEach((o) => { rows.push(["codes_by_offer", "issued", o.offer_id, o.issued]); rows.push(["codes_by_offer", "redeemed", o.offer_id, o.redeemed]); });
    rows.push(["meta", "generated_at", "", stats.generated_at]);
    return rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\r\n");
  }

  function redeemHTML() {
    return '<form id="redeem" class="card" style="margin-top:1rem"><h2 style="margin-top:0">Check or redeem a member\'s code</h2>' +
      '<div class="inline-fields"><div class="field"><label for="code">Offer code</label><input id="code" type="text" autocomplete="off" autocapitalize="characters" maxlength="12" required placeholder="e.g. 7KQ2MZ9P"></div></div>' +
      '<button class="btn secondary" type="button" id="check">Check code</button> <button class="btn" type="submit">Mark redeemed</button>' +
      '<p id="r-msg" role="status" aria-live="polite"></p><p class="hint">Scanning the member\'s QR with your phone camera shows the same code.</p></form>';
  }

  async function staff(area, sb, user) {
    const { data: roles, error } = await sb.rpc("my_roles");
    if (error) { area.innerHTML = '<p class="notice info">' + esc(RTR.friendlyError(error)) + "</p>"; return; }
    if (!roles.admin && !(roles.partner_offers || []).length) {
      area.innerHTML = '<p>Signed in as ' + esc(user.email) + '. This page is for Root to Rise staff and partners. If you should have access, email <a href="mailto:roottorisema@gmail.com">roottorisema@gmail.com</a>.</p>';
      return;
    }
    let html = '<p>Signed in as <strong>' + esc(user.email) + "</strong> (" + (roles.admin ? "admin" : "partner staff") + ").</p>";
    if (roles.admin) html += '<section class="card"><h2 style="margin-top:0">Totals</h2><div id="totals">Loading…</div>' +
      '<button class="btn secondary" id="csv" type="button">Download CSV (totals only)</button> <button class="btn secondary" id="refresh" type="button">Refresh</button></section>';
    html += redeemHTML();
    area.innerHTML = html;
    let stats = null;
    async function loadStats() {
      const { data, error } = await sb.rpc("admin_stats");
      const el = document.getElementById("totals");
      if (error) { el.textContent = RTR.friendlyError(error); return; }
      stats = data;
      el.innerHTML = '<div class="stat-grid">' + Object.keys(LABELS).map((k) => '<div class="stat"><span class="stat-n">' + esc(data.totals[k]) + '</span><span class="stat-l">' + esc(LABELS[k]) + "</span></div>").join("") + "</div>" +
        ((data.by_month || []).length ? '<table class="stats-table"><caption>By month</caption><thead><tr><th>Month</th><th>Sign-ups</th><th>Checks saved</th><th>Codes issued</th><th>Codes redeemed</th></tr></thead><tbody>' +
          data.by_month.map((m) => "<tr><td>" + esc(m.month) + "</td><td>" + esc(m.member_signups) + "</td><td>" + esc(m.eligibility_checks_saved) + "</td><td>" + esc(m.codes_issued) + "</td><td>" + esc(m.codes_redeemed) + "</td></tr>").join("") + "</tbody></table>" : "") +
        '<p class="hint">As of ' + esc(new Date(data.generated_at).toLocaleString()) + ".</p>";
    }
    if (roles.admin) {
      loadStats();
      document.getElementById("refresh").addEventListener("click", loadStats);
      document.getElementById("csv").addEventListener("click", () => {
        if (!stats) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv(stats)], { type: "text/csv" }));
        a.download = "root-to-rise-totals-" + new Date().toISOString().slice(0, 10) + ".csv";
        document.body.appendChild(a); a.click(); a.remove();
      });
    }
    const msg = document.getElementById("r-msg"), code = () => document.getElementById("code").value.trim().toUpperCase();
    document.getElementById("check").addEventListener("click", async () => {
      const { data, error } = await sb.rpc("lookup_code", { p_code: code() });
      if (error) { msg.textContent = RTR.friendlyError(error); return; }
      const r = data && data[0];
      msg.textContent = !r ? "Code not found (or not one of your offers)." : "Offer: " + r.offer_id + " — " + (r.status === "redeemed" ? "already redeemed on " + new Date(r.redeemed_at).toLocaleDateString() : r.status === "issued" ? "valid, not yet redeemed (issued " + new Date(r.issued_at).toLocaleDateString() + ")" : r.status);
    });
    document.getElementById("redeem").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { data, error } = await sb.rpc("redeem_code", { p_code: code() });
      if (error) { msg.textContent = RTR.friendlyError(error); return; }
      msg.textContent = { redeemed: "✓ Redeemed. Thank you!", already_redeemed: "This code was already redeemed.", not_valid: "This code is no longer valid.", not_found: "Code not found (or not one of your offers)." }[data] || data;
      if (data === "redeemed" && roles.admin) loadStats();
    });
  }

  document.addEventListener("DOMContentLoaded", async function () {
    const area = document.getElementById("staff-area");
    const { sb, user } = await RTR.getUser();
    if (!sb) { area.innerHTML = RTR.comingSoonHTML("Staff tools need member accounts to be turned on."); return; }
    if (!user) { area.innerHTML = '<p>Please <a href="account.html">sign in</a> first, then come back to this page.</p>'; return; }
    staff(area, sb, user);
  });
})();
