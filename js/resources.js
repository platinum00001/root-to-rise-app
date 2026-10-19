/* Resource finder — filters data/resources.json by zip, town, category, keyword. */
(function () {
  const RTR = window.RTR;
  let DATA = null;
  const selected = new Set();

  function statesOf(r) { return r.states || (r.state ? [r.state] : []); }
  function zipState(zip) {
    if (/^0[12]/.test(zip)) return "MA";
    if (/^03/.test(zip)) return "NH";
    return "";
  }
  function zipRegion(zip) {
    const g = (DATA.regions || []).find((x) => x.zip_prefixes.some((p) => zip.indexOf(p) === 0));
    return g ? g.id : "";
  }
  function townsForZip(zip) { return DATA.towns.filter((t) => t.zips.indexOf(zip) !== -1).map((t) => t.name); }
  function inRegion(r, reg) { return (r.regions || []).indexOf(reg) !== -1; }

  // Higher score = closer match; 0 = hide.
  function matchesPlace(r, zip, town) {
    const serves = r.serves || [];
    if (town) {
      const t = DATA.towns.find((x) => x.name === town);
      if (r.town === town || serves.indexOf(town) !== -1) return 3;
      if (t && inRegion(r, t.region) && !r.statewide) return 2;
      if (t && r.statewide && statesOf(r).indexOf(t.state) !== -1) return 1;
      return 0;
    }
    if (zip && zip.length === 5) {
      const st = zipState(zip), reg = zipRegion(zip), towns = townsForZip(zip);
      if (r.zip === zip) return 4;
      if (towns.length && (towns.indexOf(r.town) !== -1 || towns.some((x) => serves.indexOf(x) !== -1))) return 3;
      if (reg && inRegion(r, reg) && !r.statewide) return 2;
      if (r.statewide && statesOf(r).indexOf(st) !== -1) return 1;
      return 0;
    }
    return 1;
  }

  function link(url, text, name) {
    const esc = RTR.esc;
    return '<a href="' + esc(url) + '"' + (/^https?:/.test(url) ? ' target="_blank" rel="noopener"' : "") + ">" + esc(text) + (name ? '<span class="visually-hidden"> for ' + esc(name) + "</span>" : "") + "</a>";
  }

  function card(r) {
    const esc = RTR.esc;
    const cats = r.categories.map((c) => { const k = DATA.categories.find((x) => x.id === c); return '<span class="badge">' + esc(k ? k.label : c) + "</span>"; }).join("");
    const addr = [r.address, r.town, r.state].filter(Boolean).join(", ") + (r.zip ? " " + r.zip : "");
    const meta = [];
    if (addr.trim()) meta.push("<li><strong>Where:</strong> " + esc(addr) + "</li>");
    else if (r.statewide) meta.push("<li><strong>Where:</strong> " + (statesOf(r).length > 1 ? "Available in MA &amp; NH" : "Statewide (" + esc(statesOf(r).join(" & ")) + ")") + "</li>");
    if (r.other_locations && r.other_locations.length) meta.push("<li><strong>Also at:</strong> " + r.other_locations.map(esc).join("; ") + "</li>");
    const phones = r.phones && r.phones.length ? r.phones : (r.phone ? [{ number: r.phone }] : []);
    if (phones.length) meta.push("<li><strong>Phone:</strong> " + phones.map((p) => '<a href="' + RTR.telHref(p.number) + '">' + esc(p.number) + "</a>" + (p.description && p.description !== "main" ? " (" + esc(p.description) + ")" : "")).join(" · ") + "</li>");
    if (r.email) meta.push('<li><strong>Email:</strong> <a href="mailto:' + esc(r.email) + '">' + esc(r.email) + "</a></li>");
    if (r.hours || r.call_to_confirm) meta.push("<li><strong>Hours:</strong> " + esc(r.hours || "") + (r.call_to_confirm ? ' <span class="badge maybe">Call to confirm hours</span>' : "") + "</li>");
    if (r.eligibility) meta.push("<li><strong>Who can use it:</strong> " + esc(r.eligibility) + "</li>");
    if (r.fees) meta.push("<li><strong>Cost:</strong> " + esc(r.fees) + "</li>");
    if (r.website) meta.push("<li>" + link(r.website, "Website", r.name) + "</li>");
    const src = (r.source_urls || []).map((u, i) => link(u, "source " + (i + 1))).join(", ");
    const v = r.verified === false ? '<span class="badge sample">Not yet verified</span>' :
      '<p class="hint">' + (r.last_verified ? "Checked " + esc(r.last_verified) : "") + (src ? " · " + src : "") + "</p>";
    return '<article class="card"><h3>' + esc(r.name) + "</h3>" + (r.service ? '<p class="hint" style="margin-top:-.5rem">' + esc(r.service) + "</p>" : "") +
      "<div>" + cats + "</div><p>" + esc(r.description || "") + '</p><ul class="resource-meta">' + meta.join("") + "</ul>" + v + "</article>";
  }

  function apply() {
    const zip = document.getElementById("f-zip").value.trim();
    const town = document.getElementById("f-town").value;
    const q = document.getElementById("f-q").value.trim().toLowerCase();
    const isCrisis = (r) => (r.categories.indexOf("crisis") !== -1 ? 1 : 0);
    const list = DATA.resources
      .map((r) => ({ r, score: matchesPlace(r, zip, town) }))
      .filter((x) => x.score > 0)
      .filter((x) => !selected.size || x.r.categories.some((c) => selected.has(c)))
      .filter((x) => !q || [x.r.name, x.r.service, x.r.description, x.r.town].join(" ").toLowerCase().indexOf(q) !== -1)
      .sort((a, b) => isCrisis(b.r) - isCrisis(a.r) || b.score - a.score || a.r.name.localeCompare(b.r.name));
    const zipNote = zip && zip.length === 5 && !zipState(zip) ? " (We currently list resources for Massachusetts and New Hampshire zip codes.)" : "";
    document.getElementById("res-count").textContent = list.length + (list.length === 1 ? " resource" : " resources") + " found." + zipNote;
    document.getElementById("res-list").innerHTML = list.map((x) => card(x.r)).join("") || "<p>No matches. Try clearing a filter, or dial 211 for help.</p>";
  }

  document.addEventListener("DOMContentLoaded", async function () {
    try { DATA = await RTR.fetchJSON("data/resources.json"); }
    catch (e) { document.getElementById("res-count").textContent = "Sorry, resources could not load. Please refresh."; return; }
    const townSel = document.getElementById("f-town");
    DATA.towns.forEach((t) => { const o = document.createElement("option"); o.value = t.name; o.textContent = t.name + ", " + t.state; townSel.appendChild(o); });
    const row = document.getElementById("f-cats");
    DATA.categories.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = c.label; b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => { if (selected.has(c.id)) selected.delete(c.id); else selected.add(c.id); b.setAttribute("aria-pressed", selected.has(c.id) ? "true" : "false"); apply(); });
      row.appendChild(b);
    });
    const params = new URLSearchParams(location.search);
    if (params.get("zip")) document.getElementById("f-zip").value = params.get("zip");
    if (params.get("town")) townSel.value = params.get("town");
    if (params.get("category")) { const c = params.get("category"); selected.add(c); row.querySelectorAll(".chip").forEach((b, i) => { if (DATA.categories[i].id === c) b.setAttribute("aria-pressed", "true"); }); }
    ["f-zip", "f-q"].forEach((id) => document.getElementById(id).addEventListener("input", apply));
    townSel.addEventListener("change", apply);
    document.getElementById("f-clear").addEventListener("click", () => {
      document.getElementById("f-zip").value = ""; document.getElementById("f-q").value = ""; townSel.value = "";
      selected.clear(); row.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", "false")); apply();
    });
    apply();
  });
})();
