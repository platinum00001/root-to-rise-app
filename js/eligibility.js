/* Benefits "may qualify" screener.
 * Engine: js/screen.js (Root to Rise Resource Navigator) + data/eligibility-rules.json.
 * Privacy: answers live in memory only. They are kept on this device (localStorage) only if the
 * person ticks "Remember on this device", and sent to Supabase only if a signed-in member ticks
 * the separate "Save my answers" box. Health fields need a further, separate tick. */
(function () {
  const RTR = window.RTR;
  const LS_KEY = "rtr-screener-answers";
  let RULES = null, EXTRAS = null, lastAnswers = null, lastResults = null, lastExtras = null;
  const LABELS = {
    state: { MA: "Massachusetts", NH: "New Hampshire", other: "Somewhere else" },
    pays_for_heat: { pays_heat: "I pay for heat (oil, gas, electric, etc.)", heat_in_rent_unsubsidized: "Heat is included in my rent (not subsidized housing)", heat_in_rent_subsidized: "Heat is included in my rent (subsidized / public housing)", not_sure: "Not sure" }
  };
  const RESULT_LABEL = { may_qualify: "You may qualify", might_not_qualify_income: "Might not qualify on income — you can still apply", check_with_program: "Check with the program" };
  const RESULT_CLASS = { may_qualify: "likely", might_not_qualify_income: "unlikely", check_with_program: "maybe" };
  const esc = (s) => RTR.esc(s == null ? "" : String(s));

  function healthFields() {
    const base = (RULES.disclaimer.privacy_requirements_for_web_app || {}).health_data_fields || [];
    return base.concat(EXTRAS.questions.filter((q) => q.health_data).map((q) => q.id));
  }

  function fieldHTML(q) {
    const id = "q-" + q.id, req = q.required ? " required" : "";
    const opt = q.required ? "" : ' <span class="hint">(optional)</span>';
    const help = q.help ? '<p class="hint" id="' + id + '-help">' + esc(q.help) + "</p>" : "";
    const lbl = (o) => (q.option_labels && q.option_labels[o]) || (LABELS[q.id] && LABELS[q.id][o]) || o;
    const wrapAttr = q.id === "expected_babies" ? ' data-show-if="is_pregnant" hidden' : "";
    if (q.type === "enum") {
      return '<div class="field"' + wrapAttr + '><label for="' + id + '">' + esc(q.text) + opt + "</label>" + help + '<select id="' + id + '" name="' + q.id + '"' + req + '><option value="">Choose…</option>' +
        q.options.map((o) => '<option value="' + esc(o) + '">' + esc(lbl(o)) + "</option>").join("") + "</select></div>";
    }
    if (q.type === "integer" || q.type === "number") {
      return '<div class="field"' + wrapAttr + '><label for="' + id + '">' + esc(q.text) + opt + "</label>" + help + '<input id="' + id + '" name="' + q.id + '" type="number" inputmode="numeric"' +
        (q.min != null ? ' min="' + q.min + '"' : "") + (q.max != null ? ' max="' + q.max + '"' : "") + (q.type === "number" ? ' step="any"' : ' step="1"') + req + "></div>";
    }
    if (q.type === "boolean") {
      return '<fieldset class="field yesno"' + wrapAttr + "><legend>" + esc(q.text) + opt + "</legend>" + help +
        '<label class="choice"><input type="radio" name="' + q.id + '" value="yes"> Yes</label>' +
        '<label class="choice"><input type="radio" name="' + q.id + '" value="no"> No</label></fieldset>';
    }
    if (q.type === "multi_enum") {
      return '<fieldset class="field"><legend>' + esc(q.text) + opt + "</legend>" + help +
        q.options.map((o) => '<label class="choice"><input type="checkbox" name="' + q.id + '" value="' + esc(o) + '"> ' + esc(lbl(o)) + "</label>").join("") + "</fieldset>";
    }
    return "";
  }

  function allQuestions() { return RULES.questions.concat(EXTRAS.questions); }

  function readAnswers(form) {
    const a = {};
    allQuestions().forEach((q) => {
      const els = form.elements[q.id];
      if (!els) return;
      if (q.type === "boolean") { const c = form.querySelector('input[name="' + q.id + '"]:checked'); if (c) a[q.id] = c.value === "yes"; }
      else if (q.type === "multi_enum") a[q.id] = Array.from(form.querySelectorAll('input[name="' + q.id + '"]:checked')).map((x) => x.value);
      else if (q.type === "integer" || q.type === "number") { if (els.value !== "") a[q.id] = Number(els.value); }
      else if (els.value !== "") a[q.id] = els.value;
    });
    if (!a.is_pregnant) delete a.expected_babies;
    return a;
  }
  function fillForm(form, a) {
    allQuestions().forEach((q) => {
      if (!(q.id in a)) return;
      if (q.type === "boolean") { const r = form.querySelector('input[name="' + q.id + '"][value="' + (a[q.id] ? "yes" : "no") + '"]'); if (r) r.checked = true; }
      else if (q.type === "multi_enum") form.querySelectorAll('input[name="' + q.id + '"]').forEach((c) => (c.checked = (a[q.id] || []).indexOf(c.value) !== -1));
      else if (form.elements[q.id]) form.elements[q.id].value = a[q.id];
    });
    syncConditional(form);
  }
  function syncConditional(form) {
    form.querySelectorAll("[data-show-if]").forEach((el) => {
      const c = form.querySelector('input[name="' + el.getAttribute("data-show-if") + '"]:checked');
      el.hidden = !(c && c.value === "yes");
    });
  }
  function validate(a) {
    if (!a.state) return "Please choose your state.";
    if (!(a.household_size >= 1)) return "Please enter how many people are in your household (1 or more).";
    if (!(a.monthly_gross_income >= 0)) return "Please enter monthly household income before taxes (enter 0 if none).";
    return "";
  }

  function test(cond, a) {
    const v = a[cond.field], val = cond.value;
    switch (cond.op) {
      case "eq": return v === val || String(v) === String(val);
      case "in": return (Array.isArray(val) ? val : String(val).split(",").map((x) => x.trim())).map(String).indexOf(String(v)) !== -1;
      case "gte": return typeof v === "number" && v >= Number(val);
      case "lte": return typeof v === "number" && v <= Number(val);
      default: return false;
    }
  }
  function evaluateExtras(a) {
    return EXTRAS.programs.filter((p) => {
      if (p.states && p.states.indexOf(a.state) === -1) return false;
      if (p.show_if && !p.show_if.every((c) => test(c, a))) return false;
      if (p.show_if_any && !p.show_if_any.some((c) => test(c, a))) return false;
      return true;
    });
  }

  // ---------- rendering helpers
  function isUrl(s) { return /^(https?:|tel:|mailto:)/.test(s || ""); }
  function ext(url, text) { return '<a href="' + esc(url) + '"' + (/^https?:/.test(url) ? ' target="_blank" rel="noopener"' : "") + ">" + esc(text) + "</a>"; }
  function phoneLink(p) {
    const m = String(p).match(/(\d-)?\d{3}-\d{3}-\d{4}|\b211\b|\b988\b/);
    if (!m) return esc(p);
    const i = p.indexOf(m[0]);
    return esc(p.slice(0, i)) + '<a href="' + RTR.telHref(m[0]) + '">' + esc(m[0]) + "</a>" + esc(p.slice(i + m[0].length));
  }
  function contact(o) {
    if (o == null) return "";
    if (typeof o === "string") return isUrl(o) ? ext(o, o.replace(/^https?:\/\/(www\.)?/, "")) : phoneLink(o);
    if (Array.isArray(o)) return "<ul>" + o.map((x) => "<li>" + contact(x) + "</li>").join("") + "</ul>";
    const bits = [];
    if (o.name) bits.push("<strong>" + esc(o.name) + "</strong>");
    if (o.address) bits.push(esc(o.address));
    if (o.phone) bits.push(phoneLink(o.phone));
    if (o.hours) bits.push(esc(o.hours));
    if (o.apply_online) bits.push(ext(o.apply_online, "Apply online"));
    if (o.apply_phone) bits.push("Phone: " + phoneLink(o.apply_phone));
    if (o.in_person) bits.push(esc(o.in_person));
    if (o.url) bits.push(ext(o.url, "Website"));
    if (o.source_url) bits.push('<span class="hint">(' + ext(o.source_url, "source") + ")</span>");
    Object.keys(o).forEach((k) => {
      if (["name", "address", "phone", "hours", "apply_online", "apply_phone", "in_person", "url", "source_url"].indexOf(k) !== -1) return;
      bits.push("<em>" + esc(k.replace(/_/g, " ")) + ":</em> " + contact(o[k]));
    });
    return bits.join(" · ");
  }
  function regionKey(state) { return state === "NH" ? "nashua" : "cape_cod"; }
  function nextSteps(ns, state) {
    if (!ns) return "";
    if (ns[state] && typeof ns[state] === "object") ns = Object.assign({}, ns, ns[state]);
    const rk = regionKey(state), out = [];
    if (ns.apply_online) out.push("<li><strong>Apply online:</strong> " + contact(ns.apply_online) + "</li>");
    if (ns.apply_phone) out.push("<li><strong>Apply by phone:</strong> " + phoneLink(ns.apply_phone) + "</li>");
    ["local_office", "local_help", "local_intake", "referrals"].forEach((k) => {
      const v = ns[k] && (ns[k][rk] || (ns[k].name ? ns[k] : null));
      if (v) out.push("<li><strong>" + (k === "local_office" ? "Local office" : k === "referrals" ? "Where to start" : "Local help") + ":</strong> " + contact(v) + "</li>");
    });
    if (ns.application_help) out.push("<li><strong>Help applying:</strong> " + contact(ns.application_help) + "</li>");
    if (ns.statewide_help) out.push("<li><strong>Statewide help:</strong> " + contact(ns.statewide_help) + "</li>");
    if (ns.families) out.push("<li><strong>Families:</strong> " + contact(ns.families) + "</li>");
    if (ns.individuals) out.push("<li><strong>Individuals:</strong> " + contact(ns.individuals) + "</li>");
    if (ns.shelters) out.push("<li><strong>Shelters:</strong> " + contact(ns.shelters) + "</li>");
    if (ns.phone) out.push("<li><strong>Phone:</strong> " + phoneLink(ns.phone) + "</li>");
    const dir = ns[rk + "_directory"]; if (dir) out.push("<li><strong>Local directory:</strong> " + contact(dir) + "</li>");
    ["emergency_note", "dv_note", "tip", "phone_source"].forEach((k) => { if (ns[k]) out.push("<li>" + contact(ns[k]) + "</li>"); });
    let html = out.length ? "<ul>" + out.join("") + "</ul>" : "";
    if (ns.documents && ns.documents.length) html += "<details><summary>Documents to gather</summary><ul>" + ns.documents.map((d) => "<li>" + esc(d) + "</li>").join("") + "</ul></details>";
    return html;
  }
  function money(n) { return "$" + Math.round(n).toLocaleString(); }
  function limitLine(l) {
    if (!l || l.value == null) return "";
    // screen.js always compares against a MONTHLY figure (yearly tables are divided by 12), so show it per month.
    return '<p class="hint">Income limit used: about <strong>' + money(l.value) + "/month</strong> for your household" + (l.basis ? " — " + esc(l.basis) : "") +
      (l.as_of ? ". As of " + esc(l.as_of) : "") + (l.source_url ? " · " + ext(l.source_url, "official source") : "") + "</p>";
  }
  function disclaimerHTML() {
    const d = RULES.disclaimer;
    return '<div class="notice"><strong>' + esc(d.title) + ".</strong><ul>" + d.text.map((t) => "<li>" + esc(t) + "</li>").join("") + "</ul></div>";
  }

  function render(results, extras, a) {
    const el = document.getElementById("results");
    const prog = {}; RULES.programs.forEach((p) => (prog[p.id] = p));
    let html = "<h2>Your results</h2>" + disclaimerHTML();
    if (!results.length) html += '<p>No programs matched your answers. Try the <a href="resources.html">resource finder</a> or dial 211.</p>';
    results.forEach((r) => {
      const p = prog[r.program_id] || {};
      const srcs = (p.sources || []).map((u, i) => ext(u, "source " + (i + 1))).join(", ");
      html += '<article class="card result"><h3>' + esc(r.name) + ' <span class="badge ' + (RESULT_CLASS[r.result] || "maybe") + '">' + esc(RESULT_LABEL[r.result] || r.result) + "</span></h3>" +
        "<p>" + esc(r.message) + "</p>" + (r.reasons && r.reasons.length ? "<ul>" + r.reasons.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" : "") +
        limitLine(r.limit_used) + (r.next_steps ? "<h4>Next steps</h4>" + nextSteps(r.next_steps, a.state) : "") +
        (srcs ? '<p class="hint">Rule sources: ' + srcs + "</p>" : "") + "</article>";
    });
    if (extras.length) {
      html += "<h3>" + esc(EXTRAS.status_label) + "</h3>";
      extras.forEach((p) => {
        html += '<article class="card result"><h3>' + esc(p.name) + ' <span class="badge maybe">Check with the program</span></h3><p>' + esc(p.message) + "</p><p>" +
          (p.links || []).map((l) => ext(l.url, l.label)).join(" · ") + "</p></article>";
      });
    }
    html += disclaimerHTML();
    html += '<p class="notice info">Not sure where to start? Dial <strong>211</strong> (Mass 211 or NH 211), or email <a href="mailto:roottorisema@gmail.com">roottorisema@gmail.com</a> and a Root to Rise volunteer can help you apply.</p>';
    el.innerHTML = html;
    el.focus();
  }

  // ---------- optional saving
  function remember(a) { try { localStorage.setItem(LS_KEY, JSON.stringify(a)); } catch (e) {} }
  function forget() { try { localStorage.removeItem(LS_KEY); } catch (e) {} }

  async function renderSave() {
    const area = document.getElementById("save-area");
    if (!lastResults) { area.innerHTML = ""; return; }
    const { sb, user } = await RTR.getUser();
    if (!sb) { area.innerHTML = RTR.comingSoonHTML("Soon members will be able to choose to save answers to a private account."); return; }
    if (!user) { area.innerHTML = '<div class="card"><p>Want to keep these answers? You can <a href="account.html">sign in or create an account</a> and choose to save them. Saving is always optional.</p></div>'; return; }
    area.innerHTML = '<form class="card" id="save-form"><h2 style="margin-top:0">Save to my private account (optional)</h2>' +
      '<label class="choice"><input type="checkbox" id="save-consent"> Yes, save my answers and results to my Root to Rise account. Only I can see them, and I can delete them any time in <a href="account.html">My account</a>.</label>' +
      '<label class="choice"><input type="checkbox" id="save-health"> Also save my health-related answers (pregnancy, disability, Medicare, recovery status). If unchecked, those answers are left out.</label>' +
      '<button class="btn" id="save-btn" type="submit" disabled>Save my answers</button> <span id="save-msg" role="status"></span></form>';
    const c = document.getElementById("save-consent"), btn = document.getElementById("save-btn");
    c.addEventListener("change", () => (btn.disabled = !c.checked));
    document.getElementById("save-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!c.checked) return;
      btn.disabled = true;
      const withHealth = document.getElementById("save-health").checked;
      const answers = Object.assign({}, lastAnswers);
      if (!withHealth) healthFields().forEach((f) => delete answers[f]);
      const { error } = await sb.from("eligibility_answers").insert({
        user_id: user.id, answers, save_consent: true, includes_health_data: withHealth,
        results: lastResults.map((x) => ({ program_id: x.program_id, result: x.result })).concat(lastExtras.map((x) => ({ program_id: x.id, result: "check_with_program" }))),
        rules_version: RULES.schema_version + " (" + RULES.generated_on + ")"
      });
      document.getElementById("save-msg").textContent = error ? "Sorry, we couldn't save: " + RTR.friendlyError(error) : "Saved. You can view or delete it in My account.";
      if (error) btn.disabled = false;
    });
  }

  document.addEventListener("DOMContentLoaded", async function () {
    const form = document.getElementById("elig-form");
    const err = document.getElementById("form-error");
    try {
      [RULES, EXTRAS] = await Promise.all([RTR.fetchJSON("data/eligibility-rules.json"), RTR.fetchJSON("data/eligibility-extras.json")]);
    } catch (e) { err.hidden = false; err.textContent = "Sorry, the checker could not load. Please refresh the page."; return; }
    const core = RULES.questions.filter((q) => q.required || ["age"].indexOf(q.id) !== -1);
    const more = RULES.questions.filter((q) => core.indexOf(q) === -1);
    document.getElementById("q-core").innerHTML = core.map(fieldHTML).join("");
    document.getElementById("q-more").innerHTML = more.map(fieldHTML).join("") + EXTRAS.questions.map(fieldHTML).join("");
    document.getElementById("rules-asof").textContent = "Rules checked against official sources on " + RULES.generated_on + ". " + (RULES.fiscal_year_context && RULES.fiscal_year_context.current ? "Period: " + RULES.fiscal_year_context.current + "." : "");
    form.addEventListener("change", () => syncConditional(form));
    const rem = document.getElementById("remember");
    let saved = null; try { saved = JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) {}
    if (saved) { fillForm(form, saved); rem.checked = true; document.getElementById("remember-note").textContent = "We filled in the answers you asked this device to remember."; }
    rem.addEventListener("change", () => { if (!rem.checked) forget(); else if (lastAnswers) remember(lastAnswers); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const a = readAnswers(form);
      const msg = validate(a);
      if (msg) { err.hidden = false; err.textContent = msg; return; }
      err.hidden = true;
      lastAnswers = a;
      lastResults = window.RootToRiseScreener.screen(a, RULES);
      lastExtras = a.state === "other" ? [] : evaluateExtras(a);
      if (rem.checked) remember(a); else forget();
      render(lastResults, lastExtras, a);
      renderSave();
    });
    document.getElementById("clear-answers").addEventListener("click", function () {
      form.reset(); forget(); syncConditional(form);
      lastAnswers = lastResults = lastExtras = null;
      document.getElementById("results").innerHTML = "";
      document.getElementById("save-area").innerHTML = "";
      document.getElementById("remember-note").textContent = "Your answers were cleared from this page and this device.";
      err.hidden = true;
    });
  });
  window.RTR_ELIG = { evaluateExtras: (a) => evaluateExtras(a), setData: (r, x) => { RULES = r; EXTRAS = x; } };
})();
