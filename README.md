# Root to Rise v1

A calm, accessible recovery-community website for **Inspiration Is Everywhere / Root to Rise Recovery Cafe**, serving **Falmouth & Mashpee, MA** and **Nashua, NH**.

- Contact: roottorisema@gmail.com · 603-721-2088
- Planned live site: https://root-to-rise.vercel.app (Vercel — not yet deployed, see STATUS below) · Content editor: `/admin`
- Planned repo: https://github.com/platinum00001/root-to-rise (not yet created)

## What's in it
| Page | What it does |
|---|---|
| `index.html` | Mission, how the site helps, service areas |
| `eligibility.html` | Private benefits "may qualify" screener for 12 MA/NH programs (runs in the browser via `js/screen.js`). Shows the official source and "as of" date for every income limit. Answers stay in the browser; members can *choose* to save them. |
| `resources.html` | Resource finder — filter by zip, town, category, keyword |
| `offers.html` | Partner offers (one **sample** Lifeline offer) + opt-in notification choice (never pre-checked) |
| `account.html` | Optional member account (Supabase email/password): profile, saved answers, notification status |
| `unsubscribe.html` | One-click unsubscribe (`?token=…`) |
| `privacy.html` | Privacy policy — health data is never sold or shared for marketing |
| `admin/` | Sveltia CMS for non-technical editors |

Crisis resources (988 call/text, SAMHSA 1-800-662-4357, 911) are in the header **and** footer of every page and work without JavaScript. No tracking or analytics scripts. **This build never sends email** — it only stores consent.

## Tech
Plain HTML/CSS/vanilla JS. **No build step.** Deploys to any static host.

```
index.html  eligibility.html  resources.html  offers.html  account.html  unsubscribe.html  privacy.html
config.js            ← Supabase URL + anon key (public). Empty = "accounts coming soon" mode
css/styles.css
js/                  ← screen.js (screener engine), common.js, eligibility.js, resources.js, offers.js, account.js, unsubscribe.js, supabase-client.js
data/                ← eligibility-rules.json, eligibility-extras.json, resources.json, offers.json, site.json   (see docs/DATA-FORMAT.md)
tests/screen.test.js ← screener tests: node tests/screen.test.js
tools/               ← import_navigator_resources.py (HSDS → data/resources.json)
admin/               ← Sveltia CMS (index.html + config.yml)
supabase/schema.sql  ← tables + Row Level Security
docs/                ← DATA-FORMAT.md, DEPLOY-GUIDE.md
```

## Run locally
```bash
cd root-to-rise
python3 -m http.server 8080
# open http://localhost:8080
```
(Opening the HTML file directly with `file://` won't load the JSON data — use a local server.)

## Edit content without code (/admin)
1. Go to `https://<your-site>/admin/` (e.g. https://root-to-rise.vercel.app/admin/).
2. Sign in with GitHub (you need write access to the `root-to-rise` repo — ask the owner to add you as a collaborator). Until the OAuth helper is set up, choose **"Sign in with token"** and paste a GitHub fine-grained personal access token with *Contents: read & write* on this repo. See `docs/DEPLOY-GUIDE.md`.
3. Pick a collection: **Resources**, **Eligibility checker** (extra questions and pointers), **Partner offers**, or **Page text**. Income limits are updated through the Navigator data files instead, so that every number keeps its official source (see `docs/DATA-FORMAT.md` §1). Edit and press **Save/Publish**.
4. Sveltia commits the change to GitHub; Vercel redeploys automatically in about a minute.

Editing tips: only add phone numbers and addresses you have verified; fill in *Last verified*.

## Turn on member accounts
Create a Supabase project, run `supabase/schema.sql`, and put the project URL + **anon** key in `config.js`. Full steps: `docs/DEPLOY-GUIDE.md`. Never put a service-role key in this repo.

## Data status (v1) and credits
- **Data source:** eligibility rules, the `screen.js` screener and its tests, and most resource entries come from the **Root to Rise Resource Navigator** dataset for Inspiration Is Everywhere, Inc. (generated and verified **2026-09-26**). Main sources include HHS 2026 poverty guidelines, USDA FNS, MA DTA, MassHealth / MLRI, NH DHHS, the FCC Lifeline program, MA HEAP / SSCAC, NH Fuel Assistance / CAPHR, the WIC Federal Register notice, the Barnstable County Food Access Directory, MA Peer Recovery Support Centers, and the Greater Nashua Continuum of Care 2025 Resource Toolkit. Each program and each resource links to its own sources.
- **Eligibility rules:** verified thresholds (12 MA/NH programs) with a source and "as of" date for each. Results use "may qualify" wording only and are never a decision. Update schedule: `docs/DATA-FORMAT.md` §1.
- **Eligibility extras** (VA, recovery support, Health Connector/HealthCare.gov, SSI pointers): simple links written by the web team. They are not income-screened.
- **Resources:** 84 entries (Navigator: 78 services; web team: 6 more, e.g. MassHire, South Coastal Counties Legal Services, MASH, NH Works). Checked 2026-09-26. Many entries show "Call to confirm hours". Fields that could not be verified are left out.
- **Offers:** one **sample** offer (Lifeline free phone), clearly labeled.

## License / ownership
© Inspiration Is Everywhere / Root to Rise Recovery Cafe. Content is informational only — not medical, legal, or benefits advice.

## STATUS (Sept 26, 2026)
- Code is complete and tested locally (`python3 -m http.server`).
- **Not yet published:** the GitHub connector could not create the repo (`403 Resource not accessible by integration`), and the Vercel inline deployment was held for manual review. Follow `docs/DEPLOY-GUIDE.md` §1–2 (≈10 minutes) to publish, or re-run the automated steps once access is granted.
- **Supabase not configured yet** — `config.js` has empty placeholders, so accounts/opt-in show "Accounts coming soon".
