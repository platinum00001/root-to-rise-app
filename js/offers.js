/* Partner offers + opt-in consent (stores consent only; this site sends no email). */
(function () {
  const RTR = window.RTR;
  const DEFAULT_CONSENT = "Yes, email me about partner offers I may qualify for. I understand I can unsubscribe at any time with one click, and that my health information is never sold or shared for marketing.";

  async function renderOffers() {
    const el = document.getElementById("offers-list");
    try {
      const d = await RTR.fetchJSON("data/offers.json");
      const esc = RTR.esc;
      el.innerHTML = d.offers.map((o) =>
        '<article class="card result"><h2 style="margin-top:0;font-size:1.3rem">' + esc(o.title) + "</h2>" +
        (o.sample ? '<p><span class="badge sample">Sample offer — for demonstration</span></p>' : "") +
        (o.partner ? "<p><strong>From:</strong> " + esc(o.partner) + "</p>" : "") +
        "<p>" + esc(o.summary) + "</p>" +
        (o.who_qualifies ? "<p><strong>Who qualifies:</strong> " + esc(o.who_qualifies) + "</p>" : "") +
        (o.expires ? "<p><strong>Ends:</strong> " + esc(o.expires) + "</p>" : "") +
        (o.link ? '<a class="btn secondary" href="' + esc(o.link) + '" target="_blank" rel="noopener">' + esc(o.link_label || "Learn more") + "</a>" : "") +
        ' <a class="btn secondary" href="eligibility.html">Check if I qualify</a></article>').join("") || "<p>No offers right now. Check back soon.</p>";
    } catch (e) { el.innerHTML = "<p>Offers could not load. Please refresh.</p>"; }
  }

  async function consentText() {
    try { const s = await RTR.fetchJSON("data/site.json"); return (s.offers && s.offers.consent_text) || DEFAULT_CONSENT; } catch (e) { return DEFAULT_CONSENT; }
  }

  async function renderNotify() {
    const area = document.getElementById("notify-area");
    const text = await consentText();
    const { sb, user } = await RTR.getUser();
    const esc = RTR.esc;
    if (!sb) {
      area.innerHTML = '<p>' + esc(text) + '</p>' + RTR.comingSoonHTML("Opt-in offer notifications will be available once member accounts are turned on.");
      return;
    }
    if (!user) {
      area.innerHTML = '<p>To choose notifications, please <a href="account.html">sign in or create a free account</a>. Notifications are always optional.</p>';
      return;
    }
    const { data: row } = await sb.from("notification_consent").select("*").eq("user_id", user.id).maybeSingle();
    const on = !!(row && row.opted_in);
    area.innerHTML =
      '<form id="consent-form"><label class="choice"><input type="checkbox" id="consent-box"' + (on ? " checked" : "") + "> <span>" + esc(text) + "</span></label>" +
      '<p class="hint">We store your choice and the date. We do not send emails from this website today. See our <a href="privacy.html">privacy policy</a>.</p>' +
      '<button class="btn" type="submit">Save my choice</button> <span id="consent-msg" role="status"></span></form>' +
      (row && row.unsubscribe_token ? '<p class="hint">Your one-click unsubscribe link: <a href="unsubscribe.html?token=' + esc(row.unsubscribe_token) + '">unsubscribe</a></p>' : "");
    document.getElementById("consent-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      const checked = document.getElementById("consent-box").checked;
      const now = new Date().toISOString();
      const payload = { user_id: user.id, email: user.email, opted_in: checked, consent_text: text };
      if (checked) { payload.consented_at = now; payload.unsubscribed_at = null; } else { payload.unsubscribed_at = now; }
      const { error } = await sb.from("notification_consent").upsert(payload, { onConflict: "user_id" });
      document.getElementById("consent-msg").textContent = error ? "Sorry, couldn't save: " + error.message : (checked ? "Thanks — you're opted in. You can unsubscribe any time." : "You're opted out. You won't hear from us about offers.");
      if (!error) renderNotify();
    });
  }
  document.addEventListener("DOMContentLoaded", function () { renderOffers(); renderNotify(); });
})();
