"""Import the Resource Navigator's HSDS-style resources.json into the site's flat data/resources.json.

Usage (from the repo root):
    python3 tools/import_navigator_resources.py PATH/TO/navigator/resources.json

- Every Navigator service becomes one resource card (data_source: "navigator").
- Entries already in data/resources.json with data_source "web-team" or "editor" are kept
  unless the Navigator now lists the same organization (same website domain or name).
- Towns for the town filter are rebuilt from the service locations.
"""
import json, re, sys
T = json.load(open(sys.argv[1]))
_cur = json.load(open("data/resources.json"))
MINE = {"towns": [t for t in _cur["towns"]], "resources": [r for r in _cur["resources"] if r.get("data_source") in ("web-team", "editor")]}
CATS = [("crisis","Crisis & urgent help"),("treatment","Treatment & detox"),("peer-support","Peer support & meetings"),
 ("harm-reduction","Harm reduction / Narcan"),("mental-health","Mental health"),("housing","Housing & shelter"),
 ("food","Food"),("benefits","Benefits & phones"),("fuel","Heat & utility help"),("health","Health care"),
 ("transportation","Transportation"),("jobs","Jobs"),("legal","Legal help"),("info","211 & information")]
def mapterm(t):
    if t.startswith("food"): return ["food"]
    if t == "recovery.treatment_access": return ["treatment"]
    if t == "recovery.harm_reduction": return ["harm-reduction"]
    if t.startswith("recovery"): return ["peer-support"]
    if t.startswith("housing"): return ["housing"]
    if t == "benefits.legal_aid": return ["legal"]
    if t.startswith("benefits"): return ["benefits"]
    if t == "fuel_assistance": return ["fuel"]
    if t == "phones": return ["benefits"]
    if t == "crisis.mental_health": return ["crisis","mental-health"]
    if t.startswith("crisis"): return ["crisis"]
    if t == "transportation": return ["transportation"]
    if t.startswith("health"): return ["health"]
    if t == "information_referral": return ["info"]
    return []
REG = {"cape_cod":(["cape_cod"],["MA"],False),"nashua":(["nashua"],["NH"],False),
       "statewide_ma":(["cape_cod"],["MA"],True),"statewide_nh":(["nashua"],["NH"],True),"national":(["cape_cod","nashua"],["MA","NH"],True)}
orgs = {o["id"]:o for o in T["organizations"]}; locs = {l["id"]:l for l in T["locations"]}
out = []
for s in T["services"]:
    cats = []
    for t in s["taxonomy_term_ids"] + s["categories"]:
        for c in mapterm(t):
            if c not in cats: cats.append(c)
    regs, states, statewide = REG[s["region"]]
    ls = [locs[i] for i in s["location_ids"] if i in locs]
    org = orgs.get(s["organization_id"], {})
    r = {"id": s["id"], "name": org.get("name") or s["name"], "service": s["name"] if org.get("name") and org.get("name") != s["name"] else None,
         "categories": cats, "description": s.get("description"), "region": s["region"], "regions": regs, "states": states, "statewide": statewide}
    if ls:
        l = ls[0]; r.update({"address": l.get("address_1"), "town": l.get("city"), "state": l.get("state_province"), "zip": l.get("postal_code")})
        if len(ls) > 1: r["other_locations"] = [", ".join(x for x in [o.get("address_1"), o.get("city"), o.get("state_province")] if x) for o in ls[1:]]
    ph = s.get("phones") or []
    if ph: r["phone"] = ph[0]["number"]; r["phones"] = ph
    r.update({"website": s.get("url") or org.get("url"), "hours": s.get("hours_text"), "call_to_confirm": s.get("hours_flag") == "call to confirm",
              "eligibility": s.get("eligibility_description"), "fees": s.get("fees_description"),
              "source_urls": s.get("source_urls") or [], "verification_method": s.get("verification_method"),
              "verified": True, "last_verified": s.get("last_verified"), "data_source": "navigator"})
    out.append({k:v for k,v in r.items() if v not in (None, "", [])} | {"verified": True, "statewide": statewide})
def dom(u): 
    m = re.match(r"https?://(www\.)?([^/]+)", u or ""); return m.group(2).lower() if m else None
def norm(n): return re.sub(r"[^a-z0-9]","",n.lower())
seen_d = {dom(r.get("website")) for r in out} - {None}; seen_n = {norm(r["name"]) for r in out}
CATMAP = {"sober-housing":"housing"}
added = []
for m in MINE["resources"]:
    if dom(m.get("website")) in seen_d or norm(m["name"]) in seen_n: continue
    m = dict(m); m["categories"] = [CATMAP.get(c,c) for c in m["categories"]]
    st = m.get("states") or ([m["state"]] if m.get("state") else [])
    m["states"] = st
    if not m.get("regions"): m["regions"] = (["cape_cod"] if "MA" in st else []) + (["nashua"] if "NH" in st else [])
    if m.get("source_url"): m["source_urls"] = [m.pop("source_url")]
    m.setdefault("data_source", "web-team"); m.setdefault("statewide", False)
    out.append(m); added.append(m["id"])
# towns: from locations + existing
towns = {(t["name"], t["state"]): set(t["zips"]) for t in MINE["towns"]}
for r in out:
    if r.get("town") and r.get("state") in ("MA","NH"):
        towns.setdefault((r["town"], r["state"]), set())
        if r.get("zip"): towns[(r["town"], r["state"])].add(r["zip"])
def region_of(state, zips, name):
    if state == "MA": return "cape_cod"
    return "nashua"
towns = {k:v for k,v in towns.items() if k not in {("Boston","MA"),("Concord","NH")}}
tl = [{"name":n,"state":s,"region":region_of(s,z,n),"zips":sorted(z)} for (n,s),z in sorted(towns.items(), key=lambda k:(k[0][1],k[0][0]))]
doc = {"version": "2026-09-26", "last_updated": "2026-09-26",
 "note": "Verified 2026-09-26. Most entries come from the Root to Rise Resource Navigator dataset (HSDS-style, see docs/DATA-FORMAT.md); a few were verified by the web team. Hours change often — call to confirm.",
 "regions": [{"id":"cape_cod","label":"Cape Cod (Falmouth / Mashpee, MA)","zip_prefixes":["025","026"]},{"id":"nashua","label":"Greater Nashua, NH","zip_prefixes":["030","031"]}],
 "categories": [{"id":i,"label":l} for i,l in CATS], "towns": tl, "resources": out}
json.dump(doc, open("data/resources.json","w"), indent=1, ensure_ascii=False)
from collections import Counter
print(len(out), "added from web team:", added)
print(Counter(c for r in out for c in r["categories"])); print(Counter(x for r in out for x in r["regions"]))
print([ (t["name"],t["state"]) for t in tl])
