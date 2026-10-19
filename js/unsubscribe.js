/* One-click unsubscribe: unsubscribe.html?token=<uuid> calls a SECURITY DEFINER RPC. */
(function () {
  const RTR = window.RTR;
  document.addEventListener("DOMContentLoaded", async function () {
    const area = document.getElementById("unsub-area");
    const token = new URLSearchParams(location.search).get("token");
    const sb = await RTR.getSupabase();
    if (!sb) {
      area.innerHTML = "<p>Offer notifications are not active yet, so there is nothing to unsubscribe from. When they launch, this page will let you stop them in one click.</p><p>Questions? Email <a href=\"mailto:roottorisema@gmail.com\">roottorisema@gmail.com</a>.</p>";
      return;
    }
    if (token && /^[0-9a-f-]{36}$/i.test(token)) {
      area.innerHTML = "<p>Unsubscribing…</p>";
      const { data, error } = await sb.rpc("unsubscribe_by_token", { p_token: token });
      area.innerHTML = error ? "<p class=\"error\">Sorry, something went wrong. Please email roottorisema@gmail.com and we'll remove you right away.</p>"
        : (data ? "<p><strong>You're unsubscribed.</strong> You will no longer hear from us about partner offers. You can opt back in any time from My account.</p>" : "<p>This link was already used or isn't valid. If you still get messages, email <a href=\"mailto:roottorisema@gmail.com\">roottorisema@gmail.com</a>.</p>");
      return;
    }
    const { data } = await sb.auth.getUser();
    const user = data && data.user;
    if (user) {
      area.innerHTML = '<p>Signed in as ' + RTR.esc(user.email) + '.</p><button class="btn" id="unsub-btn">Unsubscribe from all offer notifications</button> <span id="unsub-msg" role="status"></span>';
      document.getElementById("unsub-btn").addEventListener("click", async function () {
        const { error } = await sb.from("notification_consent").upsert({ user_id: user.id, email: user.email, opted_in: false, unsubscribed_at: new Date().toISOString() }, { onConflict: "user_id" });
        document.getElementById("unsub-msg").textContent = error ? "Sorry, please try again." : "Done — you're unsubscribed.";
      });
    } else {
      area.innerHTML = '<p>Use the unsubscribe link from any message we sent you, or <a href="account.html">sign in</a> to unsubscribe here. You can also email <a href="mailto:roottorisema@gmail.com">roottorisema@gmail.com</a>.</p>';
    }
  });
})();
