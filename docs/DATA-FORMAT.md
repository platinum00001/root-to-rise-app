# Root to Rise — Data format (v1)

All site content lives in plain JSON files in `data/`. Editors can change most of it in `/admin`
(Sveltia CMS); developers can edit the files directly. Validate JSON before committing:
`python3 -m json.tool data/FILE.json > /dev/null`.

| File | Used by | Edited via |
|---|---|---|
| `data/eligibility-rules.json` | Benefits checker (with `js/screen.js`) | Resource Navigator build scripts (not in /admin, see §1) |
| `data/eligibility-extras.json` | Extra questions + "other places to check" pointers | /admin → Eligibility checker |
| `data/resources.json` | Resource finder | /admin → Resources, or `tools/import_navigator_resources.py` |
| `data/offers.json` | Partner offers page | /admin → Partner offers |
| `data/site.json` | Page text | /admin → Page text |

**Data source credit:** the eligibility rules, `screen.js` screener, and most resource entries come from the
**Root to Rise Resource Navigator** dataset (generated and verified 2026-09-26; every income threshold carries
its official `source_url` and `as_of` date). A handful of resource entries were verified separately by the
web team (`data_source: "web-team"`).

---

## 1. `data/eligibility-rules.json` + `js/screen.js` (the screener)

Schema version 1.0.0, from the Resource Navigator. Top-level keys:

| Key | Meaning |
|---|---|
| `disclaimer` | `title`, `text[]` (shown before **and** after results), `privacy_requirements_for_web_app` (health-field list, storage rules) |
| `result_wording` | The only three result states: `may_qualify`, `might_not_qualify_income`, `check_with_program`. The screener **never** says a definite "no". |
| `federal_poverty_guidelines_2026` | HHS table by household size |
| `questions[]` | The form is built from this list: `id`, `text`, `type` (`enum`, `integer`, `number`, `boolean`, `multi_enum`), `options`, `option_labels`, `required`, `sensitive`, `health_data`, `help` |
| `programs[]` | 12 MA/NH programs: `id`, `name`, `category`, `states`, `rules` (income tables), `next_steps` (apply online/phone, local office by region `cape_cod`/`nashua`, application help, documents), `sources[]` |
| `unverified_or_null_figures` | Figures deliberately left null — don't fill them without an official source |

Income tables: `unit` (`USD_per_month` / `USD_per_year`), `by_household_size`, `each_additional_person`
(null = no extrapolation → "check with program"), `basis`, `effective`, `as_of`, `source_url`.

`js/screen.js` is a dependency-free function: `RootToRiseScreener.screen(answers, rules)` returns
`[{ program_id, name, category, result, message, reasons[], limit_used{value,unit,basis,as_of,source_url}, next_steps }]`.
Note: `limit_used.value` is always the **monthly** figure the answer was compared with (yearly tables are
divided by 12), so the page shows it per month.

**Tests:** `node tests/screen.test.js` (11 cases, must all pass after any rules change).

### Updating eligibility rules
The income tables are **not** exposed in /admin, so a CMS save can never drop a table or its source.
Update them in the Navigator's source (`src/build_eligibility.py` in the Navigator data package), rebuild,
copy the new `eligibility-rules.json` (and `screen.js` if changed) into `data/` and `js/`, run the tests,
and commit. Always change the number, its `as_of`/`effective` date, and its `source_url` together.
Schedule (from the Navigator): SNAP each Oct 1; HHS poverty guidelines mid-January, then MA SNAP (~Feb 1),
MassHealth (Mar 1), NH Medicaid (~Mar); WIC (effective Jul 1); MA HEAP / NH Fuel Assistance (~May–Jun).

### Privacy rules the page follows
- Answers are kept **in memory only** by default and never sent to a server; no analytics.
- "Remember my answers on this device" (unchecked by default) stores them in this browser's `localStorage`
  (`rtr-screener-answers`). "Clear my answers" wipes the form and that storage.
- A signed-in member can save to Supabase **only** by ticking a separate, unchecked "Save my answers" box.
  Health fields (`has_elderly_or_disabled_member`, `has_disability`, `is_pregnant`, `expected_babies`,
  `is_postpartum_or_breastfeeding`, `on_medicare`, plus `in_recovery` from the extras) are removed unless a
  second, separate box is ticked. Saved rows can be deleted one at a time or all at once in My account.

## 2. `data/eligibility-extras.json`

Simple pointers shown under the main results. They never estimate eligibility (always shown as
"Check with the program").

```json
{
  "status_label": "Other places to check (not income-screened)",
  "questions": [ { "id": "veteran", "text": "Are you a veteran?", "type": "boolean", "health_data": false } ],
  "programs": [ {
    "id": "va_health", "name": "VA health care", "states": ["MA","NH"],
    "show_if": [ { "field": "veteran", "op": "eq", "value": true } ],
    "show_if_any": [],
    "message": "Plain-language pointer…",
    "links": [ { "label": "VA eligibility", "url": "https://www.va.gov/health-care/eligibility/" } ]
  } ]
}
```
Condition `field` can be any question id from either file (e.g. `state`, `age`, `has_disability`,
`insurance`, `veteran`, `in_recovery`). `op`: `eq`, `in` (list or comma-separated), `gte`, `lte`.

## 3. `data/resources.json`

A flat list the finder can filter quickly. It is generated from the Navigator's HSDS-style directory
(organizations → services → locations → phones) by:

```bash
python3 tools/import_navigator_resources.py PATH/TO/navigator/resources.json
```
The importer keeps any `web-team`/`editor` entries that the Navigator doesn't already list.

```json
{
  "version": "2026-09-26", "last_updated": "2026-09-26", "note": "…",
  "regions": [ { "id": "cape_cod", "label": "Cape Cod (Falmouth / Mashpee, MA)", "zip_prefixes": ["025","026"] },
               { "id": "nashua", "label": "Greater Nashua, NH", "zip_prefixes": ["030","031"] } ],
  "categories": [ { "id": "food", "label": "Food" } ],
  "towns": [ { "name": "Mashpee", "state": "MA", "region": "cape_cod", "zips": ["02649"] } ],
  "resources": [ {
    "id": "svc-cc-falmouth-service-center",
    "name": "Falmouth Service Center",
    "service": "Food pantry (client-choice) and fuel-assistance application help",
    "categories": ["benefits", "food", "fuel"],
    "description": "…",
    "region": "cape_cod", "regions": ["cape_cod"], "states": ["MA"], "statewide": false,
    "address": "611 Gifford Street", "town": "Falmouth", "state": "MA", "zip": "02540",
    "other_locations": ["…"],
    "phone": "508-548-2794", "phones": [ { "number": "508-548-2794", "description": "main" } ],
    "website": "https://www.falmouthservicecenter.org",
    "hours": "Tue 10am–12pm …", "call_to_confirm": false,
    "eligibility": "Open to Cape Cod residents; call for details", "fees": "Free",
    "verified": true, "last_verified": "2026-09-26",
    "source_urls": ["https://…"], "verification_method": "own_website",
    "data_source": "navigator"
  } ]
}
```
Rules: **only include fields you have verified** — leave a field out rather than guessing.
`call_to_confirm: true` shows a "Call to confirm hours" badge. Category ids: `crisis`, `treatment`,
`peer-support`, `harm-reduction`, `mental-health`, `housing`, `food`, `benefits`, `fuel`, `health`,
`transportation`, `jobs`, `legal`, `info`.

Navigator taxonomy → site category: `food.*`→food · `recovery.treatment_access`→treatment ·
`recovery.harm_reduction`→harm-reduction · other `recovery.*`→peer-support · `housing.*`→housing ·
`benefits.legal_aid`→legal · other `benefits.*` and `phones`→benefits · `fuel_assistance`→fuel ·
`crisis.mental_health`→crisis + mental-health · `crisis.*`→crisis · `health.*`→health ·
`transportation` · `information_referral`→info.

### Search logic
- **Zip:** exact zip match first, then same town, then anything in the same region (by zip prefix), then
  statewide/national services for that state. Crisis services are always listed first.
- **Town:** services in that town, then the rest of its region, then statewide services.
- **Category chips** (any selected) and a **keyword** box narrow results further. `?zip=`, `?town=` and
  `?category=` URL parameters pre-fill the filters.

## 4. `data/offers.json`

```json
{ "version": "v1", "offers": [ {
  "id": "sample-lifeline-free-phone",
  "sample": true,
  "title": "…", "partner": "…", "summary": "…", "who_qualifies": "…",
  "program_ids": ["lifeline"], "states": ["MA","NH"],
  "link": "https://…", "link_label": "…", "expires": ""
} ] }
```
`sample: true` shows a “Sample offer” badge. `program_ids` link an offer to checker programs (for future “offers you qualify for” matching).

## 5. `data/site.json`
Keys map to `data-text="section.key"` attributes in the HTML (e.g. `home.hero_title`). If a key is missing or blank the built-in HTML text is used.

---

---

## Dropping in updated Navigator data
1. Eligibility: copy `eligibility-rules.json` → `data/`, `screen.js` → `js/`, run `node tests/screen.test.js`.
2. Resources: `python3 tools/import_navigator_resources.py NEW/resources.json`, then spot-check the finder.
3. Validate JSON, commit/push (or save in /admin) — Vercel redeploys automatically.
