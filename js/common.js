/* Shared helpers: nav toggle, editable page text, small utilities. */
(function () {
  const RTR = (window.RTR = window.RTR || {});
  RTR.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  };
  RTR.fetchJSON = async function (path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error("Could not load " + path);
    return res.json();
  };
  RTR.telHref = function (phone) {
    const digits = String(phone).split(/ext|x/i)[0].replace(/[^0-9]/g, "");
    return digits ? "tel:" + (digits.length === 10 ? "+1" + digits : digits) : "";
  };
  function get(obj, path) { return path.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj); }
  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.querySelector(".nav-toggle");
    const nav = document.getElementById("site-nav");
    if (btn && nav) {
      btn.addEventListener("click", function () {
        const open = nav.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    // Page text editable in /admin (data/site.json). Static HTML is the fallback.
    const nodes = document.querySelectorAll("[data-text]");
    if (nodes.length) {
      RTR.fetchJSON("data/site.json").then(function (site) {
        nodes.forEach(function (n) {
          const v = get(site, n.getAttribute("data-text"));
          if (typeof v === "string" && v.trim()) n.textContent = v;
        });
      }).catch(function () { /* keep fallback text */ });
    }
  });
})();
